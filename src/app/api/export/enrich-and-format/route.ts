
import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import ExcelJS from "exceljs";
import { fullPairwiseBreakdown } from "@/lib/scoring-server";
import type { AuditFinding } from "@/lib/auditEngine";
import type { RecordRow } from "@/lib/types";
import { generateArabicClusterSummary } from '@/lib/arabicClusterSummary';
import { calculateClusterConfidence } from '@/lib/clusterConfidence';

/* ======================================================
   TYPES
====================================================== */

const getTmpDir = () => path.join(os.tmpdir(), 'beneficiary-insights-cache');

type EnrichedRecord = RecordRow & {
  ClusterID?: number | null;
  Cluster_ID?: number | null;
  Cluster_Size?: number | null;
  Flag?: string | null;
  Max_PairScore?: number | null;
  pairScore?: number;
  nameScore?: number;
  husbandScore?: number;
  idScore?: number;
  phoneScore?: number;
  [key: string]: any;
};

/* ======================================================
   DECISION LOGIC
====================================================== */

function getDecisionAndNote(finalScorePct: number) {
  let decision = "إحتمالية تكرار";
  let expertNote =
    "قد يكون هنالك إحتمالية لوجود تكرار نتيجة لتطابق بعض اجزاء من الاسم للمستفيدة او الزوج. يوصى بالتحقق المكتبي من المجموعة.";

  if (finalScorePct >= 85) {
    decision = "تكرار مؤكد";
    expertNote =
      "يوجد تطابق شامل في الأسماء والنسب مع احتمالية عالية أن السجلات تعود لنفس المستفيد.";
  } else if (finalScorePct >= 70) {
    decision = "اشتباه تكرار مؤكد";
  } else if (finalScorePct >= 60) {
    decision = "اشتباه تكرار";
  }
  return { decision, expertNote };
}

/* ======================================================
   CACHE
====================================================== */

async function getCachedData(cacheId: string) {
  const filePath = path.join(getTmpDir(), `${cacheId}.json`);
  const raw = await fs.readFile(filePath, 'utf8');
  const parsed = JSON.parse(raw);

  if (!parsed?.rows || !parsed?.clusters) {
    throw new Error("Cache corrupted");
  }
  return parsed;
}

/* ======================================================
   ENRICH
====================================================== */

const pairCache = new Map();

function pairKey(a: RecordRow, b: RecordRow) {
  if (!a._internalId || !b._internalId) return `${Math.random()}`;
  return a._internalId < b._internalId
    ? `${a._internalId}|${b._internalId}`
    : `${b._internalId}|${a._internalId}`;
}

function getPairScore(a: RecordRow, b: RecordRow) {
  const key = pairKey(a, b);
  if (pairCache.has(key)) return pairCache.get(key);

  const r = fullPairwiseBreakdown([a, b])[0];
  pairCache.set(key, r);
  return r;
}

