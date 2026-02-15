
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

### **Step 3: Create the Main Layout**

1.  Create a `src/components/layout-provider.tsx` component. This component will manage the main application layout, including a persistent sidebar for navigation.

    **File**: `src/components/layout-provider.tsx`
    ```tsx
    "use client";

    import { usePathname } from "next/navigation";
    import Link from "next/link";
    import {
      SidebarProvider,
      Sidebar,
      SidebarHeader,
      SidebarContent,
      SidebarMenu,
      SidebarMenuItem,
      SidebarMenuButton,
      SidebarFooter,
      SidebarTrigger,
      SidebarInset,
    } from "@/components/ui/sidebar";
    import { FileBarChart2, Upload, Microscope, ClipboardList, Home, Settings, FileDown } from "lucide-react";

    export function LayoutProvider({ children }: { children: React.ReactNode }) {
      const pathname = usePathname();
      const isActive = (path: string) => pathname === path;

      return (
        <SidebarProvider>
          <Sidebar>
            <SidebarHeader>
              <div className="flex items-center gap-2 p-2">
                <FileBarChart2 className="size-6 text-primary" />
                <span className="text-lg font-semibold text-foreground">Beneficiary Insights</span>
              </div>
            </SidebarHeader>
            <SidebarContent>
              <SidebarMenu>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/")}>
                    <Link href="/">
                      <Home />
                      <span>Dashboard</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/upload")}>
                    <Link href="/upload">
                      <Upload />
                      <span>Upload Data</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/review")}>
                    <Link href="/review">
                      <Microscope />
                      <span>Review Clusters</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/audit")}>
                    <Link href="/audit">
                      <ClipboardList />
                      <span>Run Audit</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/export")}>
                    <Link href="/export">
                      <FileDown />
                      <span>Export Report</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
                 <SidebarMenuItem>
                  <SidebarMenuButton asChild isActive={isActive("/settings")}>
                    <Link href="/settings">
                      <Settings />
                      <span>Settings</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              </SidebarMenu>
            </SidebarContent>
            <SidebarFooter>
              <div className="text-xs text-muted-foreground p-4">
                 © {new Date().getFullYear()}
              </div>
            </SidebarFooter>
          </Sidebar>
          <SidebarInset>
            <header className="flex h-14 items-center gap-4 border-b bg-card px-6">
                <SidebarTrigger className="md:hidden" />
                <div className="flex-1">
                    <h1 className="text-lg font-semibold capitalize">{pathname.split('/').pop()?.replace('-', ' ') || 'Dashboard'}</h1>
                </div>
            </header>
            <main className="flex-1 overflow-auto p-4 md:p-6">
                {children}
            </main>
          </SidebarInset>
        </SidebarProvider>
      );
    }
    ```

2.  Wrap the `children` of the main `AppLayout` in `src/app/layout.tsx` with this `LayoutProvider`.
3.  Add the `<Toaster />` component to the layout to handle application-wide notifications.

    **File**: `src/app/layout.tsx`
    ```tsx
    import { LayoutProvider } from "@/components/layout-provider";
    import { Toaster } from "@/components/ui/toaster";
    import "./globals.css";

    export default function AppLayout({
      children,
    }: {
      children: React.ReactNode;
    }) {
      return (
        <html lang="en">
          <body>
            <LayoutProvider>{children}</LayoutProvider>
            <Toaster />
          </body>
        </html>
      );
    }
    ```

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

The full worker script is generated by the `createWorkerScript` function in `src/app/upload/page.tsx`.

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

---
## Part 4: Library Code

This section contains the full source code for all utility and library files found in `src/lib`.

#### File: src/lib/arabic-fixer.ts
```ts
// src/lib/arabic-fixer.ts
// --- START OF STANDALONE ARABIC FIXER (No Dependencies) ---
const ARABIC_CHARS_arabic_fixer: Record<string, string[]> = {
  'ا': ['\uFE8D', '\uFE8E', '\uFE8D', '\uFE8E'], 'أ': ['\uFE83', '\uFE84', '\uFE83', '\uFE84'],
  'ب': ['\uFE8F', '\uFE90', '\uFE92', '\uFE91'], 'ت': ['\uFE95', '\uFE96', '\uFE98', '\uFE97'],
  'ث': ['\uFE99', '\uFE9A', '\uFE9C', '\uFE9B'], 'ج': ['\uFE9D', '\uFE9E', '\uFEA0', '\uFE9F'],
  'ح': ['\uFEA1', '\uFEA2', '\uFEA4', '\uFEA3'], 'خ': ['\uFEA5', '\uFEA6', '\uFEA8', '\uFEA7'],
  'د': ['\uFEA9', '\uFEAA', '\uFEA9', '\uFEAA'], 'ذ': ['\uFEAB', '\uFEAC', '\uFEAB', '\uFEAC'],
  'ر': ['\uFEAD', '\uFEAE', '\uFEAD', '\uFEAE'], 'ز': ['\uFEAF', '\uFEB0', '\uFEAF', '\uFEB0'],
  'س': ['\uFEB1', '\uFEB2', '\uFEB4', '\uFEB3'], 'ش': ['\uFEB5', '\uFEB6', '\uFEB8', '\uFEB7'],
  'ص': ['\uFEB9', '\uFEBA', '\uFEBC', '\uFEBB'], 'ض': ['\uFEBD', '\uFEBE', '\uFEC0', '\uFEBF'],
  'ط': ['\uFEC1', '\uFEC2', '\uFEC4', '\uFEC3'], 'ظ': ['\uFEC5', '\uFEC6', '\uFEC8', '\uFEC7'],
  'ع': ['\uFEC9', '\uFECA', '\uFECC', '\uFECB'], 'غ': ['\uFECD', '\uFECE', '\uFED0', '\uFECF'],
  'ف': ['\uFED1', '\uFED2', '\uFED4', '\uFED3'], 'ق': ['\uFED5', '\uFED6', '\uFED8', '\uFED7'],
  'ك': ['\uFED9', '\uFEDA', '\uFEDC', '\uFEDB'], 'ل': ['\uFEDD', '\uFEDE', '\uFEE0', '\uFEDF'],
  'م': ['\uFEE1', '\uFEE2', '\uFEE4', '\uFEE3'], 'ن': ['\uFEE5', '\uFEE6', '\uFEE8', '\uFEE7'],
  'ه': ['\uFEE9', '\uFEEA', '\uFEEC', '\uFEEB'], 'و': ['\uFEED', '\uFEEE', '\uFEED', '\uFEEE'],
  'ي': ['\uFEF1', '\uFEF2', '\uFEF4', '\uFEF3'], 'ى': ['\uFEEF', '\uFEF0', '\uFEEF', '\uFEF0'],
  'ة': ['\uFE93', '\uFE94', '\uFE93', '\uFE94'], 'آ': ['\uFE81', '\uFE82', '\uFE81', '\uFE82'],
  'ؤ': ['\uFE85', '\uFE86', '\uFE85', '\uFE86'], 'إ': ['\uFE87', '\uFE88', '\uFE87', '\uFE88'],
  'ئ': ['\uFE89', '\uFE8A', '\uFE8C', '\uFE8B'], 'ء': ['\uFE80', '\uFE80', '\uFE80', '\uFE80']
};
const NON_CONN_arabic_fixer = ['ا','أ','إ','آ','د','ذ','ر','ز','و','ؤ','ء'];
export function fixArabic(text: string): string {
  if (!text) return "";
  let shaped = "";
  const chars = Array.from(text);
  for (let i = 0; i < chars.length; i++) {
    const c = chars[i];
    if (!ARABIC_CHARS_arabic_fixer[c]) { shaped += c; continue; }
    const p = chars[i-1], n = chars[i+1];
    const canP = p && ARABIC_CHARS_arabic_fixer[p] && !NON_CONN_arabic_fixer.includes(p);
    const canN = n && ARABIC_CHARS_arabic_fixer[n];
    let idx = 0; // Isolated
    if (canP && canN) idx = 2; else if (canP) idx = 1; else if (canN) idx = 3;
    shaped += ARABIC_CHARS_arabic_fixer[c][idx];
  }
  return shaped.split("").reverse().join("");
}
// --- END OF STANDALONE FIXER ---

// Arabic digits (١٢٣)
export function arabicNumber(num: number) {
  return String(num).replace(/\d/g, d =>
    "٠١٢٣٤٥٦٧٨٩"[Number(d)]
  );
}
```

#### File: src/lib/arabicClusterSummary.ts
```ts
// src/lib/arabicClusterSummary.ts
const getScoreColor_arabicClusterSummary = (score?: number) => {
    if (score === undefined) return "color: #4B5563"; // gray-600
    if (score >= 90) return "color: #DC2626"; // red-600
    if (score >= 75) return "color: #F97316"; // orange-500
    if (score >= 60) return "color: #2563EB"; // blue-600
    return "color: #4B5563"; // gray-600
};

export function getDecisionAndNote(confidenceScore: number) {
  let decision = "إحتمالية تكرار";
  let expertNote = "قد يكون هنالك إحتمالية لوجود تكرار نتيجة لتطابق بعض اجزاء من الاسم للمستفيدة او الزوج. يوصى بالتحقق المكتبي من المجموعة.";

  if (confidenceScore >= 85) {
    decision = "تكرار مؤكد";
    expertNote =
      "يوجد تطابق شامل في الأسماء والنسب مع احتمالية عالية أن السجلات تعود لنفس المستفيد. يوصى بمراجعه السجلات وابقاء الحاله التي تحتوي على اكثر دقة وشمولية في البيانات وتصنيف الحالات الأخرى في المجموعه بانها تكرار/ازدواج.";
  } else if (confidenceScore >= 70) {
    decision = "اشتباه تكرار مؤكد";
    expertNote =
      "يوجد تشابه مرتفع في الأسماء والنسب مع احتمالية مرتفعة أن السجلات تعود لنفس المستفيد. يوصى بمراجعه السجلات وفي حال كان هنالك حالات تكرار يتم إبقاء الحاله التي تحتوي على اكثر دقة وشمولية في البيانات وتصنيف الحالات الأخرى في المجموعه بانها تكرار/ازدواج او يتم تعليق المجموعه للتحقق الميداني.";
  } else if (confidenceScore >= 60) {
    decision = "اشتباه تكرار";
    expertNote =
      "يوجد تشابه جزئي، وقد يكون ناتجًا عن تشابه أسماء شائع في المنطقة. يوصى بالتحقق المكتبي والميداني من المجموعة.";
  }
  return { decision, expertNote };
}

type ClusterSummaryData_arabicClusterSummary = {
  reasons?: string[];
  avgWomanNameScore?: number;
  avgHusbandNameScore?: number;
  avgFinalScore?: number;
  confidenceScore?: number;
}

const REASON_EXPLANATIONS_arabicClusterSummary: Record<string, string> = {
  SAME_HUSBAND_CHILDREN_OVERLAP: "تطابق تام لاسم الزوج مع وجود طفل واحد مشترك على الأقل.",
  CORE_WOMAN_AND_HUSBAND_LINEAGE_MATCH: "تطابق قوي في الأسماء الأولى والآباء والأجداد لكل من الزوجة والزوج.",
  FULL_WOMAN_AND_HUSBAND_MATCH: "تطابق شبه كامل في أسماء الزوجة والزوج وأنسابهم.",
  SAME_HUSBAND_WOMAN_VARIANT: "تطابق قوي في اسم الزوج مع تشابه في اسم الزوجة ونسبها.",
  DUPLICATED_HUSBAND_LINEAGE: "تطابق في اسم الزوج مع وجود تشابه في أسماء الأطفال.",
  WOMAN_LINEAGE_ONLY: "تشابه قوي في نسب المرأة مع اختلاف في اسم الزوج.",
  INVESTIGATION_PLACEHOLDER: "أحد السجلات يحتوي على كلمات مثل 'تحت التحقيق' مما يستدعي المراجعة.",
  POLYGAMY_SHARED_HOUSEHOLD: "نمط تعدد زوجات محتمل بناءً على تطابق اسم العائلة والزوج.",
  TOKEN_REORDER_LAST_RESORT: "تشابه كبير في الكلمات المكونة للأسماء مع اختلاف في الترتيب.",
  SHARED_HOUSEHOLD_SAME_HUSBAND: "تطابق قوي في اسم الزوج ونسبه مع تطابق في اسم العائلة للزوجة."
};


export function generateArabicClusterSummary(
  summaryData: ClusterSummaryData_arabicClusterSummary,
  rows: any[]
) {
  const reasons: string[] = summaryData.reasons || [];
  const size = rows.length;

  const explanations = Array.from(new Set(reasons))
        .map(reason => REASON_EXPLANATIONS_arabicClusterSummary[reason])
        .filter(Boolean);

  if (explanations.length === 0 && (summaryData.confidenceScore || 0) > 60) {
      explanations.push("تشابه عام في مكونات متعددة (أسماء، هوية، هاتف).");
  }

  const avgWoman = Number.isFinite(summaryData.avgWomanNameScore) ? Math.round(summaryData.avgWomanNameScore! * 100) : 0;
  const avgHusband = Number.isFinite(summaryData.avgHusbandNameScore) ? Math.round(summaryData.avgHusbandNameScore! * 100) : 0;
  const avgFinal = Number.isFinite(summaryData.avgFinalScore) ? Math.round(summaryData.avgFinalScore! * 100) : 0;
  const confidenceScore = Number.isFinite(summaryData.confidenceScore) ? Math.round(summaryData.confidenceScore!) : 0;

  const { decision, expertNote } = getDecisionAndNote(confidenceScore);

  const summaryHtml = `النتيجة العامة:<br>تم تجميع <strong>${size}</strong> سجلات يُحتمل أنها تمثل نفس المستفيد أو نفس الأسرة.<br><br>مستوى الثقة: <strong style="${getScoreColor_arabicClusterSummary(confidenceScore)}">${confidenceScore}%</strong><br><br>تحليل درجات التشابه:<br>• متوسط تشابه اسم المرأة: <strong style="${getScoreColor_arabicClusterSummary(avgWoman)}">${avgWoman}%</strong><br>• متوسط تشابه اسم الزوج: <strong style="${getScoreColor_arabicClusterSummary(avgHusband)}">${avgHusband}%</strong><br>• الدرجة النهائية للتشابه: <strong style="${getScoreColor_arabicClusterSummary(avgFinal)}">${avgFinal}%</strong><br><br>أسباب التجميع:<br>${explanations.map(e => `• ${e}`).join("<br>") || "• تحليل التشابه العام"}<br><br>تقييم خبير:<br>${expertNote}<br><br>القرار النهائي: ${decision}`;

  return summaryHtml;
}
```

