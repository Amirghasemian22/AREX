# AREX V9.6.3 — Personal Trading Assistant & Management Workspace

<p align="center">
  <strong>A personal trading workspace for trade journaling, risk management, strategy discipline, trading psychology, and performance analysis.</strong>
</p>

<p align="center">
  <a href="https://amirghasemian22.github.io/AREX/">🚀 Open AREX</a>
  ·
  <a href="https://github.com/Amirghasemian22/AREX">💻 GitHub Repository</a>
  ·
  <a href="https://github.com/Amirghasemian22/AREX/issues">🐛 Report an Issue</a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Version-9.6.3-00B8D9?style=for-the-badge" alt="Version 9.6.3">
  <img src="https://img.shields.io/badge/Platform-Web%20App-243B59?style=for-the-badge" alt="Web Application">
  <img src="https://img.shields.io/badge/Focus-Trading%20Management-16A085?style=for-the-badge" alt="Trading Management">
</p>

---

## 📌 What Is AREX?

**AREX is a personal trading assistant and management workspace designed to help traders make more structured decisions, manage risk, document their trades, and improve their trading process over time.**

Instead of functioning as just a trade journal, AREX brings several aspects of trading management into one environment:

* Trade planning and journaling
* Risk and position-size calculations
* Strategy rules and execution discipline
* Trading psychology and behavioral reviews
* Performance statistics and visual analytics
* Economic events and market-session awareness
* Personal goals, reviews, and trading routines
* Data backup and recovery options
* A customizable workspace for everyday use

AREX is designed for traders who want to understand not only **what happened in a trade, but also why they took it, whether they followed their rules, and what they can improve next time.**

### Project Status

**Version:** V9.6.3

AREX is an evolving project. Features, integrations, and deployment behavior may vary depending on configuration, browser support, external services, and the current deployment.

---

## ✨ Core Features

### 📊 1. Trading Dashboard

The dashboard brings important trading information into one place.

Depending on available data, it can help you review:

* Trading activity and account performance
* Profit and loss statistics
* Trading progress and consistency
* Recent activity and journal records
* Performance charts and visual summaries
* Daily trading plans and priorities

The goal is to make the information needed for reviewing your trading process easier to understand.

### 📈 2. Trading Journal

Record trades and build a history of your decisions.

Journal information may include:

* Trading symbol and direction
* Entry and exit prices
* Stop-loss and take-profit
* Position size and risk
* Trade setup and strategy
* Trade outcome and R-multiple
* Notes before and after the trade
* Execution quality and rule adherence

Use your trading history to identify recurring mistakes, evaluate setups, and understand your own behavior.

### 🧮 3. Risk Management

Plan risk before entering a trade.

Risk-management tools are intended to support calculations such as:

* Account balance and equity
* Risk percentage per trade
* Monetary risk amount
* Entry price and stop-loss distance
* Take-profit and risk-to-reward ratio
* Position sizing
* Trade risk evaluation

**Important:** Calculation accuracy depends on the information supplied and the instrument's contract specifications. Verify symbol specifications, tick values, lot sizes, and broker requirements before placing a trade.

### 🧠 4. Trading Psychology

Trading performance is affected by both strategy execution and behavior.

AREX provides a workspace for documenting and reviewing aspects of trading psychology, such as:

* Emotional state and mood
* Fear, hesitation, and impulsive decisions
* Discipline and rule adherence
* Trading mistakes and behavioral patterns
* Personal observations
* Post-trade reflections
* Goals for improving consistency

The purpose is to make behavioral patterns easier to recognize and review over time.

### 📋 5. Strategy Rules & Trading Discipline

Keep your trading process organized around defined rules.

This area of the AREX concept focuses on:

* Documenting personal trading rules
* Recording strategy conditions
* Reviewing trade execution against defined criteria
* Tracking recurring rule violations
* Distinguishing planned trades from impulsive trades
* Improving consistency through structured reviews

Strategy rules should remain explicit. Unclear or incomplete conditions should be clarified rather than treated as confirmed trading rules.

### 📉 6. Performance Analytics

Use recorded trading data to evaluate your process instead of relying only on memory or individual outcomes.

Depending on the available records and implementation, performance analysis can include:

* Win/loss statistics
* Profit and loss summaries
* Equity-curve visualization
* R-multiple analysis
* Setup-based comparisons
* Trading-history reviews
* Progress in reducing recurring mistakes
* Evaluation of discipline and execution

Meaningful conclusions require sufficient, accurate trade data. Historical performance does not guarantee future results.

### 📅 7. Economic Calendar

