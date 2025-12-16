
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

**File**: `src/app/upload/page.tsx`
```tsx
// app/(app)/upload/page.tsx
"use client";

import React, { useEffect, useState, useRef } from "react";
import * as XLSX from "xlsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Upload, Settings, CheckCircle, XCircle, Loader2, ChevronRight, Users, Group, Unlink, BoxSelect, Sigma, ChevronsUpDown } from "lucide-react";
import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import type { RecordRow } from "@/lib/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

function createWorkerScript() {
  return `
// WorkerScript v7 — fuzzy clustering (self-contained)
// Use as a web worker. Listens for messages: {type:'start', payload:{mapping, options}}, {type:'data', payload:{rows}}, {type:'end'}
// Emits progress and final payload: postMessage({ type:'done', payload:{ rows, clusters, edgesUsed } })

/* -------------------------
   Helpers & Normalizers
   ------------------------- */
function normalizeArabicRaw(s) {
  if (!s) return "";
  try { s = String(s); } catch { s = "";}
  s = s.normalize("NFKC");
  s = s.replace(/يحيي/g, "يحي");
  s = s.replace(/يحيى/g, "يحي");
  s = s.replace(/عبد /g, "عبد");
  s = s.replace(/[ًٌٍََُِّْـء]/g, "");
  s = s.replace(/[أإآ]/g, "ا");
  s = s.replace(/ى/g, "ي");
  s = s.replace(/ؤ/g, "و");
  s = s.replace(/ئ/g, "ي");
  s = s.replace(/ة/g, "ه");
  s = s.replace(/گ/g, "ك");
  s = s.replace(/[^ء-ي0-9a-zA-Z\\s]/g, " "); // keep Arabic letters, numbers, ascii, spaces
  s = s.replace(/\\s+/g, " ").trim();
  return s.toLowerCase();
}

function tokens(s) {
  const n = normalizeArabicRaw(s || "");
  if (!n) return [];
  return n.split(/\\s+/).filter(Boolean);
}

function digitsOnly(s) {
  if (s === null || s === undefined) return "";
  return String(s).replace(/\\D/g, "");
}

function normalizeChildrenField(val) {
  if (!val) return [];
  if (Array.isArray(val)) return val.map(x => String(x)).filter(Boolean);
  return String(val).split(/[;,|،]/).map(x => String(x).trim()).filter(Boolean);
}

/* -------------------------
   String similarity primitives
   ------------------------- */
function jaroWinkler(a, b) {
  a = String(a || ""); b = String(b || "");
  if (!a || !b) return 0;
  const la = a.length, lb = b.length;
  const matchDist = Math.floor(Math.max(la, lb) / 2) - 1;
  const aM = Array(la).fill(false), bM = Array(lb).fill(false);
  let matches = 0;
  for (let i = 0; i < la; i++) {
    const start = Math.max(0, i - matchDist), end = Math.min(i + matchDist + 1, lb);
    for (let j = start; j < end; j++) {
      if (bM[j]) continue;
      if (a[i] !== b[j]) continue;
      aM[i] = true; bM[j] = true; matches++; break;
    }
  }
  if (matches === 0) return 0;
  let k = 0, trans = 0;
  for (let i = 0; i < la; i++) {
    if (!aM[i]) continue;
    while (!bM[k]) k++;
    if (a[i] !== b[k]) trans++;
    k++;
  }
  trans = trans / 2;
  const m = matches;
  const jaro = (m / la + m / lb + (m - trans) / m) / 3;
  let prefix = 0, maxPrefix = 4;
  for (let i = 0; i < Math.min(maxPrefix, la, lb); i++) {
    if (a[i] === b[i]) prefix++; else break;
  }
  return jaro + prefix * 0.1 * (1 - jaro);
}

function tokenJaccard(aTokens, bTokens) {
  if (!aTokens.length && !bTokens.length) return 0;
  const A = new Set(aTokens), B = new Set(bTokens);
  let inter = 0;
  for (const x of A) if (B.has(x)) inter++;
  const uni = new Set([...A, ...B]).size;
  return uni === 0 ? 0 : inter / uni;
}

function nameOrderFreeScore(aName, bName) {
  const aT = tokens(aName), bT = tokens(bName);
  if (!aT.length || !bT.length) return 0;
  const A = new Set(aT), B = new Set(bT);
  let inter = 0; for (const t of A) if (B.has(t)) inter++;
  const union = new Set([...A, ...B]).size;
  const jacc = union === 0 ? 0 : inter / union;
  const aSorted = aT.slice().sort().join(" "), bSorted = bT.slice().sort().join(" ");
  const sj = jaroWinkler(aSorted, bSorted);
  return 0.7 * jacc + 0.3 * sj;
}

/* -------------------------
   Component compare
   - splits combined woman+husband into parts and compares part-by-part
   ------------------------- */
function splitParts(name) {
  if (!name) return [];
  return tokens(name);
}

function compareNameComponents(aName, bName) {
  // returns { partsA, partsB, partScores: [..], orderFree }
  const A = splitParts(aName);
  const B = splitParts(bName);
  const minLen = Math.min(A.length, B.length);
  const partScores = [];
  for (let i = 0; i < Math.max(A.length, B.length); i++) {
    const pA = A[i] || "";
    const pB = B[i] || "";
    partScores.push(jaroWinkler(pA, pB));
  }
  const orderFree = nameOrderFreeScore(aName, bName);
  return { partsA: A, partsB: B, partScores, orderFree };
}

/* -------------------------
   Additional Rules (0..5) - includes your 5 rules and token-based rule
   Returns boosted score (>= minPair) or null
   ------------------------- */
function applyAdditionalRules(a, b, opts) {
  const minPair = opts?.thresholds?.minPair ?? 0.62;
  const jw = jaroWinkler;

  const A = splitParts(a.womanName_normalized || "");
  const B = splitParts(b.womanName_normalized || "");
  const HA = splitParts(a.husbandName_normalized || "");
  const HB = splitParts(b.husbandName_normalized || "");
  const reasons = [];

  // RULE 0: strong token match (80%+ tokens overlap)
  {
    const setA = new Set(A);
    const setB = new Set(B);
    let inter = 0;
    for (const t of setA) if (setB.has(t)) inter++;
    const uni = new Set([...setA, ...setB]).size;
    const ratio = uni === 0 ? 0 : inter / uni;
    if (ratio >= 0.80) {
      reasons.push("TOKEN_REORDER");
      return { score: Math.min(1, minPair + 0.22), reasons };
    }
  }

  /* ----------------------------------------------------
     RULE 6 — STRONG HOUSEHOLD + CHILDREN MATCH (CRITICAL)
     This rule overrides all weak lineage noise
     المرأة نفسها مع اختلاف النسب — الزوج + الأطفال حاسمين
  ---------------------------------------------------- */
  {
    const A_parts = splitParts(a.womanName_normalized);
    const B_parts = splitParts(b.womanName_normalized);

    const firstNameMatch =
      A_parts.length > 0 && B_parts.length > 0 && jw(A_parts[0], B_parts[0]) >= 0.93;

    const husbandStrong =
      jw(a.husbandName_normalized, b.husbandName_normalized) >= 0.90 ||
      nameOrderFreeScore(a.husbandName_normalized, b.husbandName_normalized) >= 0.90;

    const childrenMatch =
      tokenJaccard(
        a.children_normalized || [],
        b.children_normalized || []
      ) >= 0.90;

    if (firstNameMatch && husbandStrong && childrenMatch) {
        reasons.push("DUPLICATED_HUSBAND_LINEAGE"); // This is close enough
        return { score: minPair + 0.25, reasons }; // HARD FORCE DUPLICATE
    }
  }

  // Helper thresholds
  const s93 = (x, y) => jw(x || "", y || "") >= 0.93;
  const s95 = (x, y) => jw(x || "", y || "") >= 0.95;

  // Normalize accessors for first, father, grandfather, 4th/last
  const getPart = (arr, idx) => (arr && arr.length > idx) ? arr[idx] : "";

  const F1 = getPart(A, 0), Fa1 = getPart(A, 1), G1 = getPart(A, 2), L1 = getPart(A, 3);
  const F2 = getPart(B, 0), Fa2 = getPart(B, 1), G2 = getPart(B, 2), L2 = getPart(B, 3);

  const HF1 = getPart(HA, 0);
  const HF2 = getPart(HB, 0);
  
  if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2) && jw(L1 || "", L2 || "") < 0.85) {
    if (jw(HF1, HF2) < 0.7) {
        reasons.push("WOMAN_LINEAGE_MATCH");
        return { score: Math.min(1, minPair + 0.18), reasons };
    }
  }

  if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2) && jw(L1, L2) >= 0.85) {
    if (jw(HF1, HF2) < 0.7) {
        reasons.push("WOMAN_LINEAGE_MATCH");
        return { score: Math.min(1, minPair + 0.18), reasons };
    }
  }

  if ((A.length === 4 && B.length === 5) || (A.length === 5 && B.length === 4)) {
    if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2) && s93(L1 || "", L2 || "")) {
      if (jw(HF1, HF2) < 0.7) {
          reasons.push("WOMAN_LINEAGE_MATCH");
          return { score: Math.min(1, minPair + 0.17), reasons };
      }
    }
  }

  if ((A.length === 4 && B.length === 5) || (A.length === 5 && B.length === 4)) {
    if (s95(F1, F2) && s93(L1 || "", L2 || "") && s95(HF1, HF2)) {
      if (s93(Fa1, Fa2) && !s93(G1, G2)) {
          reasons.push("DUPLICATED_HUSBAND_LINEAGE");
          return { score: Math.min(1, minPair + 0.20), reasons };
      }
    }
  }

  if ((A.length === 4 && B.length === 5) || (A.length === 5 && B.length === 4)) {
    if (s93(F1, F2) && s93(Fa1, Fa2) && s93(G1, G2)) {
      if (jw(HF1, HF2) < 0.7) {
          reasons.push("WOMAN_LINEAGE_MATCH");
          return { score: Math.min(1, minPair + 0.16), reasons };
      }
    }
  }

  /* ============================================================
     RULE — DOMINANT LINEAGE MATCH (WOMAN + HUSBAND)
     ============================================================ */
  {
    if (A.length >= 3 && B.length >= 3 && HA.length >= 3 && HB.length >= 3) {
      const womanFatherOK = jw(A[1], B[1]) >= 0.93;
      const womanGrandOK = jw(A[2], B[2]) >= 0.93;
      const womanFamilyOK = jw(A[A.length - 1], B[B.length - 1]) >= 0.90;
      const womanLineageStrong = womanFatherOK && womanGrandOK && womanFamilyOK;
      const husbandFirstOK  = jw(HA[0], HB[0]) >= 0.93;
      const husbandFatherOK = jw(HA[1], HB[1]) >= 0.93;
      const husbandGrandOK  = jw(HA[2], HB[2]) >= 0.93;
      const husbandFamilyOK = jw(HA[HA.length - 1], HB[HB.length - 1]) >= 0.90;
      const husbandIsSamePerson = husbandFirstOK && husbandFatherOK && husbandGrandOK && husbandFamilyOK;
      const womanFirstSupport = jw(A[0], B[0]) >= 0.55 || jw(A[0], B[0]) === 0;

      if (womanLineageStrong && husbandIsSamePerson && womanFirstSupport) {
        reasons.push("DUPLICATED_HUSBAND_LINEAGE");
        return { score: Math.min(1, minPair + 0.23), reasons };
      }
    }
  }

  return null;
}

