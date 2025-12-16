
# Building the Beneficiary Insights System: A to Z Guide

This document provides a detailed, step-by-step guide to building the Beneficiary Insights application from scratch. It covers the project setup, core logic, UI components, and backend services.

---

### **Technology Stack**

*   **Framework**: Next.js with React & TypeScript
*   **UI**: ShadCN UI & Tailwind CSS
*   **File Processing**: `xlsx` (reading), `exceljs` (writing)
*   **AI Integration**: Firebase Genkit
*   **State Management**: React State & Context, `sessionStorage` for lightweight session persistence.
*   **Core Logic**: A self-contained Web Worker for client-side fuzzy matching and clustering.

---

## **Part 1: Project Setup and UI Foundation**

### **Step 1: Initialize Next.js Project**

1.  Create a new Next.js application with TypeScript and Tailwind CSS.
    ```bash
    npx create-next-app@latest beneficiary-insights --typescript --tailwind --eslint
    ```
2.  Navigate into the project directory.
    ```bash
    cd beneficiary-insights
    ```

### **Step 2: Set up ShadCN UI**

1.  Initialize ShadCN UI in your project. This will set up your `components.json` and `globals.css` theme.
    ```bash
    npx shadcn-ui@latest init
    ```
2.  Add the necessary UI components that will be used throughout the application.
    ```bash
    npx shadcn-ui@latest add card button input label progress scroll-area radio-group toast sonner dialog select table badge accordion slider switch tooltip collapsible
    ```

### **Step 3: Create the Main Layout (`src/app/layout.tsx`)**

