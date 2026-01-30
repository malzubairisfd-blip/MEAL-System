// src/app/upload/page.tsx
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
                                      Database,
                                      Save,
                                      GitCompareArrows,
                                      Trash2,
                                      Plus,
                                      FileDown
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
import type { RecordRow } from "@/lib/types";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Input } from "@/components/ui/input";

// --- Types ---
interface Project {
  projectId: string;
  projectName: string;
}

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
const CHUNK_SIZE = 5000;

type WorkerProgress = {
  status: string;
    progress: number;
      completed?: number;
        total?: number;
        };

type TimeInfo = { elapsed: number; remaining?: number };

const DB_COLUMNS = [
    "id", "project_id", "project_name", "Generated_Cluster_ID", "Size", "Flag", "Max_PairScore", 
    "pairScore", "nameScore", "husbandScore", "childrenScore", "idScore", "phoneScore", 
    "locationScore", "groupDecision", "recordDecision", "decisionReason", "s", "cluster_id", 
    "dup_cluster_id2", "eq_clusters", "dup_flag2", "new_dup_flag1", "dup_flag", "cluster_size", 
    "dup_cluster_size", "match_probability", "match_weight", "l_id", "l_benef_name", "l_hsbnd_name", 
    "l_child_list", "l_phone_no", "l_id_card_no", "l_age_years", "l_mud_id", "gv_bnf_name", 
    "gv_hsbnd_name", "gv_bnf_hsbnd_name", "gv_n_child_list", "gv_id_card_no", "gv_phone_no", 
    "gv_age_years", "r_id", "r_benef_name", "r_husband_name", "r_child_list", "r_phone_no", 
    "r_id_card_no", "r_age_years", "r_mud_id", "lr_eq_mud", "lr_eq_phone", "lr_age_diff", 
    "lr_benef_name_jw_sim", "lr_husband_name_jw_sim", "lr_benef_name_jaccard", 
    "lr_husband_name_jaccard", "lr_id_card_dist", "lr_child_jaccard", "dup_cluster_size_2", 
    "dup_cluster_id", "dup_cluster_flag", "record_id", "benef_name", "husband_name", 
    "child_list_str", "phone_no", "bnf_id_card_no", "age_years", "gov_name", "mud_name", 
    "hh_ozla_name", "hh_vill_name", "dup_cluster_score", "hh_uuid_dup_cnt", "hh_uuid_rn", 
    "hh_team_name", "hh_srvyr_name", "hh_srvyr_phone_no", "hh_mahlah", "hh_address", 
    "hh_name", "hh_gender", "hh_is_swf", "hh_is_dislocated", "hh_is_dislocated_guest", 
    "child_cnt", "child_m_cnt", "child_f_cnt", "bnf_id", "srvy_hh_id", "bnf_idx", "id_card_type", 
    "bnf_relation", "bnf_relation_label", "bnf_relation_code", "n_child_list_str", "hh_deviceid", 
    "hh_vill_id", "gov_no", "mud_no", "hh_ozla_no", "hh_srvyr_id", "hh_srvyr_team_id", 
    "paper_form_date", "paper_form_no", "hh_qual_women_cnt", "bnf_child_cnt", "bnf_child_m_cnt", 
    "bnf_child_f_cnt", "bnf_social_status", "bnf_qual_status", "bnf_qual_status_desc", 
    "bnf_qual_is_preg", "bnf_qual_is_mother5", "bnf_qual_is_mother_handicaped", 
    "bnf_is_handicaped", "bnf_is_dislocated", "hh_phone_no", "bnf_phone_no", "hh_is_new_instance", 
    "hh_uuid", "hh_submission_time", "hh_submitted_by", "n_hh_name", "child_list2", 
    "child_list_long", "bnf_1name", "bnf_2name", "bnf_3name", "bnf_4name", "bnf_5name", 
    "hsbnd_1name", "hsbnd_2name", "hsbnd_3name", "hsbnd_4name", "hsbnd_5name", "proj_no", 
    "id_card_no", "loc_id", "status", "notes", "flag_2", "cluster_min_score", "cluster_max_score", 
    "cluster_score", "bnf_relations", "hsbnd_relations", "common_child", "common_child_cnt", 
    "relation_score", "same_mud", "same_proj", "office_no", "ser", "benef_id", "is_active", 
    "benef_class_desc", "term_reason", "is_dup_cluster", "dup_woman_id", "dup_benef_id", 
    "reg_form_date", "old_bnf_name", "old_hsbnd_name", "curr_benef_name", "curr_husband_name", 
    "calc_bnf_1name", "calc_bnf_2name", "calc_bnf_3name", "calc_bnf_4name", "calc_bnf_5name", 
    "calc_hsbnd_1name", "calc_hsbnd_2name", "calc_hsbnd_3name", "calc_hsbnd_4name", "calc_hsbnd_5name", 
    "cbnf_name", "chsbnd_name", "n_child_list", "b_1name", "b_2name", "b_3name", "b_4name", 
    "b_5name", "h_1name", "h_2name", "h_3name", "h_4name", "h_5name", "child_list", "bnf_name_2", 
    "hsbnd_name_2", "bnf_name2", "bnf_name2b", "bnf_name2c", "bnf_name3", "bnf_name3b", "bnf_name3c", 
    "bnf_name3d", "bnf_name4", "bnf_name4c", "bnf_name4b", "bnf_f_name4", "bnf_f_name3", 
    "bnf_f_name3c", "hsbnd_name2", "hsbnd_name2b", "hsbnd_name2c", "hsbnd_name3", "hsbnd_name3b", 
    "hsbnd_name3c", "hsbnd_name3d", "hsbnd_name4", "hsbnd_name4c", "hsbnd_name4b", "hsbnd_f_name4", 
    "hsbnd_f_name3", "hsbnd_f_name3c", "bnf_name_list", "hsbnd_name_list", "dup_cluster_id2_2", 
    "c_max_weight", "c_min_weight", "c_id_max_weight", "c_id_min_weight", "c_max_pct", "c_min_pct", 
    "c_id_max_pct", "c_id_min_pct", "c_min_proj", "c_max_proj", "c_proj2_cnt", "c_mud2_cnt", 
    "c_id_min_proj", "c_id_max_proj", "c_id_proj2_cnt", "c_id_mud2_cnt",
    'womanName',
    'husbandName',
    'nationalId',
    'phone',
    'village',
    'subdistrict',
    'children',
    'beneficiaryId',
    'avgPairScore',
    'avgFirstNameScore',
    'avgFamilyNameScore',
    'avgAdvancedNameScore',
    'avgTokenReorderScore',
    'reasons',
    'confidenceScore',
    'avgWomanNameScore',
    'avgHusbandNameScore',
    'avgFinalScore',
    "pre_classified_result", "group_analysis", "womanName_normalized", "husbandName_normalized", "children_normalized", 
    "subdistrict_normalized", "village_normalized", "parts", "husbandParts", "ED_NO", "ED_ID", "EC_ID", 
    "PC_ID", "ED_NAME", "EC_NAME", "PC_NAME", "SRVY_HH_ID_2", "CANDID_SER_NO", "WOMAN_ID", 
    "source_ID_2", "BENEF_ID_2", "BENEF_NO", "HH_NAME_2", "BNF_RELATION_2", "BENEF_NAME_3", 
    "HUSBAND_NAME_3", "IS_ACTIVE_2", "STATUS_2", "QUAL_STATUS", "STATUS_DESC", "QUAL_STATUS_DESC", 
    "VERIFY_STATUS", "VERIFY_NOTES", "VERIFY_REASON", "VERIFY_DATE", "REG_STATUS", "REG_FORM_DATE_2", 
    "REG_NOTES", "TOTAL_CHILD_COUNT", "MALE_CHILD_COUNT", "FEMALE_CHILD_COUNT", "LOC_ID_2", 
    "LOC_NAME", "ID_CARD_TYPE_2", "ID_CARD_TYPE_DESC", "ID_CARD_NO_2", "AGE_YEARS_2", "ADDRESS", 
    "PHONE_NO_2", "IS_TERMINATED", "TERM_DATE", "TERM_REASON_2", "TERM_NOTES", "NOTES_2", 
    "PC_FAC_ID", "EC_FAC_ID", "BENEF_CLASS", "BENEF_CLASS_DESC_2", "OLD_BNF_NAME_2", 
    "OLD_HSBND_NAME_2", "OLD_PHONE_NO", "OLD_ID_CARD_NO", "enrollment_modification_type", 
    "eligible_woman_modify_type", "eligible_woman_name_correction", 
    "eligible_woman_phone_correction", "eligible_woman_ID_correction", 
    "eligible_woman_husband_name_correction", "pregnancy_month", 
    "educational_level_of_the_targeted_woman", "new_bnf_name", 
    "the_corrected_part_of_the_targets_name", 
    "corrected_part_of_the_targets_namefirst_name", 
    "the_corrected_part_of_the_targets_namefathers_name", 
    "the_corrected_part_of_the_targets_namegrandfathers_name", 
    "corrected_part_of_the_targets_namefourth_name", "corrected_part_of_the_targets_nametitle", 
    "correcting_the_first_name", "correcting_the_fathers_name", 
    "correcting_the_grandfathers_name", "correcting_the_fourth_name", "correcting_the_title", 
    "bnf_1name_flag", "bnf_2name_flag", "bnf_3name_flag", "bnf_4name_flag", "bnf_5name_flag", 
    "bnf_1name_is_valid", "bnf_2name_is_valid", "bnf_3name_is_valid", "bnf_4name_is_valid", 
    "bnf_5name_is_valid", "bnf_1name_valid_note", "bnf_2name_valid_note", "bnf_3name_valid_note", 
    "bnf_4name_valid_note", "bnf_5name_valid_note", 
    "reference_under_which_the_name_was_corrected", 
    "reference_under_which_the_namepersonal_ID_card_correction_was_made", 
    "reference_under_which_the_namefamily_card_correction_was_made", 
    "reference_under_which_the_namepassport_correction_was_made", 
    "reference_under_which_the_name_correctionmarriage_contract_was_made", 
    "reference_under_which_the_nameelectoral_card_correction_was_made", 
    "reference_under_which_the_name_correctionquestionnaire_was_made", 
    "reference_used_to_correct_the_nameaccording_to_the_womans_statement", 
    "reference_under_which_the_nameseat_number_was_corrected", 
    "reference_under_which_the_name_correction_was_madeother_mentioned", 
    "another_reference_under_which_the_name_was_modified", 
    "the_corrected_part_of_the_husbands_name", "corrected_part_of_husbands_namefirst_name", 
    "corrected_part_of_husbands_namefathers_name", 
    "the_corrected_part_of_the_husbands_namegrandfathers_name", 
    "corrected_part_of_husbands_namefourth_name", "corrected_part_of_husbands_namesurname", 
    "new_hsbnd_name", "correcting_the_first_name_6", "correcting_the_fathers_name_8", 
    "correcting_the_grandfathers_name_10", "correcting_the_fourth_name_12", 
    "title_correction_14", "hsbnd_1name_flag", "hsbnd_2name_flag", "hsbnd_3name_flag", 
    "hsbnd_4name_flag", "hsbnd_5name_flag", "hsbnd_1name_is_valid", "hsbnd_2name_is_valid", 
    "hsbnd_3name_is_valid", "hsbnd_4name_is_valid", "hsbnd_5name_is_valid", "hsbnd_1name_valid_note", 
    "hsbnd_2name_valid_note", "hsbnd_3name_valid_note", 
    "hsbnd_4name_valid_note", "hsbnd_5name_valid_note", 
    "reference_under_which_the_name_was_corrected_16", 
    "reference_under_which_the_namepersonal_ID_card_correction_was_made_17", 
    "reference_under_which_the_namefamily_card_correction_was_made_18", 
    "reference_under_which_the_namepassport_correction_was_made_19", 
    "reference_under_which_the_name_correction_was_mademarriage_contract_20", 
    "reference_under_which_the_name_correction_was_madeelectoral_card_21", 
    "reference_under_which_the_name_correction_was_madeQuestionnaire_22", 
    "reference_used_to_correct_the_nameaccording_to_what_the_woman_stated23", 
    "reference_under_which_the_nameseat_number_was_corrected_24", 
    "reference_under_which_the_name_correction_was_madeother_mentions_25", 
    "another_reference_under_which_the_name_was_modified26", "telephone_number", 
    "ID_card_type_3", "other_determines", "ID_card_number", "day_of_signing_the_form", 
    "month", "the_reason_for_not_joining_the_project_is_stated", "other_things_to_mention", 
    "do_you_want_to_repackage_the_beneficiary_for_another_educator", 
    "please_select_the_alternative_educator", "the_name_of_the_new_intellectual", "comments",
    "internalId"
];

