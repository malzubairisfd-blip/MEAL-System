
"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import type { RecordRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search, Sparkles, Sigma, Save } from "lucide-react";
import { loadCachedResult } from "@/lib/cache";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { preprocessRow } from "@/workers/preprocess";
import { jaroWinkler, nameOrderFreeScore, tokenJaccard } from "@/lib/similarity";


interface AnalysisResult {
  woman: { a: string[]; b: string[]; scores: Record<string, number> };
  husband: { a: string[]; b: string[]; scores: Record<string, number> };
  orderFree: number;
  phone: number;
  children: number;
}

const extractLineage = (parts: string[]) => ({
    first: parts[0] || '',
    father: parts[1] || '',
    grandfather: parts[2] || '',
    family: parts[parts.length - 1] || '',
});

const LOCAL_STORAGE_KEY_PREFIX = "beneficiary-mapping-";

export default function CorrectionPage() {
    const { toast } = useToast();
    const [allRecords, setAllRecords] = useState<RecordRow[]>([]);
    const [mapping, setMapping] = useState<Record<string,string>>({});
    const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
    const [searchTerm, setSearchTerm] = useState("");
    const [isLearning, setIsLearning] = useState(false);
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [loading, setLoading] = useState(true);
    const [generatedRule, setGeneratedRule] = useState<any | null>(null);

    const learningWorkerRef = useRef<Worker | null>(null);

    useEffect(() => {
        if (typeof window !== 'undefined') {
            const worker = new Worker(new URL('@/workers/learning.worker.ts', import.meta.url));
            learningWorkerRef.current = worker;

            worker.onmessage = (event) => {
                const { error, rule } = event.data;
                setIsLearning(false);
                if (error) {
                    toast({ title: "Rule Generation Failed", description: error, variant: "destructive" });
                } else if (rule) {
                    setGeneratedRule(rule);
                    toast({ title: "Rule Generated", description: "Review the generated rule in the preview panel below." });
                }
            };

            return () => worker.terminate();
        }
    }, [toast]);

    useEffect(() => {
        const fetchData = async () => {
            setLoading(true);
            const cached = await loadCachedResult();
            if (cached?.rows) {
                setAllRecords(cached.rows);
                 if (cached.originalHeaders) {
                    const storageKey = LOCAL_STORAGE_KEY_PREFIX + cached.originalHeaders.join(',');
                    const savedMapping = localStorage.getItem(storageKey);
                    if (savedMapping) {
                        try {
                            setMapping(JSON.parse(savedMapping));
                        } catch {}
                    }
                }
            } else {
                toast({ title: "No Data Found", description: "Please upload a file on the Upload page first.", variant: "destructive" });
            }
            setLoading(false);
        };
        fetchData();
    }, [toast]);

    useEffect(() => {
        if (selectedRecordIds.size === 2) {
            setGeneratedRule(null); // Clear previous rule on new selection
            const [idA, idB] = Array.from(selectedRecordIds);
            const recordA = allRecords.find(r => r._internalId === idA);
            const recordB = allRecords.find(r => r._internalId === idB);

            if (recordA && recordB && mapping.womanName) {
                const mappedRecordA = {
                    womanName: recordA[mapping.womanName],
                    husbandName: recordA[mapping.husbandName],
                    children: recordA[mapping.children],
                    phone: recordA[mapping.phone],
                    _internalId: recordA._internalId,
                }
                const mappedRecordB = {
                    womanName: recordB[mapping.womanName],
                    husbandName: recordB[mapping.husbandName],
                    children: recordB[mapping.children],
                    phone: recordB[mapping.phone],
                    _internalId: recordB._internalId,
                }

                const a = preprocessRow(mappedRecordA);
                const b = preprocessRow(mappedRecordB);
                
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
    }, [selectedRecordIds, allRecords, mapping]);

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

    const generateRuleFromPattern = () => {
        if (selectedRecordIds.size !== 2 || !analysis) {
            toast({ title: "Selection Required", description: "Please select exactly two records to generate a rule.", variant: "destructive" });
            return;
        }
        setIsLearning(true);

        const pattern: Record<string, number> = {};
        
        // Collect all non-zero scores
        Object.entries(analysis.woman.scores).forEach(([key, score]) => {
            if (score > 0) pattern[`woman_${key}`] = score;
        });
        Object.entries(analysis.husband.scores).forEach(([key, score]) => {
            if (score > 0) pattern[`husband_${key}`] = score;
        });
        if (analysis.orderFree > 0) pattern.orderFree = analysis.orderFree;
        if (analysis.phone > 0) pattern.phone = analysis.phone;
        if (analysis.children > 0) pattern.children = analysis.children;
        
        const [idA, idB] = Array.from(selectedRecordIds);
        const records = [
            allRecords.find(r => r._internalId === idA),
            allRecords.find(r => r._internalId === idB)
        ];

        learningWorkerRef.current?.postMessage({ records, mapping, pattern });
    };

    const handleConfirmRule = async () => {
        if (!generatedRule) return;

        setIsLearning(true);
        try {
            await fetch('/api/rules', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(generatedRule)
            });
            toast({ title: "Rule Saved Successfully!", description: `Rule ${generatedRule.id} has been added.`});
            setGeneratedRule(null);
            setSelectedRecordIds(new Set());
            setAnalysis(null);
        } catch (error: any) {
            toast({ title: "Failed to Save Rule", description: error.message, variant: "destructive" });
        } finally {
            setIsLearning(false);
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <Loader2 className="h-8 w-8 animate-spin mr-2" />
                Loading records...
            </div>
        );
    }
    
    return (
        <div className="h-full flex flex-col gap-6">
            <Card>
                <CardHeader>
                    <CardTitle>Data Correction & Rule Learning</CardTitle>
                    <CardDescription>
                        Select exactly two records that should have been clustered together to analyze their similarities and generate a new matching rule.
                    </CardDescription>
                </CardHeader>
            </Card>

            <div className="flex flex-col gap-6 flex-1 overflow-hidden">
                <Card>
                    <CardHeader>
                        <CardTitle>Select Records</CardTitle>
                    </CardHeader>
                    <CardContent className="flex flex-col gap-4">
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
                            <ScrollArea className="h-96">
                                <Table>
                                    <TableHeader className="bg-primary text-primary-foreground">
                                    <TableRow>
                                        <TableHead className="w-[50px] font-bold text-black">Select</TableHead>
                                        <TableHead className="font-bold text-black">Woman Name</TableHead>
                                        <TableHead className="font-bold text-black">Husband Name</TableHead>
                                        <TableHead className="font-bold text-black">National ID</TableHead>
                                    </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {filteredRecords.map(record => (
                                            <TableRow key={record._internalId}
                                                className={`cursor-pointer ${selectedRecordIds.has(record._internalId!) ? 'bg-blue-100 hover:bg-blue-200 text-black' : 'hover:bg-muted'}`}
                                                onClick={() => handleSelect(record._internalId!)}
                                            >
                                                <TableCell>
                                                <Checkbox
                                                    checked={selectedRecordIds.has(record._internalId!)}
                                                />
                                                </TableCell>
                                                <TableCell>{record[mapping.womanName]}</TableCell>
                                                <TableCell>{record[mapping.husbandName]}</TableCell>
                                                <TableCell>{String(record[mapping.nationalId])}</TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </ScrollArea>
                        </div>
                    </CardContent>
                </Card>
                
                {analysis && (
                    <Card className="flex-1 flex flex-col">
                        <CardHeader>
                            <CardTitle className="flex items-center gap-2"><Sparkles className="text-primary"/> Analysis Panel</CardTitle>
                        </CardHeader>
                        <CardContent className="flex-1 overflow-y-auto">
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
                        </CardContent>
                            <div className="p-6 border-t">
                            <Button onClick={generateRuleFromPattern} disabled={isLearning || selectedRecordIds.size !== 2} className="w-full">
                                {isLearning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Sigma className="mr-2 h-4 w-4" />}
                                Generate Rule from Pattern
                            </Button>
                        </div>
                    </Card>
                )}

                {generatedRule && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Generated Rule Preview</CardTitle>
                            <CardDescription>Review the generated rule below. If it looks correct, confirm to save it.</CardDescription>
                        </CardHeader>
                        <CardContent className="space-y-4">
                            <pre className="p-4 bg-muted rounded-md text-xs font-mono overflow-x-auto">
                                <code>
                                    {generatedRule.code}
                                </code>
                            </pre>
                            <Button onClick={handleConfirmRule} disabled={isLearning} className="w-full">
                                {isLearning ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                                Confirm & Save Rule
                            </Button>
                        </CardContent>
                    </Card>
                )}
                
            </div>
        </div>
    );
}

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


function AnalysisSection({ title, data }: { title: string, data: AnalysisResult['woman'] }) {
    return (
        <div className="space-y-2">
            <h4 className="font-semibold">{title}</h4>
            <p className="truncate"><b>A:</b> {data.a.join(' ')}</p>
            <p className="truncate"><b>B:</b> {data.b.join(' ')}</p>
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

    
