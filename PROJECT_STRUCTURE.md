# Project Structure

This document outlines the high-level architecture of the application, showing how the main files and folders are organized within the `src/app` directory.

```
/src/app
├── (main pages)
│   ├── page.tsx                # Main application homepage (Dashboard).
│   ├── layout.tsx              # Root application layout.
│   ├── globals.css             # Global styles for the application.
│   ├── style-guide/page.tsx    # Page to display UI theme options.
│
├── api/                      # Backend API routes (server-side logic)
│   ├── ai/
│   │   └── describe-cluster/route.ts
│   ├── indicator-tracking/route.ts
│   ├── logframe/route.ts
│   ├── monitoring-indicators/route.ts
│   ├── monitoring-plan/route.ts
│   ├── project-plan/route.ts
│   ├── projects/route.ts
│   ├── purpose-and-scope/route.ts
│   ├── rules/route.ts
│   ├── sampling-plan/route.ts
│   └── settings/route.ts
│
├── (beneficiary data analysis)
│   ├── upload/page.tsx         # Main page for uploading data and starting the clustering process.
│   ├── review/page.tsx         # Frontend for the Cluster Review page with new decision workflow.
│   ├── correction/page.tsx     # Frontend for the Rule Learning/Correction page.
│   ├── audit/page.tsx          # Frontend for the Audit page.
│   ├── report/page.tsx         # Interactive dashboard for visualizing beneficiary data.
│   ├── export/page.tsx         # Frontend for the Export page.
│   └── settings/page.tsx       # Frontend for the algorithm and system Settings page.
│
├── meal-system/              # Main hub for all MEAL features.
│   ├── page.tsx
│   ├── settings/page.tsx
│   ├── analysis/page.tsx
│   ├── compliant/page.tsx
│   ├── evaluation/page.tsx
│   ├── indicator/page.tsx
│   ├── reporting/page.tsx
│   └── risk/page.tsx
│
├── project/                  # Pages for project management (dashboard, details, gantt plan).
│   ├── page.tsx
│   ├── add/page.tsx
│   ├── add-task/page.tsx
│   ├── dashboard/page.tsx
│   ├── details/page.tsx
│   ├── edit-task/page.tsx
│   └── plan/page.tsx
│
├── logframe/                 # Pages for creating and viewing Logical Frameworks.
│   ├── page.tsx
│   ├── add/page.tsx
│   └── edit/page.tsx
│
└── monitoring/               # Pages for the M&E lifecycle.
    ├── page.tsx
    ├── closure/page.tsx
    ├── implementation/
    │   ├── page.tsx
    │   ├── beneficiary/page.tsx
    │   ├── compliance/page.tsx
    │   ├── context/page.tsx
    │   ├── financial/page.tsx
    │   ├── organizational/page.tsx
    │   ├── process/page.tsx
    │   └── results/page.tsx
    └── initiation-and-planning/
        ├── page.tsx
        ├── budget/page.tsx
        ├── data-analysis/page.tsx
        ├── hr/page.tsx
        ├── reporting/page.tsx
        ├── data-collection/
        │   ├── page.tsx
        │   ├── itt/
        │   │   ├── page.tsx
        │   │   └── edit/page.tsx
        │   ├── data-types/page.tsx
        │   ├── secondary-data/page.tsx
        │   ├── staff-criteria/page.tsx
        │   └── surveys/page.tsx
        ├── me-plan-table/
        │   ├── page.tsx
        │   └── add/page.tsx
        ├── prepare-indicators/
        │   ├── page.tsx
        │   └── add/page.tsx
        ├── purpose-and-scope/
        │   ├── page.tsx
        │   └── add/page.tsx
        └── sampling-calculator/page.tsx
```