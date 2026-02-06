
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

    