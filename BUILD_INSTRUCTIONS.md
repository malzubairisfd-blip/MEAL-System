
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

1.  **Freezing Options**: At the start of `runClustering`, the `options` object is deep-cloned and frozen (`Object.freeze(JSON.parse(JSON.stringify(opts)))`). This `frozenOpts` object is then passed to all scoring functions to guarantee that settings cannot be accidentally mutated, ensuring bit-for-bit identical scoring runs.

2.  **Normalization (`normalizeArabicRaw`)**: Implement a robust function to clean and standardize Arabic names. This involves removing diacritics, normalizing characters (e.g., `أ`, `إ`, `آ` to `ا`), handling common name variations (`يحيي` to `يحي`), and removing non-essential characters.

3.  **Scoring Primitives**:
    *   `jaroWinkler`: A classic algorithm for string similarity.
    *   `tokenJaccard`: Measures the overlap between sets of name tokens.
    *   `nameOrderFreeScore`: A composite score that handles names with reordered words.

4.  **Custom Rules Engine (`applyAdditionalRules`)**: This is critical for accuracy. It's a series of `if` conditions checking for complex patterns that indicate a duplicate, even when a simple weighted score might fail (e.g., lineage matches, polygamy patterns).

5.  **Pairwise Scoring (`pairwiseScore`)**: A function that compares two records. It first checks for high-confidence matches (exact National ID, strong polygamy signal), then runs the `applyAdditionalRules` engine, and finally calculates a weighted score based on all fields.

6.  **Deterministic Blocking and Edge Building (`buildEdges`)**:
    *   **Blocking (`buildBlocks`)**: To avoid O(n²) comparisons, a blocking strategy creates hash keys from record data. Only records sharing a block are compared.
    *   **Stable Block Order**: Crucially, the array of blocks is sorted (`blocks.sort((a, b) => a[0] - b[0])`) to ensure they are processed in the same order every time.
    *   **Stable Edge Sorting**: After pairs are scored, the resulting `edges` array is sorted with a multi-key approach: `(y.score - x.score) || (x.a - y.a) || (x.b - y.b)`. This guarantees that even if scores are identical, the order of edges is stable, leading to deterministic cluster formation.
    *   **UI Responsiveness**: A `yieldToEventLoop` helper (`new Promise(resolve => setTimeout(resolve, 0))`) is awaited periodically during the heavy comparison loops to prevent the browser UI from freezing on large datasets.

7.  **Clustering (`runClustering`)**:
    *   This main function orchestrates the process. It first calls `buildEdges` to get a deterministically sorted list of potential matches.
    *   It then uses a **Union-Find** data structure to group connected records into large "super clusters".
    *   Finally, it runs a `splitCluster` algorithm on any super cluster larger than a defined size (e.g., 4 records) to break it down into smaller, more tightly-related final clusters.

8.  **Worker Communication**: The worker script listens for `start`, `data`, and `end` messages and posts `progress`, `done`, and `error` messages back to the main thread.

---

## **Part 3: Building the Application Pages**

### **Step 5: The Upload Page (`src/app/upload/page.tsx`)**

1.  **File Input**: Create a UI for file upload using `<input type="file">`. Use the `xlsx` library to parse the uploaded Excel file in a `FileReader`.
2.  **Column Mapping**: After parsing, display the file's columns. Use `RadioGroup` components for each required field (`womanName`, `husbandName`, etc.) to let the user map them to the correct file column. This section is wrapped in a `Collapsible` component that automatically hides on starting the clustering.
3.  **State Management**: Use React state to manage the file, columns, mapping, and the progress of the clustering worker.
4.  **Dynamic "Run Clustering" Button**: The button is state-aware. It shows "Start Clustering" initially, changes to "Processing..." with a spinner during the run, and "Clustering Done!" upon completion. It is disabled while active.
5.  **Worker Interaction**:
    *   On page load, initialize the Web Worker from the script created in Step 4.
    *   Create a message handler (`onmessage`) to listen for `progress`, `done`, and `error` events.
    *   When the user clicks "Start Clustering", send the `start` message with the column mapping and settings, followed by `data` messages containing chunks of the rows, and finally an `end` message.
6.  **Results & Caching**: When the `done` message is received, store the results (clusters, all rows, original headers) in a server-side cache via a POST request to `/api/cluster-cache`. Store the returned `cacheId` in `sessionStorage` to link subsequent pages to this specific run.

### **Step 6: The Review & Audit Pages (`/review`, `/audit`)**

1.  **Data Loading**: On page load, retrieve the `cacheId` from `sessionStorage`. Fetch the cached data (clusters and any existing audit findings) from the `/api/cluster-cache` endpoint using a GET request.
2.  **Cluster Review (`/review`)**:
    *   **Automated Scoring**: An effect hook automatically triggers a call to `/api/pairwise` for all clusters to calculate and display average similarity scores and a final "confidence" percentage.
    *   **UI**: Display the fetched clusters in a grid of cards with pagination. Implement search/filter functionality.
    *   **Inspection**: A "Inspect" button on each cluster card opens a `PairwiseModal` component, which shows a detailed similarity breakdown for the records in that cluster.
3.  **Audit Page (`/audit`)**:
    *   **Automated Audit**: An effect hook checks if audit findings exist in the cache. If not, it automatically makes a POST request to `/api/audit` with the `cacheId` to run the audit.
    *   **Display**: The findings returned from the API are displayed in an `Accordion` component, grouped by severity.
    *   **Cache Update**: After a successful audit, the new findings are saved back to the server-side cache.

### **Step 7: The Export Page (`/export`)**

1.  **Data Loading**: Like other pages, it fetches the full dataset (rows, clusters, audit findings) from the cache using the `cacheId`.
2.  **Generate Report Button**: A single button triggers a POST request to the `/api/export/enrich-and-format` endpoint.
3.  **Backend Enrichment & Formatting (`/api/export/enrich-and-format`)**:
    *   This crucial server-side process fetches all data from the cache file.
    *   **Enrich**: It iterates through all records, adding new columns like `Cluster_ID`, `Cluster_Size`, and `Max_PairScore`.
    *   **Sort**: It sorts the data deterministically, primarily by `Max_PairScore` and then by `Cluster_ID`, to bring the most likely duplicates to the top.
    *   **Generate Excel File**: Using `exceljs`, it creates a multi-sheet workbook: "Enriched Data", "Review Summary", "Cluster Details", and "Audit Findings", complete with conditional formatting and styling.
4.  **Download**: The API responds with the generated Excel file as a buffer, which the frontend then triggers as a download.

### **Step 8: The Settings Page (`/settings`)**

1.  **Backend (`/api/settings`)**: Create GET and POST endpoints to read and write a `settings.json` file in a temporary server directory. This file stores the clustering thresholds and score weights.
2.  **Frontend**:
    *   On page load, fetch the current settings from the GET endpoint.
    *   Create a form with sliders and inputs for each setting (e.g., `minPair`, `firstNameScore`).
    *   Implement a "Test Scoring" section where a user can input two sample records and see the live score calculated using the current page settings, mirroring the worker's logic.
    *   A "Save" button sends the updated settings object to the POST endpoint.

---

This completes the A-to-Z guide for building the Beneficiary Insights system. By following these steps, you can reconstruct the application's full functionality, from its powerful, deterministic client-side engine to its user-friendly interface.