async function enrichData(cachedData: any): Promise<EnrichedRecord[]> {
  pairCache.clear(); // Clear cache for each new enrichment
  const { rows, clusters } = cachedData;
  const enriched: EnrichedRecord[] = [];

  const clusterStats = new Map<number, { maxPairScore: number; maxBeneficiaryId: number; size: number }>();

  clusters.forEach((c: any, idx: number) => {
    let maxScore = 0;
    let maxBen = 0;

    c.records.forEach((r: RecordRow) => {
      const ben = Number(r.beneficiaryId);
      if (!isNaN(ben)) maxBen = Math.max(maxBen, ben);
    });

    for (let i = 0; i < c.records.length; i++) {
        for (let j = i + 1; j < c.records.length; j++) {
            const res = getPairScore(c.records[i], c.records[j]);
            if (res && res.score > maxScore) {
                maxScore = res.score;
            }
        }
    }

    clusterStats.set(idx + 1, {
      maxPairScore: maxScore,
      maxBeneficiaryId: maxBen,
      size: c.records.length
    });
  });

  rows.forEach((r: RecordRow) => {
    let clusterId: number | null = null;

    for(let i = 0; i < clusters.length; i++) {
        if (clusters[i].records.some((x: RecordRow) => x._internalId === r._internalId)) {
            clusterId = i + 1;
            break;
        }
    }

    if (!clusterId) {
      enriched.push({ ...r });
      return;
    }

    const stats = clusterStats.get(clusterId)!;
    const comparisons = clusters[clusterId - 1].records.filter(
      (x: RecordRow) => x._internalId !== r._internalId
    );

    let totals = { pair: 0, name: 0, husband: 0, id: 0, phone: 0 };
    let count = 0;

    comparisons.forEach(other => {
      const res = getPairScore(r, other);
      if (!res) return;
      totals.pair += res.score;
      totals.name += res.breakdown.nameScore || 0;
      totals.husband += res.breakdown.husbandScore || 0;
      totals.id += res.breakdown.idScore || 0;
      totals.phone += res.breakdown.phoneScore || 0;
      count++;
    });

    const avg = (v: number) => (count ? v / count : 0);
    const pairScore = avg(totals.pair);
    
    const flag =
      pairScore >= 0.9 ? "m?" :
      pairScore >= 0.8 ? "m"  :
      pairScore >= 0.7 ? "??" :
      pairScore >  0   ? "?"  : null;

    enriched.push({
      ...r,
      ClusterID: clusterId,
      Cluster_ID: stats.maxBeneficiaryId || clusterId,
      Cluster_Size: stats.size,
      Flag: flag,
      Max_PairScore: stats.maxPairScore,
      pairScore,
      nameScore: avg(totals.name),
      husbandScore: avg(totals.husband),
      idScore: avg(totals.id),
      phoneScore: avg(totals.phone),
      "womanName | husbandName | children | nationalId | phone | village | subdistrict":
        `${r.womanName || ""} | ${r.husbandName || ""} | ${Array.isArray(r.children) ? r.children.join(', ') : (r.children || "")} | ${r.nationalId || ""} | ${r.phone || ""} | ${r.village || ""} | ${r.subdistrict || ""}`
    });
  });

  return enriched;
}

/* ======================================================
   SORT
====================================================== */

function sortData(data: EnrichedRecord[]) {
  return data.sort((a, b) => {
    if ((b.Max_PairScore ?? 0) !== (a.Max_PairScore ?? 0))
      return (b.Max_PairScore ?? 0) - (a.Max_PairScore ?? 0);

    return (a.Cluster_ID ?? 0) - (b.Cluster_ID ?? 0);
  });
}

/* ======================================================
   POST
====================================================== */

export async function POST(req: Request) {
  try {
    const { cacheId } = await req.json();
    const cachedData = await getCachedData(cacheId);
    const enriched = await enrichData(cachedData);
    const sorted = sortData(enriched);

    const wb = new ExcelJS.Workbook();
    createEnrichedDataSheet(wb, sorted, cachedData.originalHeaders);
    createClustersSheet(wb, cachedData.clusters);
    // You can add back other sheet creation calls here if needed

    const buffer = await wb.xlsx.writeBuffer();
    return new NextResponse(buffer, {
      headers: {
        "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": "attachment; filename=beneficiary-report.xlsx",
      }
    });

  } catch (e: any) {
    console.error(e);
    return NextResponse.json({ error: e.message }, { status: 500 });
  }
}

/* ======================================================
   SHEET CREATION
====================================================== */