Stay aware of scheduled economic events that may be relevant to your trading plan.

AREX's economic-calendar functionality is intended to help organize information such as:

* Upcoming economic events
* Event impact and currency filters
* Event timing
* Personal economic-event notes

Availability and data freshness depend on the configured data source or integration. Always verify important event times against a reliable, up-to-date source.

### 🌍 8. Market Sessions & Time Tools

Trading-session awareness can help organize your routine across different markets and time zones.

Market-related tools may include:

* Forex market-session timelines
* World-clock information
* Trading-session planning
* Time-related dashboard information

Market hours can change because of daylight-saving transitions, holidays, and differences between data providers. Confirm relevant times when precision matters.

### 🏆 9. Goals & Prop-Firm Risk Tracking

AREX is designed to support structured trading goals and risk awareness.

Depending on the configured features, this workflow can help organize:

* Personal trading objectives
* Daily and weekly limits
* Risk-related rules
* Progress reviews
* Prop-firm challenge tracking
* Discipline and consistency checks

Challenge requirements differ by provider. Always verify the applicable rules, drawdown calculations, and limits with the relevant firm.

### 🎨 10. Customizable Interface

AREX is designed to provide a personalized workspace.

Depending on the current build, customization may include:

* Appearance and theme settings
* Color preferences
* Background or wallpaper selection
* Language selection
* Responsive layouts for different screen sizes

### 💾 11. Local Data & Backup

AREX includes a data-management approach intended to help users retain and recover their trading records.

Depending on the enabled implementation, data-management features may include:

* Browser-based storage using IndexedDB
* JSON data export and import
* Backup and restore workflows
* Recovery of previously exported data
* Optional cloud-backup integrations

**Important:** Browser storage is not a substitute for an independent backup. Clearing browser data, changing browsers, using another device, or encountering browser-storage problems may affect access to locally stored information. Export backups regularly and verify that they can be restored.

### ☁️ 12. Optional Cloud Integrations

AREX has been developed with support for external-service integrations as part of its broader architecture.

These may include cloud authentication, remote data storage, or backup services, depending on the current configuration.

Cloud features require the appropriate service setup, credentials or public client configuration, security rules, and deployment settings. Do not assume that a cloud feature is operational merely because its interface is present.

### 📱 13. PWA & Offline Capabilities

AREX is designed as a browser-based application and may support Progressive Web App capabilities.

Depending on the deployed build and browser, these capabilities may include:

* Installable application experience
* Responsive mobile interface
* Service Worker caching
* Access to some previously cached resources while offline

Offline access does not necessarily mean every feature works without an internet connection. External APIs, authentication, cloud synchronization, and live market information generally depend on network availability.

---

## 🧭 Main Workspace Areas

The following table describes the main functional areas of AREX. Exact navigation labels may differ between builds.

| Area                     | Purpose                                                       |
| ------------------------ | ------------------------------------------------------------- |
| Dashboard                | Review trading activity and important performance information |
| Trading Journal          | Record, organize, and review trades                           |
| Risk Management          | Calculate planned risk and position sizing                    |
| Performance Analytics    | Evaluate results and trading behavior                         |
| Trading Psychology       | Document emotions and behavioral patterns                     |
| Strategy & Rules         | Maintain trading rules and review execution                   |
| Goals & Reviews          | Organize trading objectives and periodic reviews              |
| Economic Calendar        | Review scheduled market events                                |
| Market Sessions & Clock  | Organize trading activity around market hours                 |
| Prop-Firm Challenge      | Track applicable challenge objectives and risk limits         |
| Settings & Customization | Configure available appearance and application preferences    |
| Data Management          | Export, back up, and restore supported application data       |

---

## 🖥️ Live Application

**Open AREX:**

https://amirghasemian22.github.io/AREX/

AREX is distributed as a web application. Availability depends on the deployment status and your browser environment.

---

## 🛠️ Technology

AREX uses web technologies to provide a lightweight, browser-based trading workspace.

### Core Technologies

* HTML5
* CSS3
* JavaScript

### Browser Capabilities

Depending on the current implementation:

* IndexedDB
* Local browser storage
* Service Workers
* Web App Manifest
* File API
* Web Notifications

### External Integrations

Depending on configuration:

* Google authentication services
* Cloud database and backup services
* Google Drive integration
* Economic-calendar and market-data sources

### Hosting

* GitHub Pages

Some external integrations may require a separately configured service or server-side component.

---

## 🚀 Run AREX Locally

### Requirements

* Git
* A modern web browser
* Python or another local HTTP server