#### File: src/lib/auditEngine.ts
```ts
// src/lib/auditEngine.ts
import type { RecordRow as RecordRow_auditEngine } from "./types";

export interface AuditFinding_auditEngine {
  type: string;
  severity: "high" | "medium" | "low";
  description: string;
  records: RecordRow_auditEngine[];
}

/* -------------------------------------------------------------
   BASIC NORMALIZATION HELPERS
------------------------------------------------------------- */
function safeString_auditEngine(x: any) {
  return x === null || x === undefined ? "" : String(x);
}

function digitsOnly_auditEngine(x: any) {
  return safeString_auditEngine(x).replace(/\D/g, "");
}

function normalizeArabic_auditEngine(s: any): string {
  if (!s) return "";
  let str = String(s); // Ensure 's' is a string before calling normalize
  str = str.normalize("NFKC");
  str = str.replace(/يحيي/g, "يحي");
  str = str.replace(/يحيى/g, "يحي");
  str = str.replace(/عبد /g, "عبد");
  str = str.replace(/[ًٌٍََُِّْـء]/g, "");
  str = str.replace(/[أإآ]/g, "ا");
  str = str.replace(/ى/g, "ي");
  str = str.replace(/ؤ/g, "و");
  str = str.replace(/ئ/g, "ي");
  str = str.replace(/ة/g, "ه");
  str = str.replace(/[^ء-ي0-9 ]/g, " ");
  str = str.replace(/\s+/g, " ").trim();
  return str.toLowerCase();
}

function tokens_auditEngine(s: string) {
  const n = normalizeArabic_auditEngine(s || "");
  if (!n) return [];
  return n.split(" ").filter(Boolean);
}

/* -------------------------------------------------------------
   SIMPLE JARO–WINKLER FOR AUDIT
------------------------------------------------------------- */
function jaroWinkler_auditEngine(a: string, b: string) {
  a = safeString_auditEngine(a);
  b = safeString_auditEngine(b);
  if (!a || !b) return 0;

  const la = a.length, lb = b.length;
  const dist = Math.floor(Math.max(la, lb) / 2) - 1;

  const aMatches = new Array(la).fill(false);
  const bMatches = new Array(lb).fill(false);

  let matches = 0;

  for (let i = 0; i < la; i++) {
    const start = Math.max(0, i - dist);
    const end = Math.min(i + dist + 1, lb);

    for (let j = start; j < end; j++) {
      if (bMatches[j]) continue;
      if (a[i] !== b[j]) continue;
      aMatches[i] = true;
      bMatches[j] = true;
      matches++;
      break;
    }
  }

  if (matches === 0) return 0;

  let k = 0;
  let trans = 0;

  for (let i = 0; i < la; i++) {
    if (!aMatches[i]) continue;
    while (!bMatches[k]) k++;
    if (a[i] !== b[k]) trans++;
    k++;
  }

  trans /= 2;

  const m = matches;
  const jaro = (m / la + m / lb + (m - trans) / m) / 3;

  // prefix
  let prefix = 0;
  const maxPrefix = 4;

  for (let i = 0; i < Math.min(maxPrefix, la, lb); i++) {
    if (a[i] === b[i]) prefix++;
    else break;
  }

  return jaro + prefix * 0.1 * (1 - jaro);
}

/* -------------------------------------------------------------
   TOKEN JACCARD FOR NAME ORDER FREE MATCHING
------------------------------------------------------------- */
function tokenJaccard_auditEngine(aTokens: string[], bTokens: string[]) {
  if (!aTokens.length && !bTokens.length) return 0;

  const A = new Set(aTokens);
  const B = new Set(bTokens);

  let inter = 0;
  for (const t of A) if (B.has(t)) inter++;

  return inter / (new Set([...A, ...B]).size || 1);
}

function nameOrderFree_auditEngine(a: string, b: string) {
  const tA = tokens_auditEngine(a);
  const tB = tokens_auditEngine(b);
  if (!tA.length || !tB.length) return 0;

  const jacc = tokenJaccard_auditEngine(tA, tB);
  const sortedA = tA.slice().sort().join(" ");
  const sortedB = tB.slice().sort().join(" ");

  const jw = jaroWinkler_auditEngine(sortedA, sortedB);

  return 0.7 * jacc + 0.3 * jw;
}

/* -------------------------------------------------------------
   LIGHTWEIGHT PAIRWISE SCORING FOR AUDIT POTENTIAL DUPLICATES
------------------------------------------------------------- */
function auditSimilarity_auditEngine(a: any, b: any) {
  const wA = normalizeArabic_auditEngine(a.womanName || "");
  const wB = normalizeArabic_auditEngine(b.womanName || "");
  const hA = normalizeArabic_auditEngine(a.husbandName || "");
  const hB = normalizeArabic_auditEngine(b.husbandName || "");
  const idA = safeString_auditEngine(a.nationalId || "");
  const idB = safeString_auditEngine(b.nationalId || "");
  const pA = digitsOnly_auditEngine(a.phone || "");
  const pB = digitsOnly_auditEngine(b.phone || "");

  const wTokenScore = nameOrderFree_auditEngine(wA, wB);
  const wFirst = tokens_auditEngine(wA)[0] || "";
  const wSecond = tokens_auditEngine(wB)[0] || "";

  const firstScore = jaroWinkler_auditEngine(wFirst, wSecond);
  const husbandScore = Math.max(
    tokenJaccard_auditEngine(tokens_auditEngine(hA), tokens_auditEngine(hB)),
    jaroWinkler_auditEngine(hA, hB)
  );

  const idScore =
    idA && idB ? (idA === idB ? 1 : idA.slice(-5) === idB.slice(-5) ? 0.75 : 0) : 0;

  const phoneScore =
    pA && pB
      ? pA === pB
        ? 1
        : pA.slice(-6) === pB.slice(-6)
        ? 0.85
        : 0
      : 0;

  const score =
    0.35 * wTokenScore +
    0.25 * firstScore +
    0.20 * husbandScore +
    0.10 * idScore +
    0.10 * phoneScore;

  return Math.min(1, Math.max(0, score));
}

/* -------------------------------------------------------------
   MAIN CLIENT-SIDE AUDIT FUNCTION
------------------------------------------------------------- */
export async function runClientSideAudit(clusters: {records: RecordRow_auditEngine[]}[], threshold = 0.6): Promise<AuditFinding_auditEngine[]> {
    const issues: AuditFinding_auditEngine[] = [];

    for (const clusterObject of clusters) {
      const members = clusterObject.records;
      if (!Array.isArray(members) || members.length < 2) continue;

      // 1. DUPLICATE NATIONAL IDs
      const nationalIds = members.map((m: any) => safeString_auditEngine(m.nationalId).trim());
      const uniqueIds = new Set(nationalIds.filter(Boolean));
      if (uniqueIds.size < nationalIds.filter(Boolean).length) {
        issues.push({ type: "DUPLICATE_ID", severity: 'high', description: `Duplicate National ID found in a cluster.`, records: members });
      }

      // 2. DUPLICATE woman+husband
      const pairs = members.map((m: any) =>
        `${normalizeArabic_auditEngine(safeString_auditEngine(m.womanName))}|${normalizeArabic_auditEngine(safeString_auditEngine(m.husbandName))}`
      );
      if (new Set(pairs).size < pairs.length) {
        issues.push({ type: "DUPLICATE_COUPLE", severity: 'high', description: `Exact duplicate Woman+Husband name pair found.`, records: members });
      }

      // 3. Woman with multiple husbands
      const byWoman = new Map<string, Set<string>>();
      for (const m of members) {
        const w = normalizeArabic_auditEngine(safeString_auditEngine(m.womanName).trim());
        const h = normalizeArabic_auditEngine(safeString_auditEngine(m.husbandName).trim());
        if (!byWoman.has(w)) byWoman.set(w, new Set());
        byWoman.get(w)!.add(h);
      }
      for (const [w, hs] of byWoman.entries()) {
        if (hs.size > 1) {
          issues.push({
            type: "WOMAN_MULTIPLE_HUSBANDS",
            severity: 'high',
            description: `Woman '${w}' appears to be registered with multiple husbands: ${[...hs].join(', ')}.`,
            records: members.filter(m => normalizeArabic_auditEngine(safeString_auditEngine(m.womanName)) === w)
          });
        }
      }

      // 4. Husband with >4 wives
      const byHusband = new Map<string, Set<string>>();
      for (const m of members) {
        const h = normalizeArabic_auditEngine(safeString_auditEngine(m.husbandName).trim());
        const w = normalizeArabic_auditEngine(safeString_auditEngine(m.womanName).trim());
        if (!byHusband.has(h)) byHusband.set(h, new Set());
        byHusband.get(h)!.add(w);
      }
      for (const [h, ws] of byHusband.entries()) {
        if (ws.size > 4) {
          issues.push({
            type: "HUSBAND_TOO_MANY_WIVES",
            severity: 'medium',
            description: `Husband '${h}' is registered with ${ws.size} wives, which exceeds the limit of 4.`,
            records: members.filter(m => normalizeArabic_auditEngine(safeString_auditEngine(m.husbandName)) === h)
          });
        }
      }

      // 5. Woman with multiple IDs
      const womanIDs = new Map<string, Set<string>>();
      for (const m of members) {
        const w = normalizeArabic_auditEngine(safeString_auditEngine(m.womanName).trim());
        const id = safeString_auditEngine(m.nationalId).trim();
        if (!womanIDs.has(w)) womanIDs.set(w, new Set());
        if (id) womanIDs.get(w)!.add(id);
      }
      for (const [w, ids] of womanIDs.entries()) {
        if (ids.size > 1) {
          issues.push({
            type: "MULTIPLE_NATIONAL_IDS",
            severity: 'high',
            description: `Woman '${w}' is associated with multiple National IDs: ${[...ids].join(', ')}.`,
            records: members.filter(m => normalizeArabic_auditEngine(safeString_auditEngine(m.womanName)) === w)
          });
        }
      }
      
      // 6. Check for high similarity using auditSimilarity
      for (let i = 0; i < members.length; i++) {
        for (let j = i + 1; j < members.length; j++) {
            const score = auditSimilarity_auditEngine(members[i], members[j]);
            if (score > threshold) {
                 issues.push({
                    type: "HIGH_SIMILARITY",
                    severity: 'medium',
                    description: `High similarity score (${score.toFixed(2)}) found between records.`,
                    records: [members[i], members[j]]
                });
            }
        }
      }
    }

    return issues;
}
```