// --- Components ---
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

const enrichRecordsWithClusterData = (data: any) => {
    if (!data || !data.rows || !data.clusters) {
        return [];
    }
    const { rows: allRecords, clusters } = data;
    const enrichedRecordData = new Map<string, any>();

    clusters.forEach((cluster: any) => {
        (cluster.records || []).forEach((record: any) => {
            if (record._internalId) {
                enrichedRecordData.set(record._internalId, { ...cluster, ...record });
            }
        });
    });

    return allRecords.map((originalRecord: any) => {
        const enrichedData = enrichedRecordData.get(originalRecord._internalId);
        if (enrichedData) {
            return { ...originalRecord, ...enrichedData };
        }
        return originalRecord;
    });
};

export default function UploadPage() {
    const { t, isLoading: isTranslationLoading } = useTranslation();
    const { toast } = useToast();
    const router = useRouter();

    // --- State for Upload & Clustering ---
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

    // --- State for DB Upload Section ---
    const [projects, setProjects] = useState<Project[]>([]);
    const [selectedProject, setSelectedProject] = useState<Project | null>(null);
    const [loadingDbSection, setLoadingDbSection] = useState({ projects: true, cache: false, saving: false });
    const [dbUploadUiColumns, setDbUploadUiColumns] = useState<string[]>([]);
    const [columnMappingForDb, setColumnMappingForDb] = useState<Map<string, string>>(new Map());
    const [manualMappingForDb, setManualMappingForDb] = useState({ ui: '', db: '' });
    const [saveProgress, setSaveProgress] = useState(0);
    const [duplicateDialog, setDuplicateDialog] = useState({ isOpen: false, duplicates: [], nonDuplicates: [] });
    const [saveStats, setSaveStats] = useState({ saved: 0, skipped: 0, total: 0 });

    // --- Refs ---
    const rawRowsRef = useRef<any[]>([]);
    const clusterWorkerRef = useRef<Worker | null>(null);
    const scoringWorkerRef = useRef<Worker | null>(null);
    const timerRef = useRef<NodeJS.Timeout | null>(null);
    const startTimeRef = useRef<number | null>(null);
    const notifiedAboutSaveRef = useRef(false);
    const progressInfoRef = useRef(progressInfo);
    progressInfoRef.current = progressInfo;
    const selectedProjectRef = useRef<Project | null>(null);


    // --- Memos ---
    const isMappingComplete = useMemo(() => REQUIRED_MAPPING_FIELDS.every((field) => Boolean(mapping[field])), [mapping]);
    const isDbMappingComplete = useMemo(() => dbUploadUiColumns.length > 0 && dbUploadUiColumns.every(col => columnMappingForDb.has(col)), [dbUploadUiColumns, columnMappingForDb]);
    const unmappedUiColumnsForDb = useMemo(() => dbUploadUiColumns.filter(col => !columnMappingForDb.has(col)), [dbUploadUiColumns, columnMappingForDb]);
    const unmappedDbColumns = useMemo(() => {
        const mappedDbCols = new Set(columnMappingForDb.values());
        return DB_COLUMNS.filter(col => !mappedDbCols.has(col));
    }, [columnMappingForDb]);


    // --- Callbacks & Effects ---
    const resetAll = useCallback(() => {
        setFile(null); setColumns([]); rawRowsRef.current = []; setClusters([]); setWorkerStatus("idle");
        setProgressInfo({ status: "idle", progress: 0 }); setFileReadProgress(0); setTimeInfo({ elapsed: 0 });
        setIsDataCached(false); notifiedAboutSaveRef.current = false;
        if (timerRef.current) clearInterval(timerRef.current);
        // Reset DB section state
        setSelectedProject(null); setDbUploadUiColumns([]); setColumnMappingForDb(new Map()); setSaveStats({ saved: 0, skipped: 0, total: 0 });
    }, []);

    // --- Worker Initialization & Communication ---
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
            if (msg.type === 'rules_loaded') { toast({ title: "Auto-Rules Imported", description: `Successfully imported ${msg.count} rules.` }); setWorkerStatus('rules_loaded'); setProgressInfo(prev => ({ ...prev, status: 'rules_loaded' })); return; }
            if (msg.type === "done") {
                const rawClusters = msg.payload?.clusters ?? [];
                toast({ title: "Calculating Scores", description: "Clustering complete. Now calculating detailed similarity scores." });
                setWorkerStatus("calculating_scores"); setProgressInfo({ status: "calculating_scores", progress: 96 });
                scoringWorker.postMessage({ rawClusters });
                return;
            }
            if (msg.type === "error") { setWorkerStatus("error"); toast({ title: t("upload.toasts.workerError.title"), description: msg.error, variant: "destructive" }); }
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
                        await cacheFinalResult({ ...currentData, clusters: enrichedClusters, rows: currentData?.rows ?? rawRowsRef.current, originalHeaders: currentData?.originalHeaders ?? columns });
                        setWorkerStatus("done"); setProgressInfo({ status: "done", progress: 100 });
                        toast({ title: t("upload.toasts.clusteringComplete.title"), description: t("upload.toasts.clusteringComplete.description", { count: enrichedClusters.length, }) });
                    } catch (error: any) {
                        setWorkerStatus("error"); toast({ title: t("upload.toasts.cacheError.title"), description: String(error), variant: "destructive" });
                    }
                })();
                return;
            }
            if (msg.type === "error") { setWorkerStatus("error"); toast({ title: "Scoring Worker Error", description: msg.error, variant: "destructive" }); }
        };

        clusterWorker.onmessage = (ev) => handleClusterMessage(ev.data);
        scoringWorker.onmessage = (ev) => handleScoringMessage(ev.data);

        return () => {
            clusterWorker.terminate(); scoringWorker.terminate(); cleanupWakeLock();
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [t, toast, columns]);

    useEffect(() => {
        if (isMappingComplete && columns.length) {
            const key = `${LOCAL_STORAGE_KEY_PREFIX}${columns.join(",")}`;
            localStorage.setItem(key, JSON.stringify(mapping));
            if (!notifiedAboutSaveRef.current) {
                toast({ title: "Mapping Saved", description: "Your column mapping has been saved locally for this file structure." });
                notifiedAboutSaveRef.current = true;
            }
        }
    }, [columns, isMappingComplete, mapping, toast]);

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

    // --- DB Upload Section Logic ---
    useEffect(() => {
        const fetchProjects = async () => {
            setLoadingDbSection(prev => ({ ...prev, projects: true }));
            try {
                const res = await fetch('/api/projects');
                if (!res.ok) throw new Error("Failed to load projects.");
                setProjects(await res.json());
            } catch (error: any) {
                toast({ title: "Error", description: error.message, variant: "destructive" });
            } finally {
                setLoadingDbSection(prev => ({ ...prev, projects: false }));
            }
        };
        fetchProjects();
    }, [toast]);
    
    // Load cache data when DB section becomes active
    useEffect(() => {
        if (workerStatus !== 'done') return;

        const loadDataForDbUpload = async () => {
            setLoadingDbSection(prev => ({ ...prev, cache: true }));
            try {
                const result = await loadCachedResult();
                if (!result) {
                    toast({ title: "No Data", description: "No cached data found. Please run the clustering process first.", variant: "destructive" });
                    return;
                }
                const headers = new Set<string>(result.originalHeaders || []);
                result.clusters?.[0]?.records?.[0] && Object.keys(result.clusters[0].records[0]).forEach(key => { if (!key.startsWith('_')) headers.add(key); });
                result.clusters?.[0] && Object.keys(result.clusters[0]).forEach(key => { if (key !== 'records' && key !== 'pairScores') headers.add(key); });
                setDbUploadUiColumns(Array.from(headers));
            } catch (error: any) {
                toast({ title: "Error loading cache", description: error.message, variant: "destructive" });
            } finally {
                setLoadingDbSection(prev => ({ ...prev, cache: false }));
            }
        };
        loadDataForDbUpload();
    }, [workerStatus, toast]);


    // --- Handlers ---
    const handleFile = useCallback(async (event: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = event.target.files?.[0];
        if (!selectedFile) return;
        resetAll(); setFile(selectedFile); setIsMappingOpen(true);
        const reader = new FileReader();
        reader.onprogress = (e) => { if (e.lengthComputable) setFileReadProgress((e.loaded / e.total) * 100); };
        reader.onload = async (e) => {
            try {
                const buffer = e.target?.result; const wb = XLSX.read(buffer, { type: "array", cellDates: true });
                const sheet = wb.Sheets[wb.SheetNames[0]]; const json = XLSX.utils.sheet_to_json<any>(sheet, { defval: "" });
                const detectedColumns = Object.keys(json[0] || {});
                const rowsWithId = json.map((row, index) => ({ ...row, _internalId: `row_${Date.now()}_${index}` }));
                rawRowsRef.current = rowsWithId;
                await cacheRawData({ rows: rowsWithId, originalHeaders: detectedColumns });
                setIsDataCached(true);
                const storageKey = `${LOCAL_STORAGE_KEY_PREFIX}${detectedColumns.join(",")}`;
                const saved = localStorage.getItem(storageKey);
                if (saved) {
                    try {
                        setMapping(JSON.parse(saved));
                        toast({ title: "Mapping Loaded", description: "Loaded saved column mapping from your last session." });
                        notifiedAboutSaveRef.current = true;
                    } catch {}
                }
                setColumns(detectedColumns); setFileReadProgress(100);
            } catch (error: any) {
                toast({ title: "Error processing file", description: error.message, variant: "destructive" });
                resetAll();
            }
        };
        reader.readAsArrayBuffer(selectedFile);
    }, [resetAll, toast]);

    const handleMappingChange = useCallback((field: keyof Mapping, value: string) => { setMapping((prev) => ({ ...prev, [field]: value })); }, []);

    const fetchSettingsAndRules = useCallback(async () => {
        try {
            const [settingsRes, rulesRes] = await Promise.all([fetch("/api/settings"), fetch("/api/rules", { cache: 'no-store' })]);
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
        if (!isMappingComplete) { toast({ title: t("upload.toasts.mappingIncomplete"), variant: "destructive" }); return; }
        setIsMappingOpen(false); setWorkerStatus("processing"); setProgressInfo({ status: "processing", progress: 1 });
        setTimeInfo({ elapsed: 0 }); startTimeRef.current = Date.now();
        const { settings, autoRules } = await fetchSettingsAndRules();
        clusterWorkerRef.current.postMessage({ type: "start", payload: { mapping, options: settings, autoRules } });
        const totalRows = rawRowsRef.current.length;
        for (let i = 0; i < totalRows; i += CHUNK_SIZE) {
            const chunk = rawRowsRef.current.slice(i, i + CHUNK_SIZE);
            clusterWorkerRef.current.postMessage({ type: "data", payload: { rows: chunk, total: totalRows } });
            await new Promise((resolve) => setTimeout(resolve, 5));
        }
        clusterWorkerRef.current.postMessage({ type: "end" });
    }, [fetchSettingsAndRules, isMappingComplete, mapping, t, toast]);

    const formatTime = useCallback((seconds: number) => {
        const h = Math.floor(seconds / 3600); const m = Math.floor((seconds % 3600) / 60);
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
            case "building-edges": case "merging-edges": case "annotating": case "calculating_scores":
            case "rules_loaded": return t("upload.buttons.processing");
            case "caching": return t("upload.buttons.caching");
            case "done": return t("upload.buttons.done");
            case "error": return t("upload.buttons.error");
            default: return t("upload.buttons.idle");
        }
    }, [isTranslationLoading, t, workerStatus]);

    // --- DB Upload Handlers ---
    const handleProjectSelect = (projectId: string) => {
        const project = projects.find(p => p.projectId === projectId) || null;
        setSelectedProject(project);
        selectedProjectRef.current = project;
    };
    
    const handleAutoMatch = () => {
        const newMapping = new Map<string, string>();
        const usedDbCols = new Set<string>();
        dbUploadUiColumns.forEach(uiCol => {
            const matchedDbCol = DB_COLUMNS.find(dbCol => dbCol.toLowerCase() === uiCol.toLowerCase() && !usedDbCols.has(dbCol));
            if (matchedDbCol) { newMapping.set(uiCol, matchedDbCol); usedDbCols.add(matchedDbCol); }
        });
        setColumnMappingForDb(newMapping);
        toast({ title: "Auto-match Complete", description: `${newMapping.size} columns were automatically mapped.` });
    };

    const handleAddManualMapping = () => {
        if (!manualMappingForDb.ui || !manualMappingForDb.db) { toast({ title: "Incomplete Selection", description: "Please select both a source and a destination column.", variant: "destructive" }); return; }
        const newMapping = new Map(columnMappingForDb);
        newMapping.set(manualMappingForDb.ui, manualMappingForDb.db);
        setColumnMappingForDb(newMapping);
        setManualMappingForDb({ ui: '', db: '' });
    };
    
    const executeSave = useCallback(async (recordsToSave: any[], isOverwrite: boolean) => {
        const project = selectedProjectRef.current;
        if (!project) {
            toast({ title: "Save Aborted", description: "Project selection was lost. Please re-select the project.", variant: "destructive" });
            return;
        }
        setLoadingDbSection(p => ({ ...p, saving: true }));
        setSaveProgress(0);
        
        const totalToProcess = rawRowsRef.current.length;
        setSaveStats({ saved: 0, skipped: 0, total: totalToProcess });

        try {
            const dataToSave = recordsToSave.map((row: any) => {
                const newRecord: any = {};
                for (const [uiCol, dbCol] of columnMappingForDb.entries()) {
                    if (row[uiCol] !== undefined) {
                        newRecord[dbCol] = Array.isArray(row[uiCol]) ? row[uiCol].join(', ') : row[uiCol];
                    }
                }
                newRecord.internalId = row._internalId;
                return newRecord;
            });

            const CHUNK_SIZE = 100;
            const totalToSave = dataToSave.length;
            if (totalToSave === 0) {
                toast({ title: "No Records to Save", description: "All records were skipped." });
                setSaveStats({ saved: 0, skipped: totalToProcess, total: totalToProcess });
                setLoadingDbSection(p => ({ ...p, saving: false }));
                return;
            }

            for (let i = 0; i < totalToSave; i += CHUNK_SIZE) {
                const chunk = dataToSave.slice(i, i + CHUNK_SIZE);
                const isFirstChunk = i === 0;
                const url = isFirstChunk && isOverwrite ? '/api/bnf-assessed?init=true' : '/api/bnf-assessed';

                const res = await fetch(url, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        projectId: project.projectId,
                        projectName: project.projectName,
                        results: chunk,
                    }),
                });

                if (!res.ok) {
                    const errorData = await res.json();
                    throw new Error(errorData.details || "A server error occurred while saving.");
                }
                setSaveProgress(Math.round(((i + chunk.length) / totalToSave) * 100));
            }

            toast({ title: "Save Successful", description: `${totalToSave} records saved for ${project.projectName}.` });
            setSaveProgress(100);
            setSaveStats({ saved: totalToSave, skipped: totalToProcess - totalToSave, total: totalToProcess });
        } catch (error: any) {
            toast({ title: "Save Failed", description: error.message, variant: "destructive" });
        } finally {
            setLoadingDbSection(p => ({ ...p, saving: false }));
        }
    }, [toast, columnMappingForDb]);

    const handleSaveToDatabase = useCallback(async () => {
        const project = selectedProjectRef.current;
        if (!project || !isDbMappingComplete) {
            toast({ title: "Incomplete Selection", description: "Please select a project and ensure all columns are mapped.", variant: "destructive" });
            return;
        }
        setLoadingDbSection(p => ({ ...p, saving: true }));
        setSaveProgress(0);
        setSaveStats({ saved: 0, skipped: 0, total: 0 });

        try {
            const cachedResult = await loadCachedResult();
            if (!cachedResult) throw new Error("Cached data is missing.");

            const enrichedAllRecords = enrichRecordsWithClusterData(cachedResult);
            const existingRes = await fetch('/api/bnf-assessed');
            if (!existingRes.ok) throw new Error("Could not check existing records.");
            
            const existingRecords = await existingRes.json();
            const uiBeneficiaryIdColumn = 'beneficiaryId';
            const mappedUiColumn = [...columnMappingForDb.entries()].find(([uiCol, dbCol]) => dbCol === uiBeneficiaryIdColumn)?.[0];
            
            if (!mappedUiColumn) {
                await executeSave(enrichedAllRecords, true);
                return;
            }

            const existingBeneficiaryIds = new Set(existingRecords.map((r: any) => String(r[uiBeneficiaryIdColumn])));
            const duplicates = enrichedAllRecords.filter((row: any) => existingBeneficiaryIds.has(String(row[mappedUiColumn])));
            const nonDuplicates = enrichedAllRecords.filter((row: any) => !existingBeneficiaryIds.has(String(row[mappedUiColumn])));

            if (duplicates.length > 0) {
                setDuplicateDialog({ isOpen: true, duplicates, nonDuplicates });
                setLoadingDbSection(p => ({ ...p, saving: false }));
            } else {
                await executeSave(enrichedAllRecords, true);
            }
        } catch (error: any) {
            toast({ title: "Validation Failed", description: error.message, variant: "destructive" });
            setLoadingDbSection(p => ({ ...p, saving: false }));
        }
    }, [isDbMappingComplete, toast, executeSave, columnMappingForDb]);

    const isProcessing = workerStatus !== "idle" && workerStatus !== "done" && workerStatus !== "error";

    return (
        <div className="space-y-6">
            {/* Step 1: Upload */}
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
                                                <span className="font-semibold">{t("upload.file.clickToUpload")}</span>{" "}{t("upload.file.orDragAndDrop")}
                                            </p>
                                            <p className="text-xs text-muted-foreground">{t("upload.file.fileTypes")}</p>
                                        </>
                                    )}
                                </div>
                                <input id="file-upload" type="file" className="hidden" onChange={handleFile} accept=".xlsx,.xls,.csv,.xlsm,.xlsb" />
                            </div>
                        </label>
                        {file && (
                            <Button onClick={resetAll} variant="outline">{t("upload.buttons.reset")}</Button>
                        )}
                    </div>
                    {file && fileReadProgress > 0 && fileReadProgress < 100 && (
                        <div className="mt-4">
                            <Label>{t("upload.file.reading")}</Label>
                            <Progress value={fileReadProgress} />
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Step 2: Mapping */}
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
                                    <Button variant="ghost" size="sm">
                                        <ChevronsUpDown className="h-4 w-4" />
                                        <span className="sr-only">Toggle</span>
                                    </Button>
                                </CollapsibleTrigger>
                            </div>
                        </CardHeader>
                        <CollapsibleContent>
                            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {MAPPING_FIELDS.map((field) => (
                                    <Card key={field}>
                                        <CardHeader className="p-4 flex flex-row items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                {mapping[field as keyof Mapping] ? (
                                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                                ) : (
                                                    <XCircle className="h-5 w-5 text-red-500" />
                                                )}
                                                <Label htmlFor={String(field)} className="capitalize font-semibold text-base">
                                                    {t(`upload.mappingFields.${String(field)}`)}
                                                    {REQUIRED_MAPPING_FIELDS.includes(field as any) && (
                                                        <span className="text-destructive">*</span>
                                                    )}
                                                </Label>
                                            </div>
                                        </CardHeader>
                                        <CardContent className="p-0">
                                            <ScrollArea className="h-48 border-t">
                                                <RadioGroup
                                                    value={mapping[field as keyof Mapping]}
                                                    onValueChange={(value) => handleMappingChange(field as keyof Mapping, value)}
                                                    className="p-4 grid grid-cols-2 gap-2"
                                                >
                                                    {columns.map((col) => (
                                                        <div key={col} className="flex items-center space-x-2">
                                                            <RadioGroupItem value={col} id={`${field}-${col}`} />
                                                            <Label
                                                                htmlFor={`${field}-${col}`}
                                                                className="truncate font-normal"
                                                                title={col}
                                                            >
                                                                {col}
                                                            </Label>
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

            {/* Step 3: Action */}
            {file && (
                <Card>
                    <CardHeader>
                        <CardTitle>{isTranslationLoading ? <Skeleton className="h-8 w-48" /> : t("upload.steps.3.title")}</CardTitle>
                        {isTranslationLoading ? <Skeleton className="h-5 w-64 mt-2" /> : <CardDescription>{t("upload.steps.3.description")}</CardDescription>}
                    </CardHeader>
                    <CardContent>
                        <div className="space-y-4">
                            <div className="flex flex-wrap gap-2">
                                <Button
                                    onClick={() => startClustering()}
                                    disabled={!isMappingComplete || !isDataCached || isProcessing}
                                >
                                    {isProcessing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                                    {getButtonText()}
                                </Button>
                            </div>
                            {isProcessing && (
                                <div className="space-y-2 mt-4 bg-card p-4 rounded-lg">
                                    <div className="flex justify-between items-center text-sm font-medium text-muted-foreground">
                                        <span>{formattedStatus()}</span>
                                    </div>
                                    <div className="relative h-4 w-full overflow-hidden rounded-full bg-muted">
                                        <Progress value={progressInfo.progress} className="absolute h-full w-full" />
                                        <div className="absolute inset-0 flex items-center justify-center">
                                            <span className="text-xs font-medium text-primary-foreground mix-blend-difference">
                                                {Math.round(progressInfo.progress)}%
                                            </span>
                                        </div>
                                    </div>
                                    <div className="flex items-center justify-end gap-2 text-sm text-muted-foreground">
                                        <Clock className="h-4 w-4" />
                                        <span>{formatTime(timeInfo.elapsed)}</span>
                                        {timeInfo.remaining !== undefined && (
                                            <span className="text-xs">
                                                (est. {formatTime(timeInfo.remaining)} left)
                                            </span>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                    </CardContent>
                </Card>
            )}

            {/* Step 4: Results & DB Upload */}
            {workerStatus === "done" && (
                <div className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>{t("upload.steps.4.title")}</CardTitle><CardDescription>{t("upload.steps.4.description")}</CardDescription></CardHeader>
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

                    {/* --- UPLOAD TO DB SECTION --- */}
                    <Card>
                        <CardHeader>
                            <CardTitle>5. Upload Beneficiaries to Database</CardTitle>
                            <CardDescription>Map the processed data to the main beneficiary database and save.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2">
                                <Label>Select Project</Label>
                                <Select onValueChange={handleProjectSelect} value={selectedProject?.projectId || ''} disabled={loadingDbSection.projects}>
                                    <SelectTrigger className="w-full md:w-1/2">
                                        <SelectValue placeholder={loadingDbSection.projects ? "Loading..." : "Select a project..."} />
                                    </SelectTrigger>
                                    <SelectContent>
                                        {projects.map(p => (<SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>))}
                                    </SelectContent>
                                </Select>
                            </div>

                             {selectedProject && (
                                <div className="space-y-4">
                                     <Button onClick={handleAutoMatch}><GitCompareArrows className="mr-2 h-4 w-4" />Auto-match Columns</Button>
                                     <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                        <Card>
                                            <CardHeader><CardTitle className="text-md">Current Mappings ({columnMappingForDb.size}/{dbUploadUiColumns.length})</CardTitle></CardHeader>
                                            <CardContent>
                                                <ScrollArea className="h-40 border rounded-md">
                                                     <Table>
                                                        <TableHeader><TableRow><TableHead>Source Column</TableHead><TableHead>DB Column</TableHead></TableRow></TableHeader>
                                                        <TableBody>
                                                            {Array.from(columnMappingForDb.entries()).map(([uiCol, dbCol]) => (
                                                                <TableRow key={uiCol}><TableCell>{uiCol}</TableCell><TableCell className="font-medium">{dbCol}</TableCell></TableRow>
                                                            ))}
                                                        </TableBody>
                                                    </Table>
                                                </ScrollArea>
                                            </CardContent>
                                        </Card>
                                        <Card>
                                            <CardHeader><CardTitle className="text-md">Manual Mapping</CardTitle></CardHeader>
                                            <CardContent className="space-y-2">
                                                 <Label>Unmapped Source Column ({unmappedUiColumnsForDb.length})</Label>
                                                  <Select value={manualMappingForDb.ui} onValueChange={v => setManualMappingForDb(m => ({ ...m, ui: v }))}>
                                                      <SelectTrigger><SelectValue placeholder="Select Source..." /></SelectTrigger>
                                                      <SelectContent><ScrollArea className="h-40">{unmappedUiColumnsForDb.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}</ScrollArea></SelectContent>
                                                  </Select>
                                                  <Label>Unmapped DB Column ({unmappedDbColumns.length})</Label>
                                                   <Select value={manualMappingForDb.db} onValueChange={v => setManualMappingForDb(m => ({ ...m, db: v }))}>
                                                      <SelectTrigger><SelectValue placeholder="Select Destination..." /></SelectTrigger>
                                                      <SelectContent><ScrollArea className="h-40">{unmappedDbColumns.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}</ScrollArea></SelectContent>
                                                  </Select>
                                                  <Button onClick={handleAddManualMapping} className="w-full"><Plus className="mr-2 h-4 w-4" /> Add Manual Mapping</Button>
                                            </CardContent>
                                        </Card>
                                     </div>
                                    <div className='flex gap-2'>
                                        <Button onClick={handleSaveToDatabase} disabled={loadingDbSection.saving || !isDbMappingComplete}>
                                            {loadingDbSection.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                                            Save to bnf-assessed.db
                                        </Button>
                                        <Button asChild variant="outline">
                                            <a href="/api/bnf-assessed/download">
                                                <FileDown className="mr-2 h-4 w-4" />
                                                Download bnf-assessed.db
                                            </a>
                                        </Button>
                                    </div>
                                    {loadingDbSection.saving && <Progress value={saveProgress} />}
                                    {saveProgress === 100 && saveStats.total > 0 && (
                                        <Card><CardHeader><CardTitle>Save Summary</CardTitle></CardHeader>
                                        <CardContent className="grid grid-cols-3 gap-4">
                                            <SummaryCard icon={<Users />} title="Total" value={saveStats.total} />
                                            <SummaryCard icon={<CheckCircle className="text-green-500"/>} title="Saved" value={saveStats.saved} />
                                            <SummaryCard icon={<XCircle className="text-orange-500"/>} title="Skipped" value={saveStats.skipped} />
                                        </CardContent></Card>
                                    )}
                                </div>
                            )}
                        </CardContent>
                    </Card>
                </div>
            )}
            <AlertDialog open={duplicateDialog.isOpen} onOpenChange={(isOpen) => setDuplicateDialog(prev => ({...prev, isOpen}))}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Duplicate Records Found</AlertDialogTitle>
                        <AlertDialogDescription>
                            Found {duplicateDialog.duplicates.length} record(s) that may already exist in the database based on Beneficiary ID. How would you like to proceed?
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel onClick={() => setLoadingDbSection(p => ({...p, saving: false}))}>Cancel</AlertDialogCancel>
                        <Button variant="outline" onClick={async () => {
                            setDuplicateDialog({ isOpen: false, duplicates: [], nonDuplicates: [] });
                            await executeSave(duplicateDialog.nonDuplicates, false);
                        }}>Skip Duplicates</Button>
                        <AlertDialogAction onClick={async () => {
                            setDuplicateDialog({ isOpen: false, duplicates: [], nonDuplicates: [] });
                            const cachedResult = await loadCachedResult();
                            if(!cachedResult) return;
                            const enrichedAllRecords = enrichRecordsWithClusterData(cachedResult);
                            await executeSave(enrichedAllRecords, true);
                        }}>Replace Existing</AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </div>
    );
}