/* -------------------------
   pairwiseScore: tiered approach
   ------------------------- */
function pairwiseScore(aRaw, bRaw, opts) {
  const optsDefaults = {
    finalScoreWeights: {
      firstNameScore: 0.15,
      familyNameScore: 0.25,
      advancedNameScore: 0.12,
      tokenReorderScore: 0.10,
      husbandScore: 0.12,
      idScore: 0.08,
      phoneScore: 0.05,
      childrenScore: 0.06,
      locationScore: 0.04
    },
    thresholds: {
      minPair: 0.62,
      minInternal: 0.50,
      blockChunkSize: 3000
    },
    rules: {
      enablePolygamyRules: true
    }
  };
  const o = Object.assign({}, optsDefaults, opts || {});
  o.finalScoreWeights = Object.assign({}, optsDefaults.finalScoreWeights, (opts && opts.finalScoreWeights) || {});
  o.thresholds = Object.assign({}, optsDefaults.thresholds, (opts && opts.thresholds) || {});
  o.rules = Object.assign({}, optsDefaults.rules, (opts && opts.rules) || {});

  const a = {
    womanName: aRaw.womanName || "", husbandName: aRaw.husbandName || "", nationalId: String(aRaw.nationalId || aRaw.id || ""),
    phone: digitsOnly(aRaw.phone || ""), village: aRaw.village || "", subdistrict: aRaw.subdistrict || "", children: aRaw.children || []
  };
  const b = {
    womanName: bRaw.womanName || "", husbandName: bRaw.husbandName || "", nationalId: String(bRaw.nationalId || bRaw.id || ""),
    phone: digitsOnly(bRaw.phone || ""), village: bRaw.village || "", subdistrict: bRaw.subdistrict || "", children: bRaw.children || []
  };

  a.womanName_normalized = normalizeArabicRaw(a.womanName);
  b.womanName_normalized = normalizeArabicRaw(b.womanName);
  a.husbandName_normalized = normalizeArabicRaw(a.husbandName);
  b.husbandName_normalized = normalizeArabicRaw(b.husbandName);
  a.village_normalized = normalizeArabicRaw(a.village);
  b.village_normalized = normalizeArabicRaw(b.village);
  a.children_normalized = (Array.isArray(a.children) ? a.children : normalizeChildrenField(a.children)).map(normalizeArabicRaw);
  b.children_normalized = (Array.isArray(b.children) ? b.children : normalizeChildrenField(b.children)).map(normalizeArabicRaw);

  if (a.nationalId && b.nationalId && a.nationalId === b.nationalId) {
    return { score: 0.99, breakdown: { reason: "EXACT_ID" }, reasons: ["EXACT_ID"] };
  }

  const husbandJW = jaroWinkler(a.husbandName_normalized, b.husbandName_normalized);
  const aParts = splitParts(a.womanName_normalized), bParts = splitParts(b.womanName_normalized);
  const aFather = aParts[1] || "", bFather = bParts[1] || "";
  const aGrand = aParts[2] || "", bGrand = bParts[2] || "";
  if (o.rules.enablePolygamyRules && husbandJW >= 0.95 && jaroWinkler(aFather, bFather) >= 0.93 && jaroWinkler(aGrand, bGrand) >= 0.90) {
    return { score: 0.97, breakdown: { reason: "POLYGAMY_STRONG" }, reasons: ["POLYGAMY_PATTERN"] };
  }

  const ruleResult = applyAdditionalRules(a, b, o);
  if (ruleResult) {
    return { score: Math.min(1, ruleResult.score), breakdown: { reason: "ADDITIONAL_RULE", boostedTo: ruleResult.score }, reasons: ruleResult.reasons };
  }

  const A = splitParts(a.womanName_normalized), B = splitParts(b.womanName_normalized);
  const firstA = A[0] || "", firstB = B[0] || "";
  const famA = A.slice(1).join(" "), famB = B.slice(1).join(" ");
  const firstNameScore = jaroWinkler(firstA, firstB);
  const familyNameScore = jaroWinkler(famA, famB);
  const advancedNameScore = (() => {
    const root = s => splitParts(s).map(t => t.slice(0, 3)).join(" ");
    const rA = root(a.womanName_normalized), rB = root(b.womanName_normalized);
    if (!rA || !rB) return 0;
    return Math.min(0.5, jaroWinkler(rA, rB));
  })();
  const tokenReorderScore = nameOrderFreeScore(a.womanName_normalized, b.womanName_normalized);
  const husbandScore = Math.max(jaroWinkler(a.husbandName_normalized, b.husbandName_normalized), nameOrderFreeScore(a.husbandName_normalized, b.husbandName_normalized));
  const phoneScoreVal = (a.phone && b.phone) ? (a.phone === b.phone ? 1 : (a.phone.slice(-6) === b.phone.slice(-6) ? 0.85 : (a.phone.slice(-4) === b.phone.slice(-4) ? 0.6 : 0))) : 0;
  const idScore = (a.nationalId && b.nationalId) ? (a.nationalId === b.nationalId ? 1 : (a.nationalId.slice(-5) === b.nationalId.slice(-5) ? 0.75 : 0)) : 0;
  const childrenScore = tokenJaccard(a.children_normalized || [], b.children_normalized || []);
  let locationScore = 0;
  if (a.village_normalized && b.village_normalized && a.village_normalized === b.village_normalized) locationScore += 0.4;
  if (a.subdistrict_normalized && b.subdistrict_normalized && a.subdistrict_normalized === b.subdistrict_normalized) locationScore += 0.25;
  locationScore = Math.min(0.5, locationScore);

  const W = o.finalScoreWeights;
  let score = (W.firstNameScore || 0) * firstNameScore + (W.familyNameScore || 0) * familyNameScore +
              (W.advancedNameScore || 0) * advancedNameScore + (W.tokenReorderScore || 0) * tokenReorderScore +
              (W.husbandScore || 0) * husbandScore + (W.idScore || 0) * idScore + (W.phoneScore || 0) * phoneScoreVal +
              (W.childrenScore || 0) * childrenScore + (W.locationScore || 0) * locationScore;

  const strongParts = [firstNameScore, familyNameScore, tokenReorderScore].filter(v => v >= 0.85).length;
  if (strongParts >= 2) score = Math.min(1, score + 0.04);
  score = Math.max(0, Math.min(1, score));

  const breakdown = { firstNameScore, familyNameScore, advancedNameScore, tokenReorderScore, husbandScore, idScore, phoneScore: phoneScoreVal, childrenScore, locationScore };
  
  const reasons = [];
  if (tokenReorderScore > 0.85) reasons.push("TOKEN_REORDER");

  return { score, breakdown, reasons };
}

/* -------------------------
   Blocking, edges, union-find, splitting
   ------------------------- */
function buildBlocks(rows, opts) {
  const blocks = new Map();
  const prefix = 3;
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    const wTokens = splitParts(r.womanName_normalized || "");
    const hTokens = splitParts(r.husbandName_normalized || "");
    const wFirst = wTokens[0] ? wTokens[0].slice(0, prefix) : "";
    const hFirst = hTokens[0] ? hTokens[0].slice(0, prefix) : "";
    const idLast4 = digitsOnly(r.nationalId || "").slice(-4) || "";
    const phoneLast4 = digitsOnly(r.phone || "").slice(-4) || "";
    const village = (r.village_normalized || "").slice(0, 6);

    const keys = new Set();
    if (wFirst && hFirst && idLast4 && phoneLast4) keys.add("full:" + wFirst + ":" + hFirst + ":" + idLast4 + ":" + phoneLast4);
    if (wFirst && phoneLast4) keys.add("wp:" + wFirst + ":" + phoneLast4);
    if (wFirst && idLast4) keys.add("wi:" + wFirst + ":" + idLast4);
    if (wFirst && hFirst) keys.add("wh:" + wFirst + ":" + hFirst);
    if (hFirst) keys.add("h:" + hFirst);
    if (wFirst) keys.add("w:" + wFirst);
    if (village) keys.add("v:" + village);
    if (keys.size === 0) keys.add("blk:all");

    for (const k of keys) {
      const arr = blocks.get(k) || [];
      arr.push(i);
      blocks.set(k, arr);
    }
  }
  return Array.from(blocks.values());
}

function pushEdgesForList(list, rows, minScore, seen, edges, opts) {
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) {
      const a = list[i], b = list[j];
      const key = a < b ? a + '_' + b : b + '_' + a;
      if (seen.has(key)) continue;
      seen.add(key);
      const result = pairwiseScore(rows[a], rows[b], opts);
      const score = result.score ?? 0;
      if (score >= minScore) edges.push({ a, b, score, reasons: result.reasons || [] });
    }
  }
}

function buildEdges(rows, minScore = 0.62, opts) {
  const blocks = buildBlocks(rows, opts);
  const seen = new Set();
  const edges = [];
  const chunk = opts?.thresholds?.blockChunkSize ?? 3000;
  for (let bi = 0; bi < blocks.length; bi++) {
    const block = blocks[bi];
    if (block.length > chunk) {
      for (let s = 0; s < block.length; s += chunk) {
        const part = block.slice(s, s + chunk);
        pushEdgesForList(part, rows, minScore, seen, edges, opts);
      }
    } else {
      pushEdgesForList(block, rows, minScore, seen, edges, opts);
    }
    if (bi % 20 === 0 || bi === blocks.length - 1) {
      const pct = Math.round(10 + 40 * (bi / Math.max(1, blocks.length)));
      postMessage({ type: "progress", status: "building-edges", progress: pct, completed: bi + 1, total: blocks.length });
    }
  }
  if (blocks.length > 0) {
    postMessage({ type: "progress", status: "building-edges", progress: 50, completed: blocks.length, total: blocks.length });
  }
  edges.sort((x, y) => y.score - x.score);
  return edges;
}

class UF {
  constructor(n) {
    this.parent = Array.from({ length: n }, (_, i) => i);
    this.size = Array(n).fill(1);
    this.members = new Map();
    for (let i = 0; i < n; i++) this.members.set(i, new Set([i]));
  }
  find(x) {
    if (this.parent[x] === x) return x;
    this.parent[x] = this.find(this.parent[x]);
    return this.parent[x];
  }
  merge(a, b) {
    a = this.find(a); b = this.find(b);
    if (a === b) return a;
    if (this.size[a] < this.size[b]) [a, b] = [b, a];
    this.parent[b] = a;
    this.size[a] += this.size[b];
    const mb = this.members.get(b), ma = this.members.get(a);
    for (const m of mb) ma.add(m);
    this.members.delete(b);
    return a;
  }
  rootMembers(x) {
    return Array.from(this.members.get(this.find(x)) || []);
  }
}

