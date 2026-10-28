//+------------------------------------------------------------------+
//| AREX_Exporter.mq5 — sends every CLOSED position to your AREX     |
//| Cloudflare Worker (POST /ingest). Template: compile and test it  |
//| on a DEMO account first.                                         |
//| Setup: MT5 > Tools > Options > Expert Advisors > "Allow WebRequest|
//| for listed URL" -> add your Worker origin (https://xxx.workers.dev)|
//+------------------------------------------------------------------+
#property copyright "AREX"
#property version   "1.00"
#property strict

input string InpWorkerUrl   = "https://YOUR-WORKER.workers.dev"; // origin only, no trailing slash
input string InpKey         = "";                                 // = AREX_INGEST_KEY secret on the Worker
input int    InpBackfillDays = 7;                                 // on start: send positions closed in the last N days (0 = off)

string Iso(const datetime t)
{
   string s = TimeToString(t, TIME_DATE | TIME_SECONDS);   // 2026.10.27 14:05:11
   StringReplace(s, ".", "-");
   StringReplace(s, " ", "T");
   return s;
}

bool SendPosition(const ulong posId)
{
   if(!HistorySelectByPosition(posId)) return false;
   int n = HistoryDealsTotal();
   double volIn = 0, pxIn = 0, volOut = 0, pxOut = 0, comm = 0, swap = 0, profit = 0;
   datetime tIn = 0, tOut = 0; string sym = ""; long type = -1; ulong ordIn = 0;
   for(int i = 0; i < n; i++)
   {
      ulong d = HistoryDealGetTicket(i);
      long  e = HistoryDealGetInteger(d, DEAL_ENTRY);
      long  k = HistoryDealGetInteger(d, DEAL_TYPE);
      if(k != DEAL_TYPE_BUY && k != DEAL_TYPE_SELL) continue;
      double v = HistoryDealGetDouble(d, DEAL_VOLUME), p = HistoryDealGetDouble(d, DEAL_PRICE);
      comm   += HistoryDealGetDouble(d, DEAL_COMMISSION);
      swap   += HistoryDealGetDouble(d, DEAL_SWAP);
      profit += HistoryDealGetDouble(d, DEAL_PROFIT);
      if(e == DEAL_ENTRY_IN)
      {
         if(tIn == 0) { tIn = (datetime)HistoryDealGetInteger(d, DEAL_TIME); type = k; sym = HistoryDealGetString(d, DEAL_SYMBOL); ordIn = (ulong)HistoryDealGetInteger(d, DEAL_ORDER); }
         pxIn += p * v; volIn += v;
      }
      else if(e == DEAL_ENTRY_OUT || e == DEAL_ENTRY_OUT_BY || e == DEAL_ENTRY_INOUT)
      {
         tOut = (datetime)HistoryDealGetInteger(d, DEAL_TIME);
         pxOut += p * v; volOut += v;
      }
   }
   if(volIn <= 0 || volOut <= 0) return false;            // still open
   double sl = 0, tp = 0;
   if(ordIn > 0) { sl = HistoryOrderGetDouble(ordIn, ORDER_SL); tp = HistoryOrderGetDouble(ordIn, ORDER_TP); }
   string json = StringFormat(
      "{\"ticket\":\"%I64u\",\"login\":\"%I64d\",\"symbol\":\"%s\",\"dir\":\"%s\",\"lots\":%.2f,\"entry\":%.5f,\"exit\":%.5f,\"sl\":%.5f,\"tp\":%.5f,"
      "\"openedAt\":\"%s\",\"closedAt\":\"%s\",\"commission\":%.2f,\"swap\":%.2f,\"gross\":%.2f}",
      posId, AccountInfoInteger(ACCOUNT_LOGIN), sym, (type == DEAL_TYPE_BUY ? "buy" : "sell"), volIn,
      pxIn / volIn, pxOut / volOut, sl, tp, Iso(tIn), Iso(tOut), comm, swap, profit);
   char post[], res[]; string rh;
   StringToCharArray(json, post, 0, StringLen(json));
   string headers = "Content-Type: application/json\r\nX-AREX-Key: " + InpKey + "\r\n";
   int code = WebRequest("POST", InpWorkerUrl + "/ingest", headers, 8000, post, res, rh);
   if(code != 200) PrintFormat("AREX: position %I64u not sent (HTTP %d, err %d)", posId, code, GetLastError());
   return code == 200;
}

int OnInit()
{
   if(StringLen(InpKey) < 8) Print("AREX: set InpKey to the AREX_INGEST_KEY secret.");
   if(InpBackfillDays > 0 && HistorySelect(TimeCurrent() - (datetime)InpBackfillDays * 86400, TimeCurrent()))
   {
      ulong seen[]; int total = HistoryDealsTotal();
      for(int i = 0; i < total; i++)
      {
         ulong d = HistoryDealGetTicket(i);
         long  e = HistoryDealGetInteger(d, DEAL_ENTRY);
         if(e != DEAL_ENTRY_OUT && e != DEAL_ENTRY_OUT_BY && e != DEAL_ENTRY_INOUT) continue;
         ulong pid = (ulong)HistoryDealGetInteger(d, DEAL_POSITION_ID);
         bool dup = false; for(int j = 0; j < ArraySize(seen); j++) if(seen[j] == pid) { dup = true; break; }
         if(dup) continue;
         ArrayResize(seen, ArraySize(seen) + 1); seen[ArraySize(seen) - 1] = pid;
         SendPosition(pid);
      }
   }
   return INIT_SUCCEEDED;
}

void OnTradeTransaction(const MqlTradeTransaction &trans, const MqlTradeRequest &request, const MqlTradeResult &result)
{
   if(trans.type != TRADE_TRANSACTION_DEAL_ADD) return;
   if(!HistoryDealSelect(trans.deal)) return;
   long e = HistoryDealGetInteger(trans.deal, DEAL_ENTRY);
   if(e == DEAL_ENTRY_OUT || e == DEAL_ENTRY_OUT_BY || e == DEAL_ENTRY_INOUT)
      SendPosition((ulong)HistoryDealGetInteger(trans.deal, DEAL_POSITION_ID));
}
