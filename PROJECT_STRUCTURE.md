# Project Structure

This document outlines the high-level architecture of the application, showing how all files and folders are organized.

## Root Directory

```
.
├── .env
├── .vscode/
│   ├── launch.json
│   └── settings.json
├── BUILD_INSTRUCTIONS.md
├── PROJECT_STRUCTURE.md
├── README.md
├── apphosting.yaml
├── components.json
├── idx.ts
├── next.config.js
├── package.json
├── src/
│   ├── ai/
│   │   ├── flows/
│   │   │   └── describe-cluster-flow.ts
│   │   └── genkit.ts
│   ├── api/
│   │   └── bnf-assessed/
│   │       ├── download/
│   │       │   └── route.ts
│   │       └── route.ts
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai/
│   │   │   │   └── describe-cluster/
│   │   │   │       └── route.ts
│   │   │   ├── bnf-assessed/
│   │   │   │   ├── download/
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── data-connection/
│   │   │   │   └── route.ts
│   │   │   ├── ed-selection/
│   │   │   │   ├── download/
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── education-payment-centers/
│   │   │   │   └── route.ts
│   │   │   ├── educators/
│   │   │   │   ├── update-beneficiary-info/
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── file-manager/
│   │   │   │   └── route.ts
│   │   │   ├── indicator-tracking/
│   │   │   │   └── route.ts
│   │   │   ├── interview-statements/
│   │   │   │   └── route.ts
│   │   │   ├── interviews/
│   │   │   │   ├── export/
│   │   │   │   │   └── route.ts
│   │   │   │   └── link/
│   │   │   │       └── route.ts
│   │   │   ├── locations/
│   │   │   │   └── route.ts
│   │   │   ├── logframe/
│   │   │   │   └── route.ts
│   │   │   ├── monitoring-indicators/
│   │   │   │   └── route.ts
│   │   │   ├── monitoring-plan/
│   │   │   │   └── route.ts
│   │   │   ├── pdf-templates/
│   │   │   │   └── route.ts
│   │   │   ├── project-plan/
│   │   │   │   └── route.ts
│   │   │   ├── projects/
│   │   │   │   └── route.ts
│   │   │   ├── purpose-and-scope/
│   │   │   │   └── route.ts
│   │   │   ├── rules/
│   │   │   │   └── route.ts
│   │   │   ├── sampling-plan/
│   │   │   │   └── route.ts
│   │   │   ├── settings/
│   │   │   │   └── route.ts
│   │   │   ├── training/
│   │   │   │   ├── attendance/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── qualify/
│   │   │   │   │   └── route.ts
│   │   │   │   └── requirements/
│   │   │   │       └── route.ts
│   │   │   └── trainings/
│   │   │       └── link/
│   │   │           └── route.ts
│   │   ├── file-editor/
│   │   │   └── page.tsx
│   │   ├── globals.css
│   │   ├── layout.tsx
│   │   ├── meal-system/
│   │   │   ├── analysis/
│   │   │   │   └── page.tsx
│   │   │   ├── compliant/
│   │   │   │   └── page.tsx
│   │   │   ├── evaluation/
│   │   │   │   └── page.tsx
│   │   │   ├── indicator/
│   │   │   │   └── page.tsx
│   │   │   ├── monitoring/
│   │   │   │   ├── closure/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── implementation/
│   │   │   │   │   ├── beneficiary-monitoring/
│   │   │   │   │   │   ├── Beneficiaries/
│   │   │   │   │   │   │   ├── audit/
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   ├── correction/
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   ├── database/
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   ├── export/
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   │   ├── report/
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   ├── review/
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   └── upload/
│   │   │   │   │   │   │       └── page.tsx
│   │   │   │   │   │   ├── community-educators/
│   │   │   │   │   │   │   ├── connecting/
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   ├── contracts/
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   ├── database/
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   ├── double-benefits/
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   ├── interview/
│   │   │   │   │   │   │   │   ├── export-exact-pdf/
│   │   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   │   ├── export-statements/
│   │   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   │   ├── interview-results/
│   │   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   │   ├── selection/
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   └── training/
│   │   │   │   │   │   │       └── page.tsx
│   │   │   │   │   │   └── education-and-payment-center/
│   │   │   │   │   │       ├── add-center/
│   │   │   │   │   │       │   └── page.tsx
│   │   │   │   │   │       ├── add-locations/
│   │   │   │   │   │       │   └── page.tsx
│   │   │   │   │   │       ├── edit-center/
│   │   │   │   │   │       │   └── page.tsx
│   │   │   │   │   │       ├── modification/
│   │   │   │   │   │       │   └── page.tsx
│   │   │   │   │   │       ├── page.tsx
│   │   │   │   │   │       └── upload-centers/
│   │   │   │   │   │           └── page.tsx
│   │   │   │   │   ├── compliance/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── context/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── enrollment/
│   │   │   │   │   │   ├── create-id-cards/
│   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   ├── create-sheets/
│   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   └── review/
│   │   │   │   │   │       └── page.tsx
│   │   │   │   │   ├── financial/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── organizational/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── process/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── results/
│   │   │   │   │       └── page.tsx
│   │   │   │   ├── initiation-and-planning/
│   │   │   │   │   ├── budget/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── data-analysis/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── data-collection/
│   │   │   │   │   │   ├── itt/
│   │   │   │   │   │   │   ├── edit/
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── hr/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── me-plan-table/
│   │   │   │   │   │   ├── add/
│   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── page.tsx
│   │   │   │   │   ├── prepare-indicators/
│   │   │   │   │   │   ├── add/
│   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── purpose-and-scope/
│   │   │   │   │   │   ├── add/
│   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   ├── reporting/
│   │   │   │   │   │   └── page.tsx
│   │   │   │   │   └── sampling-calculator/
│   │   │   │   │       └── page.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── page.tsx
│   │   │   ├── reporting/
│   │   │   │   └── page.tsx
│   │   │   ├── risk/
│   │   │   │   └── page.tsx
│   │   │   └── settings/
│   │   │       └── page.tsx
│   │   ├── page.tsx
│   │   ├── project/
│   │   │   ├── add/
│   │   │   │   └── page.tsx
│   │   │   ├── dashboard/
│   │   │   │   └── page.tsx
│   │   │   ├── details/
│   │   │   │   └── page.tsx
│   │   │   ├── logframe/
│   │   │   │   ├── add/
│   │   │   │   │   └── page.tsx
│   │   │   │   ├── edit/
│   │   │   │   │   └── page.tsx
│   │   │   │   └── page.tsx
│   │   │   ├── page.tsx
│   │   │   └── plan/
│   │   │       ├── add-task/
│   │   │       │   └── page.tsx
│   │   │       ├── edit-task/
│   │   │       │   └── page.tsx
│   │   │       └── page.tsx
│   │   └── style-guide/
│   │       └── page.tsx
│   ├── components/
│   │   ├── DecisionPieChart.tsx
│   │   ├── HeatmapLayer.tsx
│   │   ├── Map.tsx
│   │   ├── PairwiseModal.tsx
│   │   ├── cards/
│   │   │   └── ImpactCard.tsx
│   │   ├── charts/
│   │   │   └── OutcomeTrendChart.tsx
│   │   ├── dashboard-components.tsx
│   │   ├── dashboard/
│   │   │   └── MealDashboard.tsx
│   │   ├── feedback/
│   │   │   └── StatusBadge.tsx
│   │   ├── gantt/
│   │   │   ├── GanttChart.tsx
│   │   │   ├── GanttHeader.tsx
│   │   │   └── GanttRow.tsx
│   │   ├── itt/
│   │   │   ... (omitted for brevity)
│   │   ├── layout/
│   │   │   ├── MealLayout.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── layout-provider.tsx
│   │   ├── leaflet-layers.tsx
│   │   ├── report/
│   │   │   ... (omitted for brevity)
│   │   ├── tables/
│   │   │   └── EvidenceTable.tsx
│   │   ├── ui/
│   │   │   ... (omitted for brevity)
│   │   └── under-construction-page.tsx
│   ├── context/
│   │   └── language-context.tsx
│   ├── data/
│   │   ... (omitted for brevity)
│   ├── hooks/
│   │   ... (omitted for brevity)
│   ├── lib/
│   │   ... (omitted for brevity)
│   ├── locales/
│   │   ├── ar.json
│   │   └── en.json
│   ├── styles/
│   │   └── dashboard.css
│   ├── theme/
│   │   ├── colors.ts
│   │   ├── motion.ts
│   │   └── typography.ts
│   ├── types/
│   │   ... (omitted for brevity)
│   └── workers/
│       ... (omitted for brevity)
├── tailwind.config.ts
├── tsconfig.electron.json
├── tsconfig.json
└── workspace/
    └── .env
```