/* Split cluster so each piece <= 4 */
function splitCluster(rowsSubset, minInternal = 0.50, opts) {
    if (rowsSubset.length <= 1) return []; // Return empty if not a potential cluster
    if (rowsSubset.length <= 4) {
        const localEdges = [];
        for (let i = 0; i < rowsSubset.length; i++) {
            for (let j = i + 1; j < rowsSubset.length; j++) {
                const r = pairwiseScore(rowsSubset[i], rowsSubset[j], opts);
                if ((r.score || 0) >= minInternal) localEdges.push({ score: r.score, reasons: r.reasons || [], breakdown: r.breakdown });
            }
        }
        const reasons = Array.from(new Set(localEdges.flatMap(e => e.reasons)));
        const pairScores = localEdges.map(e => ({ finalScore: e.score, womanNameScore: e.breakdown.firstNameScore, husbandNameScore: e.breakdown.husbandScore }));
        return [{ records: rowsSubset, reasons, pairScores }];
    }

    const localEdges = [];
    for (let i = 0; i < rowsSubset.length; i++) {
        for (let j = i + 1; j < rowsSubset.length; j++) {
            const r = pairwiseScore(rowsSubset[i], rowsSubset[j], opts);
            if ((r.score || 0) >= minInternal) localEdges.push({ a: i, b: j, score: r.score, reasons: r.reasons || [], breakdown: r.breakdown });
        }
    }
    localEdges.sort((x, y) => y.score - x.score);

    const uf = new UF(rowsSubset.length);
    for (const e of localEdges) {
        const ra = uf.find(e.a), rb = uf.find(e.b);
        if (ra === rb) continue;
        if (uf.size[ra] + uf.size[rb] <= 4) uf.merge(ra, rb);
    }

    const groups = new Map();
    for (let i = 0; i < rowsSubset.length; i++) {
        const r = uf.find(i);
        if (!groups.has(r)) groups.set(r, []);
        groups.get(r).push(i);
    }

    const result = [];
    for (const idxs of groups.values()) {
        if (idxs.length <= 1) continue; // Ignore single-record groups
        const subset = idxs.map(i => rowsSubset[i]);
        const subEdges = localEdges.filter(e => idxs.includes(e.a) && idxs.includes(e.b));
        const reasons = Array.from(new Set(subEdges.flatMap(e => e.reasons)));
        const pairScores = subEdges.map(e => ({ finalScore: e.score, womanNameScore: e.breakdown.firstNameScore, husbandNameScore: e.breakdown.husbandScore }));

        if (subset.length <= 4) {
            result.push({ records: subset, reasons, pairScores });
        } else {
            result.push(...splitCluster(subset, Math.max(minInternal, 0.45), opts));
        }
    }
    return result;
}


/* Main clustering pipeline */
async function runClustering(rows, opts) {
  // ensure internal ids
  rows.forEach((r, i) => r._internalId = r._internalId || 'row_' + i);

  const minPair = opts?.thresholds?.minPair ?? 0.62;
  const minInternal = opts?.thresholds?.minInternal ?? 0.50;
  const blockChunkSize = opts?.thresholds?.blockChunkSize ?? 3000;

  postMessage({ type: "progress", status: "blocking", progress: 5, completed: 0, total: rows.length });

  const edges = buildEdges(rows, minPair, Object.assign({}, opts, { thresholds: { ...((opts && opts.thresholds) || {}), blockChunkSize } }));

  postMessage({ type: "progress", status: "edges-built", progress: 60, completed: edges.length, total: Math.max(1, rows.length) });

  const uf = new UF(rows.length);
  const finalized = new Set();
  const finalClusters = [];
  const edgesUsed = [];
  const rootReasons = new Map();

  for (let ei = 0; ei < edges.length; ei++) {
    const e = edges[ei];
    if (finalized.has(e.a) || finalized.has(e.b)) continue;
    const ra = uf.find(e.a), rb = uf.find(e.b);
    
    const currentReasons = rootReasons.get(ra) || new Set();
    (e.reasons || []).forEach(r => currentReasons.add(r));
    rootReasons.set(ra, currentReasons);

    if (ra === rb) { edgesUsed.push(e); continue; }

    const otherReasons = rootReasons.get(rb) || new Set();
    (e.reasons || []).forEach(r => otherReasons.add(r));
    rootReasons.set(rb, otherReasons);

    if (uf.size[ra] + uf.size[rb] <= 4) {
      const mergedRoot = uf.merge(ra, rb);
      const allReasons = new Set([...(rootReasons.get(ra) || []), ...(rootReasons.get(rb) || [])]);
      rootReasons.set(mergedRoot, allReasons);
      edgesUsed.push(e);
      continue;
    }
    
    // need to split combined component
    const combinedIdx = Array.from(new Set([...uf.rootMembers(ra), ...uf.rootMembers(rb)]));
    const combinedRows = combinedIdx.map(i => rows[i]);
    const parts = splitCluster(combinedRows, minInternal, opts);

    for (const p of parts) {
       if (p.records.length <= 1) continue;
       finalClusters.push(p);
       p.records.forEach(r => {
           const originalIndex = rows.findIndex(row => row._internalId === r._internalId);
           if (originalIndex !== -1) finalized.add(originalIndex);
       });
    }
    edgesUsed.push(e);
    if (ei % 200 === 0) postMessage({ type: "progress", status: "merging-edges", progress: 60 + Math.round(20 * (ei / edges.length)), completed: ei + 1, total: edges.length });
  }

  // leftovers
  const leftovers = new Map();
  for (let i = 0; i < rows.length; i++) {
    if (finalized.has(i)) continue;
    const r = uf.find(i);
    const arr = leftovers.get(r) || []; arr.push(i); leftovers.set(r, arr);
  }
  for (const [root, arr] of leftovers.entries()) {
    if (arr.length <= 1) continue;
    const subRows = arr.map(i => rows[i]);
    const parts = splitCluster(subRows, minInternal, opts);
     for (const p of parts) {
        if (p.records.length > 1) {
            const allPartReasons = new Set([...p.reasons, ...(rootReasons.get(root) || [])]);
            p.reasons = Array.from(allPartReasons);
            finalClusters.push(p);
        }
    }
  }

  const clustersWithRecords = finalClusters
    .map(c => ({
        ...c,
        records: c.records.map(r => rows.find(row => row._internalId === r._internalId))
    }))
    .filter(c => c.records.length > 1);

  postMessage({ type: "progress", status: "annotating", progress: 95 });
  return { clusters: clustersWithRecords, edgesUsed, rows };
}

/* -------------------------
   Worker message handling
   ------------------------- */
let inbound = [];
let mapping = {};
let options = {};

function mapIncomingRowsToInternal(rowsChunk, mapping) {
  return rowsChunk.map((originalRecord, i) => {
        const mapped = {
            ...originalRecord,
            _internalId: "row_" + (inbound.length + i),
            womanName: "", husbandName: "", nationalId: "", phone: "", village: "", subdistrict: "", children: [],
        };

        for (const key in mapping) {
            // Do not map cluster_id, it is system-generated and should not overwrite original data
            if (key === 'cluster_id') continue;
            
            const col = mapping[key];
            if (col && originalRecord[col] !== undefined) {
                mapped[key] = originalRecord[col];
            }
        }
        
        mapped.children = normalizeChildrenField(mapped.children);
        
        // Add normalized fields, which will be stored and used
        mapped.womanName_normalized = normalizeArabicRaw(mapped.womanName);
        mapped.husbandName_normalized = normalizeArabicRaw(mapped.husbandName);
        mapped.village_normalized = normalizeArabicRaw(mapped.village);
        mapped.subdistrict_normalized = normalizeArabicRaw(mapped.subdistrict);
        mapped.children_normalized = mapped.children.map(normalizeArabicRaw);

        return mapped;
    });
}

