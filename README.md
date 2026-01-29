# Beneficiary Insights System

## Introduction

The Beneficiary Insights System is an advanced web application designed to analyze beneficiary data with high precision. It leverages a sophisticated, client-side fuzzy matching and clustering engine to identify potential duplicates and anomalies within large datasets. The system is equipped with features for detailed review, data integrity auditing, and comprehensive reporting, making it a powerful tool for organizations managing beneficiary information.

## Technology Stack

This project is built with a modern, robust technology stack:

-   **Framework**: Next.js with React & TypeScript
-   **UI**: ShadCN UI & Tailwind CSS for a professional and responsive design.
-   **File Processing**: `xlsx` for reading Excel files and `exceljs` for generating detailed reports.
-   **AI Integration**: Firebase Genkit is used to power features like the AI-driven cluster summaries.
-   **State Management**: A combination of React State, Context, and `sessionStorage` for lightweight session persistence.
-   **Core Logic**: A self-contained Web Worker handles the heavy lifting of fuzzy matching and clustering entirely on the client-side, ensuring the UI remains responsive even with large datasets.

## Core Features

-   **Data Upload & Clustering**: A seamless file upload process that parses Excel files in the browser. The powerful clustering engine runs in a background Web Worker to prevent UI freezing.
-   **Column Mapping**: An intuitive interface for users to map columns from their source file to the required data fields.
-   **Cluster Review**: A dedicated page to inspect, analyze, and make decisions on the clusters identified by the system. It includes AI-generated summaries and detailed pairwise score breakdowns.
-   **Data Integrity Audit**: An automated audit engine that checks for common data issues, such as a woman registered with multiple husbands, duplicate National IDs, or other invalid relationships.
-   **Reporting & Export**: A comprehensive export feature that generates a multi-sheet Excel report containing enriched data, cluster details, audit findings, and a visual dashboard.
-   **Configurable Engine**: A settings page that allows administrators to fine-tune the clustering algorithm's thresholds, weights, and rules to optimize accuracy for different datasets.

## How It Works

1.  **Upload & Cluster**: The user uploads an Excel file on the `/upload` page. The data is parsed and sent to a Web Worker, which performs blocking, pairwise scoring, and clustering in a background thread.
2.  **Cache**: Once the worker is finished, the results (clusters, rows, and headers) are sent to a server-side cache, and a unique `cacheId` is stored in the browser's `sessionStorage`.
3.  **Review, Audit, Export**: Subsequent pages (`/review`, `/audit`, `/export`) use the `cacheId` to fetch the processed data from the server, allowing users to analyze the results without needing to re-run the clustering process.

## Project Structure

The project follows a standard Next.js App Router structure:

```
/src
├── app
│   ├── api/                  # Backend API routes for caching, scoring, auditing, and export
│   ├── (pages)/              # Main application pages (upload, review, audit, etc.)
│   └── layout.tsx            # Root application layout
├── components/
│   ├── ui/                   # Reusable ShadCN UI components
│   ├── layout-provider.tsx   # Main layout with sidebar and header
│   └── PairwiseModal.tsx     # Modal for inspecting cluster details
├── lib/
│   ├── auditEngine.ts        # Logic for the data integrity audit
│   └── types.ts              # Core TypeScript types
└── ai/
    ├── flows/                # Genkit flows for AI functionality
    └── genkit.ts             # Genkit initialization
```

## Getting Started

To run the project locally, follow these steps:

1.  **Install dependencies**:
    ```bash
    npm install
    ```

2.  **Run the development server**:
    ```bash
    npm run dev
    ```

The application will be available at `http://localhost:9002`.
