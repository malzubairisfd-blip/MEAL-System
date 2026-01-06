
"use client";

import { useState, useMemo, useEffect } from "react";
import type { RecordRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Sparkles, Sigma } from "lucide-react";
import { loadCachedResult } from "@/lib/cache";
import { jaroWinkler, nameOrderFreeScore, tokenJaccard } from "@/lib/similarity";
import { preprocessRow } from "@/workers/cluster.worker";
import { Card, CardContent, CardHeader, CardTitle } from "./ui/card";
import { Badge } from "./ui/badge";

interface DataCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  learningWorker: Worker;
}

type AnalysisResult = {
  woman: { a: string[], b: string[], scores: Record<string, number> };
  husband: { a: string[], b: string[], scores: Record<string, number> };
  orderFree: number;
  phone: number;
  children: number;
} | null;


const extractLineage = (parts: string[]) => ({
    first: parts[0] || '',
    father: parts[1] || '',
    grandfather: parts[2] || '',
    family: parts[parts.length - 1] || '',
});

export function DataCorrectionModal({ isOpen, onClose, learningWorker }: DataCorrectionModalProps) {
  const { toast } = useToast();
  const [allRecords, setAllRecords] = useState<RecordRow[]>([]);
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [isLearning, setIsLearning] = useState(false);
  const [analysis, setAnalysis] = useState<AnalysisResult>(null);

  useEffect(() => {
    if (isOpen) {
      const fetchData = async () => {
        const cached = await loadCachedResult();
        if (cached?.rows) {
          setAllRecords(cached.rows);
        }
      };
      fetchData();
    }
  }, [isOpen]);

  useEffect(() => {
    if (selectedRecordIds.size === 2) {
      const [idA, idB] = Array.from(selectedRecordIds);
      const recordA = allRecords.find(r => r._internalId === idA);
      const recordB = allRecords.find(r => r._internalId === idB);

      if (recordA && recordB) {
        const a = preprocessRow(recordA);
        const b = preprocessRow(recordB);
        
        const lineageA = extractLineage(a.parts);
        const lineageB = extractLineage(b.parts);
        const husbandLineageA = extractLineage(a.husbandParts);
        const husbandLineageB = extractLineage(b.husbandParts);

        setAnalysis({
          woman: {
            a: a.parts,
            b: b.parts,
            scores: {
              first: jaroWinkler(lineageA.first, lineageB.first),
              father: jaroWinkler(lineageA.father, lineageB.father),
              grandfather: jaroWinkler(lineageA.grandfather, lineageB.grandfather),
              family: jaroWinkler(lineageA.family, lineageB.family),
            }
          },
          husband: {
            a: a.husbandParts,
            b: b.husbandParts,
            scores: {
              first: jaroWinkler(husbandLineageA.first, husbandLineageB.first),
              father: jaroWinkler(husbandLineageA.father, husbandLineageB.father),
              grandfather: jaroWinkler(husbandLineageA.grandfather, husbandLineageB.grandfather),
              family: jaroWinkler(husbandLineageA.family, husbandLineageB.family),
            }
          },
          orderFree: nameOrderFreeScore(a.parts, b.parts),
          phone: a.phone && b.phone && a.phone.slice(-6) === b.phone.slice(-6) ? 1 : 0,
          children: tokenJaccard(a.children_normalized, b.children_normalized),
        });
      }
    } else {
      setAnalysis(null);
    }
  }, [selectedRecordIds, allRecords]);

  const filteredRecords = useMemo(() => {
    if (!searchTerm) return allRecords;
    const lowercasedTerm = searchTerm.toLowerCase();
    return allRecords.filter(record => 
      Object.values(record).some(value => 
        String(value).toLowerCase().includes(lowercasedTerm)
      )
    );
  }, [allRecords, searchTerm]);

  const handleSelect = (recordId: string) => {
    setSelectedRecordIds(prev => {
      const newSet = new Set(prev);
      if (newSet.has(recordId)) {
        newSet.delete(recordId);
      } else {
        if (newSet.size < 2) {
          newSet.add(recordId);
        } else {
          toast({ title: "Selection Limit", description: "You can only compare two records at a time for rule generation.", variant: "default" });
        }
      }
      return newSet;
    });
  };

  const generateRuleFromPattern = async () => {
    if (!analysis) {
        toast({ title: "Analysis Incomplete", description: "Cannot generate rule without a completed analysis.", variant: "destructive" });
        return;
    }
    
    setIsLearning(true);

    const isWomanCore = Object.values(analysis.woman.scores).some(s => s >= 0.93) && analysis.woman.scores.family >= 0.93;
    const isHusbandCore = Object.values(analysis.husband.scores).some(s => s >= 0.93) && analysis.husband.scores.family >= 0.93;

    const pattern = {
        womanCore: isWomanCore,
        husbandCore: isHusbandCore,
        orderFree: analysis.orderFree >= 0.9,
        phoneLast6: analysis.phone === 1,
        childrenFuzzy: analysis.children >= 0.6,
    };
    
    // Check if any rule condition is met before sending
    if (Object.values(pattern).every(v => v === false)) {
        toast({
            title: "No Strong Pattern Detected",
            description: "The similarities between the selected records are not strong enough to generate a high-confidence rule. Try selecting a different pair.",
            variant: "default",
        });
        setIsLearning(false);
        return;
    }
    
    const [idA, idB] = Array.from(selectedRecordIds);
    const recordA = allRecords.find(r => r._internalId === idA);
    const recordB = allRecords.find(r => r._internalId === idB);

    learningWorker.postMessage({
        pattern,
        records: [recordA, recordB] // Pass records for potential future use
    });

    toast({
      title: "Learning in Progress",
      description: "The new rule is being generated in the background. You will be notified upon completion.",
    });

    setIsLearning(false);
    onClose();
  };

  const ScoreBadge = ({ score }: { score: number }) => {
    let color: "green" | "yellow" | "red" | "gray" = "gray";
    if (score >= 0.93) color = "green";
    else if (score >= 0.85) color = "yellow";

    const baseClasses = "font-mono text-xs";
    const colorClasses = {
        green: "bg-green-100 text-green-800",
        yellow: "bg-yellow-100 text-yellow-800",
        red: "bg-red-100 text-red-800",
        gray: "bg-gray-100 text-gray-800",
    }
    return <Badge className={`${baseClasses} ${colorClasses[color]}`}>{score.toFixed(3)}</Badge>;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-7xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Data Correction & Rule Learning</DialogTitle>
          <DialogDescription>
            Select exactly two records that were missed by clustering to analyze them and generate a new rule.
          </DialogDescription>
        </DialogHeader>
        <div className="grid grid-cols-3 gap-6 flex-1 overflow-hidden">
            <div className="col-span-2 flex flex-col gap-4">
                 <div className="relative">
                    <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                    <Input 
                        placeholder="Search all records..."
                        className="pl-10"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                <div className="flex-1 overflow-hidden border rounded-md">
                    <ScrollArea className="h-full">
                        <Table>
                            <TableHeader>
                            <TableRow>
                                <TableHead className="w-[50px]">Select</TableHead>
                                <TableHead>Woman Name</TableHead>
                                <TableHead>Husband Name</TableHead>
                                <TableHead>National ID</TableHead>
                            </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredRecords.map(record => (
                                    <TableRow key={record._internalId}
                                        className={`cursor-pointer ${selectedRecordIds.has(record._internalId!) ? 'bg-blue-100 hover:bg-blue-200' : 'hover:bg-muted'}`}
                                        onClick={() => handleSelect(record._internalId!)}
                                    >
                                        <TableCell>
                                        <Checkbox
                                            checked={selectedRecordIds.has(record._internalId!)}
                                        />
                                        </TableCell>
                                        <TableCell>{record.womanName}</TableCell>
                                        <TableCell>{record.husbandName}</TableCell>
                                        <TableCell>{String(record.nationalId)}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </div>
            </div>
            <div className="col-span-1">
                <Card className="h-full flex flex-col">
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2"><Sparkles className="text-primary"/> Analysis Panel</CardTitle>
                    </CardHeader>
                    <CardContent className="flex-1 overflow-y-auto">
                        {!analysis ? (
                             <div className="flex items-center justify-center h-full text-muted-foreground">
                                <p>Select two records to begin analysis.</p>
                            </div>
                        ) : (
                            <div className="space-y-4 text-sm">
                                <AnalysisSection title="Woman Name Analysis" data={analysis.woman} />
                                <AnalysisSection title="Husband Name Analysis" data={analysis.husband} />
                                <div className="space-y-2">
                                     <h4 className="font-semibold">Other Factors</h4>
                                      <ComparisonRow label="Order-Free Name Score" score={analysis.orderFree} />
                                      <ComparisonRow label="Phone (Last 6 Digits)" score={analysis.phone} />
                                      <ComparisonRow label="Children Fuzzy Match" score={analysis.children} />
                                </div>
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </div>
        <DialogFooter>
          <span className="text-sm text-muted-foreground mr-auto">
            {selectedRecordIds.size} record(s) selected
          </span>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={generateRuleFromPattern} disabled={isLearning || selectedRecordIds.size !== 2 || !analysis}>
            {isLearning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Sigma className="mr-2 h-4 w-4" />
            Generate Rule from Pattern
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

    function AnalysisSection({ title, data }: { title: string, data: AnalysisResult['woman'] }) {
        return (
            <div className="space-y-2">
                <h4 className="font-semibold">{title}</h4>
                <p><b>Record A:</b> {data.a.join(' ')}</p>
                <p><b>Record B:</b> {data.b.join(' ')}</p>
                <div className="pl-4">
                    <ComparisonRow label="First Name" score={data.scores.first} />
                    <ComparisonRow label="Father" score={data.scores.father} />
                    <ComparisonRow label="Grandfather" score={data.scores.grandfather} />
                    <ComparisonRow label="Family Name" score={data.scores.family} />
                </div>
            </div>
        );
    }
    
    function ComparisonRow({ label, score }: { label: string, score: number }) {
        return (
            <div className="flex justify-between items-center">
                <span>{label}:</span>
                <ScoreBadge score={score} />
            </div>
        );
    }
}