self.addEventListener('message', function (ev) {
  const msg = ev.data;
  if (!msg || !msg.type) return;
  if (msg.type === 'start') {
    mapping = msg.payload.mapping || {};
    options = msg.payload.options || {};
    inbound = [];
    postMessage({ type: 'progress', status: 'worker-ready', progress: 1 });
  } else if (msg.type === 'data') {
    const rows = Array.isArray(msg.payload.rows) ? msg.payload.rows : [];
    const mapped = mapIncomingRowsToInternal(rows, mapping);
    inbound.push(...mapped);
    postMessage({ type: 'progress', status: 'receiving', progress: Math.min(5, 1 + Math.floor(inbound.length / 1000)), completed: inbound.length, total: msg.payload.total || undefined });
  } else if (msg.type === 'end') {
    setTimeout(async () => {
      try {
        postMessage({ type: 'progress', status: 'mapping-rows', progress: 5, completed: 0, total: inbound.length });
        const result = await runClustering(inbound, options);
        postMessage({ type: 'done', payload: { rows: result.rows, clusters: result.clusters, edgesUsed: result.edgesUsed } });
      } catch (err) {
        postMessage({ type: 'error', error: String(err && err.message ? err.message : err) });
      }
    }, 50);
  }
});
`;
}

type Mapping = {
  womanName: string; husbandName: string; nationalId: string; phone: string;
  village: string; subdistrict: string; children: string; beneficiaryId?: string;
};
const MAPPING_FIELDS: (keyof Mapping)[] = ["womanName","husbandName","nationalId","phone","village","subdistrict","children", "beneficiaryId"];
const REQUIRED_MAPPING_FIELDS: (keyof Mapping)[] = ["womanName","husbandName","nationalId","phone","village","subdistrict","children"];
const LOCAL_STORAGE_KEY_PREFIX = "beneficiary-mapping-";
const SETTINGS_ENDPOINT = "/api/settings";

type WorkerProgress = { status:string; progress:number; completed?:number; total?:number; }

export default function UploadPage(){
  const [columns, setColumns] = useState<string[]>([]);
  const [file, setFile] = useState<File|null>(null);
  const [mapping, setMapping] = useState<Mapping>({
    womanName: "", husbandName:"", nationalId:"", phone:"", village:"", subdistrict:"", children:"", beneficiaryId:""
  });
  const [isMappingComplete, setIsMappingComplete] = useState(false);
  const [progressInfo, setProgressInfo] = useState<WorkerProgress>({ status:"idle", progress:0 });
  const [workerStatus, setWorkerStatus] = useState<string>("idle");
  const [clusters, setClusters] = useState<any[][]>([]);
  const [fileReadProgress, setFileReadProgress] = useState(0);
  const [isMappingOpen, setIsMappingOpen] = useState(true);
  const rawRowsRef = useRef<any[]>([]);
  const workerRef = useRef<Worker|null>(null);
  const { toast } = useToast();
  const router = useRouter();

  useEffect(()=>{
    // create module worker
    if(typeof window === "undefined") return;
    if(workerRef.current) return;
    try {
      const workerScript = createWorkerScript();
      const blob = new Blob([workerScript], { type: 'application/javascript' });
      const blobUrl = URL.createObjectURL(blob);
      const w = new Worker(blobUrl);

      workerRef.current = w;
      w.onmessage = async (ev) => {
        const msg = ev.data;
        if(!msg || !msg.type) return;
        if(msg.type === 'progress'){
          setWorkerStatus(msg.status || 'working');
          setProgressInfo({ status: msg.status || 'working', progress: msg.progress ?? 0, completed: msg.completed, total: msg.total });
        } else if(msg.type === 'done'){
          setWorkerStatus('caching');
          setProgressInfo({ status: 'caching', progress: 98 });
          const resultPayload = msg.payload || {};
          const resultClusters = resultPayload.clusters || [];
          setClusters(resultClusters);
          
          try {
            const cacheId = 'cache-' + Date.now() + '-' + Math.random().toString(36).slice(2,9);
            sessionStorage.setItem('cacheId', cacheId);
            
            const allRows = resultPayload.rows || [];
            
            // The payload from the worker is now { records: [], reasons: [] }
            // The cache needs to store the clusters in the format { records: RecordRow[], reasons: string[] }[]
            const dataToCache = {
                rows: allRows,
                clusters: resultClusters, // This is already in the correct format
                originalHeaders: columns,
            };

            await fetch('/api/cluster-cache', { 
                method:'POST', 
                headers:{'Content-Type':'application/json'}, 
                body: JSON.stringify({ cacheId, ...dataToCache }) 
            });

            sessionStorage.setItem('cacheTimestamp', Date.now().toString());
            setWorkerStatus('done');
            setProgressInfo({ status: 'done', progress: 100 });
            toast({ title: "Clustering complete", description: `Found ` + resultClusters.length + ` clusters.` });
          } catch(err:any){
            setWorkerStatus('error');
            toast({ title: "Failed to cache results", description: String(err), variant:"destructive" });
          }
        } else if(msg.type === 'error'){
          setWorkerStatus('error');
          toast({ title: "Worker error", description: msg.error || 'Unknown', variant:"destructive" });
        }
      };
    } catch(err:any){
      console.error('Worker spawn failed', err);
      toast({ title: "Unable to start worker", description: String(err), variant:"destructive" });
    }
    return () => {
      if(workerRef.current){ workerRef.current.terminate(); workerRef.current = null; }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [columns]); // Re-create worker if columns change, just in case.

  useEffect(()=>{
    const allRequiredMapped = REQUIRED_MAPPING_FIELDS.every(f => !!mapping[f]);
    setIsMappingComplete(allRequiredMapped);
    if(columns.length > 0){
      const key = LOCAL_STORAGE_KEY_PREFIX + columns.join(',');
      localStorage.setItem(key, JSON.stringify(mapping));
    }
  }, [mapping, columns]);

  async function handleFile(e:React.ChangeEvent<HTMLInputElement>){
    const f = e.target.files?.[0];
    if(!f) return;
    setFile(f);
    setWorkerStatus('idle'); setProgressInfo({ status:'idle', progress:0 }); setClusters([]);
    setFileReadProgress(0);
    setIsMappingOpen(true);

    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentage = (event.loaded / event.total) * 100;
        setFileReadProgress(percentage);
      }
    };
    reader.onload = (e) => {
        const buffer = e.target?.result;
        const wb = XLSX.read(buffer, { type: 'array', cellDates:true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });
        rawRowsRef.current = json; // Store raw rows
        setColumns(Object.keys(json[0] || {}));
        const storageKey = LOCAL_STORAGE_KEY_PREFIX + Object.keys(json[0]||{}).join(',');
        const saved = localStorage.getItem(storageKey);
        if(saved) {
          try { setMapping(JSON.parse(saved)); } catch {}
        } else {
          setMapping({ womanName:"", husbandName:"", nationalId:"", phone:"", village:"", subdistrict:"", children:"", beneficiaryId:"" });
        }
        setFileReadProgress(100);
    };
    reader.readAsArrayBuffer(f);
  }

  function handleMappingChange(field:keyof Mapping, value:string){
    setMapping(m => ({ ...m, [field]: value }));
  }

  async function startClustering(){
    if(!workerRef.current) { toast({ title: "Worker not ready" }); return; }
    if(!rawRowsRef.current.length){ toast({ title: "Upload data first" }); return; }
    if(!isMappingComplete){ toast({ title: "Mapping incomplete", variant:"destructive"}); return; }

    setIsMappingOpen(false);
    setWorkerStatus('processing'); setProgressInfo({ status:'processing', progress:1 });

    // load settings from server (if any): includes finalScoreWeights and thresholds
    let settings = {};
    try {
      const res = await fetch(SETTINGS_ENDPOINT);
      const d = await res.json();
      if(d.ok) settings = d.settings || {};
    } catch(_) {}

    workerRef.current!.postMessage({ type:'start', payload: { mapping, options: settings } });

    // stream rows in chunks
    const CHUNK = 2000;
    for(let i=0;i<rawRowsRef.current.length;i+=CHUNK){
      const chunk = rawRowsRef.current.slice(i,i+CHUNK);
      workerRef.current!.postMessage({ type:'data', payload:{ rows: chunk, total: rawRowsRef.current.length } });
      // give event loop a tiny break to avoid lockups
      await new Promise(r => setTimeout(r, 8));
    }
    workerRef.current!.postMessage({ type:'end' });
  }

  const formattedStatus = () => {
    const s = progressInfo.status || 'idle';
    let statusText = s.replace(/-/g, ' '); // a bit nicer looking
    statusText = statusText.charAt(0).toUpperCase() + statusText.slice(1);
    
    if (progressInfo.completed !== undefined && progressInfo.total) {
      return `Status: ${statusText} (${progressInfo.completed}/${progressInfo.total})`;
    }
    return `Status: ${statusText}`;
  };
  
    const SummaryCard = ({ icon, title, value, total }: { icon: React.ReactNode, title: string, value: string | number, total?: number }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
        {total !== undefined && <p className="text-xs text-muted-foreground">out of {total}</p>}
      </CardContent>
    </Card>
  );

  const getButtonText = () => {
    switch (workerStatus) {
      case 'processing':
      case 'blocking':
      case 'building-edges':
      case 'merging-edges':
      case 'annotating':
        return 'Processing...';
      case 'caching':
        return 'Caching Results...';
      case 'done':
        return 'Clustering Done!';
      case 'error':
        return 'Error! Retry?';
      default:
        return 'Start Clustering';
    }
  };


  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>1. Upload File</CardTitle>
            <CardDescription>Select a file from your device to begin the analysis.</CardDescription>
          </div>
          <Button variant="outline" asChild>
              <Link href="/settings">
                <Settings className="mr-2 h-4 w-4" />
                Settings
              </Link>
          </Button>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4">
             <label htmlFor="file-upload" className="flex-1">
                <div className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted">
                    <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                        <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                        {file ? (
                          <>
                            <p className="font-semibold text-primary">{file.name}</p>
                            <p className="text-xs text-muted-foreground">{rawRowsRef.current.length > 0 ? `${rawRowsRef.current.length} rows detected` : 'Reading file...'}</p>
                          </>
                        ) : (
                          <>
                           <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                           <p className="text-xs text-muted-foreground">XLSX, XLS, CSV, etc.</p>
                          </>
                        )}
                    </div>
                    <input id="file-upload" type="file" className="hidden" onChange={handleFile} accept=".xlsx,.xls,.csv,.xlsm,.xlsb" />
                </div>
            </label>
             {file && (
                <Button onClick={() => {
                  setFile(null);
                  setColumns([]);
                  rawRowsRef.current = [];
                  setClusters([]);
                  setWorkerStatus('idle');
                  setProgressInfo({ status: 'idle', progress: 0 });
                  setFileReadProgress(0);
                }} variant="outline">Reset</Button>
            )}
          </div>
          {file && fileReadProgress > 0 && fileReadProgress < 100 && (
            <div className="mt-4">
              <Label>Reading File...</Label>
              <Progress value={fileReadProgress} />
            </div>
          )}
        </CardContent>
      </Card>

      {columns.length > 0 && (
        <Collapsible open={isMappingOpen} onOpenChange={setIsMappingOpen} asChild>
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>2. Map Columns</CardTitle>
                  <CardDescription>Map your sheet columns to the required fields for analysis.</CardDescription>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm">
                    <ChevronsUpDown className="h-4 w-4" />
                    <span className="sr-only">Toggle</span>
                  </Button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MAPPING_FIELDS.map(field => (
                  <Card key={field}>
                    <CardHeader className="p-4 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                            {mapping[field] ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                            <Label htmlFor={field} className="capitalize font-semibold text-base">{field.replace(/_/g,' ')}{REQUIRED_MAPPING_FIELDS.includes(field) && <span className="text-destructive">*</span>}</Label>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-48 border-t">
                        <RadioGroup value={mapping[field]} onValueChange={(v)=> handleMappingChange(field as keyof Mapping, v)} className="p-4 grid grid-cols-2 gap-2">
                          {columns.map(col => (
                            <div key={col} className="flex items-center space-x-2">
                              <RadioGroupItem value={col} id={`${field}-${col}`} />
                              <Label htmlFor={`${field}-${col}`} className="truncate font-normal" title={col}>{col}</Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </ScrollArea>
                    </CardContent>
                  </Card>
                ))}
              </CardContent>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {file && isMappingComplete && (
        <Card>
          <CardHeader>
            <CardTitle>3. Run Clustering</CardTitle>
            <CardDescription>Start the AI-powered analysis to find potential duplicates.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button onClick={startClustering} disabled={workerStatus !== 'idle' && workerStatus !== 'done' && workerStatus !== 'error'}>
                {(workerStatus === 'processing' || workerStatus === 'caching' || workerStatus === 'building-edges' || workerStatus === 'merging-edges') ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                {getButtonText()}
              </Button>

              {(workerStatus !== 'idle' && workerStatus !== 'done' && workerStatus !== 'error') && (
                <div className="space-y-2 mt-4">
                  <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                    <span>{formattedStatus()}</span>
                  </div>
                  <div className="relative h-4 w-full overflow-hidden rounded-full bg-secondary">
                    <Progress value={progressInfo.progress} className="absolute h-full w-full" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-medium text-primary-foreground mix-blend-difference">{Math.round(progressInfo.progress)}%</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {workerStatus === 'done' && (
        <Card>
          <CardHeader><CardTitle>4. Results</CardTitle><CardDescription>Summary of the clustering process.</CardDescription></CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                <SummaryCard icon={<Users className="h-4 w-4 text-muted-foreground" />} title="Total Records" value={rawRowsRef.current.length} />
                <SummaryCard icon={<Group className="h-4 w-4 text-muted-foreground" />} title="Clustered Records" value={clusters.flatMap(c => c.records).length} />
                <SummaryCard icon={<Unlink className="h-4 w-4 text-muted-foreground" />} title="Unclustered Records" value={rawRowsRef.current.length - clusters.flatMap(c => c.records).length} />
                <SummaryCard icon={<BoxSelect className="h-4 w-4 text-muted-foreground" />} title="Cluster Count" value={clusters.length} />
                <SummaryCard icon={<Sigma className="h-4 w-4 text-muted-foreground" />} title="Avg. Cluster Size" value={clusters.length > 0 ? (clusters.flatMap(c => c.records).length / clusters.length).toFixed(2) : 0} />
            </div>
            <Button onClick={()=> router.push('/review') } disabled={clusters.length === 0}>Go to Review Page <ChevronRight className="ml-2 h-4 w-4" /></Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

### **Step 6: The Review & Audit Pages**

1.  **Data Loading**: On page load, `src/app/review/page.tsx` and `src/app/audit/page.tsx` retrieve a `cacheId` from `sessionStorage`. The cached data (clusters and any existing audit findings) is fetched from the `/api/cluster-cache/route.ts` endpoint using a GET request.
2.  **Cluster Review (`/review`)**:
    *   **Automated Scoring**: An effect hook automatically triggers a call to `/api/pairwise/route.ts` for all clusters to calculate and display average similarity scores and a final "confidence" percentage.
    *   **UI**: The fetched clusters are displayed in a grid of cards with pagination. Search/filter functionality is also implemented.
    *   **Inspection**: An "Inspect" button on each cluster card opens a `PairwiseModal` component (`src/components/PairwiseModal.tsx`), which shows a detailed similarity breakdown for the records in that cluster.
3.  **Audit Page (`/audit`)**:
    *   **Automated Audit**: An effect hook checks if audit findings exist in the cache. If not, it automatically makes a POST request to `/api/audit/route.ts` with the `cacheId` to run the audit.
    *   **Display**: The findings returned from the API are displayed in an `Accordion` component, grouped by severity.
    *   **Cache Update**: After a successful audit, the new findings are saved back to the server-side cache via the `cluster-cache` API.

**File**: `src/app/review/page.tsx`
```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import type { RecordRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Loader2, Search, ChevronLeft, AlertTriangle, ChevronRight, Sparkles, Microscope, Calculator } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { PairwiseModal } from "@/components/PairwiseModal";
import { generateArabicClusterSummary } from "@/lib/arabicClusterSummary";
import { calculateClusterConfidence } from "@/lib/clusterConfidence";

