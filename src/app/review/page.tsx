
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import type { RecordRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Loader2,
  ChevronLeft,
  Save,
  Users,
  Check,
  Copy,
  ShieldOff,
  CheckCircle,
  HelpCircle,
  Trash2,
  Ban,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import Link from "next/link";
import { useTranslation } from "@/hooks/use-translation";
import { loadCachedResult, cacheFinalResult } from "@/lib/cache";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipProvider,
  TooltipTrigger,
  TooltipContent,
} from "@/components/ui/tooltip";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

type Cluster = {
  records: RecordRow[];
  reasons: string[];
  pairScores: any[];
  confidenceScore: number;
  Max_PairScore: number;
  // Fields for review decisions
  groupDecision?: "تكرار" | "ليست تكرار";
  recordDecisions?: { [recordId: string]: string };
  decisionReasons?: { [recordId: string]: string };
};

export default function ReviewPage() {
  const { t } = useTranslation();
  const [allClusters, setAllClusters] = useState<Cluster[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [selectedClusterIndex, setSelectedClusterIndex] = useState<number | null>(null);
  const [activeRecordIndex, setActiveRecordIndex] = useState<number | null>(null);
  const [validationError, setValidationError] = useState<string | null>(null);
  const { toast } = useToast();

  const loadClusters = useCallback(async () => {
    setLoading(true);
    const result = await loadCachedResult();

    if (result && result.clusters) {
      const sortedClusters = [...result.clusters].sort(
        (a, b) => (b.Max_PairScore || 0) - (a.Max_PairScore || 0)
      );
      setAllClusters(sortedClusters);
      if (sortedClusters.length > 0) {
        setSelectedClusterIndex(0);
      }
    } else {
      toast({
        title: t("review.toasts.noData.title"),
        description: t("review.toasts.noData.description"),
        variant: "destructive",
      });
    }
    setLoading(false);
  }, [t, toast]);

  useEffect(() => {
    loadClusters();
  }, [loadClusters]);

  const selectedCluster = useMemo(() => {
    if (selectedClusterIndex === null || !allClusters[selectedClusterIndex]) {
      return null;
    }
    return allClusters[selectedClusterIndex];
  }, [selectedClusterIndex, allClusters]);

  const handleUpdateClusterDecision = useCallback(
    (clusterIndex: number, updateFn: (cluster: Cluster) => Cluster) => {
      setValidationError(null); // Clear previous validation errors on any change
      setAllClusters((prev) =>
        prev.map((c, i) => (i === clusterIndex ? updateFn(c) : c))
      );
    },
    []
  );

 const validateAndSave = useCallback(async () => {
    if (selectedClusterIndex === null || !selectedCluster) return false;

    // --- VALIDATION LOGIC ---
    if (!selectedCluster.groupDecision) {
      setValidationError("يجب تحديد قرار للمجموعة (تكرار أو ليست تكرار).");
      return false;
    }

    if (selectedCluster.groupDecision === "تكرار") {
      const recordDecisions = selectedCluster.recordDecisions || {};
      const decisionValues = Object.values(recordDecisions);
      const keptRecords = decisionValues.filter(d => d === "تبقى").length;

      if (keptRecords === 0) {
        setValidationError("عندما تكون المجموعة مكررة، يجب تحديد سجل واحد على الأقل لـ 'تبقى'.");
        return false;
      }
    }
    
    // --- SAVE LOGIC ---
    setIsSaving(true);
    const currentData = await loadCachedResult();
    const newClusters = [...allClusters];
    await cacheFinalResult({ ...currentData, clusters: newClusters });
    
    toast({ title: "تم الحفظ", description: `تم حفظ القرارات للمجموعة ${selectedClusterIndex + 1}.`, });
    setIsSaving(false);
    return true;

  }, [selectedClusterIndex, selectedCluster, allClusters, toast]);

  // Effect to show toast on validation error
  useEffect(() => {
    if (validationError) {
      toast({
        title: "خطأ في التحقق",
        description: validationError,
        variant: "destructive",
      });
    }
  }, [validationError, toast]);


 const handleSaveAndNext = useCallback(async () => {
    const success = await validateAndSave();
    if (success) {
      if (selectedClusterIndex !== null && selectedClusterIndex < allClusters.length - 1) {
        setSelectedClusterIndex(selectedClusterIndex + 1);
        setActiveRecordIndex(null);
      } else {
        toast({ title: "اكتملت المراجعة", description: "لقد قمت بمراجعة جميع المجموعات.", });
      }
    }
  }, [validateAndSave, selectedClusterIndex, allClusters.length, toast]);

  const [updateQueue, setUpdateQueue] = useState<{ recordId: string, decision: string } | null>(null);

  useEffect(() => {
    if (!updateQueue || selectedClusterIndex === null) return;
  
    const { recordId, decision } = updateQueue;
  
    handleUpdateClusterDecision(selectedClusterIndex, (currentCluster) => {
      let newDecisions = { ...(currentCluster.recordDecisions || {}), [recordId]: decision };
      const newReasons: { [key: string]: string } = {};
  
      const keptRecord = currentCluster.records.find(r => newDecisions[r._internalId!] === "تبقى");
      const verifyRecords = currentCluster.records.filter(r => newDecisions[r._internalId!] === "تحقق");
  
      currentCluster.records.forEach(record => {
        const currentDecision = newDecisions[record._internalId!];
        if (currentDecision === "مكررة") {
          const targetRecord = keptRecord || verifyRecords[0];
          if (targetRecord) {
            newReasons[record._internalId!] = `مستفيدة مكررة مع ${targetRecord.beneficiaryId} - ${targetRecord.womanName || ""}`;
          }
        } else if (currentDecision === "تحقق") {
          const otherVerify = verifyRecords.find(r => r._internalId !== record._internalId);
          const target = otherVerify || keptRecord || currentCluster.records.find(r => newDecisions[r._internalId!] === "ليست تكرار") || currentCluster.records.find(r => newDecisions[r._internalId!] === "مكررة");
          if (target) {
            newReasons[record._internalId!] = `اشتباه تكرار مع ${target.beneficiaryId} - ${target.womanName || ""}`;
          }
        }
      });
  
      return { ...currentCluster, recordDecisions: newDecisions, decisionReasons: { ...(currentCluster.decisionReasons || {}), ...newReasons } };
    });
  
    const currentIndex = selectedCluster?.records.findIndex(r => r._internalId === recordId) ?? -1;
    if (currentIndex !== -1 && currentIndex < (selectedCluster?.records.length ?? 0) - 1) {
      setActiveRecordIndex(currentIndex + 1);
    } else {
      setTimeout(() => handleSaveAndNext(), 100);
    }
  
    setUpdateQueue(null); // Clear the queue after processing
  }, [updateQueue, handleUpdateClusterDecision, selectedClusterIndex, selectedCluster, handleSaveAndNext]);
  
  const handleRecordDecisionChange = useCallback((recordId: string, decision: string) => {
    setUpdateQueue({ recordId, decision });
  }, []);

  const handleGroupDecisionChange = useCallback((value: "تكرار" | "ليست تكرار") => {
    if (selectedClusterIndex === null) return;
    
    handleUpdateClusterDecision(selectedClusterIndex, (c) => {
      const newDecisions = { ...(c.recordDecisions || {}) };
      if (value === "تكرار" && c.records.length > 0) {
         // Do not auto-select, let user decide.
      }
      return { ...c, groupDecision: value, recordDecisions: newDecisions };
    });
    // Start the workflow
    setActiveRecordIndex(0);
  }, [selectedClusterIndex, handleUpdateClusterDecision]);


  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="ml-4">جاري تحميل المجموعات...</p>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-full max-h-[calc(100vh-10rem)]">
        {/* Cluster List */}
        <Card className="lg:col-span-1 flex flex-col">
          <CardHeader>
            <CardTitle>قائمة المجموعات</CardTitle>
            <CardDescription>
              تم العثور على {allClusters.length} مجموعات، مرتبة حسب الثقة.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex-1 overflow-y-auto">
            <div className="space-y-2">
              {allClusters.map((cluster, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setSelectedClusterIndex(index);
                    setActiveRecordIndex(null); // Reset active record on cluster change
                  }}
                  className={cn(
                    "w-full text-left p-3 rounded-lg border transition-colors",
                    selectedClusterIndex === index
                      ? "bg-primary text-primary-foreground border-primary"
                      : "hover:bg-muted",
                    cluster.groupDecision && "bg-green-100 dark:bg-green-900/30 border-green-500"
                  )}
                >
                  <div className="flex justify-between items-center">
                    <span className="font-semibold">
                      المجموعة {index + 1} ({cluster.records.length} سجلات)
                    </span>
                    <span
                      className={cn(
                        "font-bold text-lg",
                        (cluster.Max_PairScore || 0) >= 0.8
                          ? "text-red-500"
                          : (cluster.Max_PairScore || 0) >= 0.7
                          ? "text-orange-500"
                          : "text-green-500"
                      )}
                    >
                      {Math.round((cluster.Max_PairScore || 0) * 100)}%
                    </span>
                  </div>
                  <p className="text-xs truncate">
                    {cluster.records.map((r) => r.womanName).join(" | ")}
                  </p>
                   {cluster.groupDecision && (
                      <div className="flex items-center gap-1 text-xs mt-1 text-green-700 dark:text-green-300">
                          <Check className="h-3 w-3" />
                          <span>مكتمل</span>
                      </div>
                   )}
                </button>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Main Content Area */}
        <div className="lg:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-6">
          {selectedCluster ? (
             <div className="md:col-span-2 border border-gray-800 bg-gray-800 rounded-[1rem] p-1 flex-1 flex flex-col">
                <SmartphoneScreen
                  cluster={selectedCluster}
                  activeRecordIndex={activeRecordIndex}
                  onGroupDecisionChange={handleGroupDecisionChange}
                  onRecordDecisionChange={handleRecordDecisionChange}
                  onExclusionReasonChange={(recordId, reason) => {
                      if (selectedClusterIndex === null) return;
                      handleUpdateClusterDecision(selectedClusterIndex, c => ({...c, decisionReasons: {...(c.decisionReasons || {}), [recordId]: reason}}))
                  }}
                  validationError={validationError}
                />
            </div>
          ) : (
            <div className="md:col-span-2 text-center text-muted-foreground flex-1 flex items-center justify-center">
              <div>
                <Users className="mx-auto h-12 w-12" />
                <p className="mt-2">حدد مجموعة من القائمة لبدء المراجعة.</p>
              </div>
            </div>
          )}
          
          {/* Decision Summary Panel */}
          {selectedCluster && (
              <Card className="md:col-span-2">
                <CardHeader>
                  <CardTitle>ملخص القرار</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                    <p><strong>قرار المجموعة:</strong> {selectedCluster.groupDecision || 'لم يحدد'}</p>
                     <div><strong>قرارات السجلات:</strong>
                       <ul className="list-disc pl-5">
                        {selectedCluster.records.map(r => (
                            <li key={r._internalId}>
                                <span className="font-semibold">{r.womanName}:</span> 
                                <span className="ml-2">{selectedCluster.recordDecisions?.[r._internalId!] || 'لم يحدد'}</span>
                                {selectedCluster.decisionReasons?.[r._internalId!] && <span className="text-xs text-muted-foreground ml-2">({selectedCluster.decisionReasons[r._internalId!]})</span>}
                            </li>
                        ))}
                       </ul>
                    </div>
                </CardContent>
             </Card>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}

const DecisionButton = ({
  icon: Icon,
  label,
  onClick,
  isActive,
}: {
  icon: React.ElementType;
  label: string;
  onClick: () => void;
  isActive: boolean;
}) => (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
            variant={isActive ? "default" : "outline"}
            size="icon"
            onClick={onClick}
            className={cn("flex-1", isActive && "bg-primary text-primary-foreground")}
        >
            <Icon className="h-4 w-4" />
        </Button>
      </TooltipTrigger>
      <TooltipContent>
        <p>{label}</p>
      </TooltipContent>
    </Tooltip>
);

const SmartphoneScreen = ({
  cluster,
  activeRecordIndex,
  onGroupDecisionChange,
  onRecordDecisionChange,
  onExclusionReasonChange,
  validationError,
}: {
  cluster: Cluster;
  activeRecordIndex: number | null;
  onGroupDecisionChange: (value: "تكرار" | "ليست تكرار") => void;
  onRecordDecisionChange: (recordId: string, decision: string) => void;
  onExclusionReasonChange: (recordId: string, reason: string) => void;
  validationError: string | null;
}) => {
  const groupDecisionOptions = [
    { label: "تكرار", value: "تكرار", icon: Copy },
    { label: "ليست تكرار", value: "ليست تكرار", icon: ShieldOff },
  ] as const;

  const recordDecisionOptions = [
    { label: "تبقى", value: "تبقى", icon: CheckCircle },
    { label: "مكررة", value: "مكررة", icon: Copy },
    { label: "تحقق", value: "تحقق", icon: HelpCircle },
    { label: "مستبعدة", value: "مستبعدة", icon: Ban },
    { label: "ليست تكرار", value: "ليست تكرار", icon: ShieldOff },
  ] as const;

  const activeRecord = activeRecordIndex !== null ? cluster.records[activeRecordIndex] : null;

  const getChildrenText = (record: RecordRow | undefined) => {
    if (!record || !record.children) return '';
    return Array.isArray(record.children) ? record.children.join(', ') : String(record.children);
  }
  
  const reviewedCount = useMemo(() => {
    if (!cluster.groupDecision || cluster.groupDecision !== 'تكرار') return 0;
    return Object.values(cluster.recordDecisions || {}).filter(Boolean).length;
  }, [cluster.recordDecisions, cluster.groupDecision]);


  return (
    <div className="h-full flex flex-col bg-background rounded-[1rem] overflow-hidden">
      <div className="p-3 border-b flex justify-between items-center">
        <h2 className="font-bold text-sm">
            المجموعة ({cluster.records.length} سجلات)
        </h2>
        {cluster.groupDecision === 'تكرار' && (
            <span className="text-xs font-mono px-2 py-1 rounded bg-muted">
                {reviewedCount} / {cluster.records.length} records reviewed
            </span>
        )}
      </div>
      <div className="flex-1 overflow-auto">
        <Table className={cn("text-xs", validationError && "border-2 border-red-500 rounded-lg")}>
          <TableHeader>
            <TableRow>
              <TableHead>اسم السيدة</TableHead>
              <TableHead>اسم الزوج</TableHead>
              <TableHead>الرقم القومي</TableHead>
              <TableHead>الهاتف</TableHead>
              <TableHead>الأطفال</TableHead>
              <TableHead>القرار</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cluster.records.map((record, index) => {
              const isActive = index === activeRecordIndex;
              const decision = cluster.recordDecisions?.[record._internalId!];
              return (
                <TableRow key={record._internalId} className={cn(isActive && "bg-blue-100 dark:bg-blue-900/30")}>
                  <TableCell>{record.womanName}</TableCell>
                  <TableCell>{record.husbandName}</TableCell>
                  <TableCell>{record.nationalId}</TableCell>
                  <TableCell>{record.phone}</TableCell>
                  <TableCell>{getChildrenText(record)}</TableCell>
                  <TableCell>{decision || 'لم يحدد'}</TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>

      {/* Decision Panel */}
      <div className={cn("p-4 border-t bg-muted/50 space-y-4 flex-shrink-0 transition-all")}>
        {activeRecordIndex === null ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <Label className="text-sm font-semibold mb-2 block">قرار المجموعة</Label>
                <div className="flex items-center gap-2">
                    {groupDecisionOptions.map(opt => (
                        <DecisionButton 
                            key={opt.value}
                            icon={opt.icon}
                            label={opt.label}
                            onClick={() => onGroupDecisionChange(opt.value)}
                            isActive={cluster.groupDecision === opt.value}
                        />
                    ))}
                </div>
            </div>
            </div>
        ) : activeRecord ? (
            <div className="space-y-4">
                <div>
                    <Label className="text-sm font-semibold mb-2 block">قرار السجل لـ: <span className="text-primary">{activeRecord.womanName}</span></Label>
                    <div className="flex items-center gap-2">
                        {recordDecisionOptions.map(opt => (
                            <DecisionButton
                                key={opt.value}
                                icon={opt.icon}
                                label={opt.label}
                                onClick={() => onRecordDecisionChange(activeRecord._internalId!, opt.value)}
                                isActive={cluster.recordDecisions?.[activeRecord._internalId!] === opt.value}
                            />
                        ))}
                    </div>
                    {cluster.recordDecisions?.[activeRecord._internalId!] === 'مستبعدة' && (
                        <div className="mt-2">
                            <Select onValueChange={(val) => onExclusionReasonChange(activeRecord._internalId!, val)} value={cluster.decisionReasons?.[activeRecord._internalId!]}>
                                <SelectTrigger className="h-8 text-xs">
                                    <SelectValue placeholder="اختر سببًا..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="عدم انطباق المعايير على المستفيدة">عدم انطباق المعايير</SelectItem>
                                    <SelectItem value="تكرار في الاستفادة مثقفة/مستفيدة">تكرار في الاستفادة</SelectItem>
                                    <SelectItem value="انتقال سكن وإقامة المستفيدة خارج منطقة المشروع">انتقال السكن</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                </div>
            </div>
        ) : null}
      </div>
    </div>
  );
};
