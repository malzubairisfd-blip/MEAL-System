// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/database/page.tsx
"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useToast } from "@/hooks/use-toast";
import { loadCachedResult } from "@/lib/cache";
import type { RecordRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { ArrowLeft, Database, Loader2, Save, ArrowRight, FileDown, GitCompareArrows } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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


interface Project {
  projectId: string;
  projectName: string;
}

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
    "hsbnd_name_2", "bnf_name2", "bnf_name2b", "bnf_name2c", "bnf_name3", "bnf_name3b", 
    "bnf_name3c", "bnf_name3d", "bnf_name4", "bnf_name4c", "bnf_name4b", "bnf_f_name4", 
    "bnf_f_name3", "bnf_f_name3c", "hsbnd_name2", "hsbnd_name2b", "hsbnd_name2c", "hsbnd_name3", 
    "hsbnd_name3b", "hsbnd_name3c", "hsbnd_name3d", "hsbnd_name4", "hsbnd_name4c", "hsbnd_name4b", 
    "hsbnd_f_name4", "hsbnd_f_name3", "hsbnd_f_name3c", "bnf_name_list", "hsbnd_name_list", 
    "dup_cluster_id2_2", "c_max_weight", "c_min_weight", "c_id_max_weight", "c_id_min_weight", 
    "c_max_pct", "c_min_pct", "c_id_max_pct", "c_id_min_pct", "c_min_proj", "c_max_proj", 
    "c_proj2_cnt", "c_mud2_cnt", "c_id_min_proj", "c_id_max_proj", "c_id_proj2_cnt", "c_id_mud2_cnt", 
    "pre_classified_result", "group_analysis", "womanName_normalized", "husbandName_normalized", 
    "children_normalized", "subdistrict_normalized", "village_normalized", "parts", "husbandParts", 
    "ED_NO", "ED_ID", "EC_ID", "PC_ID", "ED_NAME", "EC_NAME", "PC_NAME", "SRVY_HH_ID_2", 
    "CANDID_SER_NO", "WOMAN_ID", "source_ID_2", "BENEF_ID_2", "BENEF_NO", "HH_NAME_2", 
    "BNF_RELATION_2", "BENEF_NAME_3", "HUSBAND_NAME_3", "IS_ACTIVE_2", "STATUS_2", "QUAL_STATUS", 
    "STATUS_DESC", "QUAL_STATUS_DESC", "VERIFY_STATUS", "VERIFY_NOTES", "VERIFY_REASON", "VERIFY_DATE", 
    "REG_STATUS", "REG_FORM_DATE_2", "REG_NOTES", "TOTAL_CHILD_COUNT", "MALE_CHILD_COUNT", 
    "FEMALE_CHILD_COUNT", "LOC_ID_2", "LOC_NAME", "ID_CARD_TYPE_2", "ID_CARD_TYPE_DESC", 
    "ID_CARD_NO_2", "AGE_YEARS_2", "ADDRESS", "PHONE_NO_2", "IS_TERMINATED", "TERM_DATE", 
    "TERM_REASON_2", "TERM_NOTES", "NOTES_2", "PC_FAC_ID", "EC_FAC_ID", "BENEF_CLASS", 
    "BENEF_CLASS_DESC_2", "OLD_BNF_NAME_2", "OLD_HSBND_NAME_2", "OLD_PHONE_NO", "OLD_ID_CARD_NO", 
    "enrollment_modification_type", "eligible_woman_modify_type", "eligible_woman_name_correction", 
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


export default function BeneficiaryDatabasePage() {
  const { toast } = useToast();
  const router = useRouter();

  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [loading, setLoading] = useState({ projects: true, cache: false, saving: false });
  const [cacheData, setCacheData] = useState<any>(null);
  
  const [uiColumns, setUiColumns] = useState<string[]>([]);
  const [dbColumns] = useState<string[]>(DB_COLUMNS);
  const [columnMapping, setColumnMapping] = useState<Map<string, string>>(new Map());
  const [manualMapping, setManualMapping] = useState({ ui: '', db: '' });

  const [progress, setProgress] = useState(0);
  const [duplicateDialog, setDuplicateDialog] = useState({ isOpen: false, duplicates: [], nonDuplicates: [] });
  const [saveStats, setSaveStats] = useState({ saved: 0, skipped: 0, total: 0 });
  
  const isMappingComplete = useMemo(() => uiColumns.length > 0 && uiColumns.every(col => columnMapping.has(col)), [uiColumns, columnMapping]);
  const unmappedUiColumns = useMemo(() => uiColumns.filter(col => !columnMapping.has(col)), [uiColumns, columnMapping]);
  const unmappedDbColumns = useMemo(() => {
      const mappedDbCols = new Set(columnMapping.values());
      return dbColumns.filter(col => !mappedDbCols.has(col));
  }, [dbColumns, columnMapping]);

  useEffect(() => {
    const fetchProjects = async () => {
      setLoading(prev => ({ ...prev, projects: true }));
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) throw new Error("Failed to load projects.");
        const data = await res.json();
        setProjects(Array.isArray(data) ? data : []);
      } catch (error: any) {
        toast({ title: "Error", description: error.message, variant: "destructive" });
      } finally {
        setLoading(prev => ({ ...prev, projects: false }));
      }
    };
    fetchProjects();
  }, [toast]);

  const handleProjectSelect = async (projectId: string) => {
    setSelectedProjectId(projectId);
    setCacheData(null);
    setUiColumns([]);
    setColumnMapping(new Map());
    setManualMapping({ ui: '', db: '' });
    setSaveStats({ saved: 0, skipped: 0, total: 0 });

    if (!projectId) return;

    setLoading(prev => ({ ...prev, cache: true }));
    try {
      const result = await loadCachedResult();
      if (!result) {
        toast({ title: "No Data", description: "No cached data found. Please run the clustering process first.", variant: "destructive" });
        return;
      }
      setCacheData(result);

      const headers = new Set<string>(result.originalHeaders || []);
      
      result.clusters?.[0]?.records?.[0] && Object.keys(result.clusters[0].records[0]).forEach(key => {
        if (!key.startsWith('_')) headers.add(key);
      });
      
      result.clusters?.[0] && Object.keys(result.clusters[0]).forEach(key => {
        if(key !== 'records' && key !== 'pairScores') headers.add(key);
      });
      
      setUiColumns(Array.from(headers));

    } catch (error: any) {
      toast({ title: "Error loading cache", description: error.message, variant: "destructive" });
    } finally {
      setLoading(prev => ({ ...prev, cache: false }));
    }
  };

  const handleAutoMatch = () => {
      const newMapping = new Map<string, string>();
      const usedDbCols = new Set<string>();

      uiColumns.forEach(uiCol => {
          const matchedDbCol = dbColumns.find(dbCol => dbCol.toLowerCase() === uiCol.toLowerCase() && !usedDbCols.has(dbCol));
          if(matchedDbCol) {
              newMapping.set(uiCol, matchedDbCol);
              usedDbCols.add(matchedDbCol);
          }
      });
      setColumnMapping(newMapping);
      toast({ title: "Auto-match Complete", description: `${newMapping.size} columns were matched automatically.`});
  };

  const handleAddManualMapping = () => {
      if (!manualMapping.ui || !manualMapping.db) {
          toast({ title: "Incomplete Selection", description: "Please select both a source and a destination column.", variant: "destructive" });
          return;
      }
      const newMapping = new Map(columnMapping);
      newMapping.set(manualMapping.ui, manualMapping.db);
      setColumnMapping(newMapping);
      setManualMapping({ ui: '', db: '' });
  };
  
  const executeSave = async (recordsToSave: any[], isOverwrite: boolean) => {
      setLoading(prev => ({ ...prev, saving: true }));
      setProgress(0);
      setSaveStats({ saved: 0, skipped: 0, total: 0 });

      try {
        const project = projects.find(p => p.projectId === selectedProjectId);
        if (!project) throw new Error("Selected project not found.");
        
        const dataToSave = recordsToSave.map((row: any) => {
            const newRecord: any = {};
            for (const [uiCol, dbCol] of columnMapping.entries()) {
                if(row[uiCol] !== undefined) {
                    newRecord[dbCol] = row[uiCol];
                }
            }
            newRecord.internalId = row._internalId; 
            newRecord.project_id = project.projectId;
            newRecord.project_name = project.projectName;
            return newRecord;
        });
        
        const CHUNK_SIZE = 100;
        const totalRecordsToSave = dataToSave.length;

        if (totalRecordsToSave === 0) {
            toast({ title: "No Records to Save", description: "All records were skipped." });
            setSaveStats({ saved: 0, skipped: cacheData.rows.length, total: cacheData.rows.length });
            setLoading(prev => ({ ...prev, saving: false }));
            return;
        }

        for (let i = 0; i < totalRecordsToSave; i += CHUNK_SIZE) {
            const chunk = dataToSave.slice(i, i + CHUNK_SIZE);
            const chunkPayload = { projectName: project.projectName, processedAt: new Date().toISOString(), results: chunk };

            const isFirstChunk = i === 0;
            const url = isFirstChunk && isOverwrite ? '/api/bnf-assessed?init=true' : '/api/bnf-assessed';

            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(chunkPayload)
            });

            if (!res.ok) {
                const errorData = await res.json();
                throw new Error(errorData.details || "A server error occurred while saving.");
            }

            await new Promise(resolve => setTimeout(resolve, 50));
            const currentProgress = Math.round(((i + CHUNK_SIZE) / totalRecordsToSave) * 100);
            setProgress(Math.min(100, currentProgress));
        }

        toast({ title: "Save Successful", description: `${totalRecordsToSave} records saved for ${project?.projectName}.` });
        setProgress(100);
        setSaveStats({
            saved: totalRecordsToSave,
            skipped: cacheData.rows.length - totalRecordsToSave,
            total: cacheData.rows.length
        });
        
      } catch (error: any) {
          toast({ title: "Save Failed", description: error.message, variant: "destructive" });
      } finally {
          setLoading(prev => ({ ...prev, saving: false }));
      }
  };


  const handleSaveToDatabase = async () => {
      if (!selectedProjectId || !cacheData || !isMappingComplete) {
          toast({ title: "Incomplete Selection", description: "Please select a project and ensure all columns are mapped.", variant: "destructive" });
          return;
      }

      setLoading(prev => ({ ...prev, saving: true }));
      setProgress(0);
      setSaveStats({ saved: 0, skipped: 0, total: 0 });

      try {
        const existingRes = await fetch('/api/bnf-assessed');
        if (!existingRes.ok) throw new Error("Could not fetch existing records from database.");
        const existingRecords = await existingRes.json();
        
        const uiBeneficiaryIdColumn = 'benef_id'; // This is now hardcoded as per DB schema
        const mappedUiColumn = Array.from(columnMapping.entries()).find(([uiCol, dbCol]) => dbCol === uiBeneficiaryIdColumn)?.[0];

        if (!mappedUiColumn) {
          // If benef_id is not mapped, we cannot check for duplicates. Save all as overwrite.
          await executeSave(cacheData.rows, true);
          return;
        }

        const existingBeneficiaryIds = new Set(existingRecords.map((r: any) => r[uiBeneficiaryIdColumn]));
        
        const duplicates: any[] = [];
        const nonDuplicates: any[] = [];

        cacheData.rows.forEach((row: any) => {
            const newBeneficiaryId = row[mappedUiColumn];
            if (newBeneficiaryId && existingBeneficiaryIds.has(newBeneficiaryId)) {
                duplicates.push(row);
            } else {
                nonDuplicates.push(row);
            }
        });

        if (duplicates.length > 0) {
            setDuplicateDialog({ isOpen: true, duplicates, nonDuplicates });
            setLoading(prev => ({...prev, saving: false}));
        } else {
            // No duplicates, but this is the first save for this dataset, so overwrite.
            await executeSave(cacheData.rows, true);
        }

    } catch (error: any) {
        toast({ title: "Validation Failed", description: error.message, variant: "destructive" });
        setLoading(prev => ({ ...prev, saving: false }));
    }
  };


  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Beneficiaries Database</h1>
        <Button variant="outline" asChild>
          <Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/review">
            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Review
          </Link>
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>1. Select Project</CardTitle>
          <CardDescription>Choose the project whose processed data you want to save to the database.</CardDescription>
        </CardHeader>
        <CardContent>
          <Select onValueChange={handleProjectSelect} value={selectedProjectId} disabled={loading.projects}>
            <SelectTrigger className="w-full md:w-1/2">
              <SelectValue placeholder={loading.projects ? "Loading..." : "Select a project..."} />
            </SelectTrigger>
            <SelectContent>
              {projects.map(p => (
                <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </CardContent>
      </Card>
      
      {loading.cache && <div className="flex justify-center p-8"><Loader2 className="h-8 w-8 animate-spin"/></div>}

      {cacheData && (
        <>
          <Card>
            <CardHeader>
                <CardTitle>2. Map Columns</CardTitle>
                <CardDescription>Match source columns from your data to the destination columns in the database.</CardDescription>
                <CardContent className="pt-4">
                  <Button onClick={handleAutoMatch}><GitCompareArrows className="mr-2 h-4 w-4" />Auto-match Columns</Button>
                </CardContent>
            </CardHeader>
            
            {!isMappingComplete && unmappedUiColumns.length > 0 && (
                <Card>
                    <CardHeader>
                        <CardTitle>Manual Mapping</CardTitle>
                        <CardDescription>Map the remaining {unmappedUiColumns.length} source columns.</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                            <div className="space-y-2">
                                <Label>Remaining Source Column</Label>
                                <Select value={manualMapping.ui} onValueChange={v => setManualMapping(m => ({ ...m, ui: v}))}>
                                    <SelectTrigger><SelectValue placeholder="Select Source..." /></SelectTrigger>
                                    <SelectContent>
                                        {unmappedUiColumns.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                             <div className="space-y-2">
                                <Label>Destination DB Column</Label>
                                <Select value={manualMapping.db} onValueChange={v => setManualMapping(m => ({ ...m, db: v}))}>
                                    <SelectTrigger><SelectValue placeholder="Select Destination..." /></SelectTrigger>
                                    <SelectContent>
                                        {unmappedDbColumns.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}
                                    </SelectContent>
                                </Select>
                            </div>
                            <Button onClick={handleAddManualMapping}>Add Mapping</Button>
                        </div>
                    </CardContent>
                </Card>
            )}

            <Card>
                <CardHeader><CardTitle>Current Mappings</CardTitle></CardHeader>
                <CardContent>
                     <ScrollArea className="h-64 border rounded-md p-4">
                        <Table>
                           <TableHeader>
                               <TableRow>
                                   <TableHead>Source Column (from your file)</TableHead>
                                   <TableHead>Destination Column (in database)</TableHead>
                               </TableRow>
                           </TableHeader>
                           <TableBody>
                               {Array.from(columnMapping.entries()).map(([uiCol, dbCol]) => (
                                   <TableRow key={uiCol}>
                                       <TableCell>{uiCol}</TableCell>
                                       <TableCell className="font-medium">{dbCol}</TableCell>
                                   </TableRow>
                               ))}
                           </TableBody>
                        </Table>
                     </ScrollArea>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>3. Save to Database</CardTitle>
                    <CardDescription>This will save the mapped data to the `bnf-assessed.db` database.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <div className="flex gap-2">
                        <Button onClick={handleSaveToDatabase} disabled={loading.saving || !isMappingComplete}>
                            {loading.saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Save className="mr-2 h-4 w-4" />}
                            Save to bnf-assessed.db
                        </Button>
                        <Button asChild variant="outline">
                            <a href="/api/bnf-assessed/download">
                                <FileDown className="mr-2 h-4 w-4" />
                                Download bnf-assessed.db
                            </a>
                        </Button>
                    </div>
                    {!isMappingComplete && <p className="text-sm text-destructive">Please map all source columns before saving.</p>}
                    {loading.saving && (
                        <div className="space-y-2">
                            <Progress value={progress} />
                            <p className="text-sm text-muted-foreground text-center">{progress}% Complete</p>
                        </div>
                    )}
                    {progress === 100 && saveStats.total > 0 && (
                        <Card className="mt-4">
                            <CardHeader><CardTitle>Save Summary</CardTitle></CardHeader>
                            <CardContent className="grid grid-cols-3 gap-4">
                                <div className="text-center p-4 rounded-lg bg-muted">
                                    <p className="text-sm font-medium text-muted-foreground">Total Records Processed</p>
                                    <p className="text-2xl font-bold">{saveStats.total}</p>
                                </div>
                                <div className="text-center p-4 rounded-lg bg-green-100 dark:bg-green-900/30">
                                    <p className="text-sm font-medium text-green-700 dark:text-green-300">Records Saved</p>
                                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{saveStats.saved}</p>
                                </div>
                                <div className="text-center p-4 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                                    <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Records Skipped</p>
                                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{saveStats.skipped}</p>
                                </div>
                            </CardContent>
                        </Card>
                    )}
                     {progress === 100 && (
                         <Button onClick={() => router.push('/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/audit')}>
                            Go to Audit Page <ArrowRight className="ml-2 h-4 w-4"/>
                        </Button>
                     )}
                </CardContent>
            </Card>
        </>
      )}

      <AlertDialog open={duplicateDialog.isOpen} onOpenChange={(isOpen) => setDuplicateDialog(prev => ({...prev, isOpen}))}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Duplicate Records Found</AlertDialogTitle>
                <AlertDialogDescription>
                    Found {duplicateDialog.duplicates.length} record(s) in your upload that may already exist in the database based on the Beneficiary ID. How would you like to proceed?
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <Button variant="outline" onClick={async () => {
                    setDuplicateDialog(prev => ({...prev, isOpen: false}));
                    await executeSave(duplicateDialog.nonDuplicates, false);
                }}>
                    Skip Duplicates
                </Button>
                <AlertDialogAction onClick={async () => {
                    setDuplicateDialog(prev => ({...prev, isOpen: false}));
                    await executeSave(cacheData.rows, true);
                }}>
                    Replace Existing
                </AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
    </AlertDialog>

    </div>
  );
}