type Cluster = {
  records: RecordRow[];
  reasons: string[];
  avgWomanNameScore?: number;
  avgHusbandNameScore?: number;
  avgFinalScore?: number;
  confidence?: number;
};

export default function ReviewPage() {
  const [allClusters, setAllClusters] = useState<Cluster[]>([]);
  const [filteredClusters, setFilteredClusters] = useState<Cluster[]>([]);
  const [selectedCluster, setSelectedCluster] = useState<RecordRow[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [calculating, setCalculating] = useState(false);
  const [search, setSearch] = useState("");
  const { toast } = useToast();

  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(9);

  const handleCalculateScores = useCallback(async (clustersToScore: Cluster[]) => {
    if (clustersToScore.length === 0 || clustersToScore.every(c => c.confidence !== undefined)) {
        return; // Don't run if no clusters or if already scored
    }
    setCalculating(true);
    toast({ title: "Calculating Scores", description: `Fetching and averaging scores for ${clustersToScore.length} clusters...` });

    const updatedClusters = await Promise.all(clustersToScore.map(async (cluster) => {
        try {
            const res = await fetch("/api/pairwise", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ cluster: cluster.records }),
            });
            if (!res.ok) return cluster;
            const data = await res.json();
            const pairs = data.pairs || [];

            if (pairs.length === 0) {
                const confidence = calculateClusterConfidence(0, 0);
                return { ...cluster, avgWomanNameScore: 0, avgHusbandNameScore: 0, avgFinalScore: 0, confidence };
            }

            const womanNameScores = pairs.map((p: any) => p.breakdown.nameScore || 0);
            const husbandNameScores = pairs.map((p: any) => p.breakdown.husbandScore || 0);

            const avgWomanNameScore = womanNameScores.reduce((a: number, b: number) => a + b, 0) / womanNameScores.length;
            const avgHusbandNameScore = husbandNameScores.reduce((a: number, b: number) => a + b, 0) / husbandNameScores.length;
            const avgFinalScore = (avgWomanNameScore + avgHusbandNameScore) / 2;

            return {
                ...cluster,
                avgWomanNameScore,
                avgHusbandNameScore,
                avgFinalScore,
                confidence: calculateClusterConfidence(avgWomanNameScore, avgHusbandNameScore),
            };
        } catch (error) {
            return cluster; // Return original cluster on error
        }
    }));

    setAllClusters(updatedClusters);
    setCalculating(false);
    toast({ title: "Calculations Complete", description: "Average scores and confidence have been updated for all clusters." });
  }, [toast]);


  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
          const cacheId = sessionStorage.getItem('cacheId');
          if (!cacheId) {
            toast({ title: "No Data", description: "No clusters found from the last run. Please upload data first.", variant: "destructive" });
            setLoading(false);
            return;
          }

          const res = await fetch(`/api/cluster-cache?id=${cacheId}`);
          if (!res.ok) throw new Error("Failed to load clusters from server cache.");
          
          const data = await res.json();
          const clusters = data.clusters || [];
          
          if (clusters) {
              setAllClusters(clusters);

              if (clusters.length === 0) {
                  toast({ title: "No Clusters Found", description: "The last run did not produce any clusters. Try adjusting settings.", variant: "default" });
              } else {
                  toast({ title: "Clusters Loaded", description: `Loaded ${clusters.length} clusters for review.`, variant: "default" });
              }
          } else {
               toast({ title: "Error", description: "Failed to load cluster data from server cache.", variant: "destructive" });
          }
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [toast]);
  
    useEffect(() => {
        if (allClusters.length > 0 && !loading) {
            handleCalculateScores(allClusters);
        }
    }, [allClusters, loading, handleCalculateScores]);


  useEffect(() => {
    const applyFilter = () => {
      if (!search.trim()) {
        setFilteredClusters(allClusters);
        return;
      }
      const s = search.toLowerCase();
      const filtered = allClusters.filter((cluster) =>
        cluster.records.some(
          (r) =>
            r.womanName?.toLowerCase().includes(s) ||
            r.husbandName?.toLowerCase().includes(s) ||
            String(r.phone ?? '').toLowerCase().includes(s)
        )
      );
      setFilteredClusters(filtered);
      setCurrentPage(1); // Reset to first page on new search
    };
    applyFilter();
  }, [search, allClusters]);

  const handleInspect = (clusterRecords: RecordRow[]) => {
    setSelectedCluster(clusterRecords);
  }

  const indexOfLastItem = currentPage * itemsPerPage;
  const indexOfFirstItem = indexOfLastItem - itemsPerPage;
  const currentClusters = filteredClusters.slice(indexOfFirstItem, indexOfLastItem);
  const totalPages = Math.ceil(filteredClusters.length / itemsPerPage);

  const paginate = (pageNumber: number) => {
    if (pageNumber > 0 && pageNumber <= totalPages) {
      setCurrentPage(pageNumber);
    }
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Cluster Review</CardTitle>
              <CardDescription>
                Inspect and analyze potential duplicate clusters from the last processing run. Found {filteredClusters.length} of {allClusters.length} clusters.
              </CardDescription>
            </div>
             <div className="flex flex-col sm:flex-row gap-2">
                <Button variant="outline" asChild>
                    <Link href="/upload">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to Upload
                    </Link>
                </Button>
                 <Button onClick={() => handleCalculateScores(allClusters)} disabled={calculating}>
                    {calculating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Calculator className="mr-2 h-4 w-4" />}
                    Recalculate Scores
                 </Button>
                <Button asChild>
                    <Link href="/audit">
                        Go to Audit
                        <AlertTriangle className="ml-2 h-4 w-4" />
                    </Link>
                </Button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col sm:flex-row gap-4 mb-6">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                type="text"
                placeholder="Search by name, husband, or phone..."
                className="pl-10"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>
          </div>
                    
          {loading ? (
            <div className="text-center text-muted-foreground py-10">
                <Loader2 className="mx-auto h-8 w-8 animate-spin" />
                <p className="mt-2">Loading clusters...</p>
            </div>
          ) : currentClusters.length > 0 ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {currentClusters.map((c, idx) => {
                  const clusterId = c.records.map(r => r._internalId).sort().join('-');
                  return (
                    <ClusterCard 
                      key={clusterId}
                      cluster={c} 
                      clusterNumber={(currentPage - 1) * itemsPerPage + idx + 1}
                      onInspect={() => handleInspect(c.records)}
                    />
                  )
                })}
              </div>
              {totalPages > 1 && (
                <div className="flex justify-center items-center gap-4 mt-6">
                  <Button variant="outline" onClick={() => paginate(currentPage - 1)} disabled={currentPage === 1}>
                    <ChevronLeft className="h-4 w-4 mr-2" />
                    Previous
                  </Button>
                  <span className="text-sm text-muted-foreground">
                    Page {currentPage} of {totalPages}
                  </span>
                  <Button variant="outline" onClick={() => paginate(currentPage + 1)} disabled={currentPage === totalPages}>
                    Next
                    <ChevronRight className="h-4 w-4 ml-2" />
                  </Button>
                </div>
              )}
            </>
          ) : (
             <div className="text-center text-muted-foreground py-10">
                <p>No clusters found{search ? ' for your search query' : ''}.</p>
            </div>
          )}
        </CardContent>
      </Card>

      {selectedCluster && (
        <PairwiseModal
          cluster={selectedCluster}
          isOpen={!!selectedCluster}
          onClose={() => setSelectedCluster(null)}
        />
      )}
    </div>
  );
}


function ClusterCard({ cluster, clusterNumber, onInspect }: { cluster: Cluster, clusterNumber: number, onInspect: () => void }) {
  const summaryHtml = generateArabicClusterSummary(cluster, cluster.records);
  const confidenceScore = cluster.confidence !== undefined ? cluster.confidence : calculateClusterConfidence(cluster.avgWomanNameScore, cluster.avgHusbandNameScore);

  const getScoreColor = (score?: number) => {
    if (score === undefined) return "text-gray-500";
    if (score >= 90) return "text-red-600 font-bold";
    if (score >= 75) return "text-orange-500 font-semibold";
    if (score >= 60) return "text-blue-600";
    return "text-gray-600";
  };
  
  return (
    <Card className="flex flex-col hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex justify-between items-start">
          <div>
            <CardTitle>Cluster {clusterNumber}</CardTitle>
            <CardDescription>{cluster.records.length} records</CardDescription>
          </div>
           <div className="text-right">
              <p className="text-xs text-muted-foreground">Confidence</p>
              <strong className={`text-lg ${getScoreColor(confidenceScore)}`}>{cluster.confidence === undefined ? <Loader2 className="h-4 w-4 animate-spin" /> : `${confidenceScore}%`}</strong>
          </div>
        </div>
      </CardHeader>
      <CardContent className="flex-1 space-y-4">
        <div className="space-y-2 text-sm">
          {cluster.records.slice(0, 3).map((r, i) => (
            <p key={i} className="truncate" title={r.womanName}>
              {r.womanName}
            </p>
          ))}
        </div>
         <Card className="bg-slate-50 border">
          <CardHeader className="p-4">
            <CardTitle className="text-right text-base flex justify-between items-center">
             <span>ملخص ذكي</span>
            </CardTitle>
          </CardHeader>
          <CardContent className="text-right p-4 pt-0">
             <div
              className="text-sm text-muted-foreground leading-relaxed"
              dangerouslySetInnerHTML={{ __html: summaryHtml }}
            />
          </CardContent>
        </Card>
      </CardContent>
      <CardFooter className="flex flex-col sm:flex-row gap-2">
        <Button variant="outline" className="w-full" onClick={onInspect}>
          <Microscope className="mr-2 h-4 w-4" />
          Inspect
        </Button>
      </CardFooter>
    </Card>
  );
}
```

**File**: `src/app/audit/page.tsx`
```tsx
"use client";
import React from "react";
import { useState, useEffect, useMemo, useCallback } from "react";
import type { RecordRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, ShieldCheck, Loader2, ChevronLeft, ArrowRight, UserX, Users, Ban, Fingerprint, Copy, Sigma } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { useRouter } from "next/navigation";

// Redefine AuditFinding here as it's used in this component's state
export interface AuditFinding {
  type: string;
  severity: "high" | "medium" | "low";
  description: string;
  records: RecordRow[];
}

type GroupedFinding = {
  record: RecordRow;
  issues: { type: string; description: string; severity: "high" | "medium" | "low" }[];
};