1.  Create a `src/components/layout-provider.tsx` component. This component will manage the main application layout, including a persistent sidebar for navigation.
2.  The `LayoutProvider` uses a custom `Sidebar` component (built from ShadCN's `sheet` for mobile and custom styles for desktop) to create a responsive navigation experience.
3.  Define the navigation links (Dashboard, Upload, Review, Audit, Export, Settings) within the sidebar.
4.  Wrap the `children` of the main `AppLayout` in `src/app/layout.tsx` with this `LayoutProvider`.
5.  Add the `<Toaster />` component to the layout to handle application-wide notifications.

---

## **Part 2: The Core - Deterministic Client-Side Clustering Engine**

The heart of the application is a powerful, deterministic clustering engine that runs in a Web Worker to avoid freezing the UI. This ensures identical results for the same input and settings, every time.

### **Step 4: Create the Web Worker Script (`src/app/upload/page.tsx`)**

The entire clustering logic is encapsulated within a single, large template string in `src/app/upload/page.tsx` inside a function called `createWorkerScript()`. This script is dynamically loaded as a Web Worker.

1.  **Yielding to Event Loop**: A `yieldToEventLoop` helper function (`new Promise(resolve => setTimeout(resolve, 0))`) is added to the worker. It is awaited periodically during the heavy comparison loops (`buildEdges`) to prevent the browser UI from freezing on large datasets. This is a critical optimization for user experience.

2.  **Deterministic Blocking and Edge Building (`buildEdges`)**:
    *   **Blocking (`buildBlocks`)**: To avoid O(n²) comparisons, a blocking strategy creates hash keys from record data. Only records sharing a block are compared.
    *   **Stable Block Order**: Crucially, the array of blocks is sorted (`blocks.sort((a, b) => a[0] - b[0])`) to ensure they are processed in the same order every time, making the process deterministic.
    *   **Pairwise Scoring with Yielding**: Inside the loops that compare pairs, a counter (`comparisonsDone`) tracks progress. Every ~2,000 comparisons, the worker posts a progress message back to the UI and calls `yieldToEventLoop`, keeping the application responsive.

3.  **Clustering (`runClustering`)**:
    *   This main function orchestrates the process. It first calls `buildEdges` to get a deterministically generated list of potential matches.
    *   It then uses a **Union-Find** data structure to group connected records into large "super clusters".
    *   Finally, it runs a `splitCluster` algorithm on any super cluster larger than a defined size (e.g., 4 records) to break it down into smaller, more tightly-related final clusters.

4.  **Worker Communication**: The worker script listens for `start`, `data`, and `end` messages and posts `progress`, `done`, and `error` messages back to the main thread.

---

## **Part 3: Building the Application Pages**

### **Step 5: The Upload Page (`src/app/upload/page.tsx`)**

1.  **File Input**: A UI is created for file upload using `<input type="file">`. The `xlsx` library is used to parse the uploaded Excel file in a `FileReader`.
2.  **Column Mapping**: After parsing, the file's columns are displayed. `RadioGroup` components are used for each required field (`womanName`, `husbandName`, etc.) to let the user map them to the correct file column. This section is wrapped in a `Collapsible` component that automatically hides on starting the clustering.
3.  **State Management**: React state manages the file, columns, mapping, and the progress of the clustering worker.
4.  **Dynamic "Run Clustering" Button**: The button is state-aware. It shows "Start Clustering" initially, changes to "Processing..." with a spinner during the run, and "Clustering Done!" upon completion. It is disabled while active.
5.  **Worker Interaction**:
    *   On page load, the Web Worker is initialized from the script created in Step 4.
    *   A message handler (`onmessage`) listens for `progress`, `done`, and `error` events.
    *   When the user clicks "Start Clustering", a `start` message is sent with the column mapping and settings, followed by `data` messages containing chunks of the rows, and finally an `end` message.
6.  **Results & Caching**: When the `done` message is received, the results (clusters, all rows, original headers) are stored in a server-side cache via a POST request to `/api/cluster-cache/route.ts`. The returned `cacheId` is stored in `sessionStorage` to link subsequent pages to this specific run.

### **Step 6: The Review & Audit Pages (`/review` & `/audit`)**

1.  **Data Loading (`src/app/review/page.tsx`, `src/app/audit/page.tsx`)**: On page load, the `cacheId` is retrieved from `sessionStorage`. The cached data (clusters and any existing audit findings) is fetched from the `/api/cluster-cache/route.ts` endpoint using a GET request.
2.  **Cluster Review (`/review`)**:
    *   **Automated Scoring**: An effect hook automatically triggers a call to `/api/pairwise/route.ts` for all clusters to calculate and display average similarity scores and a final "confidence" percentage.
    *   **UI**: The fetched clusters are displayed in a grid of cards with pagination. Search/filter functionality is also implemented.
    *   **Inspection**: An "Inspect" button on each cluster card opens a `PairwiseModal` component (`src/components/PairwiseModal.tsx`), which shows a detailed similarity breakdown for the records in that cluster.
3.  **Audit Page (`/audit`)**:
    *   **Automated Audit**: An effect hook checks if audit findings exist in the cache. If not, it automatically makes a POST request to `/api/audit/route.ts` with the `cacheId` to run the audit.
    *   **Display**: The findings returned from the API are displayed in an `Accordion` component, grouped by severity.
    *   **Cache Update**: After a successful audit, the new findings are saved back to the server-side cache via the `cluster-cache` API.

### **Step 7: The Export Page (`/export`)**

1.  **Data Loading (`src/app/export/page.tsx`)**: Like other pages, it fetches the full dataset (rows, clusters, audit findings) from the cache using the `cacheId`.
2.  **Generate Report Button**: A single button triggers a POST request to the `/api/export/enrich-and-format/route.ts` endpoint.
3.  **Backend Enrichment & Formatting (`/api/export/enrich-and-format/route.ts`)**:
    *   This crucial server-side process fetches all data from the cache file.
    *   **Enrich**: It iterates through all records, adding new columns like `Cluster_ID`, `Cluster_Size`, and `Max_PairScore`.
    *   **Sort**: It sorts the data deterministically, primarily by `Max_PairScore` and then by `Cluster_ID`, to bring the most likely duplicates to the top.
    *   **Generate Excel File**: Using `exceljs`, it creates a multi-sheet workbook: "Enriched Data", "Review Summary", "Cluster Details", and "Audit Findings", complete with conditional formatting and styling.
4.  **Download**: The API responds with the generated Excel file as a buffer, which the frontend then triggers as a download.

### **Step 8: The Settings Page (`/settings`)**

1.  **Backend (`src/app/api/settings/route.ts`)**: GET and POST endpoints are created to read and write a `settings.json` file in a temporary server directory. This file stores the clustering thresholds and score weights.
2.  **Frontend (`src/app/settings/page.tsx`)**:
    *   On page load, the current settings are fetched from the GET endpoint.
    *   A form with sliders and inputs is created for each setting (e.g., `minPair`, `firstNameScore`).
    *   A "Test Scoring" section allows a user to input two sample records and see the live score calculated using the current page settings, mirroring the worker's logic via `src/lib/scoringClient.ts`.
    *   A "Save" button sends the updated settings object to the POST endpoint.

---

## Part 4: Project Flow and File Structure

This section outlines the high-level architecture of the application, showing how the main files and folders interact.

```
/
├── src/
│   ├── app/
│   │   ├── api/                  # Backend API routes (server-side logic)
│   │   │   ├── ai/
│   │   │   │   └── describe-cluster/route.ts  # AI endpoint for summarizing clusters.
│   │   │   ├── audit/
│   │   │   │   ├── export/route.ts   # Endpoint to export audit findings to Excel.
│   │   │   │   └── route.ts          # Main endpoint to run the data integrity audit.
│   │   │   ├── cluster-cache/route.ts # Critical API for caching session data (rows, clusters, etc.).
│   │   │   ├── export/
│   │   │   │   └── enrich-and-format/route.ts # The main endpoint that generates the final, multi-sheet Excel report.
│   │   │   ├── pairwise/route.ts     # Endpoint to calculate detailed similarity scores for a single cluster.
│   │   │   └── settings/route.ts     # API for getting and saving clustering algorithm settings.
│   │   │
│   │   ├── audit/page.tsx          # Frontend for the Audit page.
│   │   ├── export/page.tsx         # Frontend for the Export page.
│   │   ├── review/page.tsx         # Frontend for the Cluster Review page.
│   │   ├── settings/page.tsx       # Frontend for the Settings page.
│   │   ├── upload/page.tsx         # Frontend for the Upload page and container of the Web Worker script.
│   │   ├── page.tsx                # Main dashboard/homepage.
│   │   └── layout.tsx              # Root application layout.
│   │
│   ├── components/
│   │   ├── ui/                     # Reusable ShadCN UI components (Button, Card, etc.).
│   │   ├── layout-provider.tsx     # Main layout component with the persistent sidebar.
│   │   └── PairwiseModal.tsx       # Modal used on the Review page to inspect cluster details.
│   │
│   ├── lib/                      # Shared libraries, types, and utility functions.
│   │   ├── auditEngine.ts        # Logic for the data integrity audit.
│   │   ├── scoringClient.ts      # Client-side mirror of the worker's scoring logic for live testing.
│   │   ├── types.ts              # Core TypeScript types (e.g., RecordRow).
│   │   └── utils.ts              # Utility functions like cn() for classnames.
│   │
│   └── ai/                       # AI-related logic.
│       ├── flows/describe-cluster-flow.ts # Genkit flow for generating AI summaries of clusters.
│       └── genkit.ts             # Genkit initialization and configuration.
│
└── BUILD_INSTRUCTIONS.md         # This file.
```

### **Core Application Flow**

1.  **Upload**: The user starts at `upload/page.tsx`. They upload an Excel file, which is parsed in the browser.
2.  **Clustering**: The user maps columns and clicks "Start Clustering." The page sends the data to the **Web Worker** (defined inside `upload/page.tsx`). The worker performs all heavy computations (blocking, pairwise scoring, clustering) in a background thread, sending progress updates back to the UI without freezing it.
3.  **Caching**: Once the worker is finished, `upload/page.tsx` receives the final clusters and sends them, along with all original rows, to `/api/cluster-cache/route.ts` to be stored on the server. A unique `cacheId` is returned and saved in the browser's `sessionStorage`.
4.  **Review**: The user navigates to `review/page.tsx`. The page reads the `cacheId` and fetches the clusters from the cache API. It then calls `/api/pairwise/route.ts` to get scores for display.
5.  **Audit**: The user navigates to `audit/page.tsx`. It also loads data from the cache API. If no audit has been run, it automatically calls `/api/audit/route.ts` to perform the integrity checks and then caches the results.
6.  **Export**: The user navigates to `export/page.tsx`. It fetches all data from the cache and then calls the powerful `/api/export/enrich-and-format/route.ts` endpoint, which does all the heavy lifting of creating a multi-sheet, formatted Excel report for download.
