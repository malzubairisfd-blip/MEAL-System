
"use client";

import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
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
  Wrench,
  GitCompareArrows,
  Save,
  Trash2,
  Database,
  ArrowUp,
  SaveIcon
} from "lucide-react";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { useToast } from "@/hooks/use-toast";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useTranslation } from "@/hooks/use-translation";
import { Skeleton } from "@/components/ui/skeleton";
import { registerServiceWorker } from "@/lib/registerSW";
import { setupWakeLockListener } from "@/lib/wakeLock";
import { cacheRawData, cacheFinalResult, loadCachedResult } from "@/lib/cache";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { RecordRow } from '@/lib/types';


// --- Types ---
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

type Project = {
    projectId: string;
    projectName: string;
};


const MAPPING_FIELDS: (keyof Mapping)[] = [
  "womanName", "husbandName", "nationalId", "phone", "village", "subdistrict", "children", "beneficiaryId",
];

const REQUIRED_MAPPING_FIELDS: (keyof Mapping)[] = [
  "womanName", "husbandName", "nationalId", "phone", "village", "subdistrict", "children",
];

const LOCAL_STORAGE_KEY_PREFIX = "beneficiary-mapping-";
const CHUNK_SIZE = 5000;

type WorkerProgress = {
  status: string;
  progress: number;
  completed?: number;
  total?: number;
};

type TimeInfo = { elapsed: number; remaining?: number };