export default function AuditPage() {
  const [rows, setRows] = useState<RecordRow[]>([]);
  const [findings, setFindings] = useState<AuditFinding[]>([]);
  const [loading, setLoading] = useState({ data: true, audit: false });
  const { toast } = useToast();
  const router = useRouter();

    const runAuditNow = useCallback(async () => {
    const cacheId = sessionStorage.getItem('cacheId');
    if (!cacheId) {
        toast({ title: "No Data", description: "Cache ID not found. Please re-upload data.", variant: "destructive" });
        return;
    }
    
    setLoading(prev => ({...prev, audit: true}));
    try {
        const res = await fetch("/api/audit", {
            method: "POST",
            body: JSON.stringify({ cacheId }),
            headers: { "Content-Type": "application/json" }
        });

        if (!res.ok) {
           const errorData = await res.json();
           throw new Error(errorData.error || "An error occurred during the audit.");
        }

        const data = await res.json();
        const newFindings = data.issues || [];
        setFindings(newFindings);
        
        await fetch('/api/cluster-cache', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ cacheId, auditFindings: newFindings })
        });

        toast({ title: "Audit Complete", description: `${newFindings.length} potential issues found.` });

    } catch (error: any) {
        toast({ title: "Audit Error", description: error.message || "Could not connect to the audit service.", variant: "destructive" });
    } finally {
        setLoading(prev => ({...prev, audit: false}));
    }
  }, [toast]);


  useEffect(() => {
    async function loadData() {
      setLoading(prev => ({...prev, data: true}));
      try {
          const cacheId = sessionStorage.getItem('cacheId');
          if (!cacheId) {
            toast({ title: "No Data", description: "No clustered records found to audit. Please run clustering first.", variant: "destructive" });
            setLoading(prev => ({...prev, data: false}));
            return;
          }
          
          const res = await fetch(`/api/cluster-cache?id=${cacheId}`);
          if (!res.ok) throw new Error("Failed to load data from server cache");

          const responseData = await res.json();
          const clusters = responseData.clusters;
          const auditFindings = responseData.auditFindings;
          
          if (clusters) {
              const clusteredRecords = clusters.map((c: any) => c.records).flat();
              setRows(clusteredRecords);
              if (clusteredRecords.length > 0) {
                 if (auditFindings) {
                    setFindings(auditFindings);
                    toast({ title: "Loaded from Cache", description: `Loaded ${auditFindings.length} existing audit findings.` });
                } else {
                    toast({ title: "Data Ready", description: `${clusteredRecords.length} records are ready for audit. Starting audit...` });
                    runAuditNow();
                }
              } else {
                toast({ title: "No Clustered Data", description: "No records were found in clusters to audit." });
              }
          } else {
              toast({ title: "Error", description: "Failed to load cluster data from server cache.", variant: "destructive" });
          }
      } catch (error: any) {
          toast({ title: "Error", description: error.message || "Could not fetch or parse cluster data.", variant: "destructive" });
      } finally {
          setLoading(prev => ({...prev, data: false}));
      }
    }
    loadData();
  }, [toast, runAuditNow]);



  const groupedFindings = useMemo(() => {
    const groups: { [key: string]: GroupedFinding } = {};
    findings.forEach(finding => {
      finding.records.forEach(record => {
        const key = record._internalId || record.nationalId as string;
        if (!groups[key]) {
          groups[key] = { record, issues: [] };
        }
        groups[key].issues.push({ type: finding.type, description: finding.description, severity: finding.severity });
      });
    });
    return Object.values(groups).sort((a,b) => {
        const aHigh = a.issues.some(i => i.severity === 'high');
        const bHigh = b.issues.some(i => i.severity === 'high');
        if (aHigh && !bHigh) return -1;
        if (!aHigh && bHigh) return 1;
        return b.issues.length - a.issues.length;
    });
  }, [findings]);
  
  const findingCounts = useMemo(() => {
      const counts: Record<string, number> = {
          WOMAN_MULTIPLE_HUSBANDS: 0,
          MULTIPLE_NATIONAL_IDS: 0,
          DUPLICATE_ID: 0,
          DUPLICATE_COUPLE: 0,
          HIGH_SIMILARITY: 0
      };
      findings.forEach(f => {
          if (f.type in counts) {
              counts[f.type] += 1;
          }
      });
      return counts;
  }, [findings]);

  const summaryCards = [
      { title: "Multiple Husbands", key: 'WOMAN_MULTIPLE_HUSBANDS', icon: <UserX className="h-6 w-6 text-red-500" /> },
      { title: "Multiple IDs", key: 'MULTIPLE_NATIONAL_IDS', icon: <Fingerprint className="h-6 w-6 text-orange-500" /> },
      { title: "Duplicate ID", key: 'DUPLICATE_ID', icon: <Copy className="h-6 w-6 text-yellow-500" /> },
      { title: "Duplicate Couple", key: 'DUPLICATE_COUPLE', icon: <Users className="h-6 w-6 text-blue-500" /> },
      { title: "High Similarity", key: 'HIGH_SIMILARITY', icon: <Sigma className="h-6 w-6 text-purple-500" /> }
  ];

  const getSeverityBadge = (severity: "high" | "medium" | "low") => {
    switch (severity) {
      case "high": return <Badge variant="destructive">High</Badge>;
      case "medium": return <Badge variant="default" className="bg-orange-500 hover:bg-orange-600">Medium</Badge>;
      case "low": return <Badge variant="secondary">Low</Badge>;
      default: return <Badge variant="outline">{severity}</Badge>;
    }
  };

  const goToExport = () => {
    if (findings.length === 0) {
        toast({
            title: "No Audit Findings",
            description: "Please run the audit to generate findings before proceeding to export.",
            variant: "destructive"
        });
        return;
    }
    router.push('/export');
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
            <div className="flex justify-between items-start">
                <div>
                  <CardTitle>Data Integrity Audit</CardTitle>
                  <CardDescription>
                    Run a set of rules against your clustered records to identify potential issues like duplicates and invalid relationships.
                    {rows.length > 0 && ` Ready to audit ${rows.length} records.`}
                  </CardDescription>
                </div>
                <Button variant="outline" asChild>
                    <Link href="/review">
                        <ChevronLeft className="mr-2 h-4 w-4" />
                        Back to Review
                    </Link>
                </Button>
            </div>
        </CardHeader>
        <CardContent>
          <div className="flex gap-4">
            <Button onClick={runAuditNow} disabled={loading.audit || loading.data || rows.length === 0}>
              {loading.audit ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <AlertTriangle className="mr-2 h-4 w-4" />}
              {findings.length > 0 ? 'Re-run Audit' : 'Run Audit'}
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {loading.data ? (
        <div className="text-center text-muted-foreground py-10">
          <Loader2 className="mx-auto h-8 w-8 animate-spin" />
          <p className="mt-2">Loading latest data...</p>
        </div>
      ) : loading.audit ? (
        <div className="text-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
      ) : findings.length > 0 ? (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>Audit Summary</CardTitle>
                    <CardDescription>A summary of the types of issues found across all records.</CardDescription>
                </CardHeader>
                <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                    {summaryCards.map(card => (
                        <Card key={card.key}>
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">{card.title}</CardTitle>
                                {card.icon}
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{findingCounts[card.key]}</div>
                            </CardContent>
                        </Card>
                    ))}
                </CardContent>
            </Card>
            <Card>
                <CardHeader>
                    <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                        <div>
                            <CardTitle>Audit Findings</CardTitle>
                            <CardDescription>{findings.length} total issues found across {groupedFindings.length} unique records.</CardDescription>
                        </div>
                        <div className="flex gap-2">
                            <Button onClick={goToExport}>
                               Go to Export Page
                               <ArrowRight className="ml-2 h-4 w-4" />
                            </Button>
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    <Accordion type="multiple" className="w-full">
                        {groupedFindings.map((g, i) => (
                        <AccordionItem value={`item-${i}`} key={i}>
                            <AccordionTrigger>
                                <div className="flex items-center gap-4 text-left">
                                    <span className="font-semibold">{g.record.womanName}</span>
                                    <div className="flex gap-1">
                                        {g.issues.map((issue, issueIdx) => (
                                            <React.Fragment key={issueIdx}>
                                                {getSeverityBadge(issue.severity)}
                                            </React.Fragment>
                                        ))}
                                    </div>
                                </div>
                            </AccordionTrigger>
                            <AccordionContent className="space-y-2">
                                <div className="p-3 bg-muted/50 rounded-md">
                                    <h4 className="font-semibold mb-2">Record Details:</h4>
                                    <ul className="space-y-1 text-sm">
                                        <li><strong>Husband:</strong> {g.record.husbandName}</li>
                                        <li><strong>National ID:</strong> {String(g.record.nationalId)}</li>
                                        <li><strong>Phone:</strong> {String(g.record.phone)}</li>
                                        <li><strong>Village:</strong> {g.record.village}</li>
                                    </ul>
                                </div>
                                <div className="p-3">
                                    <h4 className="font-semibold mb-2">Identified Issues:</h4>
                                    <ul className="space-y-2 text-sm list-disc pl-5">
                                        {g.issues.map((issue, idx) => (
                                            <li key={idx}>
                                                <strong>{issue.type.replace(/_/g, ' ')}</strong> ({getSeverityBadge(issue.severity)}):
                                                <span className="text-muted-foreground ml-2">{issue.description}</span>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </AccordionContent>
                        </AccordionItem>
                        ))}
                    </Accordion>
                </CardContent>
            </Card>
        </>
      ) : (
        !loading.audit && rows.length > 0 && (
            <Card className="text-center py-10">
                <CardContent className="flex flex-col items-center gap-4">
                    <ShieldCheck className="h-12 w-12 text-green-500" />
                    <h3 className="text-xl font-semibold">Ready to Audit</h3>
                    <p className="text-muted-foreground">Click "Run Audit" to check the {rows.length} clustered records for issues.</p>
                </CardContent>
            </Card>
        )
      )}
    </div>
  );
}
```

### **Step 7: The Export Page (`/export`)**

1.  **Data Loading (`src/app/export/page.tsx`)**: Like other pages, it fetches the full dataset (rows, clusters, audit findings) from the cache using the `cacheId`.
2.  **Generate Report Button**: A single button triggers a POST request to the `/api/export/enrich-and-format/route.ts` endpoint.
3.  **Backend Enrichment & Formatting (`/api/export/enrich-and-format/route.ts`)**:
    *   This crucial server-side process fetches all data from the cache file.
    *   **Enrich**: It iterates through all records, adding new columns like `Cluster_ID`, `Cluster_Size`, and `Max_PairScore`.
    *   **Sort**: It sorts the data deterministically, primarily by `Max_PairScore` and then by `Cluster_ID`, to bring the most likely duplicates to the top.
    *   **Generate Excel File**: Using `exceljs`, it creates a multi-sheet workbook: "Enriched Data", "Review Summary", "Cluster Details", and "Audit Findings", complete with conditional formatting and styling.
4.  **Download**: The API responds with the generated Excel file as a buffer, which the frontend then triggers as a download.

**File**: `src/app/export/page.tsx`
```tsx
"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown, Loader2, XCircle, CheckCircle, Database, Users } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Progress } from "@/components/ui/progress";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";


type DownloadVersion = {
    id: string;
    fileName: string;
    version: number;
    createdAt: string;
    blob: Blob;
};

type GenerationStep = "enriching" | "sorting" | "sheets" | "audit" | "summary" | "done";
const allSteps: GenerationStep[] = ["enriching", "sorting", "sheets", "audit", "summary"];

const stepDescriptions: Record<GenerationStep, string> = {
    enriching: "Enriching data with cluster info...",
    sorting: "Sorting records for the report...",
    sheets: "Creating main data sheet...",
    audit: "Creating audit findings sheet...",
    summary: "Creating summary and cluster sheets...",
    done: "Done"
};


export default function ExportPage() {
    // Component State
    const [initialLoading, setInitialLoading] = useState(true);
    const [isReady, setIsReady] = useState(false);
    const [loading, setLoading] = useState(false);
    const [progress, setProgress] = useState(0);
    const [completedSteps, setCompletedSteps] = useState<Set<GenerationStep>>(new Set());

    const { toast } = useToast();

    // Data State
    const [downloadHistory, setDownloadHistory] = useState<DownloadVersion[]>([]);
    const [recordCount, setRecordCount] = useState(0);
    const [clusterCount, setClusterCount] = useState(0);
    
    useEffect(() => {
        const checkCache = async () => {
            setInitialLoading(true);
            const cacheId = sessionStorage.getItem('cacheId');
            if (!cacheId) {
                setIsReady(false);
                setInitialLoading(false);
                toast({ title: "No Data Found", description: "Please start from the upload page to generate data for export.", variant: "destructive" });
                return;
            }
            
            try {
                const res = await fetch(`/api/cluster-cache?id=${cacheId}`);
                if (!res.ok) {
                    throw new Error('Failed to fetch cached data. Please try the upload process again.');
                }
                const responseData = await res.json();
                
                const rows = responseData.rows || [];
                const clusters = responseData.clusters || [];
                
                setRecordCount(rows.length);
                setClusterCount(clusters.length);

                if (rows.length > 0) {
                    setIsReady(true);
                } else {
                     toast({ title: "No Records Found", description: "The cached data is empty. Please re-upload your file.", variant: "destructive" });
                     setIsReady(false);
                }

            } catch (error: any) {
                setIsReady(false);
                toast({ title: "Error Loading Data", description: error.message, variant: "destructive" });
            } finally {
                setInitialLoading(false);
            }
        };
        checkCache();
    }, [toast]);
    
    const runSimulatedProgress = () => {
        setLoading(true);
        setCompletedSteps(new Set());
        setProgress(0);

        let stepIndex = 0;
        const interval = setInterval(() => {
            if (stepIndex < allSteps.length) {
                setCompletedSteps(prev => new Set(prev).add(allSteps[stepIndex]));
                setProgress((prev) => prev + (100 / (allSteps.length + 1)));
                stepIndex++;
            } else {
                clearInterval(interval);
            }
        }, 800); // Simulate each step taking time

        return () => clearInterval(interval);
    }
    
    const handleGenerateAndDownload = async () => {
        const clearSim = runSimulatedProgress();

        try {
            const cacheId = sessionStorage.getItem('cacheId');
            if (!cacheId) throw new Error("Cached data not available.");

            const res = await fetch('/api/export/enrich-and-format', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ cacheId }),
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.error || `Report generation failed on the server.`);
            }

            const blob = await res.blob();
            const now = new Date();
            const newVersion: DownloadVersion = {
                id: `v-${now.getTime()}`,
                fileName: `beneficiary-report-v${downloadHistory.length + 1}.xlsx`,
                version: downloadHistory.length + 1,
                createdAt: now.toLocaleString(),
                blob,
            };
            setDownloadHistory(prev => [newVersion, ...prev]);
            toast({ title: "Report Ready", description: `${newVersion.fileName} has been added to the download panel.` });
            
            // Automatically trigger download
            handleDirectDownload(blob, newVersion.fileName);
            
            clearSim();
            setCompletedSteps(new Set(allSteps));
            setProgress(100);
            setTimeout(() => {
                setLoading(false);
                setProgress(0);
                setCompletedSteps(new Set());
            }, 2000);

        } catch (error: any) {
            toast({ title: "Generation Failed", description: error.message, variant: "destructive" });
             clearSim();
             setLoading(false);
             setProgress(0);
             setCompletedSteps(new Set());
        }
    };
    
    const handleDirectDownload = (blob: Blob, fileName: string) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = fileName;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        toast({ title: "Download Started", description: `Downloading ${fileName}` });
    };

    const handleDeleteVersion = (id: string) => {
        setDownloadHistory(prev => prev.filter(v => v.id !== id));
    };

    const StatusIndicator = ({ done }: { done: boolean }) => {
        return done ? <CheckCircle className="h-6 w-6 text-green-500" /> : <XCircle className="h-6 w-6 text-muted-foreground" />;
    };

    return (
        <div className="space-y-6">
            <Card>
                <CardHeader>
                    <CardTitle>Advanced Export Workflow</CardTitle>
                    <CardDescription>
                        Generate and download your comprehensive beneficiary analysis report in a single step.
                    </CardDescription>
                </CardHeader>
                <CardContent className="space-y-8">
                     {initialLoading ? (
                        <div className="flex flex-col items-center justify-center h-40 gap-2 text-muted-foreground">
                            <Loader2 className="h-8 w-8 animate-spin" />
                            <p>Loading data from cache...</p>
                        </div>
                    ) : (
                         <Card className="bg-primary/10 border-primary">
                            <CardHeader>
                                <CardTitle>Generate and Download Report</CardTitle>
                            </CardHeader>
                            <CardContent>
                                <div className="flex flex-wrap items-center gap-6 mb-4">
                                     <div className="flex items-center gap-3 text-lg font-medium">
                                        <Users className="h-6 w-6 text-primary" />
                                        <span>{recordCount.toLocaleString()} Records Loaded</span>
                                    </div>
                                    <div className="flex items-center gap-3 text-lg font-medium">
                                        <Database className="h-6 w-6 text-primary" />
                                        <span>{clusterCount.toLocaleString()} Clusters Found</span>
                                    </div>
                                </div>
                                <p className="text-sm text-muted-foreground mb-4">
                                    This will generate a single Excel file with multiple sheets: Enriched Data, Review Summary, Cluster Details, and Audit Findings.
                                </p>
                                <Button onClick={handleGenerateAndDownload} disabled={loading || !isReady} size="lg">
                                    {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <FileDown className="mr-2 h-4 w-4" />}
                                    {loading ? 'Generating...' : 'Generate and Download Report'}
                                </Button>
                                {!isReady && <p className="text-xs text-destructive mt-2">Please complete the upload and clustering steps first to enable report generation.</p>}
                            </CardContent>
                        </Card>
                    )}
                    
                    {/* Status & History Section */}
                    <div className="grid md:grid-cols-2 gap-6">
                        <Card>
                            <CardHeader><CardTitle>Generation Status</CardTitle></CardHeader>
                            <CardContent className="space-y-4">
                               {
                                 loading ? (
                                    <div className="space-y-3 pt-2">
                                        <Progress value={progress} />
                                        {allSteps.map(step => (
                                             <div key={step} className="flex items-center justify-between text-sm">
                                                <span>{stepDescriptions[step]}</span>
                                                {completedSteps.has(step) ? (
                                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                                ) : (
                                                    <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                                                )}
                                             </div>
                                        ))}
                                    </div>
                                ) : (
                                  <p className="text-sm text-muted-foreground">
                                      Real-time generation status will appear here once you start the process.
                                  </p>
                                )
                               }
                            </CardContent>
                        </Card>
                         <Card>
                            <CardHeader><CardTitle>Download Panel</CardTitle></CardHeader>
                            <CardContent>
                                {downloadHistory.length === 0 ? (
                                    <p className="text-sm text-muted-foreground text-center py-4">Generated reports will appear here.</p>
                                ) : (
                                    <Table>
                                        <TableHeader>
                                            <TableRow>
                                                <TableHead>File Name</TableHead>
                                                <TableHead>Version</TableHead>
                                                <TableHead>Created</TableHead>
                                                <TableHead className="text-right">Actions</TableHead>
                                            </TableRow>
                                        </TableHeader>
                                        <TableBody>
                                            {downloadHistory.map(v => (
                                                <TableRow key={v.id}>
                                                    <TableCell className="font-medium">{v.fileName}</TableCell>
                                                    <TableCell>{v.version}</TableCell>
                                                    <TableCell>{v.createdAt}</TableCell>
                                                    <TableCell className="text-right space-x-2">
                                                        <Button variant="outline" size="sm" onClick={() => handleDirectDownload(v.blob, v.fileName)}>Download</Button>
                                                        <Button variant="destructive" size="sm" onClick={() => handleDeleteVersion(v.id)}>Delete</Button>
                                                    </TableCell>
                                                </TableRow>
                                            ))}
                                        </TableBody>
                                    </Table>
                                )}
                            </CardContent>
                        </Card>
                    </div>
                </CardContent>
            </Card>
        </div>
    );
}
```

### **Step 8: The Settings Page (`/settings`)**

1.  **Backend (`src/app/api/settings/route.ts`)**: GET and POST endpoints are created to read and write a `settings.json` file in a temporary server directory. This file stores the clustering thresholds and score weights.
2.  **Frontend (`src/app/settings/page.tsx`)**:
    *   On page load, the current settings are fetched from the GET endpoint.
    *   A form with sliders and inputs is created for each setting (e.g., `minPair`, `firstNameScore`).
    *   A "Test Scoring" section allows a user to input two sample records and see the live score calculated using the current page settings, mirroring the worker's logic via `src/lib/scoringClient.ts`.
    *   A "Save" button sends the updated settings object to the POST endpoint.

**File**: `src/app/settings/page.tsx`
```tsx
// src/app/settings/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { computePairScore } from "@/lib/scoringClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Save, RotateCcw, Upload, Download, Loader2, Plus, Minus, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";


