
"use client";

import React, { useEffect, useState, useRef, useCallback, useMemo } from "react";
import * as XLSX from "xlsx";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Upload,
  Settings,
  CheckCircle,
  XCircle,
  Loader2,
  ChevronRight,
  Users,
  Group,
  Unlink,
  BoxSelect,
  Sigma,
  ChevronsUpDown,
  Clock,
} from "lucide-react";

import { Card, CardHeader, CardContent, CardTitle, CardDescription } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import type { RecordRow } from "@/lib/types";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTranslation } from "@/hooks/use-translation";
import { Skeleton } from "@/components/ui/skeleton";
import { registerServiceWorker } from "@/lib/registerSW";
import { setupWakeLockListener } from "@/lib/wakeLock";
import { cacheRawData, cacheFinalResult } from "@/lib/cache";

type Mapping = {
  womanName: string;
  husbandName: string;
  nationalId: string;
  phone: string;
  village: string;
  subdistrict: string;
  children: string;
  beneficiaryId?: string;
};

const MAPPING_FIELDS: (keyof Mapping)[] = [
  "womanName",
  "husbandName",
  "nationalId",
  "phone",
  "village",
  "subdistrict",
  "children",
  "beneficiaryId",
];

const REQUIRED_MAPPING_FIELDS: (keyof Mapping)[] = [
  "womanName",
  "husbandName",
  "nationalId",
  "phone",
  "village",
  "subdistrict",
  "children",
];

const LOCAL_STORAGE_KEY_PREFIX = "beneficiary-mapping-";
const CHUNK_SIZE = 2000;

type WorkerProgress = {
  status: string;
  progress: number;
  completed?: number;
  total?: number;
};

type TimeInfo = { elapsed: number; remaining?: number };

const SummaryCard = ({
  icon,
  title,
  value,
  total,
}: {
  icon: React.ReactNode;
  title: string;
  value: string | number;
  total?: number;
}) => (
  <Card>
    <CardHeader className="flex flex-row items-center justify-between pb-2">
      <CardTitle className="text-sm font-medium">{title}</CardTitle>
      {icon}
    </CardHeader>
    <CardContent>
      <div className="text-2xl font-bold">{value}</div>
      {total !== undefined && (
        <p className="text-xs text-muted-foreground">out of {total}</p>
      )}
    </CardContent>
  </Card>
);