#### File: src/lib/cache.ts
```ts
// src/lib/cache.ts
import { openDB, IDBPDatabase } from 'idb';
import type { RecordRow as RecordRow_cache } from './types';
import type { AuditFinding as AuditFinding_cache } from './auditEngine';

const DB_NAME_cache = 'beneficiary-insights-cache';
const DB_VERSION_cache = 1;
const STORE_NAME_cache = 'results';
const FULL_RESULT_KEY_cache = 'FULL_RESULT';

interface FullResult_cache {
  rows: RecordRow_cache[];
  clusters: any[]; 
  originalHeaders: string[];
  auditFindings?: AuditFinding_cache[];
  chartImages?: Record<string, string>;
  processedDataForReport?: any;
}


async function getDb_cache(): Promise<IDBPDatabase> {
  return openDB(DB_NAME_cache, DB_VERSION_cache, {
    upgrade(db) {
      if (!db.objectStoreNames.contains(STORE_NAME_cache)) {
        db.createObjectStore(STORE_NAME_cache);
      }
    },
  });
}

/**
 * Caches the initial raw data immediately after upload and ID generation.
 * This overwrites any existing data.
 */
export async function cacheRawData(payload: { rows: RecordRow_cache[], originalHeaders: string[] }): Promise<void> {
    const db = await getDb_cache();
    const resultToCache: FullResult_cache = {
        rows: payload.rows || [],
        originalHeaders: payload.originalHeaders || [],
        clusters: [], // Initialize clusters as empty
    };
    const tx = db.transaction(STORE_NAME_cache, 'readwrite');
    await tx.objectStore(STORE_NAME_cache).put(resultToCache, FULL_RESULT_KEY_cache);
    await tx.done;
}

/**
 * Updates the cached result with final cluster information.
 * This assumes raw data has already been cached.
 */
export async function cacheFinalResult(payload: { clusters: any[] }): Promise<void> {
    const db = await getDb_cache();
    const tx = db.transaction(STORE_NAME_cache, 'readwrite');
    const store = tx.objectStore(STORE_NAME_cache);
    const currentData = await store.get(FULL_RESULT_KEY_cache) as FullResult_cache | undefined;

    if (!currentData) {
        throw new Error("Cannot cache final results because raw data was not found. Please re-upload the file.");
    }
    
    const updatedData: FullResult_cache = {
        ...currentData,
        clusters: payload.clusters || [],
    };
    
    await store.put(updatedData, FULL_RESULT_KEY_cache);
    await tx.done;
}


export async function loadCachedResult(): Promise<FullResult_cache | null> {
  try {
    const db = await getDb_cache();
    const result = await db.transaction(STORE_NAME_cache).objectStore(STORE_NAME_cache).get(FULL_RESULT_KEY_cache);
    return result as FullResult_cache | null;
  } catch (error) {
     console.error("Failed to load cached result:", error);
     return null;
  }
}
```

---
## Part 5: API Routes

This section contains the full source code for all API routes found in `src/app/api`.

#### File: src/app/api/ai/describe-cluster/route.ts
```ts
// src/app/api/ai/describe-cluster/route.ts
import { generateClusterDescription } from '@/ai/flows/describe-cluster-flow';
import type { RecordRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  let clusters: RecordRow[][];

  try {
    const body = await req.json();
    if (Array.isArray(body?.clusters)) {
      clusters = body.clusters;
    } else if (Array.isArray(body?.cluster)) {
      clusters = [body.cluster];
    } else {
      return new Response(
        JSON.stringify({ error: 'Invalid or empty cluster data provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch {
    return new Response(
      JSON.stringify({ error: 'Invalid JSON body' }),
      { status: 400, headers: { 'Content-Type': 'application/json' } }
    );
  }

  if (clusters.length === 0) {
      return new Response(
        JSON.stringify({ error: 'Invalid or empty cluster data provided' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
  }

  const stream = new TransformStream();
  const writer = stream.writable.getWriter();
  const encoder = new TextEncoder();

  const send = (data: any) =>
    writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));

  // 🔥 CRITICAL: send heartbeat immediately
  send({ status: 'connected' });

  (async () => {
    try {
      for (const cluster of clusters) {
        const clusterKey = cluster.map(r => r._internalId || Math.random().toString(36)).sort().join('-');

        try {
            // ⏱ Timeout protection
            const result = await Promise.race([
                generateClusterDescription({ cluster }),
                new Promise<{ description: string }>((_, reject) =>
                    setTimeout(() => reject(new Error('AI timeout')), 20000)
                ),
            ]);

            send({
              clusterKey: clusterKey,
              description: result.description,
            });
        } catch (err: any) {
            console.error('AI error for cluster:', err);
            send({ clusterKey: clusterKey, error: `AI summary failed for this cluster: ${err.message}` });
        }
      }
      send({ done: true });
    } catch (err: any) {
      console.error('Streaming error:', err);
      send({ error: 'A critical error occurred during the AI summary process.' });
    } finally {
      writer.close();
    }
  })();

  return new Response(stream.readable, {
    headers: {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  });
}
```

#### File: src/app/api/bnf-assessed/download/route.ts
```ts
// src/app/api/bnf-assessed/download/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";

const getDbPath_bnf_download = () => path.join(process.cwd(), 'src/data', 'bnf-assessed.db');

export async function GET_bnf_download(req: Request) {
    const dbPath = getDbPath_bnf_download();
    try {
        const fileBuffer = await fs.readFile(dbPath);
        return new NextResponse(fileBuffer, {
            headers: {
                'Content-Type': 'application/x-sqlite3',
                'Content-Disposition': 'attachment; filename="bnf-assessed.db"',
            },
        });
    } catch (error: any) {
        if (error.code === 'ENOENT') {
            return NextResponse.json({ error: "Database file not found. Please save data first." }, { status: 404 });
        }
        return NextResponse.json({ error: "Failed to download database file.", details: error.message }, { status: 500 });
    }
}
```

---
## Part 6: Application Pages

This section contains the full source code for all pages within the application, located in `src/app`.

#### File: src/app/page.tsx
```tsx
// src/app/page.tsx
import { MealDashboard } from "@/components/dashboard/MealDashboard";

export default function HomePage() {
  return <MealDashboard />;
}
```

#### File: src/app/style-guide/page.tsx
```tsx
// src/app/style-guide/page.tsx
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Paintbrush, Rows, Type, Shapes, PlaySquare, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface StyleTheme {
  name: string;
  colors: { name: string; hex: string }[];
  layout: string[];
  typography: string[];
  iconography: string[];
  animation: string[];
}

const themes: StyleTheme[] = [
  {
    name: "Modern Map / Data App",
    colors: [
      { name: "Primary: Soft Blue", hex: "#5DADE2" },
      { name: "Secondary: Light Blue", hex: "#A9CCE3" },
      { name: "Neutral: White / Dark Gray", hex: "#FDFEFE" },
      { name: "Background: Charcoal Black", hex: "#17202A" },
    ],
    layout: ["Clean and intuitive layout with a map-first focus.", "UI elements are minimal, spaced, and non-intrusive.", "Grid-based structure", "Clear visual hierarchy", "Responsive across screen sizes"],
    typography: ["Font: Inter, sans-serif", "Headlines: Medium / Semibold", "Body text: Regular", "Consistent line height and spacing"],
    iconography: ["Simple, line-based icons", "Consistent stroke width", "Rounded edges", "Meaningful and minimal"],
    animation: ["Subtle animations to guide the user", "Smooth transitions during map loading", "Soft progress indicators"],
  },
  {
    name: "Professional Dashboard",
    colors: [
        { name: "Primary: Deep Blue", hex: "#2874A6" },
        { name: "Accent: Sky Blue", hex: "#85C1E9" },
        { name: "Status Colors: Green, Amber, Red", hex: "#2ECC71" },
        { name: "Background: Dark Slate", hex: "#212F3D" },
    ],
    layout: ["Structured dashboard layout for data visibility", "Sidebar navigation", "Content-focused main area", "Logical grouping of controls"],
    typography: ["Font: Inter", "Clear contrast between headings and body", "Avoid decorative fonts", "Optimized for accessibility"],
    iconography: ["Functional-first approach", "Monochrome icons", "Used only where they add clarity", "Paired with labels when necessary"],
    animation: ["Reinforce system feedback", "Button hover feedback", "Loading skeletons", "Fade-in content transitions"],
  },
  {
    name: "Minimal Tech Tool",
    colors: [
      { name: "Primary: Blue", hex: "#3498DB" },
      { name: "Neutral: White / Gray", hex: "#E5E7E9" },
      { name: "Background: Near-Black", hex: "#1B2631" },
    ],
    layout: ["Minimal UI that reduces cognitive load", "Large interactive areas", "Clear margins and padding", "Focused content zones"],
    typography: ["Font: Inter", "Consistent sizing scale", "High contrast for readability", "No font mixing"],
    iconography: ["Flat icons designed for clarity", "Action-based symbols", "No decorative elements", "Consistent alignment"],
    animation: ["Purpose-driven animations only", "Loading indicators", "State changes", "Respects reduced-motion settings"],
  }
];

const StyleGuideCard = ({ theme, onUseStyle }: { theme: StyleTheme, onUseStyle: (themeName: string) => void }) => {
  return (
    <Card className="bg-gray-800 text-white border-gray-700 flex flex-col">
      <CardHeader>
        <CardTitle className="text-xl font-bold tracking-wider uppercase">{theme.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 flex-1">
        <div className="flex items-start gap-4">
          <Paintbrush className="h-5 w-5 text-gray-400 mt-1" />
          <div>
            <h3 className="font-semibold text-lg">Color</h3>
            <p className="text-sm text-gray-400 mb-2">Primary palette uses cool blues and neutral grays to ensure clarity and trust.</p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {theme.colors.map((color, index) => (
                <div key={index} className="flex items-center gap-2">
                    <div
                      className="h-6 w-6 rounded-full border-2 border-gray-600"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="text-xs text-gray-300">{color.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <Rows className="h-5 w-5 text-gray-400 mt-1" />
          <div>
            <h3 className="font-semibold text-lg">Layout</h3>
             <ul className="text-sm text-gray-300 mt-1 list-disc pl-5 space-y-1">
                {theme.layout.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <Type className="h-5 w-5 text-gray-400 mt-1" />
          <div>
            <h3 className="font-semibold text-lg">Typography</h3>
            <ul className="text-sm text-gray-300 mt-1 list-disc pl-5 space-y-1">
                {theme.typography.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <Shapes className="h-5 w-5 text-gray-400 mt-1" />
          <div>
            <h3 className="font-semibold text-lg">Iconography</h3>
            <ul className="text-sm text-gray-300 mt-1 list-disc pl-5 space-y-1">
                {theme.iconography.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <PlaySquare className="h-5 w-5 text-gray-400 mt-1" />
          <div>
            <h3 className="font-semibold text-lg">Animation</h3>
            <ul className="text-sm text-gray-300 mt-1 list-disc pl-5 space-y-1">
                {theme.animation.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        </div>
      </CardContent>
      <div className="p-6 mt-auto">
        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => onUseStyle(theme.name)}>
            <Check className="mr-2"/> Use Style
        </Button>
      </div>
    </Card>
  );
};


export default function StyleGuidePage() {
  const { toast } = useToast();

  const handleSetTheme = (themeName: string) => {
      toast({
        title: "Theme Selected",
        description: `You've selected the "${themeName}" theme. I will now apply this style to the project in the next step.`,
      });
      // In a real app, this would trigger the CSS change.
      // Here, it just notifies the user what will happen next.
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Style Guide Samples</h1>
      <p className="text-muted-foreground">Review the different theme directions below. When you're ready, click "Use Style" on your preferred theme, and I'll update the entire application's appearance.</p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {themes.map(theme => (
            <StyleGuideCard key={theme.name} theme={theme} onUseStyle={handleSetTheme} />
        ))}
      </div>
    </div>
  );
}
```

---
## Part 7: Web Workers

This section contains the full source code for all Web Workers used in the application for background processing, located in `src/workers`.

#### File: src/workers/cluster.worker.ts
```ts
// src/workers/cluster.worker.ts
import { alignLineage, jaroWinkler, collapseDuplicateAncestors, nameOrderFreeScore, tokenJaccard } from '@/lib/similarity';