type Settings = any;

const descriptions: Record<string, any> = {
  minPair: "The minimum score (0 to 1) for two records to be considered a potential match and form a link. High values create fewer, more confident clusters. Low values create more, but potentially noisier, clusters.",
  minInternal: "The minimum score (0 to 1) used to decide if records within a large, temporary cluster should remain together in the final, smaller clusters. High values result in smaller, more tightly-related final clusters.",
  blockChunkSize: "A performance setting for very large datasets. It breaks down large groups of potential matches into smaller chunks to manage memory. The default is usually fine.",
  finalScoreWeights: {
    firstNameScore: "Weight for the similarity of the first name.",
    familyNameScore: "Weight for the similarity of the family name (all parts except the first).",
    advancedNameScore: "Weight for advanced name matching techniques, like root-letter matching.",
    tokenReorderScore: "Weight for detecting names with the same words but in a different order.",
    husbandScore: "Weight for the similarity of the husband's name.",
    idScore: "Weight for matches on the National ID.",
    phoneScore: "Weight for matches on the phone number.",
    childrenScore: "Weight for matching children's names.",
    locationScore: "Weight for matching village or sub-district names."
  },
  rules: {
    enableNameRootEngine: "An advanced technique that tries to match names based on their likely root letters, catching more complex variations.",
    enableTribalLineage: "Looks for and gives weight to matches in the tribal or family name parts of a full name.",
    enableMaternalLineage: "Gives weight to similarities found in the maternal parts of a name if they can be identified.",
    enablePolygamyRules: "Applies special logic for polygamous relationships, such as checking if two women share the same husband and paternal line.",
  }
}

