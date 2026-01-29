# MEAL (Monitoring, Evaluation, Accountability, and Learning) System

## Introduction

This is a comprehensive, enterprise-level MEAL system designed for robust project management, in-depth monitoring and evaluation, and advanced data analysis. It provides a full suite of tools to manage the entire project lifecycle, from initial planning and logframe creation to implementation monitoring, beneficiary data analysis, and final reporting.

The system's core is a powerful data analysis engine for beneficiary information, which uses a sophisticated, client-side fuzzy matching and clustering engine to identify potential duplicates and anomalies within large datasets.

## Technology Stack

This project is built with a modern, robust technology stack:

-   **Framework**: Next.js with React & TypeScript
-   **UI**: ShadCN UI & Tailwind CSS for a professional and responsive design.
-   **Data Persistence**: SQLite (`better-sqlite3`) for structured data storage on the server-side, with data files located in `/src/data`.
-   **File Processing**: `xlsx` for reading Excel files and `exceljs` for generating detailed reports.
-   **AI Integration**: Firebase Genkit is used to power features like the AI-driven cluster summaries.
-   **State Management**: A combination of React State, Context, and a client-side cache (`IndexedDB`) for session persistence during the beneficiary analysis workflow.
-   **Core Logic**: A self-contained Web Worker handles the heavy lifting of fuzzy matching and clustering entirely on the client-side, ensuring the UI remains responsive even with large datasets.

## Core Modules & Features

The MEAL System is organized into several key modules:

### 1. Project Management

-   **Project Dashboard**: A high-level overview of all projects, displaying key performance indicators (KPIs) like total projects, budget, beneficiaries reached, and status.
-   **Project Creation & Details**: A form-driven interface to add new projects with detailed information, including scope, duration, budget, and location.
-   **Gantt Chart (Project Plan)**: An interactive Gantt chart for visualizing and managing project timelines, activities, and sub-activities.
-   **Logical Framework (Logframe)**: A dedicated module to create and view the logical framework for each project, defining the goal, outcome, outputs, activities, indicators, and risks.

### 2. M&E Lifecycle Management

A structured approach to the Monitoring and Evaluation lifecycle, broken down into key phases:

-   **Initiation and Planning**: Tools to define the M&E purpose and scope, plan for data collection, prepare indicators, and calculate sample sizes.
-   **Implementation Monitoring**: A suite of tools for monitoring various aspects of project implementation, including:
    -   Beneficiary Monitoring
    -   Process & Activity Tracking
    -   Compliance, Financial, and Organizational Monitoring
-   **Closure**: Tools to assist in the final phase of a project, including final reports and documenting lessons learned.

### 3. Beneficiary Data Analysis

This is a highly advanced module for ensuring data quality within beneficiary lists.

-   **Data Upload & Clustering**: A seamless file upload process that parses Excel files in the browser. A powerful clustering engine runs in a background Web Worker to perform fuzzy matching without freezing the UI.
-   **Column Mapping**: An intuitive interface for users to map columns from their source file to the required data fields.
-   **Rule-Based Correction**: A page for analyzing record similarities and generating new, dynamic matching rules to improve the accuracy of the clustering engine over time.
-   **Cluster Review Workflow**: A dedicated page to inspect, analyze, and make decisions on the clusters. It includes AI-generated summaries and detailed pairwise score breakdowns.
-   **Data Integrity Audit**: An automated audit engine that checks for common data issues, such as a woman registered with multiple husbands, duplicate National IDs, or other invalid relationships.
-   **Interactive Reporting**: A dynamic dashboard to visualize beneficiary data with maps, charts, and key figures based on the uploaded information.
-   **Advanced Export**: A comprehensive export feature that generates a multi-sheet Excel report containing enriched data, cluster details, audit findings, and a visual dashboard.
-   **Configurable Engine**: A settings page that allows administrators to fine-tune the clustering algorithm's thresholds, weights, and rules to optimize accuracy for different datasets.

## How It Works (Beneficiary Analysis Flow)

1.  **Upload & Preprocess**: The user uploads an Excel file on the `/upload` page. The data is parsed and stored in the browser's `IndexedDB`.
2.  **Cluster**: The user maps columns and starts the process. The data is sent to a Web Worker, which performs blocking, pairwise scoring, and clustering in a background thread.
3.  **Cache**: Once the worker is finished, the results (clusters, rows, etc.) are saved back to `IndexedDB`, making them available across different pages without re-computation.
4.  **Review, Audit, Report**: Subsequent pages (`/review`, `/audit`, `/report`) load the processed data from `IndexedDB`, allowing for a fast and seamless user experience.

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

## Project Structure

The project follows a standard Next.js App Router structure:

```
/src
├── app
│   ├── api/                      # Backend API routes for data persistence and services
│   ├── meal-system/              # The main hub for all MEAL features
│   ├── project/                  # Project management pages (dashboard, plan, logframe)
│   ├── monitoring/               # M&E lifecycle pages
│   ├── (data-analysis-pages)/    # Beneficiary upload, review, audit, etc.
│   └── layout.tsx                # Root application layout with sidebar navigation
├── components/
│   ├── ui/                       # Reusable ShadCN UI components
│   ├── (feature-components)/     # Components specific to features like Gantt, Reports, etc.
│   └── layout-provider.tsx       # Main layout with sidebar and header
├── data/                         # SQLite databases (.db) and seed files (.json)
├── lib/                          # Shared libraries, types, and utility functions
├── workers/                      # Web Worker scripts for background processing
└── locales/                      # Translation files (en.json, ar.json)
```