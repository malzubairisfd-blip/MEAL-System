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
│   ├── all_api.ts
│   ├── all_hooks.ts
│   ├── all_lib.ts
│   ├── all_pages.tsx
│   ├── all_workers.ts
│   ├── api/
│   │   └── bnf-assessed/
│   │       ├── download/
│   │       │   └── route.ts
│   │       └── route.ts
│   ├── app/
│   │   ├── PROJECT_STRUCTURE.md
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
│   │   │   │   │   ├── beneficiary/
│   │   │   │   │   │   └── page.tsx
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
│   │   │   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   │   │   └── upload/
│   │   │   │   │   │   │   │       └── page.tsx
│   │   │   │   │   │   │   └── training/
│   │   │   │   │   │   │       └── page.tsx
│   │   │   │   │   │   ├── education-and-payment-center/
│   │   │   │   │   │   │   ├── add-center/
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   ├── add-locations/
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   ├── edit-center/
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   ├── modification/
│   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   │   └── upload-centers/
│   │   │   │   │   │   │       └── page.tsx
│   │   │   │   │   │   └── page.tsx
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
│   │   │   ├── settings/
│   │   │   │   └── page.tsx
│   │   │   └── project/
│   │   │       ├── add/
│   │   │       │   └── page.tsx
│   │   │       ├── dashboard/
│   │   │       │   └── page.tsx
│   │   │       ├── details/
│   │   │       │   └── page.tsx
│   │   │       ├── logframe/
│   │   │       │   ├── add/
│   │   │       │   │   └── page.tsx
│   │   │       │   ├── edit/
│   │   │       │   │   └── page.tsx
│   │   │       │   └── page.tsx
│   │   │       ├── page.tsx
│   │   │       └── plan/
│   │   │           ├── add-task/
│   │   │           │   └── page.tsx
│   │   │           ├── edit-task/
│   │   │           │   └── page.tsx
│   │   │           └── page.tsx
│   │   ├── page.tsx
│   │   ├── settings/
│   │   │   └── page.tsx
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
│   │   │   ├── ITTFilters.tsx
│   │   │   ├── ITTHeaderBar.tsx
│   │   │   ├── ITTProgressBar.tsx
│   │   │   ├── ITTStatusBadge.tsx
│   │   │   ├── ITTTableCell.tsx
│   │   │   ├── ImpactCards.tsx
│   │   │   ├── IndicatorRow.tsx
│   │   │   ├── IndicatorTable.tsx
│   │   │   └── IndicatorTrackingTable.tsx
│   │   │   └── ProjectInfo.tsx
│   │   ├── layout/
│   │   │   ├── MealLayout.tsx
│   │   │   └── Sidebar.tsx
│   │   ├── layout-provider.tsx
│   │   ├── leaflet-layers.tsx
│   │   ├── report/
│   │   │   ├── BubbleStats.tsx
│   │   │   ├── ColumnMapping.tsx
│   │   │   ├── GenderVisual.tsx
│   │   │   ├── KeyFigures.tsx
│   │   │   └── TableBarCharts.tsx
│   │   ├── tables/
│   │   │   └── EvidenceTable.tsx
│   │   ├── ui/
│   │   │   ├── accordion.tsx
│   │   │   ├── alert.tsx
│   │   │   ├── alert-dialog.tsx
│   │   │   ├── avatar.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── button.tsx
│   │   │   ├── calendar.tsx
│   │   │   ├── card.tsx
│   │   │   ├── carousel.tsx
│   │   │   ├── chart.tsx
│   │   │   ├── checkbox.tsx
│   │   │   ├── collapsible.tsx
│   │   │   ├── command.tsx
│   │   │   ├── dialog.tsx
│   │   │   ├── dropdown-menu.tsx
│   │   │   ├── form.tsx
│   │   │   ├── input.tsx
│   │   │   ├── label.tsx
│   │   │   ├── menubar.tsx
│   │   │   ├── popover.tsx
│   │   │   ├── progress.tsx
│   │   │   ├── radio-group.tsx
│   │   │   ├── scroll-area.tsx
│   │   │   ├── select.tsx
│   │   │   ├── separator.tsx
│   │   │   ├── sheet.tsx
│   │   │   ├── skeleton.tsx
│   │   │   ├── slider.tsx
│   │   │   ├── switch.tsx
│   │   │   ├── table.tsx
│   │   │   ├── tabs.tsx
│   │   │   ├── textarea.tsx
│   │   │   ├── toast.tsx
│   │   │   ├── toaster.tsx
│   │   │   └── tooltip.tsx
│   │   └── under-construction-page.tsx
│   ├── context/
│   │   └── language-context.tsx
│   ├── data/
│   │   ├── auto-rules.json
│   │   ├── educators.db.json
│   │   ├── indicator-tracking.json
│   │   ├── interviews.json
│   │   ├── loc.json
│   │   ├── logframes.json
│   │   ├── monitoring-indicators.json
│   │   ├── monitoring-plans.json
│   │   ├── pdf-templates.json
│   │   ├── project-plans.json
│   │   ├── projects.json
│   │   ├── sampling-plans.json
│   │   └── scope-and-purpose.json
│   ├── hooks/
│   │   ├── use-itt-data.ts
│   │   ├── use-mobile.tsx
│   │   ├── use-toast.ts
│   │   └── use-translation.ts
│   ├── lib/
│   │   ├── arabic-fixer.ts
│   │   ├── arabicClusterSummary.ts
│   │   ├── auditEngine.ts
│   │   ├── cache.ts
│   │   ├── dsu.ts
│   │   ├── excel-export.ts
│   │   ├── exportBnfToExcel.ts
│   │   ├── exportEducatorsToExcel.ts
│   │   ├── exportEpcToExcel.ts
│   │   ├── exportGanttToExcel.ts
│   │   ├── exportGanttToPDF.ts
│   │   ├── exportSamplingPlanToExcel.ts
│   │   ├── exportToWord.ts
│   │   ├── ganttTimeline.ts
│   │   ├── ganttUtils.ts
│   │   ├── geojson-utils.ts
│   │   ├── itt-calculations.ts
│   │   ├── ittCalculations.ts
│   │   ├── logframe.ts
│   │   ├── placeholder-images.json
│   │   ├── placeholder-images.ts
│   │   ├── registerSW.ts
│   │   ├── similarity.ts
│   │   ├── statusStyles.ts
│   │   ├── types.ts
│   │   ├── utils.ts
│   │   └── wakeLock.ts
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
│   │   ├── gantt.ts
│   │   ├── indicator-tracking.ts
│   │   ├── indicator.ts
│   │   ├── monitoring-indicators.ts
│   │   └── monitoring-plan.ts
│   └── workers/
│       ├── cluster.worker.ts
│       ├── double-benefit.worker.ts
│       ├── ed-selection.worker.ts
│       ├── enrollment.worker.ts
│       ├── export.worker.ts
│       ├── id-card.worker.ts
│       ├── interview-analysis.worker.ts
│       ├── learning.worker.ts
│       └── preprocess.ts
├── tailwind.config.ts
├── tsconfig.electron.json
├── tsconfig.json
└── workspace/
    └── .env
```
