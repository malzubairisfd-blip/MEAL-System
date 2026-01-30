// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/upload/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import * as XLSX from 'xlsx';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Progress } from '@/components/ui/progress';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Database, Loader2, Save, ArrowRight, FileDown, GitCompareArrows, Plus, Trash2 } from "lucide-react";
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
import type { AuditFinding } from "@/lib/auditEngine";

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
    "hsbnd_name_2", "bnf_name2", "bnf_name2b", "bnf_name2c", "bnf_name3", "bnf_name3b", "bnf_name3c",
    "bnf_name3d", "bnf_name4", "bnf_name4c", "bnf_name4b", "bnf_f_name4", "bnf_f_name3",
    "bnf_f_name3c", "hsbnd_name2", "hsbnd_name2b", "hsbnd_name2c", "hsbnd_name3", "hsbnd_name3b",
    "hsbnd_name3c", "hsbnd_name3d", "hsbnd_name4", "hsbnd_name4c", "hsbnd_name4b", "hsbnd_f_name4",
    "hsbnd_f_name3", "hsbnd_f_name3c", "bnf_name_list", "hsbnd_name_list", "dup_cluster_id2_2",
    "c_max_weight", "c_min_weight", "c_id_max_weight", "c_id_min_weight", "c_max_pct", "c_min_pct",
    "c_id_max_pct", "c_id_min_pct", "c_min_proj", "c_max_proj", "c_proj2_cnt", "c_mud2_cnt",
    "c_id_min_proj", "c_id_max_proj", "c_id_proj2_cnt", "c_id_mud2_cnt", 'womanName', 'husbandName',
    'nationalId', 'phone', 'village', 'subdistrict', 'children', 'beneficiaryId', 'avgPairScore',
    'avgFirstNameScore', 'avgFamilyNameScore', 'avgAdvancedNameScore', 'avgTokenReorderScore',
    'reasons', 'confidenceScore', 'avgWomanNameScore', 'avgHusbandNameScore', 'avgFinalScore',
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

const enrichRecordsWithClusterData = (rows: RecordRow[], clusters: any[]) => {
  if (!rows || !clusters) return [];
  
  const recordMap = new Map<string, any>();
  clusters.forEach((cluster, index) => {
    (cluster.records || []).forEach((record: any) => {
      recordMap.set(record._internalId, {
        ...record,
        Generated_Cluster_ID: cluster.Generated_Cluster_ID ?? index + 1,
        Cluster_Size: cluster.records.length,
        Max_PairScore: cluster.Max_PairScore,
        reasons: cluster.reasons?.join(', '),
        confidenceScore: cluster.confidenceScore,
        avgWomanNameScore: cluster.avgWomanNameScore,
        avgHusbandNameScore: cluster.avgHusbandNameScore,
        avgFinalScore: cluster.avgFinalScore,
      });
    });
  });
  
  return rows.map(originalRecord => {
    const enrichedData = recordMap.get(originalRecord._internalId!);
    if (enrichedData) {
      return { ...originalRecord, ...enrichedData };
    }
    return originalRecord;
  });
};

