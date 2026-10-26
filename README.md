AREX V9.7.14 --- Personal Trading Assistant & Management Workspace

<p align="center">

<strong>{=html}A personal trading workspace for trade journaling, risk
management, strategy discipline, trading psychology, and performance
analysis.</strong>{=html}

</p>

<p align="center">

<a href="https://amirghasemian22.github.io/AREX/">{=html}🚀 Open
AREX</a>{=html} ·
<a href="https://github.com/Amirghasemian22/AREX">{=html}💻 GitHub
Repository</a>{=html} ·
<a href="https://github.com/Amirghasemian22/AREX/issues">{=html}🐛
Report an Issue</a>{=html}

</p>

<p align="center">

<img src="https://img.shields.io/badge/Version-9.7.12-00B8D9?style=for-the-badge" alt="Version 9.7.12">{=html}
<img src="https://img.shields.io/badge/Platform-Web%20App%20%7C%20PWA-243B59?style=for-the-badge" alt="Web application and PWA">{=html}
<img src="https://img.shields.io/badge/Focus-Trading%20Management-16A085?style=for-the-badge" alt="Trading Management">{=html}
<img src="https://img.shields.io/badge/Build-Mobile%20Test%20Build-orange?style=for-the-badge" alt="Mobile test build">{=html}

</p>

📌 What Is AREX?

AREX is a personal trading assistant and management workspace designed
to help traders structure their decisions, manage risk, document trades,
and review their trading process over time.

Rather than serving only as a trade recorder, AREX brings several
trading workflows together:

Trading dashboard and daily planning

Trade journaling and trade-history review

Risk-management tools and risk-limit awareness

Strategy rules and execution discipline

AI-assisted decision support, with attention to missing information
and defined rules

Trading psychology and behavioral reviews

Performance statistics and visual analytics

Economic-calendar and market-session tools

Prop-firm challenge tracking

Personal goals, reviews, and routines

Local data management, export, backup, and restore workflows

Responsive desktop and mobile layouts, with PWA support where
available

AREX is intended to help traders understand not only what happened in
a trade, but why it was taken, whether defined rules were followed, and
what can be improved next time.

Project Status

Version: V9.7.12

Build designation: Mobile Login Test Build

Status: Pre-release / testing build

V9.7.12 includes responsive-login and mobile-interface improvements. It
is a testing build, not a claim that every external integration or every
supported mobile device has been verified. Authentication, cloud backup,
live data sources, notifications, and deployed behavior depend on
configuration and require environment-specific testing.

Before publishing: The ?arex-test=1 local test entry is intended
only for local testing. Verify that the temporary test-login path is
disabled or unavailable in the production build before deploying
publicly. Never deploy a test-bypass build to a public domain.

✨ Core Features

📊 1. Trading Dashboard

The dashboard brings important trading information and workflow prompts
into one place. Depending on available records and configuration, it can
display or help review:

Trading activity and account performance

Profit-and-loss summaries

Daily plans and priorities

Journal records and recent activity

Performance charts and visual summaries

Risk and discipline reminders

Items that need more information before a decision can be evaluated

The dashboard should be interpreted using the data actually available in
the application; missing or unverified data should not be treated as
live account information.

📈 2. Trading Journal

Record trades and build a structured history of trading decisions.
Journal records may include:

Symbol and trade direction

Entry and exit prices

Stop-loss and take-profit

Position size and planned risk

Strategy or setup

Trade outcome and R-multiple

Notes before and after the trade

Execution quality and rule adherence

Use the journal to review setups, identify recurring mistakes, and
better understand trading behavior. Back up important records regularly.

🧮 3. Risk Management

Plan and review risk before entering a trade. Depending on the selected
tool and supplied information, risk workflows can include:

Account balance or equity inputs

Risk percentage and monetary risk

Entry and stop-loss distance

Take-profit and risk-to-reward ratio

Position-size calculations

Daily limits and risk warnings

Important: Results depend on the accuracy of supplied values and
instrument specifications. Verify tick value, contract size, lot size,
account currency, and broker requirements before placing a trade.

🧠 4. Trading Psychology

Document the behavioral side of trading, including:

Emotional state and mood

Fear, hesitation, and impulsive decisions

Discipline and rule adherence

Trading mistakes and behavioral patterns

