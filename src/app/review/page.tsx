
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
        setActiveRecordIndex(0);
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

  const handleUpdateClusterDecision = (
    clusterIndex: number,
    updateFn: (cluster: Cluster) => Cluster
  ) => {
    setAllClusters((prev) =>
      prev.map((c, i) => (i === clusterIndex ? updateFn(c) : c))
    );
  };

  const handleSaveAndNext = async () => {
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
      setActiveRecordIndex(0);
    } else {
      toast({
        title: "اكتملت المراجعة",
        description: "لقد قمت بمراجعة جميع المجموعات.",
      });
    }
    setIsSaving(false);
  };

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
                  setActiveRecordIndex(0);
                }}
                className={cn(
                  "w-full text-left p-3 rounded-lg border transition-colors",
                  selectedClusterIndex === index
                    ? "bg-primary text-primary-foreground border-primary"
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
              </button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Smartphone Panel */}
      <div className="lg:col-span-2 flex items-center justify-center">
        {selectedCluster ? (
          <SmartphoneShell>
            <SmartphoneScreen
              cluster={selectedCluster}
              clusterIndex={selectedClusterIndex!}
              activeRecordIndex={activeRecordIndex}
              setActiveRecordIndex={setActiveRecordIndex}
              onUpdateDecision={handleUpdateClusterDecision}
            />
          </SmartphoneShell>
        ) : (
          <div className="text-center text-muted-foreground">
            <Users className="mx-auto h-12 w-12" />
            <p className="mt-2">حدد مجموعة من القائمة لبدء المراجعة.</p>
          </div>
        )}
      </div>
      
       {/* Decision Panel */}
       <Card className="lg:col-span-3">
          <CardHeader>
            <CardTitle>لوحة القرار</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
               {selectedCluster && selectedClusterIndex !== null && (
                <div>
                  <h3 className="font-semibold mb-2">ملخص القرار للمجموعة {selectedClusterIndex + 1}</h3>
                   <div className="p-4 bg-muted rounded-lg space-y-2 text-sm">
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
                   </div>
                </div>
               )}
               <div className="flex justify-end">
                <Button onClick={handleSaveAndNext} disabled={isSaving}>
                    {isSaving ? <Loader2 className="animate-spin mr-2" /> : <Save className="mr-2" />}
                    حفظ وتحميل المجموعة التالية
                </Button>
               </div>
          </CardContent>
       </Card>
    </div>
  );
}

const SmartphoneShell = ({ children }: { children: React.ReactNode }) => (
  <div className="relative mx-auto border-gray-800 dark:border-gray-800 bg-gray-800 border-[14px] rounded-[2.5rem] h-[700px] w-[350px] shadow-xl">
    <div className="w-[148px] h-[18px] bg-gray-800 top-0 rounded-b-[1rem] left-1/2 -translate-x-1/2 absolute"></div>
    <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[124px] rounded-l-lg"></div>
    <div className="h-[46px] w-[3px] bg-gray-800 absolute -left-[17px] top-[178px] rounded-l-lg"></div>
    <div className="h-[64px] w-[3px] bg-gray-800 absolute -right-[17px] top-[142px] rounded-r-lg"></div>
    <div className="rounded-[2rem] overflow-hidden w-full h-full bg-background">
      {children}
    </div>
  </div>
);