function createEnrichedDataSheet(wb: ExcelJS.Workbook, data: EnrichedRecord[], originalHeaders: string[]) {
    const ws = wb.addWorksheet("Enriched Data");
    ws.views = [{ rightToLeft: true }];

    const LEFT_COLUMNS = [
      "ClusterID", "Cluster_ID", "Cluster_Size", "Flag", "Max_PairScore",
      "pairScore", "nameScore", "husbandScore", "idScore", "phoneScore"
    ];
    const RIGHT_COLUMNS = [
      "womanName | husbandName | children | nationalId | phone | village | subdistrict"
    ];

    const finalHeaders = [
      ...LEFT_COLUMNS,
      ...(originalHeaders || []).filter(h => !h.startsWith("_")),
      ...RIGHT_COLUMNS
    ];

    ws.columns = finalHeaders.map(h => ({
      header: h,
      key: h,
      width: h.length > 30 ? 40 : 16
    }));

    ws.getRow(1).eachCell(cell => {
        cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF002060' } };
        cell.font = { color: { argb: 'FFFFFFFF' }, bold: true };
        cell.alignment = { horizontal: 'center' };
    });

    ws.addRows(data);

    let lastCluster: any = null;
    ws.eachRow((row, idx) => {
      if (idx === 1) return;

      const cid = row.getCell("ClusterID").value;
      const score = Number(row.getCell("Max_PairScore").value || 0);

      let color: string | null = null;
      if (score >= 0.9) color = "FFFF0000";
      else if (score >= 0.8) color = "FFD966";
      else if (score >= 0.7) color = "FFF4B084";
      else if (score > 0) color = "FFFFFF00";

      row.eachCell(cell => {
        cell.border = { top:{style:"thin"}, bottom:{style:"thin"}, left:{style:"thin"}, right:{style:"thin"} };
        if (color) cell.fill = { type:"pattern", pattern:"solid", fgColor:{argb:color} };
      });

      if (cid !== lastCluster && lastCluster !== null && cid !== null) {
        row.eachCell(cell => {
          cell.border = { ...cell.border, top:{style:"thick"} };
        });
      }

      lastCluster = cid;
    });

    // Splice after styling
    const maxPairScoreCol = ws.getColumn("Max_PairScore");
    if(maxPairScoreCol.number) {
        ws.spliceColumns(maxPairScoreCol.number, 1);
    }
}


function createClustersSheet(
  wb: ExcelJS.Workbook,
  clusters: { records: RecordRow[]; reasons?: string[] }[]
) {
  const ws = wb.addWorksheet("Cluster Details");
  ws.views = [{ rightToLeft: true }];

  ws.columns = [
    { header: "Cluster ID", key: "clusterId", width: 12 },
    { header: "AI Summary", key: "summary", width: 50 },
    { header: "Beneficiary ID", key: "beneficiaryId", width: 18 },
    { header: "Score", key: "score", width: 10 },
    { header: "Woman Name", key: "womanName", width: 25 },
    { header: "Husband Name", key: "husbandName", width: 25 },
  ];

  ws.getRow(1).font = { bold: true };

  let rowIndex = 2;

  clusters.forEach((cluster, idx) => {
    const records = [...cluster.records].sort((a, b) =>
      String(a.beneficiaryId ?? '').localeCompare(String(b.beneficiaryId ?? ''))
    );

    const pairs = fullPairwiseBreakdown(records);
    const avgName = pairs.reduce((s, p) => s + (p.breakdown.nameScore || 0), 0) / (pairs.length || 1);
    const avgHusband = pairs.reduce((s, p) => s + (p.breakdown.husbandScore || 0), 0) / (pairs.length || 1);
    const confidence = calculateClusterConfidence(avgName, avgHusband);

    const summary = generateArabicClusterSummary({
      records,
      reasons: cluster.reasons || [],
      avgWomanNameScore: avgName,
      avgHusbandNameScore: avgHusband,
      avgFinalScore: (avgName + avgHusband) / 2,
      confidence
    }, records).replace(/<[^>]*>/g, '\n').replace(/\n+/g, '\n').trim();

    const start = rowIndex;

    records.forEach((r, i) => {
      const pairWithR = pairs.find(p => p.a._internalId === r._internalId || p.b._internalId === r._internalId);

      ws.addRow({
        clusterId: idx + 1,
        summary: i === 0 ? summary : "",
        beneficiaryId: r.beneficiaryId,
        score: pairWithR ? pairWithR.score.toFixed(3) : 'N/A',
        womanName: r.womanName,
        husbandName: r.husbandName
      });
      rowIndex++;
    });

    ws.mergeCells(`A${start}:A${rowIndex - 1}`);
    ws.mergeCells(`B${start}:B${rowIndex - 1}`);
    ws.getCell(`A${start}`).alignment = { vertical: 'top', horizontal: 'center' };
    ws.getCell(`B${start}`).alignment = { vertical: 'top', wrapText: true };
  });