Personal observations and post-trade reflections

Goals for improving consistency

The purpose is to make behavioral patterns easier to recognize and
review---not to provide medical or psychological diagnosis.

📋 5. Strategy Rules & Trading Discipline

Keep the trading process organized around explicit rules. This workflow
supports the management and review of:

Personal trading rules and strategy conditions

Trade evaluation against defined criteria

Rule violations and repeated mistakes

Planned versus impulsive trades

Missing information that prevents a reliable evaluation

Undefined or conflicting strategy conditions should be clarified rather
than silently treated as confirmed rules. AI-assisted evaluations are
decision-support tools, not guarantees of a trade outcome.

🤖 6. AI Trading Assistant

The AI assistant is intended to help users review their process and
reason against supplied rules and information. Depending on
configuration and available data, it may help with:

Reviewing a proposed trade against defined conditions

Highlighting missing information

Explaining why a setup may or may not satisfy specified criteria

Reviewing journal notes and recurring mistakes

Supporting risk and discipline workflows

The assistant should not be treated as a source of guaranteed signals,
guaranteed returns, or a substitute for independent verification. AI
features that rely on an external provider require the appropriate
service configuration and network access.

📉 7. Performance Analytics

Review recorded trading data instead of relying only on memory or
isolated outcomes. Depending on the available records and
implementation, analytics may include:

Win/loss statistics

Profit-and-loss summaries

Equity-curve visualization

R-multiple analysis

Setup, symbol, or session comparisons

Trading-history reviews

Progress in reducing recurring mistakes

Discipline and execution reviews

Meaningful conclusions require sufficient and accurate data. Historical
performance does not guarantee future results.

📅 8. Economic Calendar

The economic-calendar area is intended to help users review scheduled
events relevant to their trading routine. Depending on the configured
source, available information may include:

Upcoming economic events

Event impact and currency information

Event timing

Event filters and personal notes

Data availability and freshness depend on the configured integration.
Verify important events and release times against a reliable, current
source. A visible calendar interface does not by itself prove that a
live provider connection is active.

🌍 9. Market Sessions & Time Tools

Market-session tools can help organize trading routines across time
zones. Depending on the current implementation, they may include:

Forex market-session timelines

World-clock information

Session planning

Time-related dashboard information

Market hours may change because of daylight-saving transitions,
holidays, and provider differences. Confirm relevant times when
precision matters.

🏆 10. Goals & Prop-Firm Challenge

AREX is designed to help organize trading objectives and risk awareness.
Depending on the configured workflow, this may include:

Personal trading goals

Daily and weekly limits

Risk-related rules

Progress reviews

Prop-firm challenge tracking

Discipline and consistency checks

Challenge requirements vary by provider. Verify the firm's current
rules, drawdown calculations, and limits before relying on any tracker.

🎨 11. Interface, Language & Customization

AREX provides a dark trading-workspace interface and responsive layouts.
Depending on the current build, customization may include:

Theme and appearance settings

Language selection

Layout adjustments for desktop and mobile

Mobile navigation designed for touch interaction

A sticky, translucent top bar on supported layouts

PWA installation support where the browser and deployment permit it

Exact appearance and install behavior can vary by browser, operating
system, viewport size, and deployment configuration.

💾 12. Local Data, Export & Backup

AREX uses browser-side data-management mechanisms for supported
workflows. Depending on the current implementation, features may
include:

IndexedDB and browser storage

JSON export and import

Backup and restore workflows

Recovery of previously exported data

Optional cloud-backup integrations

Important: Browser storage is not a substitute for an independent
backup. Clearing browser data, changing browsers, switching devices, or
browser-storage problems may affect access to local records. Export
backups regularly and verify that they can be restored.

☁️ 13. Optional Cloud Integrations

The project has been developed with support for external-service
integrations, depending on configuration. These may include
authentication, remote storage, and cloud backup.

Cloud functionality requires correct provider configuration, authorized
domains, security rules, and any required server-side components. Do not
assume a cloud feature is operational just because its interface is
present. Confirm successful requests and test restore workflows in the
target environment.

📱 14. Mobile Experience & Progressive Web App

V9.7.12 is a mobile-login test build focused on responsive login layout
and mobile usability. The project is intended to provide a web-based,
app-like experience on compatible devices.