const SmartphoneScreen = ({
  cluster,
  clusterIndex,
  activeRecordIndex,
  setActiveRecordIndex,
  onUpdateDecision,
}: {
  cluster: Cluster;
  clusterIndex: number;
  activeRecordIndex: number | null;
  setActiveRecordIndex: (index: number | null) => void;
  onUpdateDecision: (index: number, fn: (c: Cluster) => Cluster) => void;
}) => {

  const handleGroupDecisionChange = (value: "تكرار" | "ليست تكرار") => {
    onUpdateDecision(clusterIndex, (c) => ({ ...c, groupDecision: value }));
  };

  const handleRecordDecisionChange = (recordId: string, decision: string) => {
    onUpdateDecision(clusterIndex, (currentCluster) => {
        let newDecisions = { ...(currentCluster.recordDecisions || {}), [recordId]: decision };
        
        // Auto-select "تبقى" for the first record if group is "تكرار" and it's the first decision
        if (cluster.groupDecision === 'تكرار' && Object.keys(newDecisions).length === 1) {
            newDecisions[cluster.records[0]._internalId!] = 'تبقى';
        }

        // --- Start of logic moved from useEffect ---
        const newReasons: { [key: string]: string } = {};

        const keptRecord = cluster.records.find(
          (r) => newDecisions[r._internalId!] === "تبقى"
        );
        const verifyRecord = cluster.records.find(
          (r) => newDecisions[r._internalId!] === "تحقق"
        );

        cluster.records.forEach((record) => {
          const currentDecision = newDecisions[record._internalId!];
          if (currentDecision === "مكررة") {
            const targetRecord = keptRecord || verifyRecord;
            if (targetRecord) {
              newReasons[record._internalId!] = `مستفيدة مكررة مع ${
                targetRecord.beneficiaryId
              } - ${targetRecord.womanName || ""}`;
            }
          } else if (currentDecision === "تحقق") {
            const otherVerify = cluster.records.find(
              (r) =>
                r._internalId !== record._internalId &&
                newDecisions[r._internalId!] === "تحقق"
            );
            const target =
              otherVerify ||
              keptRecord ||
              cluster.records.find(
                (r) => newDecisions[r._internalId!] === "ليست تكرار"
              ) ||
              cluster.records.find(
                (r) => newDecisions[r._internalId!] === "مكررة"
              );

            if (target) {
              newReasons[record._internalId!] = `اشتباه تكرار مع ${
                target.beneficiaryId
              } - ${target.womanName || ""}`;
            }
          }
        });
        // --- End of logic moved from useEffect ---

        return { ...currentCluster, recordDecisions: newDecisions, decisionReasons: { ...(currentCluster.decisionReasons || {}), ...newReasons } };
    });
    // Move to next record automatically
    if (activeRecordIndex !== null && activeRecordIndex < cluster.records.length - 1) {
        setActiveRecordIndex(activeRecordIndex + 1);
    } else {
        setActiveRecordIndex(null); // All done
    }
  };
  
  const handleExclusionReasonChange = (recordId: string, reason: string) => {
     onUpdateDecision(clusterIndex, c => ({ ...c, decisionReasons: { ...(c.decisionReasons || {}), [recordId]: reason }}));
  };

  return (
    <div className="h-full flex flex-col">
      <div className="p-4 border-b">
        <h2 className="font-bold text-center">المجموعة {clusterIndex + 1}</h2>
        <p className="text-xs text-muted-foreground text-center">
          {cluster.records.length} سجلات
        </p>
      </div>
      <ScrollArea className="flex-1">
        <div className="p-4 space-y-4">
          <div>
            <Label>قرار المجموعة</Label>
            <Select
              onValueChange={handleGroupDecisionChange}
              value={cluster.groupDecision}
            >
              <SelectTrigger>
                <SelectValue placeholder="اختر قرارًا للمجموعة..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="تكرار">تكرار</SelectItem>
                <SelectItem value="ليست تكرار">ليست تكرار</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Separator />
          {cluster.records.map((record, index) => (
            <RecordCard
              key={record._internalId}
              record={record}
              isActive={index === activeRecordIndex}
              onSelect={() => setActiveRecordIndex(index)}
              decision={cluster.recordDecisions?.[record._internalId!]}
              onDecisionChange={(decision) => handleRecordDecisionChange(record._internalId!, decision)}
              exclusionReason={cluster.decisionReasons?.[record._internalId!]}
              onExclusionReasonChange={(reason) => handleExclusionReasonChange(record._internalId!, reason)}
            />
          ))}
        </div>
      </ScrollArea>
    </div>
  );
};

const RecordCard = ({
  record,
  isActive,
  onSelect,
  decision,
  onDecisionChange,
  exclusionReason,
  onExclusionReasonChange
}: {
  record: RecordRow;
  isActive: boolean;
  onSelect: () => void;
  decision?: string;
  onDecisionChange: (decision: string) => void;
  exclusionReason?: string;
  onExclusionReasonChange: (reason: string) => void;
}) => {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <Card
      className={cn(
        "transition-all",
        isActive ? "border-primary shadow-lg" : "border-border"
      )}
    >
      <CardHeader className="p-3 cursor-pointer" onClick={() => { onSelect(); setIsOpen(!isOpen); }}>
        <div className="flex justify-between items-center">
          <p className="font-semibold text-sm truncate">{record.womanName}</p>
          {isOpen ? <ChevronUp className="h-4 w-4"/> : <ChevronDown className="h-4 w-4"/>}
        </div>
      </CardHeader>
      {isOpen && (
        <CardContent className="p-3 pt-0 text-xs space-y-2">
          <p>
            <strong>المستفيد:</strong> {record.beneficiaryId}
          </p>
          <p>
            <strong>الزوج:</strong> {record.husbandName}
          </p>
          <p>
            <strong>الرقم القومي:</strong> {record.nationalId}
          </p>
          <p>
            <strong>الهاتف:</strong> {record.phone}
          </p>
           <p>
            <strong>الموقع:</strong> {record.village}
          </p>
          <div className="pt-2">
            <Label>قرار السجل</Label>
            <Select onValueChange={onDecisionChange} value={decision}>
              <SelectTrigger>
                <SelectValue placeholder="اختر قرارًا..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="مكررة">مكررة</SelectItem>
                <SelectItem value="ليست تكرار">ليست تكرار</SelectItem>
                <SelectItem value="تبقى">تبقى</SelectItem>
                <SelectItem value="تحقق">تحقق</SelectItem>
                <SelectItem value="مستبعدة">مستبعدة</SelectItem>
              </SelectContent>
            </Select>
             {decision === 'مستبعدة' && (
                <div className="mt-2">
                    <Label>سبب الاستبعاد</Label>
                    <Select onValueChange={onExclusionReasonChange} value={exclusionReason}>
                        <SelectTrigger>
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
          </div>
        </CardContent>
      )}
    </Card>
  );
};
