# AREX — Forex Trading Learning, Journal & Risk Management Workspace

<p align="center">
  <strong>A personal workspace for learning Forex, tracking trades, managing risk, and building trading discipline.</strong>
</p>

<p align="center">
  <a href="https://amirghasemian22.github.io/AREX/">🚀 Live Demo</a>
  ·
  <a href="https://github.com/Amirghasemian22/AREX">💻 GitHub Repository</a>
</p>

---

## 📌 About AREX

**AREX** started as a small personal planner for organizing a Forex learning journey.

Over time, it evolved into a complete browser-based workspace for traders who want to keep their **learning, trading journal, risk management, psychology, goals, reviews, and market events** in one place.

The current **v2.1** combines a structured Forex learning roadmap with practical tools for tracking and reviewing trading activity.

> AREX is a personal productivity and journaling tool. It does not provide financial advice, trading signals, or guaranteed trading results.

---

## ✨ Features

### 📚 Forex Learning Planner

* 78-session Forex learning roadmap
* 10-week learning schedule
* Session checklist
* Learning progress tracking
* Daily and weekly study planning
* Study-time tracking
* Spaced-review system
* Weekly learning goals

### 📈 Trading Journal

Record and review your trades with:

* Entry and exit information
* Position and risk information
* Trade setup
* R-multiple
* Win/loss statistics
* Trading history
* Performance summary
* Equity curve
* Setup-based performance analysis

### 🧮 Risk Management Calculator

Built-in tools for planning trade risk, including:

* Account balance
* Risk percentage
* Risk amount
* Entry price
* Stop-loss
* Take-profit
* Position sizing
* Risk visualization

### 🧠 Trading Psychology Journal

Track the psychological side of trading:

* Daily mood
* Trading discipline
* Emotional state
* Personal rules
* Goals
* Behavioral reviews

### 📅 Economic Calendar

Keep important market events visible while planning your trading routine.

AREX includes:

* Forex Factory economic calendar integration
* Event impact filtering
* Currency filtering
* Personal economic events
* Upcoming-event tracking

### 📊 Market & Trading Tools

* Fear & Greed indicator
* Forex market session timeline
* World clock
* Trading dashboard
* Daily performance overview

### 💾 Local-First Data Storage

Your personal trading data is stored locally in your browser using **IndexedDB**.

Normal usage does not require a backend server.

This means your:

* trades
* learning progress
* journal entries
* goals
* rules
* reviews

can remain on your own device.

### ☁️ Optional Google Drive Backup

AREX can optionally synchronize backups with Google Drive.

You can:

* connect Google Drive
* create backups
* restore previous backups
* keep multiple backup versions
* resolve backup conflicts

### 📦 Backup & Restore

Export your AREX data as a JSON backup file and restore it whenever needed.

This makes it possible to move your data between devices without depending entirely on a remote database.

### 📱 Progressive Web App

AREX includes PWA capabilities:

* Installable application
* Offline support
* Service Worker caching
* Mobile-friendly interface
* System notifications for scheduled reviews where supported

---

## 🖥️ Live Demo

### 👉 [Open AREX](https://amirghasemian22.github.io/AREX/)

No installation is required.

Open the application in your browser and start using it.

---

## 🧭 Main Sections

| Section            | Purpose                                   |
| ------------------ | ----------------------------------------- |
| Dashboard          | Overview of learning and trading progress |
| Learning Checklist | Track the Forex learning roadmap          |
| Schedule           | Daily and weekly learning plan            |
| Reviews            | Spaced repetition and scheduled reviews   |
| Trading Journal    | Record and analyze trades                 |
| Psychology Journal | Track emotions and discipline             |
| Goals & Rules      | Define trading rules and personal goals   |
| Economic Calendar  | Monitor important market events           |
| Discipline Path    | Track consistency and daily discipline    |
| Settings & Backup  | Appearance, data management and backups   |

---

## 🔐 Privacy & Data

AREX follows a **local-first** approach.

Your primary application data is stored in your browser using IndexedDB.

AREX does not require an application account or backend database for normal usage.

Optional Google Drive synchronization is available for users who want cloud backups.

---

## 🛠️ Technology

AREX is intentionally lightweight and runs directly in the browser.

### Core

* HTML5
* CSS3
* Vanilla JavaScript

### Browser APIs

* IndexedDB
* Service Workers
* Web Notifications
* File API
* Local browser storage
* PWA / Web App Manifest

### Integrations

* Google Drive API
* Google Identity Services
* Forex Factory economic calendar
* External market data sources

### Hosting

* GitHub Pages

---

## 🚀 Running Locally

AREX is a client-side web application.

Clone the repository:

```bash
git clone https://github.com/Amirghasemian22/AREX.git
cd AREX
```

Then serve the directory using any local HTTP server.

For example:

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000
```

---

## 📂 Project Structure

```text
AREX/
├── index.html
├── manifest.json
├── sw.js
├── icon-192.png
├── icon-512.png
└── README.md
```

The current version is intentionally implemented as a lightweight client-side application without a traditional backend.

---

## 🗺️ Roadmap

AREX is still evolving.

Potential future directions include:

* [ ] More advanced trading analytics
* [ ] Additional market data integrations
* [ ] More detailed performance reports
* [ ] Advanced journal filtering
* [ ] Strategy performance analysis
* [ ] Improved mobile experience
* [ ] More backup and synchronization options
* [ ] Expanded learning resources
* [ ] Multi-language improvements

---

## 📜 Version History

### v2.1

* Animated assistant
* Customizable application backgrounds
* Glassmorphism effects
* Forex session timeline
* Fear & Greed indicator
* Economic calendar
* UI and UX improvements

### v2.0

* Responsive improvements
* Position sizing and risk calculator
* Major visual redesign

### v1.5

* Google Drive synchronization
* Custom colors
* World clock
* Language switching

### v1.0

* 78-session Forex learning checklist
* Trading journal
* Psychology journal
* Scheduled reviews

---

## ⚠️ Disclaimer

AREX is a personal learning, journaling and trading-management tool.

It does **not** provide financial advice, investment recommendations, trading signals, or guaranteed results.

Trading financial markets involves substantial risk. Always conduct your own research and use appropriate risk management.

---

## 👨‍💻 Author

Created and maintained by **Amir Ghasemian**.

* GitHub: [@Amirghasemian22](https://github.com/Amirghasemian22)

---

## ⭐ Support the Project

If you find AREX useful:

⭐ Star the repository
🐛 Report bugs through GitHub Issues
💡 Suggest new features
🔀 Contribute improvements

Every star and contribution helps the project grow.

---

## 📄 License

See the repository license for terms of use.