export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testA, setTestA] = useState({ womanName: "", husbandName: "", nationalId: "", phone: "" });
  const [testB, setTestB] = useState({ womanName: "", husbandName: "", nationalId: "", phone: "" });
  const [lastResult, setLastResult] = useState<any>(null);
  const { toast } = useToast();

  const getDefaultSettings = () => ({
    thresholds: {
      minPair: 0.62,
      minInternal: 0.54,
      blockChunkSize: 3000
    },
    finalScoreWeights: {
      firstNameScore: 0.15,
      familyNameScore: 0.25,
      advancedNameScore: 0.12,
      tokenReorderScore: 0.10,
      husbandScore: 0.12,
      idScore: 0.08,
      phoneScore: 0.05,
      childrenScore: 0.04,
      locationScore: 0.04
    },
    rules: {
      enableNameRootEngine: true,
      enableTribalLineage: true,
      enableMaternalLineage: true,
      enablePolygamyRules: true
    }
  });


  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          // Merge fetched settings with defaults to ensure all keys exist
          const defaults = getDefaultSettings();
          const mergedSettings = {
              ...defaults,
              ...j.settings,
              thresholds: { ...defaults.thresholds, ...j.settings.thresholds },
              finalScoreWeights: { ...defaults.finalScoreWeights, ...j.settings.finalScoreWeights },
              rules: { ...defaults.rules, ...j.settings.rules },
          };
          setSettings(mergedSettings);
        } else {
          // If missing, load defaults
          setSettings(getDefaultSettings());
          toast({ title: "Settings not found", description: "Loading default settings. Save to create a settings file.", variant: "default" });
        }
      })
      .catch(() => {
        setSettings(getDefaultSettings());
        toast({ title: "Error loading settings", description: "Could not fetch settings from server. Using defaults.", variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [toast]);


  function update(path: string, value: any) {
    if (!settings) return;
    const clone = JSON.parse(JSON.stringify(settings));
    const parts = path.split(".");
    let cur: any = clone;
    for (let i = 0; i < parts.length - 1; i++) {
      cur[parts[i]] = cur[parts[i]] ?? {};
      cur = cur[parts[i]];
    }
    cur[parts[parts.length - 1]] = value;
    setSettings(clone);
  }
  
  function handleNumericChange(path: string, change: number) {
      if (!settings) return;
      const parts = path.split(".");
      let cur: any = settings;
      for (let i = 0; i < parts.length - 1; i++) {
        cur = cur[parts[i]];
      }
      const currentValue = cur[parts[parts.length - 1]] || 0;
      const newValue = Math.max(0, Math.min(1, parseFloat((currentValue + change).toFixed(2))));
      update(path, newValue);
  }

  function handleWeightChange(key: string, change: number) {
    handleNumericChange(`finalScoreWeights.${key}`, change);
  }

  async function save() {
    if (!settings) return;
    setSaving(true);
    try {
      const res = await fetch("/api/settings", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(settings)
      });
      const j = await res.json();
      if (!j.ok) throw new Error(j.error || "Save failed");
      toast({ title: "Settings Saved", description: "Your changes have been saved successfully." });
    } catch (err: any) {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults() {
    if (confirm("Are you sure you want to reset all settings to their defaults?")) {
      setSettings(getDefaultSettings());
      toast({ title: "Settings Reset", description: "Settings have been reset. Click Save to persist." });
    }
  }

  function exportJSON() {
    if (!settings) return;
    const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "clustering-settings.json";
    a.click();
    URL.revokeObjectURL(url);
  }

  function importJSON(file: File | null) {
    if (!file) return;
    const r = new FileReader();
    r.onload = (e) => {
      try {
        const parsed = JSON.parse(String(e.target?.result));
        // Simple validation
        if (parsed.thresholds && parsed.rules && parsed.finalScoreWeights) {
          setSettings(parsed);
          toast({ title: "Settings Imported", description: "Imported settings previewed. Click Save to persist them." });
        } else {
          throw new Error("Invalid settings file structure.");
        }
      } catch (err: any) {
        toast({ title: "Import Failed", description: err.message, variant: "destructive" });
      }
    };
    r.readAsText(file);
  }

  function runTestScoring() {
    if (!settings) { toast({ title: "Settings not loaded", variant: "destructive" }); return; }
    const res = computePairScore(testA, testB, settings);
    setLastResult(res);
  }
  
  if (loading || !settings) {
    return (<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Loading settings...</span></div>);
  }

  return (
    <div className="space-y-6">
      <Card>
          <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-2xl">Clustering — Admin Settings (v5)</CardTitle>
                  <CardDescription>Fine-tune the v5 clustering engine, weights, and rules.</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                   <Button variant="outline" asChild>
                    <Link href="/upload">
                        <ArrowLeft className="mr-2" />
                        Go to Upload
                    </Link>
                  </Button>
                  <Button onClick={exportJSON} variant="outline"><Download className="mr-2" />Export</Button>
                  <Button asChild variant="outline">
                    <Label>
                      <Upload className="mr-2" />
                      Import
                      <input type="file" accept="application/json" className="hidden" onChange={(e) => importJSON(e.target.files?.[0] ?? null)} />
                    </Label>
                  </Button>
                  <Button onClick={resetDefaults} variant="destructive"><RotateCcw className="mr-2" />Reset</Button>
                  <Button onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                    Save
                  </Button>
                </div>
              </div>
          </CardHeader>
      </Card>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Thresholds & Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="grid grid-cols-12 items-center gap-4">
                  <Label htmlFor="minPair" className="col-span-12 sm:col-span-3 flex items-center">Min Pair Score: <b className="mx-1">{settings.thresholds.minPair}</b></Label>
                  <Slider id="minPair" min={0} max={1} step={0.01} value={[settings.thresholds.minPair]} onValueChange={(v)=>update("thresholds.minPair", v[0])} className="col-span-12 sm:col-span-6" />
                  <div className="col-span-12 sm:col-span-3 flex items-center gap-1 justify-end">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleNumericChange('thresholds.minPair', -0.01)}><Minus className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleNumericChange('thresholds.minPair', 0.01)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
                 <p className="text-xs text-muted-foreground mt-1 pl-1">{descriptions.minPair}</p>
              </div>
              <div>
                <div className="grid grid-cols-12 items-center gap-4">
                  <Label htmlFor="minInternal" className="col-span-12 sm:col-span-3 flex items-center">Min Internal Score: <b className="mx-1">{settings.thresholds.minInternal}</b></Label>
                  <Slider id="minInternal" min={0} max={1} step={0.01} value={[settings.thresholds.minInternal]} onValueChange={(v)=>update("thresholds.minInternal", v[0])} className="col-span-12 sm:col-span-6" />
                  <div className="col-span-12 sm:col-span-3 flex items-center gap-1 justify-end">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleNumericChange('thresholds.minInternal', -0.01)}><Minus className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleNumericChange('thresholds.minInternal', 0.01)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
                 <p className="text-xs text-muted-foreground mt-1 pl-1">{descriptions.minInternal}</p>
              </div>
              <div>
                <Label htmlFor="blockChunkSize">Block Chunk Size</Label>
                <Input id="blockChunkSize" type="number" value={settings.thresholds.blockChunkSize} onChange={(e)=>update("thresholds.blockChunkSize", parseInt(e.target.value||"0"))}/>
                <p className="text-xs text-muted-foreground mt-1">{descriptions.blockChunkSize}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Final Score Composition</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(settings.finalScoreWeights).map(([k, v]: [string, any]) => (
                <div key={k} className="flex flex-col gap-2 p-3 border rounded-md">
                   <div className="flex justify-between items-center">
                     <Label htmlFor={`fsw-${k}`} className="capitalize flex items-center">{k.replace(/([A-Z])/g, ' $1')}</Label>
                   </div>
                   <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleWeightChange(k, -0.01)}><Minus className="h-4 w-4" /></Button>
                        <Input type="number" step="0.01" value={v || ''} onChange={(e)=>update(`finalScoreWeights.${k}`, parseFloat(e.target.value) || 0)} className="w-24 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"/>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleWeightChange(k, 0.01)}><Plus className="h-4 w-4" /></Button>
                   </div>
                    <Slider id={`fsw-${k}`} min={0} max={1} step={0.01} value={[v]} onValueChange={(val)=>update(`finalScoreWeights.${k}`, val[0])} />
                    <p className="text-xs text-muted-foreground mt-1">{descriptions.finalScoreWeights[k]}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Rules</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(settings.rules).map(([k, v]: [string, any]) => (
                <div key={k} className="flex items-start justify-between p-3 rounded-lg border">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`r-${k}`} className="capitalize flex items-center">{k.replace(/([A-Z])/g, ' $1').replace('Enable ', '')}</Label>
                    <p className="text-xs text-muted-foreground">{descriptions.rules[k]}</p>
                  </div>
                  <Switch id={`r-${k}`} checked={v} onCheckedChange={(val)=>update(`rules.${k}`, val)} />
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Test Scoring</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 p-3 border rounded-md">
                <h4 className="font-medium">Record A</h4>
                <Label>Woman Name</Label>
                <Input value={testA.womanName} onChange={e=>setTestA({...testA, womanName: e.target.value})}/>
                <Label>Husband Name</Label>
                <Input value={testA.husbandName} onChange={e=>setTestA({...testA, husbandName: e.target.value})}/>
                <Label>National ID</Label>
                <Input value={testA.nationalId} onChange={e=>setTestA({...testA, nationalId: e.target.value})}/>
                <Label>Phone</Label>
                <Input value={testA.phone} onChange={e=>setTestA({...testA, phone: e.target.value})}/>
              </div>

              <div className="space-y-2 p-3 border rounded-md">
                <h4 className="font-medium">Record B</h4>
                <Label>Woman Name</Label>
                <Input value={testB.womanName} onChange={e=>setTestB({...testB, womanName: e.target.value})}/>
                <Label>Husband Name</Label>
                <Input value={testB.husbandName} onChange={e=>setTestB({...testB, husbandName: e.target.value})}/>
                <Label>National ID</Label>
                <Input value={testB.nationalId} onChange={e=>setTestB({...testB, nationalId: e.target.value})}/>
                <Label>Phone</Label>
                <Input value={testB.phone} onChange={e=>setTestB({...testB, phone: e.target.value})}/>
              </div>

              <div className="flex gap-2">
                <Button onClick={runTestScoring}>Run Test</Button>
                <Button onClick={() => { setTestA({womanName:"",husbandName:"",nationalId:"",phone:""}); setTestB({womanName:"",husbandName:"",nationalId:"",phone:""}); setLastResult(null); }} variant="outline">Clear</Button>
              </div>

              {lastResult && (
                <div className="mt-3 bg-muted p-3 rounded-lg">
                  <div className="font-bold text-lg">Score: {lastResult.score.toFixed(4)}</div>
                  <div className="text-sm mt-2">Compare to minPair: <b>{settings.thresholds.minPair}</b></div>
                  <details className="mt-2 text-sm">
                      <summary className="cursor-pointer font-medium">View Breakdown</summary>
                      <pre className="text-xs mt-2 bg-background p-2 rounded">{JSON.stringify(lastResult.breakdown, null, 2)}</pre>
                  </details>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}
```

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
