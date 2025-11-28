# **App Name**: Beneficiary Insights

## Core Features:

- File Upload and Parsing: Upload and parse data from XLSX, CSV, TXT, XLSB, and XLSM files. This includes progress indicators during the upload.
- Column Mapping UI: A user interface that allows users to map columns from the uploaded file to the required fields (womanName, husbandName, nationalId, phone, village, subdistrict, children).
- Data Clustering: Cluster similar records based on fuzzy matching of names, locations, and other attributes, using the provided clustering algorithm.
- Excel Export: Export clustering results to an Excel file with visual formatting to highlight similarity scores, using the included formatting rules.
- Cluster Review: Enable manual review of generated clusters and the ability to perform actions.
- Anomaly Audit: Runs rules on the records to look for duplicate woman, more than 4 wives per husband, potential marriage to a forbidden relative, and potential fraud with national ids. Notifies user.
- LLM-Powered Audit Assistant: Utilizes a generative AI tool to create descriptions of potential duplicate clusters, including likely shared household connections to guide human review. LLM should reason if, and when, to include potentially identifiable personal information to contextualize the records in question

## Style Guidelines:

- Primary color: Indigo (#4B0082), for a serious, but optimistic and future-forward tone.
- Background color: Light-indigo (#F0F8FF), a light tint of indigo, creates a calm and neutral background.
- Accent color: Light-yellow (#E6E600), an analogous hue to indigo, adds contrast without competing for prominence. The choice to have this yellow more saturated gives the feeling of warnings which can be helpful to a reviewer.
- Body and headline font: 'Inter' (sans-serif) for a modern and clean aesthetic. Also suitable for data grids with a lot of text.
- Code font: 'Source Code Pro' for displaying code snippets.
- Use clear, minimalist icons for actions and data categories, and warnings related to potential findings.
- Subtle transitions and animations to enhance user interaction, such as loading indicators and modal appearances.