// --- Preprocessing Logic (Copied from preprocess.ts) ---

function baseArabicNormalize(value: any): string {
  if (!value) return "";
  let s = String(value)
    .normalize("NFKC")
    .replace(/يحيي/g, "يحي")
    .replace(/يحيى/g, "يحي")
    .replace(/عبد /g, "عبد")
    .replace(/[ًٌٍَُِّْـء]/g, "")
    .replace(/[أإآ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/گ/g, "ك")
    .replace(/\s+/g, " ")
    .replace(/[^ء-ي0-9a-zA-Z\s]/g, " ")
    .trim()
    .toLowerCase();
  return s;
}

const FIXED_COMPOUND_NAMES_cluster_worker = [
  // === ALLAH NAMES ===
  "عبد الله","عبد الرحمن","عبد الرحيم","عبد الكريم","عبد العزيز",
  "عبد الملك","عبد السلام","عبد القادر","عبد الجليل","عبد الرزاق",
  "عبد الغني","عبد الوهاب","عبد الاله","عبد الواحد","عبد الماجد",

  // === FEMALE (الله) ===
  "امه الله","امه الرحمن","امه الرحيم","امه الكريم",

  // === MALE (الله) ===
  "صنع الله","عطاء الله","نور الله","فتح الله","نصر الله",
  "فضل الله","رحمه الله","حسب الله","جود الله",

  // === PROPHET / RELIGIOUS ===
  "نور الدين","شمس الدين","سيف الدين","زين الدين","جمال الدين",
  "كمال الدين","صلاح الدين","علاء الدين","تقي الدين","نجم الدين",

  // === FAMILY ===
  "ابو بكر","ابو طالب","ابو هريره",
  "ام كلثوم","ام سلمه","ام حبيبه",

  // === LINEAGE ===
  "ابن تيميه","ابن سينا","ابن خلدون","ابن رشد",
  "بنت الشاطئ"
];

const PREFIX_COMPOUND_RULES_cluster_worker: RegExp[] = [
  /^امه\s+[ء-ي]{3,}$/,
  /^ابو\s+[ء-ي]{3,}$/,
  /^ام\s+[ء-ي]{3,}$/,
  /^ابن\s+[ء-ي]{3,}$/,
  /^بنت\s+[ء-ي]{3,}$/,
  /^[ء-ي]{3,}\s+الدين$/,
  /^[ء-ي]{3,}\s+الله$/
];

function normalizeArabicWithCompounds_cluster_worker(value: any): string {
  let s = baseArabicNormalize(value);

  // Step 1: apply fixed compounds
  for (const name of FIXED_COMPOUND_NAMES_cluster_worker) {
    const normalized = baseArabicNormalize(name);
    const re = new RegExp(normalized.replace(" ", "\\s*"), "g");
    s = s.replace(re, normalized.replace(" ", "_"));
  }

  // Step 2: auto-detect safe 2-part compounds
  const parts = s.split(" ");
  const result: string[] = [];

  for (let i = 0; i < parts.length; i++) {
    if (i < parts.length - 1) {
      const pair = `${parts[i]} ${parts[i + 1]}`;
      if (PREFIX_COMPOUND_RULES_cluster_worker.some((r) => r.test(pair))) {
        result.push(pair.replace(" ", "_"));
        i++; // skip next
        continue;
      }
    }
    result.push(parts[i]);
  }

  return result.join(" ");
}

const digitsOnly_cluster_worker = (value: any) => {
  if (value === undefined || value === null) return "";
  return String(value).replace(/\D/g, "");
};

const normalizeChildrenField_cluster_worker = (value: any) => {
  if (value === null || value === undefined) return [];
  if (Array.isArray(value)) {
    return value.map((item) => String(item).trim()).filter(Boolean);
  }
  return String(value)
    .split(/[;,|،]/)
    .map((part) => String(part).trim())
    .filter(Boolean);
};

const splitParts_cluster_worker = (value: string) =>
  value ? value.split(/\s+/).filter(Boolean) : [];

export type PreprocessedRow_cluster_worker = {
  _internalId: string;
  womanName: string;
  husbandName: string;
  nationalId: string;
  phone: string;
  village: string;
  subdistrict: string;
  children: any[];
  womanName_normalized: string;
  husbandName_normalized: string;
  village_normalized: string;
  subdistrict_normalized: string;
  children_normalized: string[];
  parts: string[];
  husbandParts: string[];
};

const preprocessRow_cluster_worker = (raw: any): PreprocessedRow_cluster_worker => {
  const row = {
    ...raw,
    womanName: raw.womanName || "",
    husbandName: raw.husbandName || "",
    nationalId: String(raw.nationalId || raw.id || ""),
    phone: digitsOnly_cluster_worker(raw.phone || ""),
    village: raw.village || "",
    subdistrict: raw.subdistrict || "",
    children: normalizeChildrenField_cluster_worker(raw.children),
  };
  const womanName_normalized = raw.womanName_normalized || normalizeArabicWithCompounds_cluster_worker(row.womanName);
  const husbandName_normalized = raw.husbandName_normalized || normalizeArabicWithCompounds_cluster_worker(row.husbandName);
  const village_normalized = raw.village_normalized || baseArabicNormalize(row.village);
  const subdistrict_normalized = raw.subdistrict_normalized || baseArabicNormalize(row.subdistrict);
  const children_normalized =
    raw.children_normalized || (row.children || []).map((child: any) => baseArabicNormalize(child));

  return {
    ...row,
    womanName_normalized,
    husbandName_normalized,
    village_normalized,
    subdistrict_normalized,
    children_normalized,
    parts: raw.parts || splitParts_cluster_worker(womanName_normalized),
    husbandParts: raw.husbandParts || splitParts_cluster_worker(husbandName_normalized),
  };
};

export interface WorkerOptions_cluster_worker {
    thresholds: {
        minPair: number;
        minInternal: number;
        blockChunkSize: number;
    };
    finalScoreWeights: {
        [key: string]: number;
    };
    rules: {
        [key: string]: boolean;
    };
    autoRulesOnly?: boolean;
}

// --- End of Preprocessing Logic ---


// --- Executor for Learned Rules ---
type RuleResult_cluster_worker = {
  score: number;
  reasons: string[];
};

// Default no-op executor (safe fallback)
let executeLearnedRules_cluster_worker: (
  a: any,
  b: any,
  jw: Function,
  nameOrderFreeScore: Function,
  tokenJaccard: Function,
  minPair: number
) => RuleResult_cluster_worker | null = () => null;

function compileRules_cluster_worker(rules: any[]) {
  try {
    if (!Array.isArray(rules) || rules.length === 0) {
      executeLearnedRules_cluster_worker = () => null;
      return;
    }

    // Only enabled + non-empty rules
    const enabledRules = rules.filter(
      r => r.enabled && typeof r.code === 'string' && r.code.trim().length > 0
    );

    postMessage({
      type: 'rules_loaded',
      count: enabledRules.length,
    });

    if (enabledRules.length === 0) {
      executeLearnedRules_cluster_worker = () => null;
      return;
    }

    // Wrap every rule defensively so one bad rule doesn't kill all
    const wrappedRules = enabledRules.map((r, idx) => `
      try {
        ${r.code}
      } catch (e) {
        // AUTO_RULE_${idx} failed silently
      }
    `).join('\n');

    executeLearnedRules_cluster_worker = new Function(
      'a',
      'b',
      'jw',
      'nameOrderFreeScore',
      'tokenJaccard',
      'minPair',
      `
      // Pre-bind commonly used tokens
      const A = a.parts || [];
      const B = b.parts || [];
      const HA = a.husbandParts || [];
      const HB = b.husbandParts || [];

      ${wrappedRules}

      return null;
      `
    ) as any;

  } catch (e) {
    console.warn(
      "Could not load or compile auto-rules. Continuing without learned rules.",
      e
    );
    executeLearnedRules_cluster_worker = () => null;
  }
}
```

#### File: src/workers/double-benefit.worker.ts
```ts
// src/workers/double-benefit.worker.ts
import { jaroWinkler as jaroWinkler_double_benefit, nameOrderFreeScore as nameOrderFreeScore_double_benefit, tokenJaccard as tokenJaccard_double_benefit } from '@/lib/similarity';

// --- Normalization Logic ---
function baseArabicNormalize_double_benefit(value: any): string {
    if (!value) return "";
    let s = String(value).normalize("NFKC").replace(/يحيي/g, "يحي").replace(/يحيى/g, "يحي").replace(/عبد /g, "عبد").replace(/[ًٌٍَُِّْـء]/g, "").replace(/[أإآ]/g, "ا").replace(/ى/g, "ي").replace(/ؤ/g, "و").replace(/ئ/g, "ي").replace(/ة/g, "ه").replace(/گ/g, "ك").replace(/\s+/g, " ").replace(/[^ء-ي0-9a-zA-Z\s]/g, " ").trim().toLowerCase();
    return s;
}

const FIXED_COMPOUND_NAMES_double_benefit = ["عبد الله", "عبد الرحمن", "عبد الرحيم", "عبد الكريم", "عبد العزيز", "عبد الملك", "عبد السلام", "عبد القادر", "عبد الجليل", "عبد الرزاق", "عبد الغني", "عبد الوهاب", "عبد الاله", "عبد الواحد", "عبد الماجد", "امه الله", "امه الرحمن", "امه الرحيم", "امه الكريم", "صنع الله", "عطاء الله", "نور الله", "فتح الله", "نصر الله", "فضل الله", "رحمه الله", "حسب الله", "جود الله", "نور الدين", "شمس الدين", "سيف الدين", "زين الدين", "جمال الدين", "كمال الدين", "صلاح الدين", "علاء الدين", "تقي الدين", "نجم الدين", "ابو بكر", "ابو طالب", "ابو هريره", "ام كلثوم", "ام سلمه", "ام حبيبه", "ابن تيميه", "ابن سينا", "ابن خلدون", "ابن رشد", "بنت الشاطئ"];
const PREFIX_COMPOUND_RULES_double_benefit: RegExp[] = [/^امه\s+[ء-ي]{3,}$/, /^ابو\s+[ء-ي]{3,}$/, /^ام\s+[ء-ي]{3,}$/, /^ابن\s+[ء-ي]{3,}$/, /^بنت\s+[ء-ي]{3,}$/, /^[ء-ي]{3,}\s+الدين$/, /^[ء-ي]{3,}\s+الله$/];

function normalizeArabicWithCompounds_double_benefit(value: any): string {
    let s = baseArabicNormalize_double_benefit(value);
    for (const name of FIXED_COMPOUND_NAMES_double_benefit) {
        const normalized = baseArabicNormalize_double_benefit(name);
        const re = new RegExp(normalized.replace(" ", "\\s*"), "g");
        s = s.replace(re, normalized.replace(" ", "_"));
    }
    const parts = s.split(" ");
    const result: string[] = [];
    for (let i = 0; i < parts.length; i++) {
        if (i < parts.length - 1) {
            const pair = `${parts[i]} ${parts[i + 1]}`;
            if (PREFIX_COMPOUND_RULES_double_benefit.some((r) => r.test(pair))) {
                result.push(pair.replace(" ", "_"));
                i++;
                continue;
            }
        }
        result.push(parts[i]);
    }
    return result.join(" ");
}

const digitsOnly_double_benefit = (value: any) => (value === undefined || value === null) ? "" : String(value).replace(/\D/g, "");

// --- Scoring Logic ---
function calculateSimilarity_double_benefit(educator: any, beneficiary: any, mapping: any) {
    const normEdName = normalizeArabicWithCompounds_double_benefit(educator[mapping.educatorName]);
    const normBnfName = normalizeArabicWithCompounds_double_benefit(beneficiary[mapping.beneficiaryName]);
    
    const edNameParts = normEdName.split(' ');
    const bnfNameParts = normBnfName.split(' ');
    
    const nameScore = nameOrderFreeScore_double_benefit(edNameParts, bnfNameParts);

    const edId = String(educator[mapping.educatorId] || '').trim();
    const bnfId = String(beneficiary[mapping.beneficiaryId] || '').trim();
    let idScore = 0;
    if (edId && bnfId) {
        idScore = edId === bnfId ? 1 : (edId.slice(-6) === bnfId.slice(-6) ? 0.8 : 0);
    }

    const edPhones = String(educator[mapping.educatorPhone] || '').split(/[-,]/).map(p => digitsOnly_double_benefit(p));
    const bnfPhone = digitsOnly_double_benefit(beneficiary[mapping.beneficiaryPhone]);
    let phoneScore = 0;
    if (bnfPhone) {
        for (const edPhone of edPhones) {
            if (edPhone === bnfPhone) {
                phoneScore = 1;
                break;
            }
            if (edPhone.slice(-7) === bnfPhone.slice(-7)) {
                phoneScore = Math.max(phoneScore, 0.9);
            }
        }
    }
    
    // Weighted score
    return (nameScore * 0.5) + (idScore * 0.3) + (phoneScore * 0.2);
}
```

---
## Part 8: Enrollment Review Page

This new section implements an advanced "Enrollment Review" page for correcting data and generating new matching rules.

### **Step 6: Update Database Schema**

First, update the `src/app/api/bnf-assessed/route.ts` file to include all the new columns required for the name difference analysis.

**File**: `src/app/api/bnf-assessed/route.ts`
```ts
// src/app/api/bnf-assessed/route.ts
import { NextResponse } from "next/server";
import fs from "fs/promises";
import path from "path";
import Database from "better-sqlite3";

const getDataPath = () => path.join(process.cwd(), "src/data");
const getDbPath = () => path.join(getDataPath(), "bnf-assessed.db");


const DB_COLUMNS_FOR_CREATION = `(
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    project_id TEXT,
    project_name TEXT,
    Generated_Cluster_ID TEXT,
    Size INTEGER,
    Flag TEXT,
    Max_PairScore REAL,
    pairScore REAL,
    nameScore REAL,
    husbandScore REAL,
    childrenScore REAL,
    idScore REAL,
    phoneScore REAL,
    locationScore REAL,
    groupDecision TEXT,
    recordDecisions TEXT,
    decisionReasons TEXT,
    s TEXT,
    cluster_id TEXT,
    dup_cluster_id2 TEXT,
    eq_clusters TEXT,
    dup_flag2 TEXT,
    new_dup_flag1 TEXT,
    dup_flag TEXT,
    cluster_size INTEGER,
    dup_cluster_size INTEGER,
    match_probability REAL,
    match_weight REAL,
    l_id TEXT,
    l_benef_name TEXT,
    l_hsbnd_name TEXT,
    l_child_list TEXT,
    l_phone_no TEXT,
    l_id_card_no TEXT,
    l_age_years INTEGER,
    l_mud_id TEXT,
    gv_bnf_name TEXT,
    gv_hsbnd_name TEXT,
    gv_bnf_hsbnd_name TEXT,
    gv_n_child_list TEXT,
    gv_id_card_no TEXT,
    gv_phone_no TEXT,
    gv_age_years INTEGER,
    r_id TEXT,
    r_benef_name TEXT,
    r_husband_name TEXT,
    r_child_list TEXT,
    r_phone_no TEXT,
    r_id_card_no TEXT,
    r_age_years INTEGER,
    r_mud_id TEXT,
    lr_eq_mud TEXT,
    lr_eq_phone TEXT,
    lr_age_diff INTEGER,
    lr_benef_name_jw_sim REAL,
    lr_husband_name_jw_sim REAL,
    lr_benef_name_jaccard REAL,
    lr_husband_name_jaccard REAL,
    lr_id_card_dist REAL,
    lr_child_jaccard REAL,
    dup_cluster_size_2 INTEGER,
    dup_cluster_id TEXT,
    dup_cluster_flag TEXT,
    record_id TEXT,
    benef_name TEXT,
    husband_name TEXT,
    child_list_str TEXT,
    phone_no TEXT,
    bnf_id_card_no TEXT,
    age_years INTEGER,
    gov_name TEXT,
    mud_name TEXT,
    hh_ozla_name TEXT,
    hh_vill_name TEXT,
    dup_cluster_score REAL,
    hh_uuid_dup_cnt INTEGER,
    hh_uuid_rn TEXT,
    hh_team_name TEXT,
    hh_srvyr_name TEXT,
    hh_srvyr_phone_no TEXT,
    hh_mahlah TEXT,
    hh_address TEXT,
    hh_name TEXT,
    hh_gender TEXT,
    hh_is_swf TEXT,
    hh_is_dislocated TEXT,
    hh_is_dislocated_guest TEXT,
    child_cnt INTEGER,
    child_m_cnt INTEGER,
    child_f_cnt INTEGER,
    bnf_id TEXT,
    srvy_hh_id TEXT,
    bnf_idx INTEGER,
    id_card_type TEXT,
    bnf_relation TEXT,
    bnf_relation_label TEXT,
    bnf_relation_code TEXT,
    n_child_list_str TEXT,
    hh_deviceid TEXT,
    hh_vill_id TEXT,
    gov_no TEXT,
    mud_no TEXT,
    hh_ozla_no TEXT,
    hh_srvyr_id TEXT,
    hh_srvyr_team_id TEXT,
    paper_form_date TEXT,
    paper_form_no TEXT,
    hh_qual_women_cnt INTEGER,
    bnf_child_cnt INTEGER,
    bnf_child_m_cnt INTEGER,
    bnf_child_f_cnt INTEGER,
    bnf_social_status TEXT,
    bnf_qual_status TEXT,
    bnf_qual_status_desc TEXT,
    bnf_qual_is_preg TEXT,
    bnf_qual_is_mother5 TEXT,
    bnf_qual_is_mother_handicaped TEXT,
    bnf_is_handicaped TEXT,
    bnf_is_dislocated TEXT,
    hh_phone_no TEXT,
    bnf_phone_no TEXT,
    hh_is_new_instance TEXT,
    hh_uuid TEXT,
    hh_submission_time TEXT,
    hh_submitted_by TEXT,
    n_hh_name TEXT,
    child_list2 TEXT,
    child_list_long TEXT,
    bnf_1name TEXT,
    bnf_2name TEXT,
    bnf_3name TEXT,
    bnf_4name TEXT,
    bnf_5name TEXT,
    hsbnd_1name TEXT,
    hsbnd_2name TEXT,
    hsbnd_3name TEXT,
    hsbnd_4name TEXT,
    hsbnd_5name TEXT,
    proj_no TEXT,
    id_card_no TEXT,
    loc_id TEXT,
    status TEXT,
    notes TEXT,
    flag_2 TEXT,
    cluster_min_score REAL,
    cluster_max_score REAL,
    cluster_score REAL,
    bnf_relations TEXT,
    hsbnd_relations TEXT,
    common_child TEXT,
    common_child_cnt INTEGER,
    relation_score REAL,
    same_mud TEXT,
    same_proj TEXT,
    office_no TEXT,
    ser TEXT,
    benef_id TEXT,
    is_active TEXT,
    benef_class_desc TEXT,
    term_reason TEXT,
    is_dup_cluster TEXT,
    dup_woman_id TEXT,
    dup_benef_id TEXT,
    reg_form_date TEXT,
    old_bnf_name TEXT,
    old_hsbnd_name TEXT,
    curr_benef_name TEXT,
    curr_husband_name TEXT,
    calc_bnf_1name TEXT,
    calc_bnf_2name TEXT,
    calc_bnf_3name TEXT,
    calc_bnf_4name TEXT,
    calc_bnf_5name TEXT,
    calc_hsbnd_1name TEXT,
    calc_hsbnd_2name TEXT,
    calc_hsbnd_3name TEXT,
    calc_hsbnd_4name TEXT,
    calc_hsbnd_5name TEXT,
    cbnf_name TEXT,
    chsbnd_name TEXT,
    n_child_list TEXT,
    b_1name TEXT,
    b_2name TEXT,
    b_3name TEXT,
    b_4name TEXT,
    b_5name TEXT,
    h_1name TEXT,
    h_2name TEXT,
    h_3name TEXT,
    h_4name TEXT,
    h_5name TEXT,
    child_list TEXT,
    bnf_name_2 TEXT,
    hsbnd_name_2 TEXT,
    bnf_name2 TEXT,
    bnf_name2b TEXT,
    bnf_name2c TEXT,
    bnf_name3 TEXT,
    bnf_name3b TEXT,
    bnf_name3c TEXT,
    bnf_name3d TEXT,
    bnf_name4 TEXT,
    bnf_name4c TEXT,
    bnf_name4b TEXT,
    bnf_f_name4 TEXT,
    bnf_f_name3 TEXT,
    bnf_f_name3c TEXT,
    hsbnd_name2 TEXT,
    hsbnd_name2b TEXT,
    hsbnd_name2c TEXT,
    hsbnd_name3 TEXT,
    hsbnd_name3b TEXT,
    hsbnd_name3c TEXT,
    hsbnd_name3d TEXT,
    hsbnd_name4 TEXT,
    hsbnd_name4c TEXT,
    hsbnd_name4b TEXT,
    hsbnd_f_name4 TEXT,
    hsbnd_f_name3 TEXT,
    hsbnd_f_name3c TEXT,
    bnf_name_list TEXT,
    hsbnd_name_list TEXT,
    dup_cluster_id2_2 TEXT,
    c_max_weight REAL,
    c_min_weight REAL,
    c_id_max_weight REAL,
    c_id_min_weight REAL,
    c_max_pct REAL,
    c_min_pct REAL,
    c_id_max_pct REAL,
    c_id_min_pct REAL,
    c_min_proj REAL,
    c_max_proj REAL,
    c_proj2_cnt INTEGER,
    c_mud2_cnt INTEGER,
    c_id_min_proj REAL,
    c_id_max_proj REAL,
    c_id_proj2_cnt INTEGER,
    c_id_mud2_cnt INTEGER,
    womanName TEXT,
    husbandName TEXT,
    nationalId INTEGER,
    phone INTEGER,
    village TEXT,
    subdistrict TEXT,
    children TEXT,
    beneficiaryId TEXT,
    avgPairScore REAL,
    avgFirstNameScore REAL,
    avgFamilyNameScore REAL,
    avgAdvancedNameScore REAL,
    avgTokenReorderScore REAL,
    reasons TEXT,
    confidenceScore REAL,
    avgWomanNameScore REAL,
    avgHusbandNameScore REAL,
    avgFinalScore REAL,
    pre_classified_result TEXT,
    group_analysis TEXT,
    womanName_normalized TEXT,
    husbandName_normalized TEXT,
    children_normalized TEXT,
    subdistrict_normalized TEXT,
    village_normalized TEXT,
    parts TEXT,
    husbandParts TEXT,
    ED_NO TEXT,
    ED_ID TEXT,
    EC_ID TEXT,
    PC_ID TEXT,
    ED_NAME TEXT,
    EC_NAME TEXT,
    PC_NAME TEXT,
    SRVY_HH_ID_2 TEXT,
    CANDID_SER_NO TEXT,
    WOMAN_ID TEXT,
    source_ID_2 TEXT,
    BENEF_ID_2 TEXT,
    BENEF_NO TEXT,
    HH_NAME_2 TEXT,
    BNF_RELATION_2 TEXT,
    BENEF_NAME_3 TEXT,
    HUSBAND_NAME_3 TEXT,
    IS_ACTIVE_2 TEXT,
    STATUS_2 TEXT,
    QUAL_STATUS TEXT,
    STATUS_DESC TEXT,
    QUAL_STATUS_DESC TEXT,
    VERIFY_STATUS TEXT,
    VERIFY_NOTES TEXT,
    VERIFY_REASON TEXT,
    VERIFY_DATE TEXT,
    REG_STATUS TEXT,
    REG_FORM_DATE_2 TEXT,
    REG_NOTES TEXT,
    TOTAL_CHILD_COUNT INTEGER,
    MALE_CHILD_COUNT INTEGER,
    FEMALE_CHILD_COUNT INTEGER,
    LOC_ID_2 TEXT,
    LOC_NAME TEXT,
    ID_CARD_TYPE_2 TEXT,
    ID_CARD_TYPE_DESC TEXT,
    ID_CARD_NO_2 TEXT,
    AGE_YEARS_2 INTEGER,
    ADDRESS TEXT,
    PHONE_NO_2 TEXT,
    IS_TERMINATED TEXT,
    TERM_DATE TEXT,
    TERM_REASON_2 TEXT,
    TERM_NOTES TEXT,
    NOTES_2 TEXT,
    PC_FAC_ID TEXT,
    EC_FAC_ID TEXT,
    BENEF_CLASS TEXT,
    BENEF_CLASS_DESC_2 TEXT,
    OLD_BNF_NAME_2 TEXT,
    OLD_HSBND_NAME_2 TEXT,
    OLD_PHONE_NO TEXT,
    OLD_ID_CARD_NO TEXT,
    enrollment_modification_type TEXT,
    eligible_woman_modify_type TEXT,
    eligible_woman_name_correction TEXT,
    eligible_woman_phone_correction TEXT,
    eligible_woman_ID_correction TEXT,
    eligible_woman_husband_name_correction TEXT,
    pregnancy_month INTEGER,
    educational_level_of_the_targeted_woman TEXT,
    new_bnf_name TEXT,
    the_corrected_part_of_the_targets_name TEXT,
    corrected_part_of_the_targets_namefirst_name TEXT,
    the_corrected_part_of_the_targets_namefathers_name TEXT,
    the_corrected_part_of_the_targets_namegrandfathers_name TEXT,
    corrected_part_of_the_targets_namefourth_name TEXT,
    corrected_part_of_the_targets_nametitle TEXT,
    correcting_the_first_name TEXT,
    correcting_the_fathers_name TEXT,
    correcting_the_grandfathers_name TEXT,
    correcting_the_fourth_name TEXT,
    correcting_the_title TEXT,
    bnf_1name_flag TEXT,
    bnf_2name_flag TEXT,
    bnf_3name_flag TEXT,
    bnf_4name_flag TEXT,
    bnf_5name_flag TEXT,
    bnf_1name_is_valid TEXT,
    bnf_2name_is_valid TEXT,
    bnf_3name_is_valid TEXT,
    bnf_4name_is_valid TEXT,
    bnf_5name_is_valid TEXT,
    bnf_1name_valid_note TEXT,
    bnf_2name_valid_note TEXT,
    bnf_3name_valid_note TEXT,
    bnf_4name_valid_note TEXT,
    bnf_5name_valid_note TEXT,
    reference_under_which_the_name_was_corrected TEXT,
    reference_under_which_the_namepersonal_ID_card_correction_was_made TEXT,
    reference_under_which_the_namefamily_card_correction_was_made TEXT,
    reference_under_which_the_namepassport_correction_was_made TEXT,
    reference_under_which_the_name_correctionmarriage_contract_was_made TEXT,
    reference_under_which_the_nameelectoral_card_correction_was_made TEXT,
    reference_under_which_the_name_correctionquestionnaire_was_made TEXT,
    reference_used_to_correct_the_nameaccording_to_the_womans_statement TEXT,
    reference_under_which_the_nameseat_number_was_corrected TEXT,
    reference_under_which_the_name_correction_was_madeother_mentioned TEXT,
    another_reference_under_which_the_name_was_modified TEXT,
    the_corrected_part_of_the_husbands_name TEXT,
    corrected_part_of_husbands_namefirst_name TEXT,
    corrected_part_of_husbands_namefathers_name TEXT,
    the_corrected_part_of_the_husbands_namegrandfathers_name TEXT,
    corrected_part_of_husbands_namefourth_name TEXT,
    corrected_part_of_husbands_namesurname TEXT,
    new_hsbnd_name TEXT,
    correcting_the_first_name_6 TEXT,
    correcting_the_fathers_name_8 TEXT,
    correcting_the_grandfathers_name_10 TEXT,
    correcting_the_fourth_name_12 TEXT,
    title_correction_14 TEXT,
    hsbnd_1name_flag TEXT,
    hsbnd_2name_flag TEXT,
    hsbnd_3name_flag TEXT,
    hsbnd_4name_flag TEXT,
    hsbnd_5name_flag TEXT,
    hsbnd_1name_is_valid TEXT,
    hsbnd_2name_is_valid TEXT,
    hsbnd_3name_is_valid TEXT,
    hsbnd_4name_is_valid TEXT,
    hsbnd_5name_is_valid TEXT,
    hsbnd_1name_valid_note TEXT,
    hsbnd_2name_valid_note TEXT,
    hsbnd_3name_valid_note TEXT,
    hsbnd_4name_valid_note TEXT,
    hsbnd_5name_valid_note TEXT,
    reference_under_which_the_name_was_corrected_16 TEXT,
    reference_under_which_the_namepersonal_ID_card_correction_was_made_17 TEXT,
    reference_under_which_the_namefamily_card_correction_was_made_18 TEXT,
    reference_under_which_the_namepassport_correction_was_made_19 TEXT,
    reference_under_which_the_name_correction_was_mademarriage_contract_20 TEXT,
    reference_under_which_the_name_correction_was_madeelectoral_card_21 TEXT,
    reference_under_which_the_name_correction_was_madeQuestionnaire_22 TEXT,
    reference_used_to_correct_the_nameaccording_to_what_the_woman_stated23 TEXT,
    reference_under_which_the_nameseat_number_was_corrected_24 TEXT,
    reference_under_which_the_name_correction_was_madeother_mentions_25 TEXT,
    another_reference_under_which_the_name_was_modified26 TEXT,
    telephone_number TEXT,
    ID_card_type_3 TEXT,
    other_determines TEXT,
    ID_card_number TEXT,
    day_of_signing_the_form TEXT,
    month TEXT,
    the_reason_for_not_joining_the_project_is_stated TEXT,
    other_things_to_mention TEXT,
    do_you_want_to_repackage_the_beneficiary_for_another_educator TEXT,
    please_select_the_alternative_educator TEXT,
    the_name_of_the_new_intellectual TEXT,
    comments TEXT,
    diff_per__bnf1 TEXT,
    diff_level_bnf1 TEXT,
    diff_per__bnf2 TEXT,
    diff_level_bnf2 TEXT,
    diff_per__bnf3 TEXT,
    diff_level_bnf3 TEXT,
    diff_per__bnf4 TEXT,
    diff_level__bnf4 TEXT,
    diff_per__bnf5 TEXT,
    diff_level__bnf5 TEXT,
    diff_per__bnf TEXT,
    diff_level__bnf TEXT,
    diff_per__hus1 TEXT,
    diff_level__hus1 TEXT,
    diff_per__hus2 TEXT,
    diff_level__hus2 TEXT,
    diff_per__hus3 TEXT,
    diff_level__hus3 TEXT,
    diff_per__hus4 TEXT,
    diff_level__hus4 TEXT,
    diff_per__hus5 TEXT,
    diff_level__hus5 TEXT,
    diff_per__hus TEXT,
    diff_level__hus TEXT,
    enroll_sim_score TEXT,
    enroll_cluster_id TEXT,
    branch_recommendation TEXT,
    HQ_recommendation TEXT,
    enroll_recom TEXT,
    weighted_damerau_score TEXT,
    positional_similarity TEXT,
    bigram_similarity TEXT,
    lcs_ratio TEXT,
    length_factor TEXT,
    structural_integrity TEXT,
    root_factor TEXT,
    internalId TEXT,
    data JSON
)`;
// ... (rest of the file remains the same)
```
This is a large file, so the rest is omitted for brevity but remains unchanged. The key is adding the new `diff_...`, `enroll_...`, and score breakdown columns to the `CREATE TABLE` statement.

### **Step 7: Create the Name Difference Engine**

Create a new library file to house the advanced name comparison logic.

**File**: `src/lib/name-engine.ts`
```ts
// src/lib/name-engine.ts

// ==========================================
// 1. ARABIC NORMALIZATION ENGINE
// ==========================================

const FIXED_COMPOUND_NAMES = [
    // === ALLAH NAMES (Sorted by length desc to match longest first) ===
    "عبد الرحمن", "عبد الرحيم", "عبد الكريم", "عبد العزيز", "عبد الملك",
    "عبد السلام", "عبد القادر", "عبد الجليل", "عبد الرزاق", "عبد الغني",
    "عبد الوهاب", "عبد الاله", "عبد الواحد", "عبد الماجد", "عبد الصمد",
    "عبد الباري", "عبد القدوس", "عبد المطلب", "عبد المهيمن", "عبد الله",
    
    // === FEMALE ===
    "امه الله", "امه الرحمن", "امه الرحيم", "امه الكريم", "فاطمه الزهراء",
  
    // === MALE RELIGIOUS ===
    "صنع الله", "عطاء الله", "نور الله", "فتح الله", "نصر الله",
    "فضل الله", "رحمه الله", "حسب الله", "جود الله", "جار الله",
  
    // === PROPHET / RELIGIOUS TITLES ===
    "نور الدين", "شمس الدين", "سيف الدين", "زين الدين", "جمال الدين",
    "كمال الدين", "صلاح الدين", "علاء الدين", "تقي الدين", "نجم الدين",
    "عز الدين", "بدر الدين", "عماد الدين",
  
    // === HISTORICAL / KUNYA ===
    "ابو بكر", "ابو طالب", "ابو هريره", "ابو القاسم",
    "ام كلثوم", "ام sلمه", "ام حبيبه",
    "ابن تيميه", "ابn سينا", "ابن خلدون", "ابن رشد",
    "بنت الشاطئ"
  ];
  
  function baseArabicNormalize(value: any): string {
    if (!value) return "";
    
    let s = String(value).normalize("NFKC");
  
    // Specific Spelling Corrections
    s = s
      .replace(/يحيي/g, "يحي")
      .replace(/يحيى/g, "يحي");
  
    // Character Unification
    s = s
      .replace(/[ًٌٍَُِّْـء]/g, "")   // Remove Tashkeel (Diacritics), Tatweel, Hamza
      .replace(/[أإآ]/g, "ا")       // Normalize Alef
      .replace(/[ى]/g, "ي")         // Normalize Alef Maqsura to Ya
      .replace(/[ؤ]/g, "و")         // Hamza on Waw to Waw
      .replace(/[ئ]/g, "ي")         // Hamza on Ya to Ya
      .replace(/ة/g, "ه")           // Ta Marbuta to Ha
      .replace(/گ/g, "ك")           // Persian Gaf to Kaf
      .replace(/ڤ/g, "ف");          // Persian/Kurdish Ve to Fa
  
    // Clean non-alphanumeric (Keep spaces for now)
    s = s
      .replace(/[^ء-ي0-9a-zA-Z\s]/g, " ") 
      .replace(/\s+/g, " ")
      .trim()
      .toLowerCase();
  
    return s;
  }
  
  /**
   * Main Normalization Function
   * Applies base normalization + compound name merging (underscores).
   */
  export function normalizeArabicWithCompounds(text: any): string {
    let s = baseArabicNormalize(text);
  
    // 1. Apply Fixed Compound List
    for (const compound of FIXED_COMPOUND_NAMES) {
      const normalizedCompound = baseArabicNormalize(compound);
      if (s.includes(normalizedCompound)) {
        // Replace with underscored version globally
        // We use split/join to replace all occurrences
        const replacement = normalizedCompound.replace(/\s/g, "_");
        s = s.split(normalizedCompound).join(replacement);
      }
    }
  
    // 2. Apply Dynamic Patterns (Regex) for unknown compounds
    
    // Rule: "Abd" prefix (عبد + Name) -> abd_name
    s = s.replace(/\b(عبد)\s+([ء-ي]+)\b/g, "$1_$2");
  
    // Rule: "Abu/Umm/Ibn/Bint" prefix -> abu_name
    s = s.replace(/\b(ابو|ام|ابن|بنت)\s+([ء-ي]+)\b/g, "$1_$2");
  
    // Rule: "Al-Din" / "Al-Allah" suffix -> name_aldin
    s = s.replace(/\b([ء-ي]+)\s+(الدين|الله)\b/g, "$1_$2");
  
    return s.replace(/_+/g, "_").trim();
  }
  
  
  // ==========================================
  // 2. MATH & ALGORITHMS
  // ==========================================
  
  // A. Weighted Damerau-Levenshtein
  function damerauLevenshtein(s1: string, s2: string): number {
    const n = s1.length;
    const m = s2.length;
    
    if (n === 0) return m;
    if (m === 0) return n;
  
    const d: number[][] = [];
    for (let i = 0; i <= n; i++) d[i] = [i];
    for (let j = 0; j <= m; j++) d[0][j] = j;
  
    for (let i = 1; i <= n; i++) {
      for (let j = 1; j <= m; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        
        d[i][j] = Math.min(
          d[i - 1][j] + 1,       // deletion
          d[i][j - 1] + 1,       // insertion
          d[i - 1][j - 1] + cost // substitution
        );
  
        // Transposition check
        if (i > 1 && j > 1 && s1[i - 1] === s2[j - 2] && s1[i - 2] === s2[j - 1]) {
          d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1); 
        }
      }
    }
    return d[n][m];
  }
  
  // B. Bigram Similarity
  function getBigrams(str: string): Set<string> {
    const bigrams = new Set<string>();
    for (let i = 0; i < str.length - 1; i++) {
      bigrams.add(str.substring(i, i + 2));
    }
    return bigrams;
  }
  
  function bigramSimilarity(s1: string, s2: string): number {
    const b1 = getBigrams(s1);
    const b2 = getBigrams(s2);
    if (b1.size === 0 || b2.size === 0) return 0;
    
    let intersection = 0;
    b1.forEach(x => { if (b2.has(x)) intersection++; });
    
    return (2.0 * intersection) / (b1.size + b2.size);
  }
  
  // C. Longest Common Subsequence (LCS)
  function lcsLength(s1: string, s2: string): number {
    const dp = Array(s1.length + 1).fill(0).map(() => Array(s2.length + 1).fill(0));
    for (let i = 1; i <= s1.length; i++) {
      for (let j = 1; j <= s2.length; j++) {
        if (s1[i - 1] === s2[j - 1]) dp[i][j] = dp[i - 1][j - 1] + 1;
        else dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
    return dp[s1.length][s2.length];
  }
  
  // D. Consonant Skeleton (Root Stability Proxy)
  // Removes Alef, Waw, Ya to approximate the Arabic root
  function getConsonantSkeleton(str: string): string {
    return str.replace(/[اوي]/g, "");
  }
  
  
  // ==========================================
  // 3. MAIN SCORING LOGIC
  // ==========================================
  
  export interface ScoreResult {
    totalScore: number;
    details: {
      weighted_damerau: number;
      positional_similarity: number;
      bigram_similarity: number;
      lcs_ratio: number;
      length_factor: number;
      structural_integrity: number;
      root_factor: number;
    };
  }
  
  export function calculateAdvancedNameSimilarity(oldName: string, newName: string): ScoreResult {
    // 1. Normalize
    const s1 = normalizeArabicWithCompounds(oldName);
    const s2 = normalizeArabicWithCompounds(newName);
  
    // 2. Edge Case: Empty or Identical
    if (!s1 && !s2) return { totalScore: 0, details: zeroDetails() };
    if (!s1 || !s2) return { totalScore: 0, details: zeroDetails() };
    if (s1 === s2) return { totalScore: 100, details: perfectDetails() };
  
    const maxLen = Math.max(s1.length, s2.length);
  
    // --- COMPONENT 1: Weighted Damerau-Levenshtein (35%) ---
    const dist = damerauLevenshtein(s1, s2);
    // Score is inverted: 0 distance = 100 score
    const damerauScore = Math.max(0, (1 - dist / maxLen) * 100);
  
    // --- COMPONENT 2: Positional Similarity (20%) ---
    // Start matches are more important than end matches
    let posScore = 0;
    const sameStart = s1[0] === s2[0];
    const sameEnd = s1[s1.length - 1] === s2[s2.length - 1];
    
    if (sameStart) posScore += 60; // Start is heavier
    if (sameEnd) posScore += 40;   // End is lighter
    
    // Penalty if lengths differ significantly
    const lenDiff = Math.abs(s1.length - s2.length);
    if (lenDiff > 2) posScore *= 0.7; // Reduce confidence if length varies wildly
  
    // --- COMPONENT 3: Bigram Similarity (15%) ---
    const bigramScore = bigramSimilarity(s1, s2) * 100;
  
    // --- COMPONENT 4: LCS Ratio (10%) ---
    const lcs = lcsLength(s1, s2);
    const lcsScore = (lcs / maxLen) * 100;
  
    // --- COMPONENT 5: Structural Integrity (10%) ---
    // Jaccard Index of character sets (does this name contain the same letters?)
    const set1 = new Set(s1.split(''));
    const set2 = new Set(s2.split(''));
    let intersection = 0;
    set1.forEach(x => { if(set2.has(x)) intersection++; });
    const union = new Set([...s1, ...s2]).size;
    const structuralScore = (intersection / union) * 100;
  
    // --- COMPONENT 6: Length Deviation Penalty (5%) ---
    // 100 if lengths are same, approaches 0 as they diverge
    const lengthFactor = Math.max(0, (1 - lenDiff / maxLen) * 100);
  
    // --- COMPONENT 7: Root Stability (5%) ---
    const root1 = getConsonantSkeleton(s1);
    const root2 = getConsonantSkeleton(s2);
    const rootMax = Math.max(root1.length, root2.length) || 1;
    const rootDist = damerauLevenshtein(root1, root2);
    const rootFactor = Math.max(0, (1 - rootDist / rootMax) * 100);
  
    // --- FINAL WEIGHTED CALCULATION ---
    const totalScore = 
      (0.35 * damerauScore) +
      (0.20 * posScore) +
      (0.15 * bigramScore) +
      (0.10 * lcsScore) +
      (0.10 * structuralScore) +
      (0.05 * lengthFactor) +
      (0.05 * rootFactor);
  
    return {
      totalScore: parseFloat(totalScore.toFixed(2)),
      details: {
        weighted_damerau: parseFloat(damerauScore.toFixed(2)),
        positional_similarity: parseFloat(posScore.toFixed(2)),
        bigram_similarity: parseFloat(bigramScore.toFixed(2)),
        lcs_ratio: parseFloat(lcsScore.toFixed(2)),
        length_factor: parseFloat(lengthFactor.toFixed(2)),
        structural_integrity: parseFloat(structuralScore.toFixed(2)),
        root_factor: parseFloat(rootFactor.toFixed(2))
      }
    };
  }
  
  // Helper: Classification Level
  export function getModificationLevel(score: number): string {
    if (score >= 97) return "Spelling mistake";
    if (score >= 92) return "Small modification";
    if (score >= 80) return "Moderate modification";
    if (score >= 65) return "High modification";
    return "Complete modification";
  }
  
  // Helpers for edge cases
  function zeroDetails() {
    return { 
      weighted_damerau: 0, positional_similarity: 0, bigram_similarity: 0, 
      lcs_ratio: 0, length_factor: 0, structural_integrity: 0, root_factor: 0 
    };
  }
  
  function perfectDetails() {
    return { 
      weighted_damerau: 100, positional_similarity: 100, bigram_similarity: 100, 
      lcs_ratio: 100, length_factor: 100, structural_integrity: 100, root_factor: 100 
    };
  }
```

### **Step 8: Create the Enrollment Review Worker**

This worker will perform the intensive calculations in the background.

**File**: `src/workers/enrollment-review.worker.ts`
```ts
// src/workers/enrollment-review.worker.ts
import { normalizeArabicWithCompounds, calculateAdvancedNameSimilarity, getModificationLevel } from '@/lib/name-engine';

self.onmessage = async (event) => {
    const { uploadedData, lookupColumnFile, lookupColumnDb, allDbData, mapping, origin } = event.data;

    try {
        postMessage({ type: 'progress', status: 'Starting analysis...', progress: 5 });

        const dbDataMap = new Map(allDbData.map((row: any) => [String(row[lookupColumnDb]), row]));
        const totalRecords = uploadedData.length;

        const results = uploadedData.map((fileRow: any, index: number) => {
            const lookupValue = fileRow[lookupColumnFile];
            const dbRecord = dbDataMap.get(String(lookupValue));
            
            if (!dbRecord) return null; // Skip if no match in DB

            const updatedRecord = { ...dbRecord };
            
            // Apply mapped data from file to DB record
            for(const [fileCol, dbCol] of Object.entries(mapping)) {
                if(fileRow.hasOwnProperty(fileCol)) {
                    updatedRecord[dbCol as string] = fileRow[fileCol];
                }
            }

            // --- Name Difference Calculations ---
            const nameParts = [
                { key: 'bnf1', oldNameCol: 'bnf_1name', newNameCol: 'correcting_the_first_name', flagCol: 'corrected_part_of_the_targets_namefirst_name' },
                { key: 'bnf2', oldNameCol: 'bnf_2name', newNameCol: 'correcting_the_fathers_name', flagCol: 'the_corrected_part_of_the_targets_namefathers_name' },
                { key: 'bnf3', oldNameCol: 'bnf_3name', newNameCol: 'correcting_the_grandfathers_name', flagCol: 'the_corrected_part_of_the_targets_namegrandfathers_name' },
                { key: 'bnf4', oldNameCol: 'bnf_4name', newNameCol: 'correcting_the_fourth_name', flagCol: 'corrected_part_of_the_targets_namefourth_name' },
                { key: 'bnf5', oldNameCol: 'bnf_5name', newNameCol: 'correcting_the_title', flagCol: 'corrected_part_of_the_targets_nametitle' },
                { key: 'hus1', oldNameCol: 'hsbnd_1name', newNameCol: 'correcting_the_first_name_6', flagCol: 'corrected_part_of_husbands_namefirst_name' },
                { key: 'hus2', oldNameCol: 'hsbnd_2name', newNameCol: 'correcting_the_fathers_name_8', flagCol: 'corrected_part_of_husbands_namefathers_name' },
                { key: 'hus3', oldNameCol: 'hsbnd_3name', newNameCol: 'correcting_the_grandfathers_name_10', flagCol: 'the_corrected_part_of_the_husbands_namegrandfathers_name' },
                { key: 'hus4', oldNameCol: 'hsbnd_4name', newNameCol: 'correcting_the_fourth_name_12', flagCol: 'corrected_part_of_husbands_namefourth_name' },
                { key: 'hus5', oldNameCol: 'hsbnd_5name', newNameCol: 'title_correction_14', flagCol: 'corrected_part_of_husbands_namesurname' },
            ];

            nameParts.forEach(part => {
                if (Number(updatedRecord[part.flagCol]) === 1) {
                    const scoreResult = calculateAdvancedNameSimilarity(updatedRecord[part.oldNameCol], updatedRecord[part.newNameCol]);
                    updatedRecord[`diff_per__${part.key}`] = scoreResult.totalScore;
                    updatedRecord[`diff_level_${part.key}`] = getModificationLevel(scoreResult.totalScore);
                }
            });

            // --- Whole Name Difference ---
            const bnfScoreResult = calculateAdvancedNameSimilarity(updatedRecord['l_benef_name'], updatedRecord['new_bnf_name']);
            updatedRecord['diff_per__bnf'] = bnfScoreResult.totalScore;
            updatedRecord['diff_level__bnf'] = getModificationLevel(bnfScoreResult.totalScore);
            
            const husScoreResult = calculateAdvancedNameSimilarity(updatedRecord['l_hsbnd_name'], updatedRecord['new_hsbnd_name']);
            updatedRecord['diff_per__hus'] = husScoreResult.totalScore;
            updatedRecord['diff_level__hus'] = getModificationLevel(husScoreResult.totalScore);
            
            // --- Similarity Score ---
            updatedRecord['enroll_sim_score'] = 0; // Placeholder for now

            postMessage({ type: 'progress', status: `Processing record ${index + 1}...`, progress: 10 + ((index + 1) / totalRecords) * 80 });
            
            return updatedRecord;

        }).filter(Boolean); // Filter out nulls

        // --- Save to DB ---
        postMessage({ type: 'progress', status: 'Saving results to database...', progress: 95 });

        const saveResponse = await fetch(`${origin}/api/bnf-assessed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: "save", records: results, uniqueIdDbCol: lookupColumnDb, projectId: 'N/A' })
        });
        
        if (!saveResponse.ok) {
            const error = await saveResponse.json();
            throw new Error(`Failed to save uploaded data: ${error.details || error.error}`);
        }

        postMessage({ type: 'done', data: { processed: results.length } });

    } catch (e: any) {
        postMessage({ type: 'error', error: e.message || 'An unknown error occurred.' });
    }
};
```

### **Step 9: Create the Enrollment Review Page**

Finally, create the main page component that ties everything together.

**File**: `src/app/meal-system/monitoring/implementation/enrollment/review/page.tsx`
```tsx
// This file is now empty as the page has been moved.
```
This should now be `src/app/meal-system/monitoring/implementation/enrollment/review/page.tsx`. I will place the code there.

**File**: `src/app/meal-system/monitoring/implementation/enrollment/review/page.tsx`
```tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import * as XLSX from 'xlsx';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, GitCompareArrows, Trash2, Plus, FileDown, Upload, Database } from 'lucide-react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';


interface Project {
  projectId: string;
  projectName: string;
}

const LOCAL_STORAGE_MAPPING_PREFIX = "enrollment-review-mapping-";

export default function EnrollmentUploadAndProcessPage() {
    const { toast } = useToast();
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [loadingProjects, setLoadingProjects] = useState(true);

    const [file, setFile] = useState<File | null>(null);
    const [sheets, setSheets] = useState<string[]>([]);
    const [selectedSheet, setSelectedSheet] = useState('');
    const [columns, setColumns] = useState<string[]>([]);
    const [rawFileData, setRawFileData] = useState<any[]>([]);
    
    const [dbColumns, setDbColumns] = useState<string[]>([]);
    const [loadingDbSchema, setLoadingDbSchema] = useState(true);
    const [allDbData, setAllDbData] = useState<any[]>([]);

    const [lookupColumnFile, setLookupColumnFile] = useState('');
    const [lookupColumnDb, setLookupColumnDb] = useState('');
    
    const [columnMapping, setColumnMapping] = useState<Map<string, string>>(new Map());
    const [manualMapping, setManualMapping] = useState({ ui: '', db: '' });

    const [isProcessing, setIsProcessing] = useState(false);
    const [workerStatus, setWorkerStatus] = useState('idle');
    const [workerProgress, setWorkerProgress] = useState(0);

    const workerRef = useRef<Worker | null>(null);

    // Initialization
    useEffect(() => {
        const fetchInitialData = async () => {
            try {
                const [projRes, dbSchemaRes] = await Promise.all([
                    fetch('/api/projects'),
                    fetch('/api/bnf-assessed', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action: 'get_schema' })})
                ]);
                if (projRes.ok) setProjects(await projRes.json());
                if (dbSchemaRes.ok) {
                    const schema = await dbSchemaRes.json();
                    setDbColumns(schema.columns || []);
                }
            } catch (error: any) {
                toast({ title: "Error loading initial data", description: error.message, variant: "destructive" });
            } finally {
                setLoadingProjects(false);
                setLoadingDbSchema(false);
            }
        };
        fetchInitialData();
        
        // Initialize Worker
        const worker = new Worker(new URL('@/workers/enrollment-review.worker.ts', import.meta.url));
        workerRef.current = worker;
        
        worker.onmessage = (event) => {
            const { type, status, progress, error } = event.data;
        
            if (type === "progress") {
                setWorkerStatus(status);
                setWorkerProgress(progress);
            } else if (type === "done") {
                setIsProcessing(false);
                setWorkerStatus('done');
                setWorkerProgress(100);
                toast({ title: 'Success!', description: `Successfully processed and saved ${event.data.data.processed} records.`});
            } else if (type === "error") {
                setIsProcessing(false);
                setWorkerStatus('error');
                toast({ title: 'Worker Error', description: error, variant: 'destructive'});
            }
        };
        
        return () => worker.terminate();

    }, [toast]);
    
    // UI Logic (Memoization, Handlers)
    const unmappedFileColumns = useMemo(() => columns.filter(col => !Array.from(columnMapping.keys()).includes(col) && col !== lookupColumnFile), [columns, columnMapping, lookupColumnFile]);
    const unmappedDbColumns = useMemo(() => dbColumns.filter(col => !Array.from(columnMapping.values()).includes(col) && col !== lookupColumnDb), [dbColumns, columnMapping, lookupColumnDb]);
    
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files) {
        setFile(e.target.files[0]);
        setSheets([]);
        setSelectedSheet('');
        setColumns([]);
        setRawFileData([]);
      }
    };

    useEffect(() => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target!.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            setSheets(workbook.SheetNames);
            if (workbook.SheetNames.length > 0) {
                setSelectedSheet(workbook.SheetNames[0]);
            }
        };
        reader.readAsArrayBuffer(file);
    }, [file]);

    useEffect(() => {
        if (!file || !selectedSheet) return;
        const reader = new FileReader();
        reader.onload = (e) => {
            const data = new Uint8Array(e.target!.result as ArrayBuffer);
            const workbook = XLSX.read(data, { type: 'array' });
            const worksheet = workbook.Sheets[selectedSheet];
            const jsonData = XLSX.utils.sheet_to_json(worksheet);
            setRawFileData(jsonData);
            const fileColumns = Object.keys(jsonData[0] || {});
            setColumns(fileColumns);
            
            const storageKey = `${LOCAL_STORAGE_MAPPING_PREFIX}${fileColumns.join(',')}`;
            const savedMapping = localStorage.getItem(storageKey);
            if(savedMapping) {
                setColumnMapping(new Map(Object.entries(JSON.parse(savedMapping))));
                toast({ title: "Mapping Restored" });
            } else {
                setColumnMapping(new Map());
            }
        };
        reader.readAsArrayBuffer(file);
    }, [file, selectedSheet, toast]);
    
    useEffect(() => {
        if (columns.length > 0 && columnMapping.size > 0) {
            const storageKey = `${LOCAL_STORAGE_MAPPING_PREFIX}${columns.join(',')}`;
            localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(columnMapping)));
        }
    }, [columnMapping, columns]);

    const handleAutoMatch = () => {
        const newMapping = new Map<string, string>();
        unmappedFileColumns.forEach(uiCol => {
            const matchedDbCol = unmappedDbColumns.find(dbCol => dbCol.toLowerCase().replace(/_/g, '') === uiCol.toLowerCase().replace(/_/g, ''));
            if(matchedDbCol) { newMapping.set(uiCol, matchedDbCol); }
        });
        setColumnMapping(prev => new Map([...prev, ...newMapping]));
        toast({ title: "Auto-match Complete" });
    };

    const handleAddManualMapping = () => {
        if (manualMapping.ui && manualMapping.db) {
            setColumnMapping(prev => new Map(prev).set(manualMapping.ui, manualMapping.db));
            setManualMapping({ ui: '', db: '' });
        }
    };
    
    const handleProcessAndSave = async () => {
        if (!selectedProjectId || !lookupColumnFile || !lookupColumnDb || rawFileData.length === 0) {
            toast({ title: "Missing prerequisites", description: "Select project, upload file, and define lookup columns.", variant: "destructive" });
            return;
        }

        setIsProcessing(true);
        setWorkerStatus('fetching_db_data');
        setWorkerProgress(0);

        try {
            const res = await fetch('/api/bnf-assessed');
            if (!res.ok) throw new Error("Failed to fetch current bnf-assessed data.");
            const fullDbData = await res.json();
            
            workerRef.current?.postMessage({
                uploadedData: rawFileData,
                lookupColumnFile,
                lookupColumnDb,
                allDbData: fullDbData,
                mapping: Object.fromEntries(columnMapping),
                origin: window.location.origin,
            });

        } catch(error: any) {
            toast({ title: "Error starting process", description: error.message, variant: "destructive" });
            setIsProcessing(false);
        }
    };
    
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Enrollment Review & Correction</h1>
                 <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/enrollment"><ArrowLeft className="mr-2 h-4 w-4" /> Back</Link></Button>
            </div>
            
            {/* Sections */}
            <Card><CardHeader><CardTitle>1. Select Project</CardTitle></CardHeader>
                <CardContent><Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loadingProjects}>
                    <SelectTrigger><SelectValue placeholder="Select a project..." /></SelectTrigger>
                    <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                </Select></CardContent>
            </Card>

            <Card>
                <CardHeader><CardTitle>2. Upload Data File</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                     <Input type="file" onChange={handleFileChange} accept=".xlsx,.xls,.csv" />
                     {sheets.length > 0 && <Select value={selectedSheet} onValueChange={handleSheetSelect}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{sheets.map(s=><SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select>}
                </CardContent>
            </Card>

            {columns.length > 0 && (
                 <Card>
                    <CardHeader><CardTitle>3. Define Lookup Columns</CardTitle></CardHeader>
                    <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                           <Label>Lookup Column from File</Label>
                           <Select value={lookupColumnFile} onValueChange={setLookupColumnFile}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{columns.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                        </div>
                         <div className="space-y-2">
                           <Label>Lookup Column from Database</Label>
                           <Select value={lookupColumnDb} onValueChange={setLookupColumnDb}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{dbColumns.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                        </div>
                    </CardContent>
                </Card>
            )}

            {columns.length > 0 && (
                <Card>
                    <CardHeader>
                       <div className="flex justify-between items-center">
                         <CardTitle>4. Map Columns for Update</CardTitle>
                         <Button onClick={handleAutoMatch}><GitCompareArrows className="mr-2 h-4 w-4" />Auto-match</Button>
                       </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                         <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div className="space-y-2">
                                <Label>Unmapped File Column</Label>
                                <Select value={manualMapping.ui} onValueChange={v => setManualMapping(m=>({...m, ui: v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{unmappedFileColumns.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                            </div>
                            <div className="space-y-2">
                                <Label>Unmapped DB Column</Label>
                                <Select value={manualMapping.db} onValueChange={v => setManualMapping(m=>({...m, db: v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent>{unmappedDbColumns.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent></Select>
                            </div>
                            <Button onClick={handleAddManualMapping}><Plus className="mr-2 h-4 w-4"/>Add Mapping</Button>
                        </div>
                        <ScrollArea className="h-48 border rounded-md">
                            <Table><TableHeader><TableRow><TableHead>File Column</TableHead><TableHead>Database Column</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                            <TableBody>{Array.from(columnMapping.entries()).map(([ui, db]) => <TableRow key={ui}><TableCell>{ui}</TableCell><TableCell>{db}</TableCell><TableCell><Button variant="ghost" size="icon" onClick={()=>setColumnMapping(p=>{const n=new Map(p);n.delete(ui);return n;})}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>)}</TableBody>
                            </Table>
                        </ScrollArea>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader><CardTitle>5. Execute and Save</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                     <Button onClick={handleProcessAndSave} disabled={isProcessing || !isMappingComplete}>
                        {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4"/>}
                        {isProcessing ? `Processing... (${workerStatus})` : 'Process & Save Changes'}
                    </Button>
                    {isProcessing && <Progress value={workerProgress} />}
                </CardContent>
            </Card>

            <div className="flex justify-end gap-2">
                 <Button variant="secondary" asChild><Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/review">Go to Review Page</Link></Button>
                 <Button variant="secondary" asChild><Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/database">Go to Database Page</Link></Button>
            </div>
        </div>
    );
}

```
This sets up all the required parts for your new feature.