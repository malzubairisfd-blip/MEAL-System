
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
  Smartphone,
  ChevronDown,
  ChevronUp,
  Save,
  Users,
  Check,
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
import { Separator } from "@/components/ui/separator";
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
  const [selectedClusterIndex, setSelectedClusterIndex] = useState<number | null>(
    null
  );
  const [activeRecordIndex, setActiveRecordIndex] = useState<number | null>(null);
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
      setAllClusters((prev) =>
        prev.map((c, i) => (i === clusterIndex ? updateFn(c) : c))
      );
    },
    []
  );

  const handleSaveAndNext = useCallback(async () => {
    if (selectedClusterIndex === null || !selectedCluster) return;

    // Validation
    if (
      selectedCluster.groupDecision === "تكرار" &&
      !Object.values(selectedCluster.recordDecisions || {}).some(
        (d) => d === "تبقى"
      )
    ) {
      toast({
        title: "خطأ في التحقق",
        description: "عندما تكون المجموعة مكررة، يجب أن يبقى سجل واحد على الأقل.",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    const currentData = await loadCachedResult();
    const newClusters = [...allClusters];
    await cacheFinalResult({ ...currentData, clusters: newClusters });

    toast({
      title: "تم الحفظ",
      description: `تم حفظ القرارات للمجموعة ${selectedClusterIndex + 1}.`,
    });

    if (selectedClusterIndex < allClusters.length - 1) {
      setSelectedClusterIndex(selectedClusterIndex + 1);
      setActiveRecordIndex(null); // Reset active record for new cluster
    } else {
      toast({
        title: "اكتملت المراجعة",
        description: "لقد قمت بمراجعة جميع المجموعات.",
      });
    }
    setIsSaving(false);
  }, [selectedClusterIndex, selectedCluster, allClusters, toast]);


  const handleRecordDecisionChange = useCallback((recordId: string, decision: string) => {
    if (selectedClusterIndex === null || !selectedCluster) return;
  
    handleUpdateClusterDecision(selectedClusterIndex, (currentCluster) => {
      let newDecisions = { ...(currentCluster.recordDecisions || {}), [recordId]: decision };
      const newReasons: { [key: string]: string } = {};
  
      const keptRecord = currentCluster.records.find(r => newDecisions[r._internalId!] === "تبقى");
      const verifyRecord = currentCluster.records.find(r => newDecisions[r._internalId!] === "تحقق");
  
      currentCluster.records.forEach(record => {
        const currentDecision = newDecisions[record._internalId!];
        if (currentDecision === "مكررة") {
          const targetRecord = keptRecord || verifyRecord;
          if (targetRecord) {
            newReasons[record._internalId!] = `مستفيدة مكررة مع ${targetRecord.beneficiaryId} - ${targetRecord.womanName || ""}`;
          }
        } else if (currentDecision === "تحقق") {
          const otherVerify = currentCluster.records.find(r => r._internalId !== record._internalId && newDecisions[r._internalId!] === "تحقق");
          const target = otherVerify || keptRecord || currentCluster.records.find(r => newDecisions[r._internalId!] === "ليست تكرار") || currentCluster.records.find(r => newDecisions[r._internalId!] === "مكررة");
          if (target) {
            newReasons[record._internalId!] = `اشتباه تكرار مع ${target.beneficiaryId} - ${target.womanName || ""}`;
          }
        }
      });
  
      return { ...currentCluster, recordDecisions: newDecisions, decisionReasons: { ...(currentCluster.decisionReasons || {}), ...newReasons } };
    });
  
    const currentIndex = selectedCluster.records.findIndex(r => r._internalId === recordId);
    if (currentIndex < selectedCluster.records.length - 1) {
      setActiveRecordIndex(currentIndex + 1);
    } else {
      setActiveRecordIndex(null); // Mark as done
      handleSaveAndNext(); // Auto-save and move to next cluster
    }
  }, [selectedClusterIndex, handleUpdateClusterDecision, selectedCluster, handleSaveAndNext]);

  const handleGroupDecisionChange = useCallback((value: "تكرار" | "ليست تكرار") => {
    if (selectedClusterIndex === null) return;
    
    handleUpdateClusterDecision(selectedClusterIndex, (c) => {
        const newDecisions = { ...(c.recordDecisions || {}) };
        if (value === "تكرار" && c.records.length > 0) {
            // Automatically set first record to "تبقى" if it's a new decision
             if(!Object.values(newDecisions).some(d => d === 'تبقى')) {
               newDecisions[c.records[0]._internalId!] = 'تبقى';
             }
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
                    : cluster.groupDecision // Mark completed clusters
                    ? "bg-green-100 dark:bg-green-900/30 border-green-500"
                    : "hover:bg-muted"
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
      <div className="lg:col-span-2 flex flex-col gap-6">
        {selectedCluster ? (
           <SmartphoneShellLandscape>
            <SmartphoneScreen
              cluster={selectedCluster}
              activeRecordIndex={activeRecordIndex}
              onGroupDecisionChange={handleGroupDecisionChange}
              onRecordDecisionChange={handleRecordDecisionChange}
              onExclusionReasonChange={(recordId, reason) => {
                  if (selectedClusterIndex === null) return;
                  handleUpdateClusterDecision(selectedClusterIndex, c => ({...c, decisionReasons: {...(c.decisionReasons || {}), [recordId]: reason}}))
              }}
            />
          </SmartphoneShellLandscape>
        ) : (
          <div className="text-center text-muted-foreground flex-1 flex items-center justify-center">
            <div>
              <Users className="mx-auto h-12 w-12" />
              <p className="mt-2">حدد مجموعة من القائمة لبدء المراجعة.</p>
            </div>
          </div>
        )}
        
        {/* Decision Summary Panel */}
        {selectedCluster && (
            <Card>
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
                   <div className="flex justify-end pt-4">
                    <Button onClick={handleSaveAndNext} disabled={isSaving}>
                        {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                        حفظ وتحميل المجموعة التالية
                    </Button>
                   </div>
              </CardContent>
           </Card>
        )}
      </div>
    </div>
  );
}

const SmartphoneShellLandscape = ({ children }: { children: React.ReactNode }) => (
  <div className="relative mx-auto border-gray-800 bg-gray-800 border-[14px] rounded-[2.5rem] h-[350px] w-[700px] shadow-xl">
    <div className="h-[46px] w-[3px] bg-gray-800 absolute -top-[17px] left-[124px] rounded-t-lg"></div>
    <div className="h-[46px] w-[3px] bg-gray-800 absolute -top-[17px] left-[178px] rounded-t-lg"></div>
    <div className="h-[64px] w-[3px] bg-gray-800 absolute -right-[17px] top-[142px] rounded-r-lg transform -rotate-90 origin-top-right"></div>
    <div className="rounded-[2rem] overflow-hidden w-full h-full bg-background">
      {children}
    </div>
  </div>
);


const SmartphoneScreen = ({
  cluster,
  activeRecordIndex,
  onGroupDecisionChange,
  onRecordDecisionChange,
  onExclusionReasonChange
}: {
  cluster: Cluster;
  activeRecordIndex: number | null;
  onGroupDecisionChange: (value: "تكرار" | "ليست تكرار") => void;
  onRecordDecisionChange: (recordId: string, decision: string) => void;
  onExclusionReasonChange: (recordId: string, reason: string) => void;
}) => {

  const decisionOptions = ["مكررة", "ليست تكرار", "تبقى", "تحقق", "مستبعدة"];

  return (
    <div className="h-full flex flex-col">
      <div className="p-3 border-b flex justify-between items-center">
        <h2 className="font-bold text-center text-sm">المجموعة ({cluster.records.length} سجلات)</h2>
         <div className="w-48">
            <Label>قرار المجموعة</Label>
            <Select onValueChange={onGroupDecisionChange} value={cluster.groupDecision}>
              <SelectTrigger className="h-8">
                <SelectValue placeholder="اختر قرارًا..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="تكرار">تكرار</SelectItem>
                <SelectItem value="ليست تكرار">ليست تكرار</SelectItem>
              </SelectContent>
            </Select>
          </div>
      </div>
      <ScrollArea className="flex-1">
        <Table className="text-xs">
          <TableHeader>
            <TableRow>
              <TableHead className="w-1/4">اسم السيدة</TableHead>
              <TableHead>اسم الزوج</TableHead>
              <TableHead>الرقم القومي</TableHead>
              <TableHead className="w-1/3">القرار</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {cluster.records.map((record, index) => {
              const isActive = index === activeRecordIndex;
              const decision = cluster.recordDecisions?.[record._internalId!];
              const isDecided = !!decision;
              return (
                <TableRow key={record._internalId} className={cn(isActive && "bg-blue-100 dark:bg-blue-900/30")}>
                  <TableCell>{record.womanName}</TableCell>
                  <TableCell>{record.husbandName}</TableCell>
                  <TableCell>{record.nationalId}</TableCell>
                  <TableCell>
                    <Select onValueChange={(val) => onRecordDecisionChange(record._internalId!, val)} value={decision} disabled={cluster.groupDecision === undefined}>
                      <SelectTrigger className="h-8">
                        <SelectValue placeholder="اختر قرارًا..." />
                      </SelectTrigger>
                      <SelectContent>
                         {decisionOptions.map(opt => <SelectItem key={opt} value={opt}>{opt}</SelectItem>)}
                      </SelectContent>
                    </Select>
                     {decision === 'مستبعدة' && (
                        <div className="mt-1">
                            <Select onValueChange={(val) => onExclusionReasonChange(record._internalId!, val)} value={cluster.decisionReasons?.[record._internalId!]}>
                                <SelectTrigger className="h-7 text-xs">
                                    <SelectValue placeholder="اختر سببًا..." />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="عدم انطباق المعايير على المستفيدة">عدم انطباق المعايير على المستفيدة</SelectItem>
                                    <SelectItem value="تكرار في الاستفادة مثقفة/مستفيدة">تكرار في الاستفادة مثقفة/مستفيدة</SelectItem>
                                    <SelectItem value="انتقال سكن وإقامة المستفيدة خارج منطقة المشروع">انتقال سكن وإقامة المستفيدة خارج منطقة المشروع</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </ScrollArea>
    </div>
  );
};
