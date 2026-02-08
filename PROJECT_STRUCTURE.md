# Project Structure

This document outlines the high-level architecture of the application, showing how the main files and folders are organized.

## Root Directory

- `.env`: Environment variables.
- `apphosting.yaml`: Firebase App Hosting configuration.
- `next.config.js`: Next.js configuration.
- `package.json`: Project dependencies and scripts.
- `tailwind.config.ts`: Tailwind CSS configuration.
- `tsconfig.json`: TypeScript configuration for the Next.js app.
- `components.json`: ShadCN UI configuration.
- `idx.ts`: Placeholder/Index file.
- `README.md`, `BUILD_INSTRUCTIONS.md`: Project documentation.
- `.vscode/`: VS Code specific settings.

---

## `src` Directory

This is the main application source code folder.

```
/src
├── ai/                              # Genkit AI flows and configuration.
│   ├── flows/describe-cluster-flow.ts
│   └── genkit.ts
│
├── app/                             # Next.js App Router: contains all pages and API routes.
│   ├── api/                         # Backend API routes (server-side logic).
│   │   ├── ai/
│   │   ├── bnf-assessed/
│   │   ├── data-connection/
│   │   ├── ed-selection/
│   │   ├── education-payment-centers/
│   │   ├── educators/
│   │   ├── file-manager/
│   │   ├── indicator-tracking/
│   │   ├── interviews/
│   │   ├── locations/
│   │   ├── logframe/
│   │   ├── monitoring-indicators/
│   │   ├── monitoring-plan/
│   │   ├── pdf-templates/
│   │   ├── project-plan/
│   │   ├── projects/
│   │   ├── purpose-and-scope/
│   │   ├── rules/
│   │   ├── sampling-plan/
│   │   ├── settings/
│   │   ├── training/
│   │   └── trainings/
│   │
│   ├── meal-system/                 # Main hub for all MEAL features.
│   │   ├── monitoring/
│   │   │   ├── initiation-and-planning/
│   │   │   └── implementation/
│   │   ├── project/
│   │   └── ... (other MEAL pages)
│   │
│   ├── file-editor/page.tsx         # Utility page for direct file editing.
│   ├── style-guide/page.tsx         # UI theme selection page.
│   ├── page.tsx                     # Main application homepage (Dashboard).
│   ├── layout.tsx                   # Root application layout.
│   └── globals.css                  # Global styles.
│
├── components/                      # Reusable React components.
│   ├── cards/
│   ├── charts/
│   ├── dashboard/
│   ├── gantt/
│   ├── itt/
│   ├── layout/
│   ├── report/
│   ├── tables/
│   └── ui/                          # ShadCN UI components (Button, Card, Input, etc.).
│
├── context/                         # React context providers.
│   └── language-context.tsx
│
├── data/                            # Seed data for local SQLite databases.
│   └── *.json
│
├── hooks/                           # Custom React hooks.
│   ├── use-itt-data.ts
│   ├── use-mobile.tsx
│   ├── use-toast.ts
│   └── use-translation.ts
│
├── lib/                             # Utility functions, helpers, and core logic.
│   ├── *.ts
│
├── locales/                         # Internationalization (i18n) files.
│   ├── en.json
│   └── ar.json
│
├── styles/                          # Additional CSS files.
│   └── dashboard.css
│
├── theme/                           # Theme configuration files.
│   └── *.ts
│
├── types/                           # TypeScript type definitions.
│   └── *.ts
│
└── workers/                         # Web Workers for background processing.
    └── *.worker.ts
```