### 1. Clone the Repository

```bash
git clone https://github.com/Amirghasemian22/AREX.git
cd AREX
```

### 2. Start a Local HTTP Server

With Python installed:

```bash
python -m http.server 8000
```

### 3. Open the Application

Visit:

```text
http://localhost:8000
```

### Important Notes

* Keep the repository's directory structure intact.
* Do not move JavaScript, CSS, asset, or configuration files away from the paths expected by the application.
* Some authentication providers require localhost or the deployed domain to be configured as an authorized domain.
* Features that depend on external APIs or cloud services may require additional configuration.
* A successful local launch does not, by itself, verify every integration.

---

## 📂 Project Structure

AREX may contain the following types of files and directories. The exact structure depends on the current release.

```text
AREX/
├── index.html
├── README.md
├── js/
├── scripts/
├── tests/
├── css/                 # If included in the release
├── assets/              # If included in the release
├── manifest.json        # If included in the release
├── sw.js                # If included in the release
└── ...                  # Other application and configuration files
```

### Directory Guidelines

* **`index.html`** — Application entry point.
* **`js/`** — JavaScript modules and application logic, if used by the current build.
* **`scripts/`** — Development, build, validation, or maintenance scripts, depending on their contents.
* **`tests/`** — Automated tests and validation files.
* **`css/` and `assets/`** — Stylesheets and visual resources, if present.

Preserve the directory structure when uploading or deploying the project. Not every development file is required at runtime, but removing files without checking their references can break the application or its maintenance workflow.

---

## 🔒 Security & Privacy

AREX may store information locally in your browser and may use external services when configured.

Keep the following principles in mind:

* Back up important trading records regularly.
* Avoid using public or shared devices for sensitive personal data.
* Do not publish private API keys, service-account credentials, access tokens, or other secrets in the repository.
* Restrict cloud-database access using appropriate authentication and security rules.
* Never rely on frontend code alone to protect server-side secrets.
* Review the privacy and security policies of any connected third-party service.

Firebase web configuration values are generally intended to be included in client applications, but they are **not** a replacement for properly configured authentication, database security rules, and API restrictions.

Do not assume that locally stored data is automatically synchronized to the cloud. Confirm that the relevant backup or synchronization operation completed successfully.

---

## 🗺️ Project Direction

AREX aims to evolve into a more capable personal trading assistant that helps traders understand their own processes and make better-informed decisions.

Potential areas of development include:

* More detailed strategy-performance reports
* Repeated-mistake detection
* Improved trade-review workflows
* Chart screenshots and trade annotations
* Broker and trading-platform imports
* Comparisons by symbol, strategy, or market session
* More advanced strategy knowledge management
* Better decision-support workflows
* Additional backup and synchronization options
* Improved mobile usability and accessibility

These items represent possible development directions and should not be interpreted as guarantees that every feature is already implemented.

---

## 📜 Version History

### V9.6.3

* Current project release designation.
* Focus on a more integrated trading-management experience.
* Continued development of the application structure, interface, and supporting workflows.

> For detailed changes between builds, consult the repository's commit history and release notes where available.

### Earlier Versions

AREX evolved from an earlier Forex learning planner into a broader trading-management workspace.

Previous versions introduced and developed features such as the trading journal, risk calculator, psychology journal, dashboard, market tools, customization, and data-management workflows.

---

## ⚠️ Financial Disclaimer

AREX is a trading-management, journaling, and productivity tool. It is not a broker, investment adviser, or financial institution.

AREX does not guarantee profitable trading outcomes and should not be treated as a source of guaranteed trading signals or returns.

Trading Forex, futures, CFDs, cryptocurrencies, and other financial instruments involves substantial risk and may result in the loss of some or all of your capital.

You are responsible for your trading decisions, risk management, and compliance with applicable laws and broker requirements.

Always verify calculations, instrument specifications, market information, and external data before making a trading decision.

---

## 👨‍💻 Author

Created and maintained by **Amir Ghasemian Moghadam**.

* GitHub: [@Amirghasemian22](https://github.com/Amirghasemian22)
* LinkedIn: [Amir Ghasemian](https://www.linkedin.com/in/amirghasemiian-ai-vision/)

---

## ⭐ Support AREX

If you find AREX useful:

* ⭐ Star the repository.
* 🐛 Report bugs through GitHub Issues.
* 💡 Suggest improvements.
* 🔀 Contribute to the project.

Feedback helps AREX continue to improve.

---

## 📄 License

See the repository's license file for applicable terms of use. If no license is included, the project's reuse and redistribution permissions may be limited.
