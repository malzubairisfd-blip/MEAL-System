# Beneficiary-Insights-System

This is a comprehensive MEAL (Monitoring, Evaluation, Accountability, and Learning) system designed for managing and analyzing beneficiary data for humanitarian and development projects. It provides a suite of tools for everything from initial project planning to final reporting, with a strong focus on data integrity, fraud detection, and operational efficiency.

## Project Structure

This document outlines the high-level architecture of the application, showing how all files and folders are organized.

### Root Directory

The root contains configuration files for Next.js (`next.config.js`), Tailwind CSS (`tailwind.config.ts`), TypeScript (`tsconfig.json`), and other project settings.

### `src/` Directory

This is the main application source code directory.

#### `src/ai/`

This directory houses the Generative AI functionalities of the application, built with **Genkit**.

-   **`flows/describe-cluster-flow.ts`**: Contains a Genkit flow that uses an AI model to analyze and describe clusters of potentially duplicate beneficiary records. It provides a summary in Arabic, focusing on similarities in names and other identifying information to help auditors make decisions.

#### `src/app/api/`

This directory defines all the server-side API endpoints for the application. It handles data processing, database interactions, and other backend logic.

-   **`ai/`**: Endpoints related to AI operations.
    -   `describe-cluster/route.ts`: API endpoint to trigger the AI-powered cluster description flow.
-   **`bnf-assessed/`**: Manages the core `bnf-assessed.db` SQLite database, which stores deduplicated and audited beneficiary records.
    -   Handles CRUD (Create, Read, Update, Delete) operations, duplicate checks, and data downloads.
-   **`bnf-cash-disbursement/` & `ed-cash-disbursement/`**: APIs for managing cash disbursement data for both beneficiaries and community educators, respectively. They handle complex, multi-cycle payment data.
-   **`bnf-cmam/` & `child-cmam/`**: Endpoints for managing Community Management of Acute Malnutrition (CMAM) data for beneficiaries and children. This includes screening, confirmation, and referral cycle updates.
-   **`data-connection/`**: A crucial API for data orchestration. It connects data across different databases, such as linking educators to education centers and beneficiaries to educators.
-   **`ed-selection/`**: Manages the `educators.db` database, which stores information about community educator candidates, including their selection process, interview results, and contract details.
-   **`education-payment-centers/`**: Manages the `ec_pc.db` database, storing details about education and payment centers.
-   **`file-manager/`**: A general-purpose API for interacting with the file system, allowing for creating, reading, updating, and deleting files and folders, as well as handling file uploads (including ZIP files).
-   **`health-centers/`**: Manages the `health-center.db` database, containing information about health centers and workers.
-   **`indicator-tracking/`, `logframe/`, `monitoring-plan/`, `project-plan/`, `purpose-and-scope/`, `sampling-plan/`**: A suite of APIs that manage the core MEAL planning documents stored in their respective SQLite databases. They handle the creation, retrieval, and updating of project goals, indicators, tasks, and monitoring strategies.
-   **`interviews/`, `training/`**: Endpoints related to the educator lifecycle, including assigning applicants to interview/training halls and exporting statements.

#### `src/app/` (Pages)

This directory contains all the user-facing pages of the application, built with Next.js App Router.

-   **`page.tsx`**: The main dashboard and entry point of the application.
-   **`file-editor/`**: A page providing a web-based IDE for editing project files directly.
-   **`meal-system/`**: The core of the application, organized according to the MEAL lifecycle.
    -   **`monitoring/`**: Contains pages for the different stages of monitoring.
        -   **`initiation-and-planning/`**: Tools for planning the M&E process, including defining indicators, creating project plans, and calculating sample sizes.
        -   **`implementation/`**: Pages for executing the monitoring plan. This is the most extensive part of the system.
            -   **`beneficiary-monitoring/`**: Tools for managing beneficiary data, including the fraud detection and deduplication workflow (Upload, Review, Audit, Report, Export).
            -   **`community-educators/`**: Tools for managing the entire lifecycle of community educators, from selection and interviews to contracts and training.
            -   **`enrollment/`**: Pages for managing beneficiary enrollment, including generating ID cards and review sheets.
            -   **`process/`**: Tools for monitoring specific project processes like health sessions and cash disbursements.
        -   **`closure/`**: Placeholder for project closure activities.
    -   **`evaluation/`, `analysis/`, `reporting/`, `risk/`, `compliant/`, `indicator/`**: Other key sections of the MEAL system.
-   **`settings/`**: A page for configuring the application's core logic, such as the clustering engine's thresholds and weights, and managing auto-generated rules.
-   **`style-guide/` & `system-architecture/`**: Pages for developers and administrators to view the application's design system and generated architecture diagrams.

#### `src/components/`

Contains all the reusable React components used throughout the application, organized by function (e.g., `charts/`, `tables/`, `ui/`). The `ui/` directory holds base components from `shadcn/ui`.

#### `src/context/`

Includes React Context providers, such as the `language-context.tsx` for managing internationalization (i18n).

#### `src/data/`

Stores static data files and serves as the location for the application's SQLite databases (e.g., `projects.db`, `loc.json`).

#### `src/hooks/`

Contains custom React hooks, like `use-toast.ts` for showing notifications and `use-translation.ts` for i18n.

#### `src/lib/`

A library of utility functions, helper scripts, and core business logic that is shared across the application. This includes data export functions (`exportToExcel.ts`, `exportToWord.ts`), similarity calculation logic (`similarity.ts`), and database interaction logic.

#### `src/locales/`

Contains JSON files for different languages (`en.json`, `ar.json`) used by the `use-translation` hook.

#### `src/workers/`

Holds the application's Web Workers. These are used to run computationally intensive tasks like data clustering, scoring, and PDF/Excel generation in the background without freezing the user interface.