export default function UploadPage() {
  const { t, isLoading: isTranslationLoading } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();

  const [columns, setColumns] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [isDataCached, setIsDataCached] = useState(false);
  const [mapping, setMapping] = useState<Mapping>({
    womanName: "", husbandName: "", nationalId: "", phone: "",
    village: "", subdistrict: "", children: "", beneficiaryId: "",
  });

  const isMappingComplete = useMemo(() => REQUIRED_MAPPING_FIELDS.every((f) => !!mapping[f]), [mapping]);
  const [progressInfo, setProgressInfo] = useState<WorkerProgress>({ status: "idle", progress: 0 });
  const [workerStatus, setWorkerStatus] = useState("idle");
  const [clusters, setClusters] = useState<any[]>([]);
  const [fileReadProgress, setFileReadProgress] = useState(0);
  const [isMappingOpen, setIsMappingOpen] = useState(true);
  const [timeInfo, setTimeInfo] = useState<TimeInfo>({ elapsed: 0 });

  const rawRowsRef = useRef<any[]>([]);
  const clusterWorkerRef = useRef<Worker | null>(null);
  const scoringWorkerRef = useRef<Worker | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);

  useEffect(() => {
    registerServiceWorker();
    const clusterWorker = new Worker(new URL("@/workers/cluster.worker.ts", import.meta.url), { type: "module" });
    const scoringWorker = new Worker(new URL("@/workers/scoring.worker.ts", import.meta.url), { type: "module" });

    clusterWorkerRef.current = clusterWorker;
    scoringWorkerRef.current = scoringWorker;

    const cleanupWakeLock = setupWakeLockListener();

    clusterWorker.onmessage = async (ev) => {
      const msg = ev.data;
      if (!msg?.type) return;

      if (msg.type === "progress") {
        setWorkerStatus(msg.status);
        setProgressInfo(msg);
        return;
      }

      if (msg.type === "done") {
        const rawClusters = msg.payload?.clusters ?? [];
        toast({ title: "Calculating Scores", description: "Clustering complete. Now calculating detailed similarity scores." });
        setWorkerStatus('calculating_scores');
        setProgressInfo({ status: 'calculating_scores', progress: 96 });
        scoringWorker.postMessage({ rawClusters });
      } else if (msg.type === 'error') {
        setWorkerStatus('error');
        toast({ title: t('upload.toasts.workerError.title'), description: msg.error, variant: 'destructive' });
      }
    };

    scoringWorker.onmessage = async (ev) => {
        const msg = ev.data;
        if (!msg?.type) return;

        if (msg.type === 'progress') {
            setProgressInfo(prev => ({ ...prev, progress: 96 + (msg.progress / 100) * 2 }));
            return;
        }

        if (msg.type === 'done') {
            try {
                const enrichedClusters = msg.enrichedClusters;
                setClusters(enrichedClusters);
                setWorkerStatus("caching");
                setProgressInfo({ status: "caching", progress: 98 });
                await cacheFinalResult({ clusters: enrichedClusters });
                setWorkerStatus("done");
                setProgressInfo({ status: "done", progress: 100 });
                toast({
                    title: t("upload.toasts.clusteringComplete.title"),
                    description: t("upload.toasts.clusteringComplete.description", { count: enrichedClusters.length }),
                });
            } catch (e: any) {
                setWorkerStatus("error");
                toast({ title: t("upload.toasts.cacheError.title"), description: String(e), variant: "destructive" });
            }
        } else if (msg.type === 'error') {
            setWorkerStatus('error');
            toast({ title: 'Scoring Worker Error', description: msg.error, variant: 'destructive' });
        }
    };

    return () => {
      clusterWorker.terminate();
      scoringWorker.terminate();
      cleanupWakeLock();
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [t, toast]);

  useEffect(() => {
    if (columns.length === 0) return;
    const key = LOCAL_STORAGE_KEY_PREFIX + columns.join(",");
    localStorage.setItem(key, JSON.stringify(mapping));
  }, [mapping, columns]);

  useEffect(() => {
    if (workerStatus !== "idle" && workerStatus !== "done" && workerStatus !== "error" && startTimeRef.current) {
      if (timerRef.current) clearInterval(timerRef.current);
      timerRef.current = setInterval(() => {
        const elapsed = (Date.now() - startTimeRef.current!) / 1000;
        let remaining;
        if (progressInfo.progress > 0 && progressInfo.progress < 100) {
          remaining = (elapsed / progressInfo.progress) * (100 - progressInfo.progress);
        }
        setTimeInfo({ elapsed, remaining });
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [workerStatus, progressInfo.progress]);

  const handleFile = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    setWorkerStatus("idle");
    setProgressInfo({ status: "idle", progress: 0 });
    setClusters([]);
    setTimeInfo({ elapsed: 0 });
    if (timerRef.current) clearInterval(timerRef.current);
    setFileReadProgress(0);
    setIsMappingOpen(true);
    setIsDataCached(false);

    const reader = new FileReader();
    reader.onprogress = (event) => {
      if (event.lengthComputable) {
        const percentage = (event.loaded / event.total) * 100;
        setFileReadProgress(percentage);
      }
    };
    reader.onload = async (ev) => {
      try {
        const buffer = ev.target?.result;
        const wb = XLSX.read(buffer, { type: "array", cellDates: true });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const json = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });
        
        // --- Generate internalId immediately ---
        const rowsWithId = json.map((row, index) => ({
          ...row,
          _internalId: `row_${Date.now()}_${index}`
        }));
        rawRowsRef.current = rowsWithId;
        
        const fileColumns = Object.keys(json[0] || {});
        setColumns(fileColumns);
        
        // --- Cache to IndexedDB before enabling clustering ---
        await cacheRawData({ rows: rowsWithId, originalHeaders: fileColumns });
        setIsDataCached(true);
        toast({ title: "Data Ready", description: "Internal IDs generated and data cached. You can now run clustering." });

        const storageKey = LOCAL_STORAGE_KEY_PREFIX + fileColumns.join(",");
        const saved = localStorage.getItem(storageKey);
        if (saved) {
          try { setMapping(JSON.parse(saved)); } catch {}
        } else {
          setMapping({ womanName: "", husbandName: "", nationalId: "", phone: "", village: "", subdistrict: "", children: "", beneficiaryId: "" });
        }
        setFileReadProgress(100);
      } catch (err: any) {
        toast({ title: "Error processing file", description: err.message, variant: "destructive"});
        resetAll();
      }
    };
    reader.readAsArrayBuffer(f);
  }, [toast]);

  const handleMappingChange = useCallback((field: keyof Mapping, value: string) => {
    setMapping((m) => ({ ...m, [field]: value }));
  }, []);

  const startClustering = useCallback(async () => {
    if (!clusterWorkerRef.current || !scoringWorkerRef.current) {
      toast({ title: t("upload.toasts.workerNotReady") });
      return;
    }
    if (!rawRowsRef.current.length) {
      toast({ title: t("upload.toasts.noData") });
      return;
    }
    if (!isMappingComplete) {
      toast({ title: t("upload.toasts.mappingIncomplete"), variant: "destructive" });
      return;
    }

    setIsMappingOpen(false);
    setWorkerStatus("processing");
    setProgressInfo({ status: "processing", progress: 1 });
    setTimeInfo({ elapsed: 0 });
    startTimeRef.current = Date.now();

    let settings = {};
    try {
      const res = await fetch("/api/settings");
      const d = await res.json();
      if (d.ok) settings = d.settings || {};
    } catch {}

    clusterWorkerRef.current!.postMessage({
      type: "start",
      payload: { mapping, options: settings },
    });

    for (let i = 0; i < rawRowsRef.current.length; i += CHUNK_SIZE) {
      const chunk = rawRowsRef.current.slice(i, i + CHUNK_SIZE);
      clusterWorkerRef.current!.postMessage({ type: "data", payload: { rows: chunk, total: rawRowsRef.current.length } });
      await new Promise((r) => setTimeout(r, 8));
    }
    clusterWorkerRef.current!.postMessage({ type: "end" });
  }, [isMappingComplete, mapping, toast, t]);

  const resetAll = useCallback(() => {
    setFile(null);
    setColumns([]);
    rawRowsRef.current = [];
    setClusters([]);
    setWorkerStatus("idle");
    setProgressInfo({ status: "idle", progress: 0 });
    setFileReadProgress(0);
    setTimeInfo({ elapsed: 0 });
    if (timerRef.current) clearInterval(timerRef.current);
    setIsDataCached(false);
  }, []);

  const formatTime = useCallback((seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h > 0 ? `${h}h` : "", m > 0 ? `${m}m` : "", `${s}s`].filter(Boolean).join(" ");
  }, []);

  const formattedStatus = useCallback(() => {
    const s = progressInfo.status || "idle";
    const statusText = isTranslationLoading ? "" : t(`upload.status.${s}`);
    if (progressInfo.completed !== undefined && progressInfo.total) {
      return `${t("upload.status.label")}: ${statusText} (${progressInfo.completed.toLocaleString()}/${progressInfo.total.toLocaleString()})`;
    }
    return `${t("upload.status.label")}: ${statusText}`;
  }, [progressInfo, isTranslationLoading, t]);

  const getButtonText = useCallback(() => {
    if (isTranslationLoading) return <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
    switch (workerStatus) {
      case "processing":
      case "blocking":
      case "building-edges":
      case "merging-edges":
      case "annotating":
      case "calculating_scores":
        return t("upload.buttons.processing");
      case "caching":
        return t("upload.buttons.caching");
      case "done":
        return t("upload.buttons.done");
      case "error":
        return t("upload.buttons.error");
      default:
        return t("upload.buttons.idle");
    }
  }, [isTranslationLoading, t, workerStatus]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="flex flex-row items-start justify-between">
          <div>
            <CardTitle>{isTranslationLoading ? <Skeleton className="h-8 w-48" /> : t("upload.steps.1.title")}</CardTitle>
            <CardDescription>{isTranslationLoading ? <Skeleton className="h-5 w-64 mt-1" /> : t("upload.steps.1.description")}</CardDescription>
          </div>
          <Button variant="outline" asChild>
            <Link href="/settings">
              <Settings className="mr-2 h-4 w-4" />
              {isTranslationLoading ? <Skeleton className="h-5 w-20" /> : t("upload.buttons.settings")}
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
                      <p className="text-xs text-muted-foreground">
                        {rawRowsRef.current.length > 0 ? `${rawRowsRef.current.length} ${t("upload.file.rowsDetected")}` : t("upload.file.reading")}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="mb-2 text-sm text-muted-foreground">
                        <span className="font-semibold">{t("upload.file.clickToUpload")}</span> {t("upload.file.orDragAndDrop")}
                      </p>
                      <p className="text-xs text-muted-foreground">{t("upload.file.fileTypes")}</p>
                    </>
                  )}
                </div>
                <input id="file-upload" type="file" className="hidden" onChange={handleFile} accept=".xlsx,.xls,.csv,.xlsm,.xlsb" />
              </div>
            </label>
            {file && (<Button onClick={resetAll} variant="outline">{t("upload.buttons.reset")}</Button>)}
          </div>
          {file && fileReadProgress > 0 && fileReadProgress < 100 && (
            <div className="mt-4">
              <Label>{t("upload.file.reading")}</Label>
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
                  <CardTitle>{isTranslationLoading ? <Skeleton className="h-8 w-48" /> : t("upload.steps.2.title")}</CardTitle>
                  <CardDescription>{isTranslationLoading ? <Skeleton className="h-5 w-64 mt-1" /> : t("upload.steps.2.description")}</CardDescription>
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm"><ChevronsUpDown className="h-4 w-4" /><span className="sr-only">Toggle</span></Button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MAPPING_FIELDS.map((field) => (
                  <Card key={field}>
                    <CardHeader className="p-4 flex flex-row items-center justify-between">
                      <div className="flex items-center gap-2">
                        {mapping[field as keyof Mapping] ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                        <Label htmlFor={String(field)} className="capitalize font-semibold text-base">
                          {t(`upload.mappingFields.${String(field)}`)}
                          {REQUIRED_MAPPING_FIELDS.includes(field as any) && <span className="text-destructive">*</span>}
                        </Label>
                      </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-48 border-t">
                        <RadioGroup value={mapping[field as keyof Mapping]} onValueChange={(v) => handleMappingChange(field as keyof Mapping, v)} className="p-4 grid grid-cols-2 gap-2">
                          {columns.map((col) => (
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

      {file && (
        <Card>
          <CardHeader>
            <CardTitle>{isTranslationLoading ? <Skeleton className="h-8 w-48" /> : t("upload.steps.3.title")}</CardTitle>
            <CardDescription>{isTranslationLoading ? <Skeleton className="h-5 w-64 mt-1" /> : t("upload.steps.3.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <Button onClick={startClustering} disabled={!isMappingComplete || !isDataCached || (workerStatus !== "idle" && workerStatus !== "done" && workerStatus !== "error")}>
                {(workerStatus !== "idle" && workerStatus !== "done" && workerStatus !== "error") ? (<Loader2 className="mr-2 h-4 w-4 animate-spin" />) : null}
                {getButtonText()}
              </Button>

              {(workerStatus !== "idle" && workerStatus !== "done" && workerStatus !== "error") && (
                <div className="space-y-2 mt-4">
                  <div className="flex justify-between items-center text-sm font-medium text-muted-foreground"><span>{formattedStatus()}</span></div>
                  <div className="relative h-4 w-full overflow-hidden rounded-full bg-secondary">
                    <Progress value={progressInfo.progress} className="absolute h-full w-full" />
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-xs font-medium text-primary-foreground mix-blend-difference">{Math.round(progressInfo.progress)}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>{formatTime(timeInfo.elapsed)}</span>
                    {timeInfo.remaining !== undefined && <span className="text-xs">(est. {formatTime(timeInfo.remaining)} left)</span>}
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {workerStatus === "done" && (
        <Card>
          <CardHeader>
            <CardTitle>{isTranslationLoading ? <Skeleton className="h-8 w-48" /> : t("upload.steps.4.title")}</CardTitle>
            <CardDescription>{isTranslationLoading ? <Skeleton className="h-5 w-64 mt-1" /> : t("upload.steps.4.description")}</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
              <SummaryCard icon={<Users className="h-4 w-4 text-muted-foreground" />} title={t("upload.results.totalRecords")} value={rawRowsRef.current.length} />
              <SummaryCard icon={<Group className="h-4 w-4 text-muted-foreground" />} title={t("upload.results.clusteredRecords")} value={clusters.flatMap((c) => (c as any).records).length} />
              <SummaryCard icon={<Unlink className="h-4 w-4 text-muted-foreground" />} title={t("upload.results.unclusteredRecords")} value={rawRowsRef.current.length - clusters.flatMap((c) => (c as any).records).length} />
              <SummaryCard icon={<BoxSelect className="h-4 w-4 text-muted-foreground" />} title={t("upload.results.clusterCount")} value={clusters.length} />
              <SummaryCard icon={<Sigma className="h-4 w-4 text-muted-foreground" />} title={t("upload.results.avgClusterSize")} value={clusters.length > 0 ? (clusters.flatMap((c) => (c as any).records).length / clusters.length).toFixed(2) : 0} />
            </div>
            <Button onClick={() => router.push("/review")} disabled={clusters.length === 0}>
              {t("upload.buttons.goToReview")} <ChevronRight className="ml-2 h-4 w-4" />
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