export default function UploadToDbPage() {
  const { toast } = useToast();
  const router = useRouter();
  
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  
  const [file, setFile] = useState<File | null>(null);
  const [rawRows, setRawRows] = useState<RecordRow[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [idColumnForCheck, setIdColumnForCheck] = useState<string>('');
  
  const [columnMapping, setColumnMapping] = useState<Map<string, string>>(new Map());
  const [manualMapping, setManualMapping] = useState({ ui: '', db: '' });

  const [loading, setLoading] = useState({ projects: true, worker: false, saving: false });
  const [progress, setProgress] = useState(0);
  
  const [duplicateDialog, setDuplicateDialog] = useState({ isOpen: false, duplicates: [], nonDuplicates: [] });
  const [saveStats, setSaveStats] = useState({ saved: 0, skipped: 0, total: 0 });

  const workerRef = useRef<Worker>();

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
  
   useEffect(() => {
    workerRef.current = new Worker(new URL('@/workers/cluster.worker.ts', import.meta.url));
    workerRef.current.onmessage = (event) => handleWorkerMessage(event.data);
    return () => workerRef.current?.terminate();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) {
        setFile(f);
        const reader = new FileReader();
        reader.onload = (event) => {
            const workbook = XLSX.read(event.target?.result, { type: 'binary', cellDates: true });
            const sheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[sheetName];
            const jsonData = XLSX.utils.sheet_to_json<RecordRow>(worksheet, { defval: "" });
            const rowsWithId = jsonData.map((row, index) => ({
                ...row,
                _internalId: `row_${Date.now()}_${index}`
            }));
            setRawRows(rowsWithId);
            setColumns(Object.keys(rowsWithId[0] || {}));
        };
        reader.readAsBinaryString(f);
    }
  };

  const handleAutoMatch = () => {
      const newMapping = new Map<string, string>();
      const usedDbCols = new Set<string>();

      columns.forEach(uiCol => {
          const matchedDbCol = DB_COLUMNS.find(dbCol => dbCol.toLowerCase() === uiCol.toLowerCase() && !usedDbCols.has(dbCol));
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
  
  const removeMapping = (sourceKey: string) => {
    const newMap = new Map(columnMapping);
    newMap.delete(sourceKey);
    setColumnMapping(newMap);
  };
  
  const handleProcessAndSave = () => {
    if (!workerRef.current || !selectedProjectId) {
      toast({ title: "Prerequisites Missing", description: "Please select a project and ensure the worker is ready.", variant: "destructive" });
      return;
    }
    if (!idColumnForCheck) {
        toast({ title: 'Validation Error', description: 'Please select a column to use for the duplicate check.', variant: 'destructive' });
        return;
    }
    setLoading(prev => ({...prev, worker: true}));
    setProgress(0);

    const clusteringMapping = {
      womanName: Array.from(columnMapping.entries()).find(([_, dbCol]) => dbCol === 'womanName')?.[0] || 'womanName',
      husbandName: Array.from(columnMapping.entries()).find(([_, dbCol]) => dbCol === 'husbandName')?.[0] || 'husbandName',
      nationalId: Array.from(columnMapping.entries()).find(([_, dbCol]) => dbCol === 'nationalId')?.[0] || 'nationalId',
      phone: Array.from(columnMapping.entries()).find(([_, dbCol]) => dbCol === 'phone')?.[0] || 'phone',
      village: Array.from(columnMapping.entries()).find(([_, dbCol]) => dbCol === 'village')?.[0] || 'village',
      subdistrict: Array.from(columnMapping.entries()).find(([_, dbCol]) => dbCol === 'subdistrict')?.[0] || 'subdistrict',
      children: Array.from(columnMapping.entries()).find(([_, dbCol]) => dbCol === 'children')?.[0] || 'children',
    };
    
    workerRef.current.postMessage({ type: 'start', payload: { mapping: clusteringMapping, options: {} }});
    workerRef.current.postMessage({ type: 'data', payload: { rows: rawRows, total: rawRows.length } });
    workerRef.current.postMessage({ type: 'end' });
  };
  
  const handleWorkerMessage = (msg: any) => {
    if (msg.type === 'progress') {
      setProgress(msg.progress);
    } else if (msg.type === 'done') {
      setLoading(prev => ({...prev, worker: false}));
      const enrichedRecords = enrichRecordsWithClusterData(rawRows, msg.payload.clusters);
      validateAndSaveToDB(enrichedRecords);
    } else if (msg.type === 'error') {
      setLoading(prev => ({...prev, worker: false}));
      toast({ title: "Clustering Error", description: msg.error, variant: 'destructive'});
    }
  };

  const validateAndSaveToDB = async (enrichedRecords: any[]) => {
      setLoading(prev => ({ ...prev, saving: true }));
      try {
        const existingRes = await fetch('/api/bnf-assessed');
        if (!existingRes.ok) throw new Error("Could not fetch existing records from database.");
        const existingRecords = await existingRes.json();
        
        const existingIds = new Set(existingRecords.map((r: any) => String(r.beneficiaryId)));
        
        const duplicates = enrichedRecords.filter(row => existingIds.has(String(row[idColumnForCheck])));
        const nonDuplicates = enrichedRecords.filter(row => !existingIds.has(String(row[idColumnForCheck])));
        
        if (duplicates.length > 0) {
            setDuplicateDialog({ isOpen: true, duplicates, nonDuplicates });
            setLoading(prev => ({...prev, saving: false}));
        } else {
            await executeSave(enrichedRecords, true); // Overwrite if it's the first time for this project
        }
      } catch(e: any) {
        toast({ title: "Validation Failed", description: e.message, variant: 'destructive'});
        setLoading(prev => ({...prev, saving: false}));
      }
  };

  const executeSave = async (recordsToSave: any[], isOverwrite: boolean) => {
    setLoading(prev => ({...prev, saving: true}));
    setDuplicateDialog({ isOpen: false, duplicates: [], nonDuplicates: [] });
    
    const project = projects.find(p => p.projectId === selectedProjectId);
    if (!project) {
        toast({ title: 'Error', description: 'Selected project not found.'});
        setLoading(prev => ({ ...prev, saving: false}));
        return;
    }
    
    const dataToSave = recordsToSave.map(row => {
        const newRecord: {[key: string]: any} = {};
        for(const [uiCol, dbCol] of columnMapping.entries()){
            if(row[uiCol] !== undefined) newRecord[dbCol] = row[uiCol];
        }
        newRecord.project_id = project.projectId;
        newRecord.project_name = project.projectName;
        newRecord.internalId = row._internalId; // Keep internal ID
        return newRecord;
    });

    try {
        const res = await fetch(`/api/bnf-assessed?init=${isOverwrite}`, {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ projectName: project.projectName, results: dataToSave })
        });
        if(!res.ok) throw new Error('Save operation failed.');

        toast({ title: 'Save Successful!', description: `${recordsToSave.length} records saved.`});
        setSaveStats({ saved: recordsToSave.length, skipped: rawRows.length - recordsToSave.length, total: rawRows.length });
    } catch(e:any) {
        toast({ title: "Save Failed", description: e.message, variant: 'destructive'});
    } finally {
         setLoading(prev => ({ ...prev, saving: false}));
    }
  }

  const unmappedUiColumns = useMemo(() => columns.filter(col => !Array.from(columnMapping.keys()).includes(col)), [columns, columnMapping]);
  const isMappingComplete = useMemo(() => unmappedUiColumns.length === 0, [unmappedUiColumns]);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>1. Select Project & Upload</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select onValueChange={setSelectedProjectId} value={selectedProjectId} disabled={loading.projects}>
            <SelectTrigger><SelectValue placeholder={loading.projects ? "Loading..." : "Select a project..."} /></SelectTrigger>
            <SelectContent>{projects.map(p => <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>)}</SelectContent>
          </Select>
          <Input id="file-upload" type="file" onChange={handleFileChange} accept=".xlsx,.xls,.csv" />
        </CardContent>
      </Card>
      
      {columns.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>2. Map Columns</CardTitle>
            <CardDescription>Match columns from your file to the database schema. Select the column that contains the unique Beneficiary ID for duplicate checking.</CardDescription>
            <div className="flex flex-col md:flex-row gap-4 items-end pt-4">
                <Button onClick={handleAutoMatch}><GitCompareArrows className="mr-2 h-4 w-4" />Auto-match Columns</Button>
                <div className="flex-1 w-full md:w-auto">
                    <Label htmlFor="id-check-column">Beneficiary ID Column for Duplicate Check</Label>
                    <Select value={idColumnForCheck} onValueChange={setIdColumnForCheck}>
                        <SelectTrigger id="id-check-column">
                            <SelectValue placeholder="Select ID column..." />
                        </SelectTrigger>
                        <SelectContent>
                            {columns.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}
                        </SelectContent>
                    </Select>
                </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
             {!isMappingComplete && (
                <Card className="p-4 bg-muted">
                    <CardTitle className="text-md mb-2">Manual Mapping</CardTitle>
                     <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                          <div className="space-y-2">
                            <Label>Unmapped Source Column</Label>
                            <Select value={manualMapping.ui} onValueChange={v => setManualMapping(m => ({ ...m, ui: v}))}>
                                <SelectTrigger><SelectValue placeholder="Select Source..." /></SelectTrigger>
                                <SelectContent><ScrollArea className="h-60">{unmappedUiColumns.map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}</ScrollArea></SelectContent>
                            </Select>
                          </div>
                           <div className="space-y-2">
                              <Label>Unmapped DB Column</Label>
                              <Select value={manualMapping.db} onValueChange={v => setManualMapping(m => ({ ...m, db: v}))}>
                                  <SelectTrigger><SelectValue placeholder="Select Destination..." /></SelectTrigger>
                                  <SelectContent><ScrollArea className="h-60">{DB_COLUMNS.filter(c => !Array.from(columnMapping.values()).includes(c)).map(col => <SelectItem key={col} value={col}>{col}</SelectItem>)}</ScrollArea></SelectContent>
                              </Select>
                          </div>
                          <Button onClick={handleAddManualMapping}>Add Mapping</Button>
                      </div>
                </Card>
            )}
             <Card>
                <CardHeader><CardTitle className="text-md">Current Mappings</CardTitle></CardHeader>
                <CardContent>
                     <ScrollArea className="h-40 border rounded-md">
                        <Table>
                           <TableHeader><TableRow><TableHead>Source Column</TableHead><TableHead>Destination Column</TableHead><TableHead className="text-right">Actions</TableHead></TableRow></TableHeader>
                           <TableBody>
                               {Array.from(columnMapping.entries()).map(([uiCol, dbCol]) => (
                                   <TableRow key={uiCol}>
                                       <TableCell>{uiCol}</TableCell><TableCell className="font-medium">{dbCol}</TableCell>
                                       <TableCell className="text-right"><Button variant="ghost" size="icon" onClick={() => removeMapping(uiCol)}><Trash2 className="h-4 w-4 text-destructive" /></Button></TableCell>
                                   </TableRow>
                               ))}
                           </TableBody>
                        </Table>
                     </ScrollArea>
                </CardContent>
            </Card>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>3. Process Data and Save</CardTitle>
          <CardDescription>This will run the clustering algorithm and then save the results to the database.</CardDescription>
        </CardHeader>
        <CardContent>
           <Button onClick={handleProcessAndSave} disabled={loading.worker || loading.saving || !selectedProjectId || !file}>
            {(loading.worker || loading.saving) && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
            {loading.worker ? 'Clustering...' : loading.saving ? 'Saving...' : 'Process and Save to DB'}
           </Button>
            {(loading.worker || loading.saving) && <Progress value={progress} className="mt-4"/>}
        </CardContent>
      </Card>
      
      {saveStats.total > 0 && (
         <Card>
            <CardHeader><CardTitle>Save Summary</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-3 gap-4">
                <div className="text-center p-4 rounded-lg bg-muted">
                    <p className="text-sm font-medium text-muted-foreground">Total Records</p>
                    <p className="text-2xl font-bold">{saveStats.total}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-green-100 dark:bg-green-900/30">
                    <p className="text-sm font-medium text-green-700 dark:text-green-300">Saved</p>
                    <p className="text-2xl font-bold text-green-600 dark:text-green-400">{saveStats.saved}</p>
                </div>
                <div className="text-center p-4 rounded-lg bg-yellow-100 dark:bg-yellow-900/30">
                    <p className="text-sm font-medium text-yellow-700 dark:text-yellow-300">Skipped</p>
                    <p className="text-2xl font-bold text-yellow-600 dark:text-yellow-400">{saveStats.skipped}</p>
                </div>
            </CardContent>
             <CardContent>
                 <Button asChild><Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/review"><ArrowRight className="mr-2"/> Go to Review Page</Link></Button>
            </CardContent>
        </Card>
      )}

      <AlertDialog open={duplicateDialog.isOpen} onOpenChange={(isOpen) => setDuplicateDialog(prev => ({...prev, isOpen}))}>
        <AlertDialogContent>
            <AlertDialogHeader>
                <AlertDialogTitle>Duplicate Records Found</AlertDialogTitle>
                <AlertDialogDescription>
                    Found {duplicateDialog.duplicates.length} record(s) in your upload that may already exist in the database based on Beneficiary ID.
                </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setLoading(prev => ({...prev, saving: false}))}>Cancel</AlertDialogCancel>
                <Button variant="outline" onClick={() => executeSave(duplicateDialog.nonDuplicates, false)}>Skip Duplicates</Button>
                <AlertDialogAction onClick={() => executeSave([...duplicateDialog.nonDuplicates, ...duplicateDialog.duplicates], false)}>Replace Existing</AlertDialogAction>
            </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
