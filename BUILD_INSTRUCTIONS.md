
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
    npx shadcn-ui@latest add card button input label progress scroll-area radio-group toast sonner dialog select table badge accordion slider switch tooltip
    ```

### **Step 3: Create the Main Layout (`src/app/layout.tsx`)**

1.  Create a `src/components/layout-provider.tsx` component. This component will manage the main application layout, including a persistent sidebar for navigation.
2.  The `LayoutProvider` uses a custom `Sidebar` component (built from ShadCN's `sheet` for mobile and custom styles for desktop) to create a responsive navigation experience.
3.  Define the navigation links (Dashboard, Upload, Review, Audit, Export, Settings) within the sidebar.
4.  Wrap the `children` of the main `AppLayout` in `src/app/layout.tsx` with this `LayoutProvider`.
5.  Add the `<Toaster />` component to the layout to handle application-wide notifications.

---

## **Part 2: The Core - Client-Side Clustering Engine**

The heart of the application is a powerful, self-contained clustering engine that runs in a Web Worker to avoid freezing the UI.

### **Step 4: Create the Web Worker Script**

1.  The entire clustering logic is encapsulated within a single, large string in `src/app/upload/page.tsx` inside a function called `createWorkerScript()`. This script is dynamically loaded as a Web Worker.
2.  **Normalization (`normalizeArabicRaw`)**: Implement a robust function to clean and standardize Arabic names. This involves removing diacritics, normalizing characters (e.g., `أ`, `إ`, `آ` to `ا`), handling common name variations (`يحيي` to `يحي`), and removing non-essential characters.
3.  **Scoring Primitives**:
    *   `jaroWinkler`: A classic algorithm for string similarity.
    *   `tokenJaccard`: Measures the overlap between sets of name tokens.
    *   `nameOrderFreeScore`: A composite score that handles names with reordered words.
4.  **Custom Rules Engine (`applyAdditionalRules`)**: This is the most critical part for accuracy. Implement a series of `if` conditions that check for specific, complex patterns that indicate a duplicate, even when a simple weighted score might fail.
    *   **Rule 0 (Token Match)**: If 80%+ of the name tokens are identical, it's a strong match.
    *   **Rules 1-5 (Lineage Rules)**: Implement specific rules for scenarios like matching `first name + father + grandfather`, handling names with 4 vs. 5 parts, and comparing husband names.
5.  **Pairwise Scoring (`pairwiseScore`)**: Create a function that compares two records.
    *   It first checks for high-confidence matches (e.g., exact National ID, strong polygamy signal).
    *   If no high-confidence match is found, it runs the `applyAdditionalRules` engine.
    *   If still no match, it calculates a final weighted score based on the similarity of different fields (woman's name, husband's name, ID, phone, children, location). The weights are configurable via the Settings page.
6.  **Blocking (`buildBlocks`)**: To avoid comparing every record with every other record (which would be too slow), implement a blocking strategy. This function creates hash keys based on parts of the data (e.g., first 3 letters of a name + last 4 digits of a phone number). Only records that share a block are compared.
7.  **Clustering (`runClustering`)**:
    *   This main function orchestrates the process. It first builds edges between records that have a similarity score above a minimum threshold (`minPair`).
    *   It then uses a Union-Find data structure to group connected records into large "super clusters".
    *   Finally, it runs a `splitCluster` algorithm on any super cluster larger than 4 records to break it down into smaller, more tightly-related final clusters.
8.  **Worker Communication**: The worker script listens for messages (`start`, `data`, `end`) and posts messages back to the main thread with progress updates (`progress`) and the final result (`done`).

---

## **Part 3: Building the Application Pages**

### **Step 5: The Upload Page (`src/app/upload/page.tsx`)**

1.  **File Input**: Create a UI for file upload using `<input type="file">`. Use the `xlsx` library to parse the uploaded Excel file in a `FileReader`.
2.  **Column Mapping**: After parsing, display the columns from the uploaded file. For each required field (`womanName`, `husbandName`, etc.), create a `RadioGroup` to allow the user to map it to a file column.
3.  **State Management**: Use React state to manage the file, columns, mapping, and the progress of the clustering worker.
4.  **Worker Interaction**:
    *   On page load, initialize the Web Worker from the script created in Step 4.
    *   Create a message handler (`onmessage`) to listen for `progress`, `done`, and `error` events from the worker.
    *   When the user clicks "Start Clustering", send the `start` message with the column mapping and settings, followed by `data` messages containing chunks of the rows, and finally an `end` message.
5.  **Results & Caching**: When the `done` message is received, store the results (clusters, all rows, original headers) in a temporary server-side cache via a POST request to `/api/cluster-cache`. Store the returned `cacheId` in `sessionStorage` to link subsequent pages to this specific run.

### **Step 6: The Review & Audit Pages (`/review`, `/audit`)**

1.  **Data Loading**: On page load, retrieve the `cacheId` from `sessionStorage`. Fetch the cached data (clusters and audit findings) from the `/api/cluster-cache` endpoint using a GET request.
2.  **Cluster Review (`/review`)**:
    *   Display the fetched clusters in a grid of cards.
    *   Implement search/filter functionality.
    *   Create a `PairwiseModal` component. When a user clicks "Inspect" on a cluster, this modal should open and make a POST request to `/api/pairwise` to get a detailed similarity breakdown for the records in that cluster.
3.  **Audit Page (`/audit`)**:
    *   Create a "Run Audit" button that makes a POST request to the `/api/audit` endpoint, sending the `cacheId`.
    *   The backend audit service will run a series of data integrity checks (e.g., duplicate IDs, a woman with multiple husbands).
    *   Display the findings returned from the API in an `Accordion` component, grouped by severity.
    *   After the audit, update the server-side cache with the new findings.

### **Step 7: The Export Page (`/export`)**

1.  **Data Loading**: Like the other pages, fetch the full dataset (rows, clusters, audit findings) from the cache using the `cacheId`.
2.  **Generate Report Button**: Create a button that triggers a POST request to a dedicated endpoint, `/api/export/enrich-and-format`.
3.  **Backend Enrichment & Formatting (`/api/export/enrich-and-format`)**:
    *   This is a crucial server-side process. It fetches all the data from the cache file.
    *   **Enrich**: It iterates through all records, adding new columns like `Cluster_ID`, `Cluster_Size`, and `Max_PairScore`.
    *   **Sort**: It sorts the data primarily by the maximum score within a cluster, and then by the cluster ID, to bring the most likely duplicates to the top.
    *   **Generate Excel File**: Using the `exceljs` library, it creates a multi-sheet workbook:
        *   **Enriched Data**: The main sheet with all records, enriched columns, and conditional formatting (e.g., highlighting high-score rows in red).
        *   **Review Summary**: A dashboard-style summary sheet.
        *   **Cluster Details**: A sheet that groups records by cluster.
        *   **Audit Findings**: A formatted list of all data integrity issues found.
4.  **Download**: The API responds with the generated Excel file as a buffer, which the frontend then triggers as a download in the browser.

### **Step 8: The Settings Page (`/settings`)**

1.  **Backend (`/api/settings`)**: Create GET and POST endpoints to read and write a `settings.json` file in a temporary server directory. This file stores the clustering thresholds and score weights.
2.  **Frontend**:
    *   On page load, fetch the current settings from the GET endpoint.
    *   Create a form with sliders, inputs, and switches for each setting (e.g., `minPair`, `firstNameScore`, `enablePolygamyRules`).
    *   Implement a "Test Scoring" section where a user can input two sample records and see the live score calculated using the current settings on the page. The scoring logic for this (`computePairScore`) should be mirrored in a client-side utility file.
    *   When the user clicks "Save", send the updated settings object to the POST endpoint.

---

This completes the A-to-Z guide for building the Beneficiary Insights system. By following these steps, you can reconstruct the application's full functionality, from its powerful client-side engine to its user-friendly interface.
