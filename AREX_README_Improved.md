::: {align="center"}
# AREX

### Trade with a process --- not a guess.

**Your personal trading workspace for clearer decisions, disciplined
risk, and meaningful reviews.**

[**Open AREX ↗**](https://amirghasemian22.github.io/AREX/) · [GitHub
Repository](https://github.com/Amirghasemian22/AREX) · [Report a
Bug](https://github.com/Amirghasemian22/AREX/issues)

`<br>`{=html}

![Platform](https://img.shields.io/badge/Platform-Web%20App%20%7C%20PWA-243B59?style=for-the-badge)
![Focus](https://img.shields.io/badge/Focus-Trading%20Process-16A085?style=for-the-badge)
![Status](https://img.shields.io/badge/Status-Active%20Development-orange?style=for-the-badge)
:::

------------------------------------------------------------------------

## The goal: make every trade teach you something

A trading day is more than entries and exits. It is a series of
decisions: preparing for the session, checking risk, following a
strategy, managing emotions, and reviewing what happened.

**AREX brings those steps into one workspace.** Use it to document your
process, keep your rules visible, understand your results, and identify
what to improve next.

> AREX is a trading-management and decision-support tool---not a signal
> service, broker, or promise of profit.

## Your trading workflow, in one place

```{=html}
<table>
```
```{=html}
<tr>
```
```{=html}
<td width="50%" valign="top">
```
### 📊 See the bigger picture

Review your recorded activity, performance summaries, daily priorities,
and items that need attention from the dashboard.

### 📝 Keep a useful trade journal

Record the setup, direction, entry, exit, stop-loss, take-profit,
position size, outcome, notes, and execution quality---where supported
by the current build.

### 🛡️ Plan risk before entry

Work with account values, risk percentage, monetary risk, stop distance,
position sizing, risk-to-reward, and configured daily limits.

```{=html}
</td>
```
```{=html}
<td width="50%" valign="top">
```
### 🧭 Follow your process

Organize your daily routine and compare proposed trades with the
strategy rules and conditions you have defined.

### 🧠 Learn from your decisions

Record emotions, hesitation, impulsive actions, rule violations, and
post-trade reflections to make recurring patterns easier to spot.

### 🤖 Get structured decision support

The AI-assisted workflow can help explain which defined conditions are
met, what is missing, and why a reliable evaluation may not yet be
possible---when the relevant feature and provider are configured.

```{=html}
</td>
```
```{=html}
</tr>
```
```{=html}
<tr>
```
```{=html}
<td width="50%" valign="top">
```
### 📈 Review performance, not just outcomes

Explore available statistics and visualizations, such as win/loss
results, P&L, R-multiples, equity trends, and comparisons by setup,
symbol, or session.

### 🗓️ Prepare around the market

Use the economic-calendar and market-session areas to organize your
routine. Verify important event times and session hours with current,
reliable sources.

```{=html}
</td>
```
```{=html}
<td width="50%" valign="top">
```
### 🏆 Keep goals and limits visible

Organize personal objectives and track configured prop-firm challenge
rules. Always verify the firm's current drawdown and evaluation
requirements.

### 💾 Keep control of your records

Use the data export, import, backup, and restore options available in
your build. Optional cloud features depend on correct configuration and
successful connection.

```{=html}
</td>
```
```{=html}
</tr>
```
```{=html}
</table>
```
## A simple way to use AREX

**01 --- Prepare**\
Set your priorities, review the market calendar and sessions, and check
the rules that matter for the day.

**02 --- Check risk**\
Confirm account values, risk limits, stop-loss, and position size before
relying on a calculation.

**03 --- Record**\
Document the trade and the reasoning behind it---not only the final
result.

**04 --- Review**\
Compare the trade with your strategy, note emotional or execution
mistakes, and capture what you learned.

**05 --- Improve**\
Use your journal and available analytics to find repeated patterns and
choose one specific improvement for the next session.

The aim is not to take more trades. It is to make your process more
deliberate and your reviews more useful.

## Workspace areas

AREX is organized around these main workflows; exact labels and
availability can vary by build.

  -----------------------------------------------------------------------
  Area                                What it helps you do
  ----------------------------------- -----------------------------------
  Dashboard                           Review activity, priorities, and
                                      available performance information

  Daily Roadmap                       Organize the daily routine and
                                      pre-trade checks

  Trade Journal                       Record and review trading decisions

  AI Trading Assistant                Evaluate defined conditions and
                                      surface missing information

  Risk Management                     Review risk, position sizing, and
                                      configured limits

  Strategy & Rules                    Maintain strategy conditions and
                                      execution rules

  Performance Analytics               Explore recorded results and
                                      trading behavior

  Psychology Journal                  Document emotions and behavioral
                                      patterns

  Economic Calendar                   Review scheduled events from the
                                      configured source

  Market Sessions                     Plan around market hours and time
                                      zones

  Prop-Firm Challenge                 Track configured objectives and
                                      risk limits

  Settings                            Manage available preferences and
                                      integrations
  -----------------------------------------------------------------------

## Honest by design

A clear interface should never make uncertain information look certain.

-   **No guaranteed signals or returns.** AREX supports your decision
    process; it cannot guarantee a trade outcome.
-   **Your rules matter.** Undefined or conflicting strategy conditions
    should be clarified rather than silently treated as confirmed.
-   **Missing data is still missing.** A visible calendar, chart, or
    connection control does not by itself prove a live provider is
    connected.
-   **Calculations need correct inputs.** Instrument specifications,
    tick value, contract size, lot size, and account currency can affect
    risk calculations.
-   **External services need testing.** Authentication, cloud backup, AI
    providers, notifications, and market data depend on configuration,
    network access, and deployment.
-   **A successful test suite is not a production guarantee.** Test the
    actual deployed site and devices before relying on a workflow.

## Open AREX

**Try the deployed application:**\
[amirghasemian22.github.io/AREX](https://amirghasemian22.github.io/AREX/)

The public site may not always match the newest local or testing build.
Check the version shown by the running app and the repository's latest
release or commit before reporting a version-specific issue.

## Run locally

### What you need

-   A modern web browser
-   Python 3 or another local HTTP server
-   Git (optional, if you download the repository ZIP)

### 1. Get the project

``` bash
git clone https://github.com/Amirghasemian22/AREX.git
cd AREX
```

Or download the repository ZIP and extract it, keeping the directory
structure intact.

### 2. Start a local server

``` bash
python -m http.server 8000
```

On Windows, if `python` is not recognized:

``` powershell
py -m http.server 8000
```

### 3. Open it

Visit:

``` text
http://localhost:8000/
```

Keep the project folders in place. The app expects its JavaScript,
styles, assets, and configuration files at their defined paths.

### About the local test entry

Some testing builds may include a temporary `?arex-test=1` entry for
local UI testing. **It is not production authentication.** Never publish
a build that exposes a test-login bypass on a public site. Before
deployment, verify that this path is disabled or excluded from the
production build.

A local launch does not verify OAuth, cloud sync, external APIs, or
real-device PWA behavior. Authentication providers may also require
`localhost` or the deployed domain to be configured as an authorized
origin.

## Data, backups, and privacy

AREX may use browser storage for supported workflows. Depending on the
build, it may also provide JSON export/import, backup and restore, or
optional cloud integrations.

-   Export important records regularly.
-   Keep a backup somewhere separate from the browser and device you
    normally use.
-   Test restoring a backup before you need it.
-   Do not assume data has synced until the application confirms
    success.
-   Clearing browser data, changing browsers, or switching devices may
    affect access to locally stored records.
-   Keep private strategy files private unless you have deliberately
    reviewed and approved their publication.

### Security essentials

-   Never commit private API keys, access tokens, service-account
    credentials, or other secrets.
-   Protect cloud databases with appropriate authentication and
    restrictive security rules.
-   Do not rely on frontend code to protect server-side secrets.
-   Firebase client configuration values are not a replacement for
    proper authorization and API restrictions.
-   Treat test-login functionality as development-only.

## Technology

AREX is a browser-based application built with standard web
technologies.

-   **Core:** HTML, CSS, and JavaScript
-   **Browser capabilities:** IndexedDB/browser storage, Service
    Workers, Web App Manifest, File APIs, and Web Notifications where
    supported
-   **Hosting:** GitHub Pages for static web hosting
-   **Optional integrations:** Google authentication, Google Drive
    backup, cloud services, economic-calendar or market-data sources,
    and AI providers
-   **Optional backend:** A separately deployed backend or Worker for
    capabilities that cannot safely run entirely in the browser

The availability of each integration depends on the current build and
its configuration.

## Test before release

If the repository includes the relevant scripts, run them from the
project root:

``` bash
node --test tests/*.test.js
node scripts/release-gate.js
```

Use the scripts present in the checked-out build as the source of truth.
Passing automated tests is valuable, but it does not prove that every
external integration works in production.

Before a public release, check:

-   [ ] Login and logout with the configured provider
-   [ ] Data separation between user accounts
-   [ ] Backup and restore using real test data
-   [ ] Backend/Worker behavior in the deployed environment
-   [ ] Calendar and market-data freshness
-   [ ] Notification permissions and delivery, if configured
-   [ ] Layout on actual Android and iOS devices
-   [ ] PWA installation, updates, and offline behavior
-   [ ] Removal or disabling of temporary test-login paths
-   [ ] No private credentials or unapproved strategy files in the
    public repository

## Project direction

AREX is being developed as a personal trading-management assistant---not
merely a course or a trade recorder. The long-term direction is to make
the trading process easier to follow, review, and improve while keeping
rules and data limitations explicit.

Potential areas for future improvement include richer strategy reports,
repeated-mistake detection, chart annotations, broker/platform imports,
comparisons by symbol or session, expanded strategy knowledge
management, and additional backup options. These are development
directions, not a claim that every item is already available.

## Contributing and feedback

Found a bug or have an idea?

-   [Open an issue](https://github.com/Amirghasemian22/AREX/issues)
-   [Browse the repository](https://github.com/Amirghasemian22/AREX)
-   Star the project if you find it useful.

Helpful bug reports include the app version, browser/device, steps to
reproduce, expected behavior, and what happened instead. **Do not
include passwords, access tokens, private account details, or
confidential strategy files.**

## About

Created and maintained by **Amir Ghasemian Moghadam**\
GitHub: [@Amirghasemian22](https://github.com/Amirghasemian22) ·
[LinkedIn](https://www.linkedin.com/in/amirghasemiian-ai-vision/)

## Financial disclaimer

AREX is a trading-management, journaling, and productivity tool. It is
not a broker, investment adviser, or financial institution, and it does
not guarantee profitable results or provide guaranteed trading signals.

Trading Forex, futures, CFDs, cryptocurrencies, and other financial
instruments involves substantial risk and may result in the loss of some
or all of your capital. You are responsible for your trading decisions,
risk management, and compliance with applicable laws and broker
requirements. Verify calculations, instrument specifications, and market
information before making trading decisions.

## License

See the repository's `LICENSE` file for the applicable terms. If no
license file is present, reuse and redistribution permissions may be
limited.