Depending on the deployed build and browser, PWA-related capabilities
may include:

Responsive mobile interface

Installable app experience

Web App Manifest

Service Worker asset caching

Access to some cached resources while offline

Touch-friendly navigation and controls

PWA behavior varies by browser and operating system. Offline
availability does not mean all features work without a network:
authentication, cloud synchronization, AI providers, notifications, and
live market data may require connectivity. Test installation and
behavior on the actual Android and iOS devices you intend to support.

🧭 Main Workspace Areas

The main functional areas are intended to cover the following workflows.
Exact labels and availability may differ between builds.

Area                                Purpose

Dashboard                           Review trading activity,
priorities, and available
performance information

Daily Roadmap                       Organize the daily trading routine
and pre-trade checks

Trade Journal                       Record, organize, and review trades

AI Trading Assistant                Support rule-based review and
identify missing information

Risk Management                     Review planned risk, position
sizing, and risk limits

Strategy & Rules                    Maintain strategy conditions and
execution rules

Performance Analytics               Evaluate recorded results and
trading behavior

Psychology Journal                  Document emotions and behavioral
patterns

Economic Calendar                   Review scheduled market events from
the configured source

Market Sessions                     Organize activity around market
hours

Prop-Firm Challenge                 Track configured challenge
objectives and risk limits

🖥️ Live Application

Open AREX:

https://amirghasemian22.github.io/AREX/

The public URL may not contain the latest test build until it has been
explicitly deployed. Check the deployed version before assuming that it
matches V9.7.12.

🛠️ Technology

AREX is a browser-based application built with standard web
technologies.

Core Technologies

HTML5

CSS3

JavaScript

Browser Capabilities

Depending on the implementation and browser:

IndexedDB and browser storage

Service Workers

Web App Manifest

File APIs

Web Notifications

External Integrations

Depending on configuration:

Google authentication

Cloud database or storage services

Google Drive backup

Economic-calendar or market-data sources

Optional AI service through a configured backend or provider

Hosting

GitHub Pages for static web hosting

Optional separately deployed backend or Worker for features that
cannot safely run entirely in the browser

Some integrations require a separately configured service. Do not place
private API keys, service-account credentials, or other server secrets
in client-side files or a public repository.

🚀 Run AREX Locally

Requirements

Git (optional if downloading the repository ZIP)

Python 3 or another local HTTP server

A modern browser

1. Clone the Repository

git clone https://github.com/Amirghasemian22/AREX.git
cd AREX

Alternatively, download the project ZIP and extract it while preserving
the directory structure.

2. Start a Local HTTP Server

With Python installed:

python -m http.server 8000

On Windows, if python is not recognized, try:

py -m http.server 8000

3. Open the Application

For a normal local run, visit:

http://localhost:8000/

4. Local Test Entry (Testing Builds Only)

If the exact build you are testing includes the temporary local
test-login feature, open:

http://localhost:8000/?arex-test=1

This parameter is intended only for local testing. It must not be
treated as production authentication or used to bypass authentication on
a public deployment. Before publishing, verify that the test-login code
is disabled or excluded from the production build.

Local Run Notes

Keep the repository's directory structure intact.

Do not move JavaScript, CSS, assets, or configuration files away
from the paths expected by the application.

Authentication providers may require localhost or the deployed
domain to be configured as an authorized domain.

Features that depend on external APIs or cloud services may need
additional configuration.

A successful local launch does not verify every external
integration.

localhost on a phone points to the phone itself, not your
computer. To test on a physical device, serve the project from a
network address reachable by that device or use a properly
configured HTTPS test deployment.

🧪 Testing & Release Validation

The repository may include automated tests and validation scripts. If
the relevant files are present, run the tests from the project root
using the commands documented by the project, for example:

node --test tests/*.test.js

If a release-gate script is included, run:

node scripts/release-gate.js

Use the actual scripts included in the checked-out build as the source
of truth. Passing automated tests does not prove that OAuth, cloud
backup and restore, external data providers, notifications, or
real-device PWA behavior work in production.

Before a public release, verify at minimum:

Login and logout with the configured authentication provider

Separation of data between different user accounts

Backup and restore with real test data

Worker/backend behavior in the deployed environment

Economic-calendar and market-data availability

Notification permissions and actual delivery, where configured

Mobile layout on real Android and iOS devices

PWA installation, update, and offline behavior

Production build does not expose the temporary local test-login path

No private credentials or personal strategy files are included in
the public repository

📂 Project Structure

The exact structure depends on the checked-out release. A typical
project may contain:

AREX/
├── index.html
├── README.md
├── manifest.json
├── sw.js
├── js/
├── scripts/
├── tests/
├── assets/                 # If included
├── css/                    # If included
├── mt5/                    # If included in the selected distribution
└── ...                     # Other application and configuration files

Directory Guidelines

index.html --- Application entry point.

js/ --- JavaScript modules and application logic, if used by
the build.

scripts/ --- Development, validation, build, or maintenance
scripts.

tests/ --- Automated tests and validation files.

manifest.json --- PWA metadata, if present.

sw.js --- Service Worker, if present.

assets/ and css/ --- Visual resources and stylesheets, if
present.

mt5/ --- Platform-related files, if included in the
distribution.

Preserve the directory structure when uploading or deploying. Do not
remove files merely because they appear to be development files; first
verify whether scripts, tests, runtime code, or deployment workflows
depend on them.

🔒 Security & Privacy

AREX may store information locally and may use external services when
configured.

Back up important trading records regularly.

Avoid using shared devices for sensitive personal data.

Never publish private API keys, service-account credentials, access
tokens, or other secrets.

Restrict cloud-database access using appropriate authentication and
security rules.

Do not rely on frontend code alone to protect server-side secrets.

Keep private strategy knowledge files out of a public repository
unless you have intentionally reviewed and approved their
publication.

Confirm that data export and restore workflows work before relying
on them.

Treat temporary test-login functionality as development-only and
never expose it as a public authentication bypass.

Firebase web configuration values are often designed to be present in
client applications, but they do not replace proper authentication,
restrictive database rules, and API restrictions.

Do not assume that local data is automatically synchronized to the
cloud. Confirm that each backup or synchronization operation completed
successfully.

🗺️ Project Direction

AREX is being developed as a personal trading-management assistant
rather than a course or a trade recorder alone. Development priorities
include reliability, explicit strategy rules, safe data management,
usability, and careful integration with external services.

Potential future improvements may include:

More detailed strategy-performance reports

Repeated-mistake detection

Improved trade-review workflows

Chart screenshots and trade annotations

Broker and trading-platform import workflows

Comparisons by symbol, strategy, or market session

Expanded strategy knowledge management

More advanced decision-support workflows

Additional backup and synchronization options

Improved mobile accessibility and PWA behavior

These are possible development directions, not guarantees that every
item is already implemented.

📜 Version History

V9.7.12 --- Mobile Login Test Build

Responsive-login and mobile-usability refinements.

Continued work on mobile navigation and PWA-oriented layouts.

Testing-build designation; external integrations and real-device
behavior still require verification in the target environment.

Earlier Builds

AREX evolved from an earlier Forex learning planner into a broader
trading-management workspace. Previous builds developed workflows for
journaling, risk management, trading psychology, dashboard analytics,
market tools, customization, and data management.

For exact code changes, consult the repository's commit history and
release notes included with each build where available.

⚠️ Financial Disclaimer

AREX is a trading-management, journaling, and productivity tool. It is
not a broker, investment adviser, or financial institution.

AREX does not guarantee profitable trading outcomes and should not be
treated as a source of guaranteed trading signals or returns.

Trading Forex, futures, CFDs, cryptocurrencies, and other financial
instruments involves substantial risk and may result in the loss of some
or all of your capital.

You are responsible for your trading decisions, risk management, and
compliance with applicable laws and broker requirements.

Always verify calculations, instrument specifications, market
information, and external data before making a trading decision.

👨‍💻 Author

Created and maintained by Amir Ghasemian Moghadam.

GitHub: @Amirghasemian22

LinkedIn: [Amir](https://www.linkedin.com/in/amirghasemiian-ai-vision/)

⭐ Support AREX

If you find AREX useful:

⭐ Star the repository.

🐛 Report bugs through GitHub
Issues.

💡 Suggest improvements.

🔀 Contribute to the project.

Feedback helps AREX continue to improve.

📄 License

See the repository's license file for applicable terms. If no license is
included, reuse and redistribution permissions may be limited.