// --- Components ---
const SummaryCard = ({
  icon, title, value, total,
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

const DB_COLUMNS = ["id", "project_id", "project_name", "Generated_Cluster_ID", "Size", "Flag", "Max_PairScore", "pairScore", "nameScore", "husbandScore", "childrenScore", "idScore", "phoneScore", "locationScore", "groupDecision", "recordDecisions", "decisionReasons", "s", "cluster_id", "dup_cluster_id2", "eq_clusters", "dup_flag2", "new_dup_flag1", "dup_flag", "cluster_size", "dup_cluster_size", "match_probability", "match_weight", "l_id", "l_benef_name", "l_hsbnd_name", "l_child_list", "l_phone_no", "l_id_card_no", "l_age_years", "l_mud_id", "gv_bnf_name", "gv_hsbnd_name", "gv_bnf_hsbnd_name", "gv_n_child_list", "gv_id_card_no", "gv_phone_no", "gv_age_years", "r_id", "r_benef_name", "r_husband_name", "r_child_list", "r_phone_no", "r_id_card_no", "r_age_years", "r_mud_id", "lr_eq_mud", "lr_eq_phone", "lr_age_diff", "lr_benef_name_jw_sim", "lr_husband_name_jw_sim", "lr_benef_name_jaccard", "lr_husband_name_jaccard", "lr_id_card_dist", "lr_child_jaccard", "dup_cluster_size_2", "dup_cluster_id", "dup_cluster_flag", "record_id", "benef_name", "husband_name", "child_list_str", "phone_no", "bnf_id_card_no", "age_years", "gov_name", "mud_name", "hh_ozla_name", "hh_vill_name", "dup_cluster_score", "hh_uuid_dup_cnt", "hh_uuid_rn", "hh_team_name", "hh_srvyr_name", "hh_srvyr_phone_no", "hh_mahlah", "hh_address", "hh_name", "hh_gender", "hh_is_swf", "hh_is_dislocated", "hh_is_dislocated_guest", "child_cnt", "child_m_cnt", "child_f_cnt", "bnf_id", "srvy_hh_id", "bnf_idx", "id_card_type", "bnf_relation", "bnf_relation_label", "bnf_relation_code", "n_child_list_str", "hh_deviceid", "hh_vill_id", "gov_no", "mud_no", "hh_ozla_no", "hh_srvyr_id", "hh_srvyr_team_id", "paper_form_date", "paper_form_no", "hh_qual_women_cnt", "bnf_child_cnt", "bnf_child_m_cnt", "bnf_child_f_cnt", "bnf_social_status", "bnf_qual_status", "bnf_qual_status_desc", "bnf_qual_is_preg", "bnf_qual_is_mother5", "bnf_qual_is_mother_handicaped", "bnf_is_handicaped", "bnf_is_dislocated", "hh_phone_no", "bnf_phone_no", "hh_is_new_instance", "hh_uuid", "hh_submission_time", "hh_submitted_by", "n_hh_name", "child_list2", "child_list_long", "bnf_1name", "bnf_2name", "bnf_3name", "bnf_4name", "bnf_5name", "hsbnd_1name", "hsbnd_2name", "hsbnd_3name", "hsbnd_4name", "hsbnd_5name", "proj_no", "id_card_no", "loc_id", "status", "notes", "flag_2", "cluster_min_score", "cluster_max_score", "cluster_score", "bnf_relations", "hsbnd_relations", "common_child", "common_child_cnt", "relation_score", "same_mud", "same_proj", "office_no", "ser", "benef_id", "is_active", "benef_class_desc", "term_reason", "is_dup_cluster", "dup_woman_id", "dup_benef_id", "reg_form_date", "old_bnf_name", "old_hsbnd_name", "curr_benef_name", "curr_husband_name", "calc_bnf_1name", "calc_bnf_2name", "calc_bnf_3name", "calc_bnf_4name", "calc_bnf_5name", "calc_hsbnd_1name", "calc_hsbnd_2name", "calc_hsbnd_3name", "calc_hsbnd_4name", "calc_hsbnd_5name", "cbnf_name", "chsbnd_name", "n_child_list", "b_1name", "b_2name", "b_3name", "b_4name", "b_5name", "h_1name", "h_2name", "h_3name", "h_4name", "h_5name", "child_list", "bnf_name_2", "hsbnd_name_2", "bnf_name2", "bnf_name2b", "bnf_name2c", "bnf_name3", "bnf_name3b", "bnf_name3c", "bnf_name3d", "bnf_name4", "bnf_name4c", "bnf_name4b", "bnf_f_name4", "bnf_f_name3", "bnf_f_name3c", "hsbnd_name2", "hsbnd_name2b", "hsbnd_name2c", "hsbnd_name3", "hsbnd_name3b", "hsbnd_name3c", "hsbnd_name3d", "hsbnd_name4", "hsbnd_name4c", "hsbnd_name4b", "hsbnd_f_name4", "hsbnd_f_name3", "hsbnd_f_name3c", "bnf_name_list", "hsbnd_name_list", "dup_cluster_id2_2", "c_max_weight", "c_min_weight", "c_id_max_weight", "c_id_min_weight", "c_max_pct", "c_min_pct", "c_id_max_pct", "c_id_min_pct", "c_min_proj", "c_max_proj", "c_proj2_cnt", "c_mud2_cnt", "c_id_min_proj", "c_id_max_proj", "c_id_proj2_cnt", "c_id_mud2_cnt", 'womanName', 'husbandName', 'nationalId', 'phone', 'village', 'subdistrict', 'children', 'beneficiaryId', 'avgPairScore', 'avgFirstNameScore', 'avgFamilyNameScore', 'avgAdvancedNameScore', 'avgTokenReorderScore', 'reasons', 'confidenceScore', 'avgWomanNameScore', 'avgHusbandNameScore', 'avgFinalScore', "pre_classified_result", "group_analysis", "womanName_normalized", "husbandName_normalized", "children_normalized", "subdistrict_normalized", "village_normalized", "parts", "husbandParts", 'diff_per__bnf1', 'diff_per__bnf2', 'diff_per__bnf3', 'diff_per__bnf4', 'diff_per__bnf5', 'diff_per__bnf', 'diff_per__hus1', 'diff_per__hus2', 'diff_per__hus3', 'diff_per__hus4', 'diff_per__hus5', 'diff_per__hus', "internalId", "data"];


export default function UploadPage() {
  const { t, isLoading: isTranslationLoading } = useTranslation();
  const { toast } = useToast();
  const router = useRouter();

  // --- State ---
  const [columns, setColumns] = useState<string[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [mapping, setMapping] = useState<Mapping>({
    womanName: "", husbandName: "", nationalId: "", phone: "", village: "", subdistrict: "", children: "", beneficiaryId: "",
  });
  const [isDataCached, setIsDataCached] = useState(false);
  const [progressInfo, setProgressInfo] = useState<WorkerProgress>({ status: "idle", progress: 0 });
  const [workerStatus, setWorkerStatus] = useState("idle");
  const [clusters, setClusters] = useState<any[]>([]);
  const [fileReadProgress, setFileReadProgress] = useState(0);
  const [isMappingOpen, setIsMappingOpen] = useState(true);
  const [timeInfo, setTimeInfo] = useState<TimeInfo>({ elapsed: 0 });

  // --- Refs ---
  const rawRowsRef = useRef<any[]>([]);
  const clusterWorkerRef = useRef<Worker | null>(null);
  const scoringWorkerRef = useRef<Worker | null>(null);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const notifiedAboutSaveRef = useRef(false);
  const progressInfoRef = useRef(progressInfo);
  progressInfoRef.current = progressInfo;

    // --- State for DB Save Section ---
    const [projects, setProjects] = useState<Project[]>([]);
    const [loadingProjects, setLoadingProjects] = useState(true);
    const [selectedProjectId, setSelectedProjectId] = useState('');
    const [dbColumnMapping, setDbColumnMapping] = useState<Map<string, string>>(new Map());
    const [uniqueIdMapping, setUniqueIdMapping] = useState({ fileCol: '', dbCol: '' });
    const [manualDbMapping, setManualDbMapping] = useState({ ui: '', db: '' });
    const [isSaving, setIsSaving] = useState(false);
    const [saveStatus, setSaveStatus] = useState('idle');
    const [saveProgress, setSaveProgress] = useState(0);
    const [duplicateInfo, setDuplicateInfo] = useState<{ isOpen: boolean; count: number; records: any[] }>({ isOpen: false, count: 0, records: [] });
    const [saveStats, setSaveStats] = useState({ saved: 0, skipped: 0, total: 0 });


  // --- Memos ---
  const isMappingComplete = useMemo(
    () => REQUIRED_MAPPING_FIELDS.every((field) => Boolean(mapping[field])),
    [mapping]
  );
  
  const isDbMappingReady = useMemo(() => uniqueIdMapping.fileCol && uniqueIdMapping.dbCol, [uniqueIdMapping]);
  
  const unmappedUiColumns = useMemo(() => columns.filter(c => !Array.from(dbColumnMapping.keys()).includes(c) && c !== uniqueIdMapping.fileCol), [columns, dbColumnMapping, uniqueIdMapping.fileCol]);
  const unmappedDbColumns = useMemo(() => {
      const used = new Set([...dbColumnMapping.values(), uniqueIdMapping.dbCol]);
      return DB_COLUMNS.filter(c => !used.has(c));
  }, [dbColumnMapping, uniqueIdMapping.dbCol]);


  // --- Callbacks ---
  const resetAll = useCallback(() => {
    setFile(null); setColumns([]); rawRowsRef.current = []; setClusters([]);
    setWorkerStatus("idle"); setProgressInfo({ status: "idle", progress: 0 });
    setFileReadProgress(0); setTimeInfo({ elapsed: 0 }); setIsDataCached(false);
    notifiedAboutSaveRef.current = false;
    // Reset DB Save state
    setSelectedProjectId(''); setDbColumnMapping(new Map()); setUniqueIdMapping({ fileCol: '', dbCol: '' });
    setIsSaving(false); setSaveStatus('idle'); setSaveProgress(0);
    setDuplicateInfo({ isOpen: false, count: 0, records: [] }); setSaveStats({ saved: 0, skipped: 0, total: 0 });
    if (timerRef.current) clearInterval(timerRef.current);
  }, []);

  // --- Effects ---
  useEffect(() => {
    registerServiceWorker();
    const clusterWorker = new Worker(new URL("@/workers/cluster.worker.ts", import.meta.url), { type: "module" });
    const scoringWorker = new Worker(new URL("@/workers/scoring.worker.ts", import.meta.url), { type: "module" });
    clusterWorkerRef.current = clusterWorker;
    scoringWorkerRef.current = scoringWorker;
    const cleanupWakeLock = setupWakeLockListener();

    const handleClusterMessage = (msg: any) => {
        if (!msg?.type) return;
        if (msg.type === "progress") { setWorkerStatus(msg.status); setProgressInfo(msg); return; }
        if (msg.type === 'rules_loaded') { toast({ title: "Auto-Rules Imported", description: `Successfully imported ${msg.count} rules.`, }); setWorkerStatus('rules_loaded'); setProgressInfo(prev => ({ ...prev, status: 'rules_loaded' })); return; }
        if (msg.type === "done") {
            const rawClusters = msg.payload?.clusters ?? [];
            toast({ title: "Calculating Scores", description: "Clustering complete. Now calculating detailed similarity scores.", });
            setWorkerStatus("calculating_scores"); setProgressInfo({ status: "calculating_scores", progress: 96 });
            scoringWorker.postMessage({ rawClusters });
            return;
        }
        if (msg.type === "error") {
            setWorkerStatus("error");
            toast({ title: t("upload.toasts.workerError.title"), description: msg.error, variant: "destructive", });
        }
    };
    const handleScoringMessage = (msg: any) => {
        if (!msg?.type) return;
        if (msg.type === "progress") { setProgressInfo((prev) => ({ ...prev, progress: 96 + (msg.progress / 100) * 2, })); return; }
        if (msg.type === "done") {
            (async () => {
                try {
                    const enrichedClusters = msg.enrichedClusters;
                    setClusters(enrichedClusters);
                    setWorkerStatus("caching"); setProgressInfo({ status: "caching", progress: 99 });
                    const currentData = await loadCachedResult();
                    await cacheFinalResult({ ...currentData, clusters: enrichedClusters, rows: currentData?.rows ?? rawRowsRef.current, originalHeaders: currentData?.originalHeaders ?? columns, });
                    setWorkerStatus("done"); setProgressInfo({ status: "done", progress: 100 });
                    toast({ title: t("upload.toasts.clusteringComplete.title"), description: t("upload.toasts.clusteringComplete.description", { count: enrichedClusters.length, }), });
                } catch (error: any) {
                    setWorkerStatus("error");
                    toast({ title: t("upload.toasts.cacheError.title"), description: String(error), variant: "destructive", });
                }
            })();
            return;
        }
        if (msg.type === "error") {
            setWorkerStatus("error");
            toast({ title: "Scoring Worker Error", description: msg.error, variant: "destructive" });
        }
    };
    clusterWorker.onmessage = (ev) => handleClusterMessage(ev.data);
    scoringWorker.onmessage = (ev) => handleScoringMessage(ev.data);
    return () => { clusterWorker.terminate(); scoringWorker.terminate(); cleanupWakeLock(); if (timerRef.current) clearInterval(timerRef.current); };
  }, [t, toast, columns]);

  // Save mapping
  useEffect(() => {
    if (isMappingComplete && columns.length) {
        const key = `${LOCAL_STORAGE_KEY_PREFIX}${columns.join(",")}`;
        localStorage.setItem(key, JSON.stringify(mapping));
        if (!notifiedAboutSaveRef.current) {
            toast({ title: "Mapping Saved", description: "Your column mapping has been saved locally for this file structure.", });
            notifiedAboutSaveRef.current = true;
        }
    }
  }, [columns, isMappingComplete, mapping, toast]);

  // Timer effect
  useEffect(() => {
    if (workerStatus !== "idle" && workerStatus !== "done" && workerStatus !== "error" && startTimeRef.current) {
        if (timerRef.current) clearInterval(timerRef.current);
        timerRef.current = setInterval(() => {
            const elapsed = (Date.now() - startTimeRef.current!) / 1000;
            let remaining;
            const currentP = progressInfoRef.current.progress;
            if (currentP > 0 && currentP < 100) { remaining = (elapsed / currentP) * (100 - currentP); }
            setTimeInfo({ elapsed, remaining });
        }, 1000);
    } else if (timerRef.current) {
        clearInterval(timerRef.current);
        timerRef.current = null;
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [workerStatus]);

  const handleFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = event.target.files?.[0];
    if (!selectedFile) return;
    resetAll();
    setFile(selectedFile);
    setIsMappingOpen(true);
    const reader = new FileReader();
    reader.onprogress = (progressEvent) => {
        if (progressEvent.lengthComputable) {
            const percent = (progressEvent.loaded / progressEvent.total) * 100;
            setFileReadProgress(percent);
        }
    };
    reader.onload = async (loadEvent) => {
        try {
            const buffer = loadEvent.target?.result;
            const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const json = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });
            const detectedColumns = Object.keys(json[0] || {});
            const rowsWithId = json.map((row, index) => ({ ...row, _internalId: `row_${Date.now()}_${index}`, }));
            rawRowsRef.current = rowsWithId;
            await cacheRawData({ rows: rowsWithId, originalHeaders: detectedColumns });
            setIsDataCached(true);
            const storageKey = `${LOCAL_STORAGE_KEY_PREFIX}${detectedColumns.join(",")}`;
            const saved = localStorage.getItem(storageKey);
            if (saved) {
                try {
                    setMapping(JSON.parse(saved));
                    toast({ title: "Mapping Loaded", description: "Loaded saved column mapping from your last session.", });
                    notifiedAboutSaveRef.current = true;
                } catch {}
            }
            setColumns(detectedColumns);
            setFileReadProgress(100);
        } catch (error: any) {
            toast({ title: "Error processing file", description: error.message, variant: "destructive", });
            resetAll();
        }
    };
    reader.readAsArrayBuffer(selectedFile);
  }, [resetAll, toast]);

  const handleMappingChange = useCallback((field: keyof Mapping, value: string) => {
    setMapping((prev) => ({ ...prev, [field]: value }));
  }, []);

  const fetchSettingsAndRules = useCallback(async () => {
    try {
        const [settingsRes, rulesRes] = await Promise.all([ fetch("/api/settings"), fetch("/api/rules", { cache: 'no-store' }) ]);
        const settingsData = await settingsRes.json();
        const rulesData = await rulesRes.json();
        const settings = settingsData.ok ? settingsData.settings : {};
        const autoRules = Array.isArray(rulesData) ? rulesData : [];
        return { settings, autoRules };
    } catch (error) {
        console.error("Failed to fetch settings or rules:", error);
        return { settings: {}, autoRules: [] };
    }
  }, []);

  const startClustering = useCallback(async () => {
    if (!clusterWorkerRef.current || !scoringWorkerRef.current) { toast({ title: t("upload.toasts.workerNotReady") }); return; }
    if (!rawRowsRef.current.length) { toast({ title: t("upload.toasts.noData") }); return; }
    if (!isMappingComplete) { toast({ title: t("upload.toasts.mappingIncomplete"), variant: "destructive"}); return; }
    setIsMappingOpen(false);
    setWorkerStatus("processing"); setProgressInfo({ status:'processing', progress:1 });
    setTimeInfo({ elapsed: 0 }); startTimeRef.current = Date.now();
    const { settings, autoRules } = await fetchSettingsAndRules();
    clusterWorkerRef.current.postMessage({ type:'start', payload: { mapping, options: settings, autoRules }, });
    const totalRows = rawRowsRef.current.length;
    for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
        const chunk = rawRowsRef.current.slice(i, i + CHUNK_SIZE);
        clusterWorkerRef.current.postMessage({ type:'data', payload:{ rows: chunk, total: totalRows } });
        await new Promise((resolve) => setTimeout(resolve, 5)); 
    }
    clusterWorkerRef.current.postMessage({ type:'end' });
  }, [fetchSettingsAndRules, isMappingComplete, mapping, t, toast]);

  const formatTime = useCallback((seconds: number) => {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);
    return [h > 0 ? `${h}h` : "", m > 0 ? `${m}m` : "", `${s}s`].filter(Boolean).join(" ");
  }, []);

  const formattedStatus = useCallback(() => {
    const statusKey = progressInfo.status || "idle";
    const translated = isTranslationLoading ? "" : t(`upload.status.${statusKey}`);
    if (progressInfo.completed !== undefined && progressInfo.total) {
        return `${t("upload.status.label")}: ${translated} (${progressInfo.completed.toLocaleString()}/${progressInfo.total.toLocaleString()})`;
    }
    return `${t("upload.status.label")}: ${translated}`;
  }, [isTranslationLoading, progressInfo, t]);

  const getButtonText = useCallback(() => {
    if (isTranslationLoading) return <Loader2 className="mr-2 h-4 w-4 animate-spin" />;
    switch (workerStatus) {
        case "processing": case "receiving": case "indexing": case "blocking":
        case "building-edges": case "merging-edges": case "annotating":
        case "calculating_scores": case "rules_loaded":
            return t("upload.buttons.processing");
        case "caching": return t("upload.buttons.caching");
        case "done": return t("upload.buttons.done");
        case "error": return t("upload.buttons.error");
        default: return t("upload.buttons.idle");
    }
  }, [isTranslationLoading, t, workerStatus]);

    // --- DB Save Section Callbacks ---
    useEffect(() => {
        const fetchProjects = async () => {
            setLoadingProjects(true);
            try {
                const res = await fetch('/api/projects');
                if (!res.ok) throw new Error("Failed to load projects.");
                setProjects(await res.json());
            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
            } finally {
                setLoadingProjects(false);
            }
        };
        if (workerStatus === 'done') {
            fetchProjects();
        }
    }, [workerStatus, toast]);
    
    const handleAutoMatch = useCallback(async () => {
        const cachedData = await loadCachedResult();
        const clusterRecords = cachedData?.clusters?.[0]?.records?.[0] ? Object.keys(cachedData.clusters[0].records[0]) : [];
        const clusterTopLevel = cachedData?.clusters?.[0] ? Object.keys(cachedData.clusters[0]) : [];
        
        const availableColumns = [...new Set([...columns, ...clusterTopLevel, ...clusterRecords])];
      
        const newMapping = new Map<string, string>();
        const usedDbCols = new Set<string>();

        availableColumns.forEach(uiCol => {
            const matchedDbCol = DB_COLUMNS.find(dbCol => 
                dbCol.toLowerCase().replace(/_/g, '') === uiCol.toLowerCase().replace(/_/g, '').replace(/\s/g, '') 
                && !usedDbCols.has(dbCol)
            );
            if (matchedDbCol) {
                newMapping.set(uiCol, matchedDbCol);
                usedDbCols.add(matchedDbCol);
            }
        });
        setDbColumnMapping(newMapping);
        toast({ title: "Auto-match Complete", description: `Automatically matched ${newMapping.size} columns.` });
    }, [columns, toast]);

    const handleAddDbMapping = () => {
        if (manualDbMapping.ui && manualDbMapping.db) {
            const newMap = new Map(dbColumnMapping);
            newMap.set(manualDbMapping.ui, manualDbMapping.db);
            setDbColumnMapping(newMap);
            setManualDbMapping({ ui: '', db: '' });
        }
    };
    
    const handleDeleteDbMapping = (key: string) => {
        const newMap = new Map(dbColumnMapping);
        newMap.delete(key);
        setDbColumnMapping(newMap);
    };

    const handleSaveToDatabase = useCallback(async (mode: 'skip' | 'replace' | 'check' = 'check') => {
        if (!selectedProjectId || !uniqueIdMapping.fileCol || !uniqueIdMapping.dbCol) {
            toast({ title: "Incomplete Setup", description: "Please select a project and map the unique ID column before saving.", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        setSaveStatus('preparing');
        setSaveProgress(10);
        
        try {
            const cachedData = await loadCachedResult();
            if (!cachedData) throw new Error("Could not load processed data from cache.");

            const enrichData = (cachedData: any): { enrichedRecords: any[] } => {
                const { rows: allRecords, clusters } = cachedData;
                if (!allRecords || !clusters) {
                    throw new Error("Invalid cache: missing rows or clusters.");
                }

                const recordToEnrichedClusterMap = new Map<string, any>();
                clusters.forEach((cluster: any) => {
                    (cluster.records || []).forEach((record: RecordRow) => {
                        recordToEnrichedClusterMap.set(record._internalId!, {
                            Generated_Cluster_ID: cluster.Generated_Cluster_ID,
                            Size: (cluster.records || []).length,
                            Flag: 'Review', // Hardcoded flag
                            Max_PairScore: cluster.Max_PairScore,
                            confidenceScore: cluster.confidenceScore,
                            reasons: (cluster.reasons || []).join(','),
                            groupDecision: cluster.groupDecision,
                            recordDecisions: cluster.recordDecisions?.[record._internalId!],
                            decisionReasons: cluster.decisionReasons?.[record._internalId!],
                        });
                    });
                });
            
                const finalEnrichedRecords = allRecords.map((record: RecordRow) => {
                    const clusterInfo = recordToEnrichedClusterMap.get(record._internalId!);
                    const scoredRecord = clusters
                        .flatMap((c: any) => c.records || [])
                        .find((r: RecordRow) => r._internalId === record._internalId);
                    
                    return {
                        ...record,
                        ...(clusterInfo || {}),
                        ...(scoredRecord || {}),
                        internalId: record._internalId,
                    };
                });
            
                return { enrichedRecords: finalEnrichedRecords };
            };

            const { enrichedRecords } = enrichData(cachedData);
            
            const recordsToProcess = enrichedRecords.map(record => {
                const newRecord: {[key: string]: any} = { project_id: selectedProjectId };

                if (record.hasOwnProperty(uniqueIdMapping.fileCol)) {
                    newRecord[uniqueIdMapping.dbCol] = record[uniqueIdMapping.fileCol];
                }

                for (const [uiCol, dbCol] of dbColumnMapping.entries()) {
                     if (record.hasOwnProperty(uiCol)) {
                        newRecord[dbCol] = record[uiCol];
                    }
                }
                
                for (const key of DB_COLUMNS) {
                    if (record[key] !== undefined && newRecord[key] === undefined) {
                        newRecord[key] = record[key];
                    }
                }

                return newRecord;
            });
            
            if (mode === 'check') {
                setSaveStatus('checking_duplicates');
                setSaveProgress(25);
                const uniqueIds = recordsToProcess.map(r => r[uniqueIdMapping.dbCol]).filter(Boolean);
                const res = await fetch('/api/bnf-assessed', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'check_duplicates', projectId: selectedProjectId, uniqueIdCol: uniqueIdMapping.dbCol, uniqueIds })
                });
                const { count } = await res.json();
                if (count > 0) {
                    setDuplicateInfo({ isOpen: true, count, records: recordsToProcess });
                } else {
                    await handleSaveToDatabase('replace'); 
                }
            } else { 
                 setDuplicateInfo({ isOpen: false, count: 0, records: [] });
                 setSaveStatus('saving');
                 setSaveProgress(50);
                 const res = await fetch('/api/bnf-assessed', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ action: 'save', projectId: selectedProjectId, records: recordsToProcess, mode, uniqueIdDbCol: uniqueIdMapping.dbCol })
                });
                 if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.error || "A server error occurred while saving.");
                 }
                 const stats = await res.json();
                 setSaveStats(stats);
                 setSaveStatus('done');
                 setSaveProgress(100);
                 toast({ title: "Save Complete!", description: `Saved ${stats.saved} records, skipped ${stats.skipped}.` });
            }

        } catch (error: any) {
            setSaveStatus('error');
            toast({ title: "Save Failed", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }

    }, [selectedProjectId, uniqueIdMapping, dbColumnMapping, toast, projects]);


  const isProcessing = workerStatus !== "idle" && workerStatus !== "done" && workerStatus !== "error";

  return (
    <div className="space-y-6">
      <Card>
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>{isTranslationLoading ? <Skeleton className="h-8 w-48" /> : t("upload.steps.1.title")}</CardTitle>
              {isTranslationLoading ? <Skeleton className="h-5 w-64 mt-2" /> : <CardDescription>{t("upload.steps.1.description")}</CardDescription>}
            </div>
            <Button variant="outline" asChild>
                <Link href="/meal-system/settings">
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
                        {file ? (<> <p className="font-semibold text-primary">{file.name}</p> <p className="text-xs text-muted-foreground"> {rawRowsRef.current.length > 0 ? `${rawRowsRef.current.length} ${t("upload.file.rowsDetected")}` : t("upload.file.reading")} </p> </>) 
                        : (<> <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">{t("upload.file.clickToUpload")}</span>{" "}{t("upload.file.orDragAndDrop")}</p> <p className="text-xs text-muted-foreground">{t("upload.file.fileTypes")}</p> </> )}
                    </div>
                    <input id="file-upload" type="file" className="hidden" onChange={handleFile} accept=".xlsx,.xls,.csv,.xlsm,.xlsb" />
                </div>
              </label>
             {file && ( <Button onClick={resetAll} variant="outline"> {t("upload.buttons.reset")} </Button> )}
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
                  {isTranslationLoading ? <Skeleton className="h-5 w-64 mt-2" /> : <CardDescription>{t("upload.steps.2.description")}</CardDescription>}
                </div>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm"> <ChevronsUpDown className="h-4 w-4" /> <span className="sr-only">Toggle</span> </Button>
                </CollapsibleTrigger>
              </div>
            </CardHeader>
            <CollapsibleContent>
              <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {MAPPING_FIELDS.map((field) => (
                  <Card key={field}>
                    <CardHeader className="p-4 flex flex-row items-center justify-between">
                        <div className="flex items-center gap-2">
                            {mapping[field as keyof Mapping] ? ( <CheckCircle className="h-5 w-5 text-green-500" /> ) : ( <XCircle className="h-5 w-5 text-red-500" /> )}
                            <Label htmlFor={String(field)} className="capitalize font-semibold text-base"> {t(`upload.mappingFields.${String(field)}`)} {REQUIRED_MAPPING_FIELDS.includes(field as any) && ( <span className="text-destructive">*</span> )} </Label>
                        </div>
                    </CardHeader>
                    <CardContent className="p-0">
                      <ScrollArea className="h-48 border-t">
                        <RadioGroup value={mapping[field as keyof Mapping]} onValueChange={(value) => handleMappingChange(field as keyof Mapping, value)} className="p-4 grid grid-cols-2 gap-2">
                          {columns.map((col) => (
                            <div key={col} className="flex items-center space-x-2">
                              <RadioGroupItem value={col} id={`${field}-${col}`} />
                              <Label htmlFor={`${field}-${col}`} className="truncate font-normal" title={col}> {col} </Label>
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
            {isTranslationLoading ? <Skeleton className="h-5 w-64 mt-2" /> : <CardDescription>{t("upload.steps.3.description")}</CardDescription>}
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex flex-wrap gap-2">
                <Button onClick={() => startClustering()} disabled={!isMappingComplete || !isDataCached || isProcessing}>
                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                    {getButtonText()}
                </Button>
              </div>
              {isProcessing && (
                <div className="space-y-2 mt-4 bg-card p-4 rounded-lg">
                  <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                    <span>{formattedStatus()}</span>
                    <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                        <Clock className="h-4 w-4" />
                        <span>{formatTime(timeInfo.elapsed)}</span>
                        {timeInfo.remaining !== undefined && ( <span className="text-xs"> (est. {formatTime(timeInfo.remaining)} left) </span> )}
                    </div>
                  </div>
                  <div className="relative h-4 w-full overflow-hidden rounded-full bg-muted">
                    <Progress value={progressInfo.progress} className="absolute h-full w-full" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-xs font-medium text-primary-foreground mix-blend-difference"> {Math.round(progressInfo.progress)}% </span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      {workerStatus === "done" && (
        <>
            <Card>
                <CardHeader>
                    <CardTitle>{isTranslationLoading ? <Skeleton className="h-8 w-48" /> : t("upload.steps.4.title")}</CardTitle>
                    {isTranslationLoading ? <Skeleton className="h-5 w-64 mt-2" /> : <CardDescription>{t("upload.steps.4.description")}</CardDescription>}
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-4">
                    <SummaryCard icon={<Users className="h-4 w-4 text-muted-foreground" />} title={t("upload.results.totalRecords")} value={rawRowsRef.current.length} />
                    <SummaryCard icon={<Group className="h-4 w-4 text-muted-foreground" />} title={t("upload.results.clusteredRecords")} value={clusters.flatMap((c) => c.records).length} />
                    <SummaryCard icon={<Unlink className="h-4 w-4 text-muted-foreground" />} title={t("upload.results.unclusteredRecords")} value={rawRowsRef.current.length - clusters.flatMap((c) => c.records).length} />
                    <SummaryCard icon={<BoxSelect className="h-4 w-4 text-muted-foreground" />} title={t("upload.results.clusterCount")} value={clusters.length} />
                    <SummaryCard icon={<Sigma className="h-4 w-4 text-muted-foreground" />} title={t("upload.results.avgClusterSize")} value={clusters.length > 0 ? (clusters.flatMap((c) => c.records).length / clusters.length).toFixed(2) : 0} />
                    </div>
                    <div className="flex gap-2">
                    <Button onClick={() => router.push("/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/review")} disabled={!clusters.length}>
                        {t("upload.buttons.goToReview")} <ChevronRight className="ml-2 h-4 w-4" />
                    </Button>
                    <Button onClick={() => router.push("/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/correction")} disabled={!clusters.length}>
                        <Wrench className="mr-2 h-4 w-4" /> Go to Data Correction
                    </Button>
                    </div>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>5. Save to Database</CardTitle>
                    <CardDescription>Map columns from your uploaded file to the `bnf-assessed.db` database and save the data.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                    <div className="space-y-2">
                        <Label>Select Project</Label>
                        <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loadingProjects}>
                            <SelectTrigger className="w-full md:w-1/2">
                                <SelectValue placeholder={loadingProjects ? "Loading..." : "Select a project to save data to"} />
                            </SelectTrigger>
                            <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>

                    <Card>
                        <CardHeader>
                            <div className="flex justify-between items-center">
                                <div>
                                    <CardTitle className="text-lg">Column Mapping</CardTitle>
                                    <CardDescription>Match source columns to database fields. A unique ID is required.</CardDescription>
                                </div>
                                <Button onClick={handleAutoMatch}><GitCompareArrows className="mr-2 h-4 w-4"/>Auto-match</Button>
                            </div>
                        </CardHeader>
                        <CardContent className="space-y-4">
                             <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-lg bg-muted/50">
                                <div className="space-y-2">
                                    <Label className="font-semibold">Unique ID (from File)</Label>
                                    <Select value={uniqueIdMapping.fileCol} onValueChange={v => setUniqueIdMapping(p => ({...p, fileCol: v}))}>
                                        <SelectTrigger><SelectValue placeholder="Select file column..." /></SelectTrigger>
                                        <SelectContent>{columns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                                 <div className="space-y-2">
                                    <Label className="font-semibold">Unique ID (in Database)</Label>
                                    <Select value={uniqueIdMapping.dbCol} onValueChange={v => setUniqueIdMapping(p => ({...p, dbCol: v}))}>
                                        <SelectTrigger><SelectValue placeholder="Select DB column..." /></SelectTrigger>
                                        <SelectContent>{DB_COLUMNS.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</SelectContent>
                                    </Select>
                                </div>
                             </div>
                             <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                                <div className="space-y-2">
                                    <Label>Other Columns (from File)</Label>
                                    <Select value={manualDbMapping.ui} onValueChange={v => setManualDbMapping(m => ({ ...m, ui: v}))}>
                                        <SelectTrigger><SelectValue placeholder="Select source..." /></SelectTrigger>
                                        <SelectContent><ScrollArea className="h-60">{unmappedUiColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</ScrollArea></SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label>Other Columns (in Database)</Label>
                                     <Select value={manualDbMapping.db} onValueChange={v => setManualDbMapping(m => ({ ...m, db: v}))}>
                                        <SelectTrigger><SelectValue placeholder="Select destination..." /></SelectTrigger>
                                        <SelectContent><ScrollArea className="h-60">{unmappedDbColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</ScrollArea></SelectContent>
                                    </Select>
                                </div>
                                <Button onClick={handleAddDbMapping}>Add Mapping</Button>
                            </div>
                            <div>
                                <h4 className="font-semibold mb-2">Current Mappings</h4>
                                <ScrollArea className="h-40 border rounded-md">
                                    <Table>
                                        <TableHeader><TableRow><TableHead>File Column</TableHead><TableHead>Database Field</TableHead><TableHead className="text-right">Action</TableHead></TableRow></TableHeader>
                                        <TableBody>
                                            {uniqueIdMapping.fileCol && <TableRow className="bg-blue-50 dark:bg-blue-900/20"><TableCell className="font-bold">{uniqueIdMapping.fileCol}</TableCell><TableCell className="font-bold">{uniqueIdMapping.dbCol}</TableCell><TableCell></TableCell></TableRow>}
                                            {Array.from(dbColumnMapping.entries()).map(([ui, db]) => <TableRow key={ui}><TableCell>{ui}</TableCell><TableCell>{db}</TableCell><TableCell className="text-right"><Button variant="ghost" size="icon" onClick={()=>handleDeleteDbMapping(ui)}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>)}
                                        </TableBody>
                                    </Table>
                                </ScrollArea>
                            </div>
                        </CardContent>
                    </Card>

                    <div className="flex flex-col items-center gap-4">
                        <Button onClick={() => handleSaveToDatabase('check')} disabled={!isDbMappingReady || isSaving} size="lg">
                            {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <ArrowUp className="mr-2 h-4 w-4"/>}
                            Save to bnf-assessed.db
                        </Button>
                        {isSaving && <div className="w-full"><Progress value={saveProgress} /><p className="text-sm text-center mt-1 text-muted-foreground">{saveStatus}</p></div>}
                    </div>
                     {saveStatus === 'done' && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                            <SummaryCard icon={<Database />} title="Total Records in File" value={saveStats.total} />
                            <SummaryCard icon={<SaveIcon />} title="Records Saved/Replaced" value={saveStats.saved} />
                            <SummaryCard icon={<ChevronRight />} title="Records Skipped" value={saveStats.skipped} />
                        </div>
                    )}
                </CardContent>
            </Card>
        </>
      )}

      <AlertDialog open={duplicateInfo.isOpen} onOpenChange={(isOpen) => setDuplicateInfo(prev => ({...prev, isOpen}))}>
          <AlertDialogContent>
              <AlertDialogHeader>
                  <AlertDialogTitle>Existing Records Found</AlertDialogTitle>
                  <AlertDialogDescription>Found {duplicateInfo.count} records in the database for this project that match the unique ID you selected. How would you like to proceed?</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                  <AlertDialogCancel onClick={() => setIsSaving(false)}>Cancel</AlertDialogCancel>
                  <Button variant="outline" onClick={() => handleSaveToDatabase('skip')}>Skip Existing ({duplicateInfo.count})</Button>
                  <AlertDialogAction onClick={() => handleSaveToDatabase('replace')}>Replace Project Data</AlertDialogAction>
              </AlertDialogFooter>
          </AlertDialogContent>
      </AlertDialog>

    </div>
  );
}

