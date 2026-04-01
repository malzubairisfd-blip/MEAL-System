# Project Structure

This document outlines the high-level architecture of the application, showing how all files and folders are organized.

## Root Directory

```
.
├── .agents/
│   └── skills/
│       └── developing-genkit-js/
│           ├── references/
│           │   ├── best-practices.md
│           │   ├── common-errors.md
│           │   ├── docs-and-cli.md
│           │   ├── examples.md
│           │   └── setup.md
│           └── SKILL.md
├── .env
├── .vscode/
│   ├── launch.json
│   └── settings.json
├── PROJECT_STRUCTURE.md
├── README.md
├── Test.md
├── components.json
├── idx.ts
├── metadata.json
├── next.config.js
├── package.json
├── skills-lock.json
├── src/
│   ├── ai/
│   │   ├── flows/
│   │   │   └── describe-cluster-flow.ts
│   │   └── genkit.ts
│   ├── app/
│   │   ├── api/
│   │   │   ├── ai/
│   │   │   │   └── describe-cluster/
│   │   │   │       └── route.ts
│   │   │   ├── bnf-assessed/
│   │   │   │   ├── download/
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── bnf-cash-disbursement/
│   │   │   │   └── route.ts
│   │   │   ├── bnf-cmam/
│   │   │   │   ├── referral-update/
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── bnf-referral-cycle/
│   │   │   │   └── route.ts
│   │   │   ├── child-cmam/
│   │   │   │   ├── referral-update/
│   │   │   │   │   └── route.ts
│   │   │   │   └── route.ts
│   │   │   ├── data-connection/
│   │   │   │   └── route.ts
│   │   │   ├── ed-cash-disbursement/
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
│   │   │   ├── enrollment-review/
│   │   │   │   └── route.ts
│   │   │   ├── export-folder/
│   │   │   │   └── route.ts
│   │   │   ├── file-manager/
│   │   │   │   └── route.ts
│   │   │   ├── health-centers/
│   │   │   │   ├── download/
│   │   │   │   │   └── route.ts
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
│   │   │   ├── monthly-health-sessions/
│   │   │   │   ├── download/
│   │   │   │   │   └── route.ts
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
│   │   │   ├── system-intelligence/
│   │   │   │   ├── analyze/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── export-pdf/
│   │   │   │   │   └── route.ts
│   │   │   │   └── export-word/
│   │   │   │       └── route.ts
│   │   │   ├── training/
│   │   │   │   ├── attendance/
│   │   │   │   │   └── route.ts
│   │   │   │   ├── qualify/
│   │   │   │   │   └── route.ts
│   │   │   │   └── requirements/
│   │   │   │       └── route.ts
│   │   │   ├── trainings/
│   │   │   │   └── link/
│   │   │   │       └── route.ts
│   │   │   └── validate-name/
│   │   │       └── route.ts
│   │   ├── export-folders/
│   │   │   └── page.tsx
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
│   │   │   │   │   │   │   │   ├── export/
│   │   │   │   │   │   │   │   │   └── page.tsx
│   │   │   │   │   │   │   │   ├── page.tsx
│   │   │   │   │   │   │   │   └── view/
│   │   │   │   │   │   │   │       └── page.tsx
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
│   │   ├── settings/
│   │   │   └── page.tsx
│   │   ├── style-guide/
│   │   │   └── page.tsx
│   │   └── system-architecture/
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
│   │   ├── dashboard/
│   │   │   └── MealDashboard.tsx
│   │   ├── dashboard-components.tsx
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
│   │   │   ├── alert-dialog.tsx
│   │   │   ├── alert.tsx
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
│   │   ├── bnf-referral-cycle.json
│   │   ├── child-referral-cycle.json
│   │   ├── educators.db.json
│   │   ├── indicator-tracking.json
│   │   ├── interviews.json
│   │   ├── loc.json
│   │   ├── logframes.json
│   │   ├── monitoring-indicators.json
│   │   ├── monitoring-plans.json
│   │   ├── pdf-templates.json
│   │   ├── project-plans.json
│   │   └── projects.json
│   ├── hooks/
│   │   ├── use-itt-data.ts
│   │   ├── use-mobile.tsx
│   │   ├── use-toast.ts
│   │   └── use-translation.ts
│   ├── lib/
│   │   ├── apiAnalyzer.ts
│   │   ├── arabic-fixer.ts
│   │   ├── arabicClusterSummary.ts
│   │   ├── auditEngine.ts
│   │   ├── cache.ts
│   │   ├── confirmationchildcmam-export.ts
│   │   ├── contract-template.ts
│   │   ├── dependencyGraph.ts
│   │   ├── dsu.ts
│   │   ├── excel-export.ts
│   │   ├── exportBnfToExcel.ts
│   │   ├── exportChildCmamToExcel.ts
│   │   ├── exportCmamToExcel.ts
│   │   ├── exportDisbursementToExcel.ts
│   │   ├── exportEducatorsToExcel.ts
│   │   ├── exportEnrollmentToExcel.ts
│   │   ├── exportEpcToExcel.ts
│   │   ├── exportGanttToExcel.ts
│   │   ├── exportGanttToPDF.ts
│   │   ├── exportHealthCentersToExcel.ts
│   │   ├── exportHealthSessionsToExcel.ts
│   │   ├── exportSamplingPlanToExcel.ts
│   │   ├── exportToWord.ts
│   │   ├── fullValidation.ts
│   │   ├── ganttTimeline.ts
│   │   ├── ganttUtils.ts
│   │   ├── generateContractPDF.ts
│   │   ├── geojson-utils.ts
│   │   ├── itt-calculations.ts
│   │   ├── ittCalculations.ts
│   │   ├── logframe.ts
│   │   ├── placeholder-images.json
│   │   ├── placeholder-images.ts
│   │   ├── registerSW.ts
│   │   ├── riskBuilder.ts
│   │   ├── schemaReader.ts
│   │   ├── similarity.ts
│   │   ├── statusStyles.ts
│   │   ├── systemScanner.ts
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
│       ├── bnfcmam-export.worker.ts
│       ├── bnfreferralcmam-export.worker.ts
│       ├── childcmam-export.worker.ts
│       ├── childreferralcmam-export.worker.ts
│       ├── cluster.worker.ts
│       ├── double-benefit.worker.ts
│       ├── ed-selection.worker.ts
│       ├── enrollment-review.worker.ts
│       ├── enrollment.worker.ts
│       ├── export.worker.ts
│       ├── id-card.worker.ts
│       ├── interview-analysis.worker.ts
│       ├── learning.worker.ts
│       ├── monthly-sessions.worker.ts
│       ├── preprocess.ts
│       └── scoring.worker.ts
├── tailwind.config.ts
├── tsconfig.electron.json
├── tsconfig.json
└── workspace/
    └── .env
```
