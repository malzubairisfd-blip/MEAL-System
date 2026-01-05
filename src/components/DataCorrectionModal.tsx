
"use client";

import { useState, useMemo } from "react";
import type { RecordRow } from "@/lib/types";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Search } from "lucide-react";

interface DataCorrectionModalProps {
  allRecords: RecordRow[];
  mapping: Record<string, string>;
  isOpen: boolean;
  onClose: () => void;
  learningWorker: Worker;
}

export function DataCorrectionModal({ allRecords, mapping, isOpen, onClose, learningWorker }: DataCorrectionModalProps) {
  const { toast } = useToast();
  const [selectedRecordIds, setSelectedRecordIds] = useState<Set<string>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [isLearning, setIsLearning] = useState(false);
  
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
        newSet.add(recordId);
      }
      return newSet;
    });
  };

  const handleLearnFromFailure = async () => {
    if (selectedRecordIds.size < 2) {
      toast({ title: "Selection Error", description: "Please select at least two records to form a cluster.", variant: "destructive" });
      return;
    }
    
    setIsLearning(true);
    const failureCluster = allRecords.filter(r => selectedRecordIds.has(r._internalId!));
    
    // Offload learning to the worker
    learningWorker.postMessage({ failureCluster });

    toast({
      title: "Learning in Progress",
      description: "The new rule is being generated in the background. You will be notified upon completion.",
    });

    setIsLearning(false);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle>Data Correction & Rule Learning</DialogTitle>
          <DialogDescription>
            Select records that were missed by the clustering algorithm to teach it new rules.
          </DialogDescription>
        </DialogHeader>
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input 
            placeholder="Search all records..."
            className="pl-10"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="flex-1 overflow-hidden">
            <ScrollArea className="h-full">
                <Table>
                    <TableHeader>
                    <TableRow>
                        <TableHead className="w-[50px]">Select</TableHead>
                        <TableHead>Woman Name</TableHead>
                        <TableHead>Husband Name</TableHead>
                        <TableHead>National ID</TableHead>
                        <TableHead>Phone</TableHead>
                        <TableHead>Village</TableHead>
                    </TableRow>
                    </TableHeader>
                    <TableBody>
                        {filteredRecords.map(record => (
                            <TableRow key={record._internalId}
                                className={selectedRecordIds.has(record._internalId!) ? 'bg-blue-100' : ''}
                                onClick={() => handleSelect(record._internalId!)}
                            >
                                <TableCell>
                                <Checkbox
                                    checked={selectedRecordIds.has(record._internalId!)}
                                    onCheckedChange={() => handleSelect(record._internalId!)}
                                />
                                </TableCell>
                                <TableCell>{record[mapping.womanName]}</TableCell>
                                <TableCell>{record[mapping.husbandName]}</TableCell>
                                <TableCell>{String(record[mapping.nationalId])}</TableCell>
                                <TableCell>{String(record[mapping.phone])}</TableCell>
                                <TableCell>{record[mapping.village]}</TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </ScrollArea>
        </div>
        <DialogFooter>
          <span className="text-sm text-muted-foreground mr-auto">
            {selectedRecordIds.size} record(s) selected
          </span>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleLearnFromFailure} disabled={isLearning || selectedRecordIds.size < 2}>
            {isLearning && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Learn from Failure ({selectedRecordIds.size})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
