
# Beneficiary Insights System - Project Structure

This document outlines the high-level architecture of the application, showing how the main files and folders interact.

```
/
├── src/
│   ├── app/
│   │   ├── api/                  # Backend API routes (server-side logic)
│   │   │   ├── ai/
│   │   │   │   └── describe-cluster/route.ts  # AI endpoint for summarizing clusters.
│   │   │   ├── audit/route.ts          # Main endpoint to run the data integrity audit.
│   │   │   ├── cluster-cache/route.ts # DEPRECATED (using IndexedDB now).
│   │   │   ├── export/
│   │   │   │   └── enrich-and-format/route.ts # DEPRECATED (using Web Worker now).
│   │   │   ├── indicator-tracking/route.ts # API for Indicator Tracking data.
│   │   │   ├── logframe/route.ts       # API for Logframe data.
│   │   │   ├── monitoring-indicators/route.ts # API for detailed Indicator plans.
│   │   │   ├── monitoring-plan/route.ts # API for M&E Plan data.
│   │   │   ├── project-plan/route.ts   # API for Gantt chart / project plan data.
│   │   │   ├── projects/route.ts       # API for creating and managing projects.
│   │   │   ├── purpose-and-scope/route.ts # API for M&E Purpose & Scope plans.
│   │   │   ├── rules/route.ts          # API for managing learned clustering rules.
│   │   │   ├── sampling-plan/route.ts  # API for Sampling Plan calculations.
│   │   │   └── settings/route.ts     # API for getting/saving clustering algorithm settings.
│   │   │
│   │   ├── audit/page.tsx          # Frontend for the Audit page.
│   │   ├── correction/page.tsx     # Frontend for the Rule Learning/Correction page.
│   │   ├── export/page.tsx         # Frontend for the Export page.
│   │   ├── logframe/               # Pages for creating and viewing Logical Frameworks.
│   │   ├── meal-system/            # Main hub for all MEAL (Monitoring, Evaluation, Accountability, Learning) features.
│   │   ├── monitoring/             # Pages for the M&E lifecycle.
│   │   ├── project/                # Pages for project management (dashboard, details, gantt plan).
│   │   ├── report/page.tsx         # Interactive dashboard for visualizing beneficiary data.
│   │   ├── review/page.tsx         # Frontend for the Cluster Review page with new decision workflow.
│   │   ├── settings/page.tsx       # Frontend for the algorithm and system Settings page.
│   │   ├── style-guide/page.tsx    # Page to display UI theme options.
│   │   ├── upload/page.tsx         # Main page for uploading data and starting the clustering process.
│   │   ├── page.tsx                # Main application homepage (dashboard).
│   │   └── layout.tsx              # Root application layout.
│   │
│   ├── components/
│   │   ├── ui/                     # Reusable ShadCN UI components (Button, Card, etc.).
│   │   ├── dashboard/              # Components for the main MEAL dashboard.
│   │   ├── gantt/                  # Components for the Gantt chart view.
│   │   ├── itt/                    # Components for the Indicator Tracking Table.
│   │   ├── layout/                 # Main layout components (Sidebar, etc).
│   │   ├── report/                 # Components used on the interactive Report page.
│   │   ├── tables/                 # Reusable table components.
│   │   └── PairwiseModal.tsx       # Modal used on the Review page to inspect cluster details.
│   │
│   ├── context/
│   │   └── language-context.tsx    # React context for managing application language (i18n).
│   │
│   ├── data/
│   │   ├── *.json                  # JSON files acting as a simple database for projects, logframes, etc.
│   │
│   ├── hooks/
│   │   ├── use-itt-data.ts         # Hook for fetching all data related to the ITT page.
│   │   ├── use-mobile.ts           # Hook to detect if the user is on a mobile device.
│   │   ├── use-toast.ts            # Hook for showing toast notifications.
│   │   └── use-translation.ts      # Hook for handling language translation.
│   │
│   ├── lib/                      # Shared libraries, types, and utility functions.
│   │   ├── auditEngine.ts        # Logic for the data integrity audit.
│   │   ├── cache.ts              # Functions for interacting with IndexedDB.
│   │   ├── ganttUtils.ts         # Utility functions for Gantt chart calculations.
│   │   ├── similarity.ts         # Core string similarity functions (Jaro-Winkler, etc.).
│   │   ├── types.ts              # Core TypeScript types (e.g., RecordRow).
│   │   └── ...other utils
│   │
│   ├── locales/
│   │   ├── ar.json                 # Arabic translations.
│   │   └── en.json                 # English translations.
│   │
│   ├── styles/
│   │   └── dashboard.css           # Additional specific styles.
│   │
│   ├── theme/
│   │   ├── colors.ts               # Theme color definitions.
│   │   ├── motion.ts               # Animation variant definitions (Framer Motion).
│   │   └── typography.ts           # Typography style definitions.
│   │
│   ├── types/
│   │   ├── gantt.ts                # TypeScript types for Gantt chart tasks.
│   │   ├── indicator.ts            # Core indicator type definitions.
│   │   └── ...other types
│   │
│   └── workers/
│       ├── cluster.worker.ts       # Primary web worker for heavy data clustering logic.
│       ├── export.worker.ts        # Web worker for generating the final Excel export file.
│       ├── learning.worker.ts      # Web worker for generating new rules from user feedback.
│       ├── preprocess.ts           # Client-side safe data preprocessing logic.
│       └── scoring.worker.ts       # Web worker for calculating detailed pairwise scores post-clustering.
│
├── public/
│   └── data/
│       └── yemen_admin*.geojson    # GeoJSON files for map boundaries.
│
├── BUILD_INSTRUCTIONS.md         # Original build guide.
└── PROJECT_STRUCTURE.md          # This file.
```

## Core Application Flow

1.  **Upload**: The user starts at `/upload`. They upload an Excel file, which is parsed and cached in the browser's **IndexedDB** using functions from `src/lib/cache.ts`.
2.  **Clustering**: The user maps columns and clicks "Start Clustering." The page sends the data to the **Clustering Web Worker** (`src/workers/cluster.worker.ts`). The worker performs all heavy computations in a background thread.
3.  **Scoring & Caching**: Once the main clustering is done, the results are passed to the **Scoring Web Worker** (`src/workers/scoring.worker.ts`) to calculate detailed pairwise scores and confidence levels. The final, enriched clusters are then saved back to IndexedDB.
4.  **Review**: The user navigates to `/review`. The page reads the cached results from IndexedDB and displays them. Users can make decisions on each cluster, which are saved back to the cache.
5.  **Audit**: The user navigates to `/audit`. It also loads data from the IndexedDB cache. It runs the client-side audit engine (`src/lib/auditEngine.ts`) and saves the findings.
6.  **Report & Export**: The `/report` page loads all cached data to create an interactive dashboard. The `/export` page uses the **Export Web Worker** (`src/workers/export.worker.ts`) to generate the final, multi-sheet Excel report for download.
7.  **MEAL System**: The `/meal-system` acts as a hub, linking to various monitoring and evaluation pages like `/logframe`, `/project/plan`, and `/monitoring`, which fetch their data from the respective JSON files in `/src/data/` via the API routes in `/src/app/api/`.

