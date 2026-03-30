# MEAL System — Beneficiary Insights Platform

> An AI-powered Monitoring, Evaluation, Accountability & Learning (MEAL) platform built for humanitarian and development programs. Manage beneficiaries, track indicators, run evaluations, generate reports, and let AI surface insights — all in one place.

---

## Table of Contents

1. [What Is This System?](#1-what-is-this-system)
2. [Key Features](#2-key-features)
3. [Tech Stack](#3-tech-stack)
4. [Project Structure](#4-project-structure)
5. [Getting Started](#5-getting-started)
6. [Environment Variables](#6-environment-variables)
7. [Application Modules](#7-application-modules)
8. [AI Capabilities](#8-ai-capabilities)
9. [API Reference](#9-api-reference)
10. [Data & Export](#10-data--export)
11. [Multilingual Support](#11-multilingual-support)
12. [UI & Design System](#12-ui--design-system)
13. [Running in Production](#13-running-in-production)
14. [Deployment on Replit](#14-deployment-on-replit)
15. [Troubleshooting](#15-troubleshooting)

---

## 1. What Is This System?

The **MEAL System** is a full-stack web application designed for organizations running humanitarian, development, or social programs. It covers the complete project lifecycle — from initiation and planning, through implementation and monitoring, all the way to evaluation and closure.

The system gives program teams a single platform to:

- Register and manage **beneficiaries** with audit trails and correction workflows
- Track **community educators**, their contracts, interviews, and training attendance
- Manage **education and payment centers** with geographic location data
- Define and measure **indicators** against a logical framework (logframe)
- Run **sampling plans** and calculate statistically valid sample sizes
- Conduct **interviews** and export findings as PDF reports
- Visualize data through **interactive maps**, heatmaps, charts, and dashboards
- Generate **compliance**, **financial**, and **process** monitoring reports
- Use **AI** to describe data clusters and surface patterns automatically

---

## 2. Key Features

| Feature | Description |
|---|---|
| Beneficiary Management | Full CRUD with upload, audit, correction, and export |
| Community Educator Tracking | Contracts, selection, training, double-benefit checks |
| Education & Payment Centers | Add, edit, map locations, upload in bulk |
| Indicator Tracking | Define, measure, and monitor MEAL indicators |
| Logframe Builder | Build and manage logical frameworks per project |
| Sampling Calculator | Statistically sound sample size computation |
| Interview System | Conduct, store, export interviews and statements as PDF |
| AI Cluster Analysis | Gemini-powered cluster description and pattern detection |
| Interactive Maps | Leaflet maps with heatmap and marker clustering |
| Multi-format Exports | PDF, Excel, DOCX, CSV exports throughout the system |
| Multilingual UI | Full English and Arabic (RTL) support |
| Role-based Settings | Per-project configuration and rules management |
| File Manager | Upload and manage project files |
| Gantt Charts | Visual project planning timelines |
| Risk Register | Track and manage project risks |
| Dashboard | Real-time overview of all MEAL metrics |

---

## 3. Tech Stack

| Layer | Technology |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS 3 + Radix UI |
| AI | Google Genkit + Gemini (via `@genkit-ai/google-genai`) |
| Charts | Recharts + ECharts |
| Maps | Leaflet + React-Leaflet (heatmap & clustering) |
| PDF Generation | pdf-lib, jsPDF, @react-pdf/renderer, pdfkit |
| Excel Export | ExcelJS, xlsx |
| DOCX Export | docx |
| Forms | React Hook Form + Zod |
| Animation | Framer Motion |
| Code Editor | Monaco Editor |
| Database (local) | better-sqlite3 |
| Package Manager | npm |

---

## 4. Project Structure

```
.
├── next.config.js              # Next.js configuration
├── package.json                # Dependencies and scripts
├── tailwind.config.ts          # Tailwind CSS configuration
├── tsconfig.json               # TypeScript configuration
├── public/                     # Static assets
└── src/
    ├── ai/
    │   ├── genkit.ts           # Genkit AI client (Google Gemini)
    │   └── flows/
    │       └── describe-cluster-flow.ts  # AI cluster analysis flow
    ├── app/
    │   ├── layout.tsx          # Root layout (providers, fonts)
    │   ├── page.tsx            # Home → renders MealDashboard
    │   ├── api/                # All server-side API route handlers
    │   ├── meal-system/        # Core MEAL module pages
    │   ├── file-editor/        # In-app file editor
    │   └── style-guide/        # Component style guide
    ├── components/
    │   ├── dashboard/          # Main dashboard component
    │   ├── layout/             # Sidebar + MealLayout
    │   ├── ui/                 # Radix-based design system components
    │   ├── charts/             # Chart components
    │   ├── gantt/              # Gantt chart components
    │   ├── report/             # Report generation components
    │   └── tables/             # Data table components
    ├── context/
    │   └── language-context.tsx  # i18n language state
    ├── datalib/                # Data access and processing utilities
    ├── hooks/                  # Custom React hooks
    ├── locales/
    │   ├── en.json             # English translations
    │   └── ar.json             # Arabic translations
    ├── styles/                 # Additional CSS
    ├── theme/                  # Color, motion, and typography tokens
    ├── types/                  # Shared TypeScript types
    └── workers/                # Web workers for heavy computation
```

---

## 5. Getting Started

### Prerequisites

- **Node.js 20+**
- A **Google API key** with Gemini access (for AI features)

### Install and Run

```bash
# Install dependencies
npm install

# Start the development server
npm run dev
```

The app will be available at `http://localhost:5000`.

### Available Scripts

| Script | What it does |
|---|---|
| `npm run dev` | Start dev server on port 5000 |
| `npm run build` | Build for production |
| `npm run start` | Run the production build |
| `npm run lint` | Run ESLint |
| `npm run typecheck` | Type-check without emitting |
| `npm run genkit:dev` | Start the Genkit AI dev UI |
| `npm run genkit:watch` | Start Genkit with file watching |

---

## 6. Environment Variables

Create a `.env.local` file in the project root with the following:

```env
# Required — Google Gemini AI (get one at https://aistudio.google.com/app/apikey)
GOOGLE_API_KEY=your_google_api_key_here
```

> On **Replit**, this is stored securely as a secret — no `.env` file needed.

---

## 7. Application Modules

### Dashboard (`/`)
The home screen. Displays a high-level MEAL dashboard with project summaries, indicator progress, beneficiary counts, and activity feeds.

### MEAL System (`/meal-system`)

The heart of the application. It is organized into phases mirroring the project lifecycle:

#### Monitoring → Initiation & Planning
- **Purpose & Scope** — Define what the project aims to achieve
- **Prepare Indicators** — Set up measurable indicators with targets
- **M&E Plan Table** — Map indicators to activities and timelines
- **Data Collection (ITT)** — Set up data collection instruments
- **Sampling Calculator** — Calculate statistically valid sample sizes
- **Budget** — Plan and track the monitoring budget
- **HR** — Manage human resources for MEAL activities
- **Data Analysis** — Plan the analysis approach
- **Reporting** — Set up reporting schedules and templates

#### Monitoring → Implementation
- **Beneficiary Monitoring**
  - `Database` — Full beneficiary registry
  - `Upload` — Bulk import beneficiary data
  - `Audit` — Review and audit beneficiary records
  - `Correction` — Correct erroneous beneficiary entries
  - `Review` — Supervisory review workflow
  - `Export` — Export data in multiple formats
  - `Report` — Generate beneficiary monitoring reports

- **Community Educators**
  - `Database` — Educator registry
  - `Selection` — Run educator selection processes
  - `Training` — Log and track training attendance
  - `Connecting` — Link educators to beneficiaries
  - `Contracts` — Manage educator contracts
  - `Interview` — Conduct educator interviews
  - `Export Statements` — Export interview statements
  - `Export Exact PDF` — Generate printer-ready PDF interview reports
  - `Interview Results` — Analyze and view interview outcomes
  - `Double Benefits` — Detect and manage educators receiving duplicate benefits

- **Education & Payment Centers**
  - `Center Management` — Add, edit, and view centers
  - `Add Locations` — Attach geographic coordinates
  - `Upload Centers` — Bulk import center data
  - `Modification` — Track center modifications

- **Enrollment** — Manage beneficiary enrollment, create ID cards and enrollment sheets
- **Compliance** — Track compliance metrics
- **Financial** — Monitor financial data
- **Organizational** — Organizational-level monitoring
- **Process** — Process monitoring and quality assurance
- **Results** — Track results and outcomes

#### Monitoring → Closure
Program closure workflows and final reporting.

#### Indicator Tracking (`/meal-system/indicator`)
Real-time indicator progress against targets with visualization.

#### Analysis (`/meal-system/analysis`)
Data analysis tools including cross-tabulations and statistical summaries.

#### Evaluation (`/meal-system/evaluation`)
Evaluation frameworks, data, and findings management.

#### Compliant (`/meal-system/compliant`)
Complaint and feedback mechanism (accountability component of MEAL).

#### Reporting (`/meal-system/reporting`)
Generate and manage all program reports.

#### Risk (`/meal-system/risk`)
Risk register for identifying, assessing, and tracking risks.

#### Settings (`/meal-system/settings`)
Per-project MEAL settings and configuration.

### Project Management
- **Projects** — Create and manage program projects
- **Logframe** — Build logical frameworks (impact → outcome → output → activity)
- **Project Plan** — Gantt-chart-based project planning with tasks
- **Project Dashboard** — Project-specific metrics and progress

### File Editor (`/file-editor`)
An in-browser Monaco-powered code/text editor for managing project files directly in the system.

---

## 8. AI Capabilities

The system integrates **Google Gemini** via the Genkit framework.

### Cluster Description Flow
**Endpoint:** `POST /api/ai/describe-cluster`

Analyzes a data cluster and returns a natural-language description of the patterns, demographics, and anomalies found. Useful for quickly understanding large beneficiary datasets without manual analysis.

**Flow location:** `src/ai/flows/describe-cluster-flow.ts`

**Configuration:** `src/ai/genkit.ts`

To explore or test AI flows interactively:

```bash
npm run genkit:dev
```

This opens the Genkit developer UI where you can invoke flows, inspect traces, and test prompts.

---

## 9. API Reference

All API routes live under `src/app/api/`. Every route is a Next.js Route Handler (server-side only).

| Route | Method | Description |
|---|---|---|
| `/api/projects` | GET, POST | List and create projects |
| `/api/logframe` | GET, POST | Logical framework data |
| `/api/project-plan` | GET, POST | Project plan tasks |
| `/api/locations` | GET, POST | Geographic locations |
| `/api/educators` | GET, POST | Community educator records |
| `/api/educators/update-beneficiary-info` | POST | Update educator-beneficiary links |
| `/api/ed-selection` | GET, POST | Educator selection records |
| `/api/ed-selection/download` | GET | Download selection data |
| `/api/education-payment-centers` | GET, POST | Education and payment centers |
| `/api/bnf-assessed` | GET, POST | Assessed beneficiary data |
| `/api/bnf-assessed/download` | GET | Download beneficiary assessments |
| `/api/interviews` | GET, POST | Interview records |
| `/api/interviews/link` | POST | Link interviews to educators |
| `/api/interviews/export` | GET | Export interview data |
| `/api/interview-statements` | GET, POST | Interview statement records |
| `/api/indicator-tracking` | GET, POST | Indicator tracking data |
| `/api/monitoring-indicators` | GET, POST | Monitoring-level indicators |
| `/api/monitoring-plan` | GET, POST | M&E plan table data |
| `/api/sampling-plan` | GET, POST | Sampling plan configuration |
| `/api/purpose-and-scope` | GET, POST | Purpose and scope records |
| `/api/rules` | GET, POST | Business rules configuration |
| `/api/settings` | GET, POST | Application settings |
| `/api/training` | GET, POST | Training sessions |
| `/api/training/attendance` | GET, POST | Training attendance records |
| `/api/training/requirements` | GET, POST | Training requirements |
| `/api/training/qualify` | GET, POST | Educator qualification results |
| `/api/trainings/link` | POST | Link training to educators |
| `/api/pdf-templates` | GET, POST | PDF template management |
| `/api/file-manager` | GET, POST | File storage management |
| `/api/data-connection` | GET, POST | External data connections |
| `/api/ai/describe-cluster` | POST | AI-powered cluster analysis |

---

## 10. Data & Export

The system supports exporting data in multiple formats depending on context:

| Format | Use Case | Library |
|---|---|---|
| **PDF** | Interview reports, ID cards, statements | pdf-lib, jsPDF, pdfkit, @react-pdf/renderer |
| **Excel (.xlsx)** | Beneficiary lists, indicator data, reports | ExcelJS, xlsx |
| **DOCX** | Formal reports and documents | docx |
| **CSV** | Raw data exports for external tools | Native |
| **ZIP** | Bulk file exports | JSZip |
| **QR Code** | Beneficiary ID cards | qrcode |
| **Image** | Chart/map snapshots | html-to-image, html2canvas |

---

## 11. Multilingual Support

The UI supports **English** and **Arabic** (with full RTL layout).

Language files are in `src/locales/`:
- `en.json` — English strings
- `ar.json` — Arabic strings

Language state is managed via `src/context/language-context.tsx` and is accessible throughout the app via the `useLanguage()` hook. Switching language also switches text direction (`ltr` / `rtl`).

---

## 12. UI & Design System

The component library is built on **Radix UI** primitives styled with **Tailwind CSS**.

All base components live in `src/components/ui/` and include:

`Accordion` · `Alert` · `AlertDialog` · `Avatar` · `Badge` · `Button` · `Calendar` · `Card` · `Carousel` · `Chart` · `Checkbox` · `Collapsible` · `Command` · `Dialog` · `DropdownMenu` · `Form` · `Input` · `Label` · `Menubar` · `Popover` · `Progress` · `RadioGroup` · `ScrollArea` · `Select` · `Separator` · `Sheet` · `Skeleton` · `Slider` · `Switch` · `Table` · `Tabs` · `Textarea` · `Toast` · `Tooltip`

Design tokens (colors, motion, typography) are defined in `src/theme/` and consumed across the app for consistency.

A live **Style Guide** is accessible at `/style-guide` to browse all components in their various states.

---

## 13. Running in Production

```bash
# Build the optimized production bundle
npm run build

# Start the production server
npm run start
```

The production server runs on port `5000` and binds to all interfaces (`0.0.0.0`).

---

## 14. Deployment on Replit

This project is configured to run seamlessly on Replit.

**What's pre-configured:**
- Dev server runs on port `5000` (required for Replit's webview)
- Server binds to `0.0.0.0` so Replit's proxy can reach it
- The `GOOGLE_API_KEY` is stored as a Replit Secret (never in code)
- The workflow `Start application` runs `npm run dev` automatically

**To deploy publicly on Replit:**
1. Click the **Deploy** button in the Replit interface
2. Replit will build and host the app under a `.replit.app` domain with TLS included

---

## 15. Troubleshooting

**App not loading in preview?**
- Make sure the `Start application` workflow is running
- Confirm the dev server is bound to port `5000` in `package.json`

**AI features not working?**
- Verify `GOOGLE_API_KEY` is set in Replit Secrets or your `.env.local`
- Run `npm run genkit:dev` to test AI flows directly

**Build errors?**
- Run `npm run typecheck` to identify TypeScript issues
- Check that all dependencies are installed with `npm install`

**Maps not rendering?**
- Leaflet requires a browser environment — ensure you're not rendering map components on the server side (use dynamic imports with `ssr: false`)

**PDF export failing?**
- Some PDF libraries require Node.js APIs — confirm you're calling them from API routes, not client components

---

## License

Private — All rights reserved.
