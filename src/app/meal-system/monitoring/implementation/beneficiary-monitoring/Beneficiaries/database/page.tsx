// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/database/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useForm } from "react-hook-form";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, ArrowLeft, Users, FileDown, Filter, ArrowUpAZ, ArrowDownAZ, Trash2, Edit, Link2, Plus, ChevronLeft, ChevronRight, GitCompareArrows } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { Label } from "@/components/ui/label";

import { useToast } from "@/hooks/use-toast";
import { exportBnfToExcel } from "@/lib/exportBnfToExcel";

interface BnfRecord {
  id: number;
  [key: string]: any;
}

interface Project {
  projectId: string;
  projectName: string;
}

const SummaryCard = ({ icon, title, value }: { icon: React.ReactNode, title: string, value: string | number }) => (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium">{title}</CardTitle>
        {icon}
      </CardHeader>
      <CardContent>
        <div className="text-2xl font-bold">{value}</div>
      </CardContent>
    </Card>
);

const ColumnFilter = ({
  column,
  onFilter,
  onSort,
  onClear,
  uniqueValues
}: {
  column: string;
  onFilter: (column: string, selected: Set<any>) => void;
  onSort: (column: string, direction: 'asc' | 'desc') => void;
  onClear: (column: string) => void;
  uniqueValues: any[];
}) => {
  const [selected, setSelected] = useState<Set<any>>(new Set());
  const [searchTerm, setSearchTerm] = useState("");

  const filteredUniqueValues = useMemo(() =>
    uniqueValues.filter(val =>
      String(val).toLowerCase().includes(searchTerm.toLowerCase())
    ), [uniqueValues, searchTerm]
  );
  
  const handleSelect = (value: any) => {
    const newSelected = new Set(selected);
    if (newSelected.has(value)) {
      newSelected.delete(value);
    } else {
      newSelected.add(value);
    }
    setSelected(newSelected);
  };

  const handleSelectAll = (checked: boolean | "indeterminate") => {
    if (checked) {
      setSelected(new Set(uniqueValues));
    } else {
      setSelected(new Set());
    }
  };

  const handleClear = () => {
    setSelected(new Set());
    setSearchTerm("");
    onClear(column);
  };

  useEffect(() => {
    onFilter(column, selected);
  }, [selected, onFilter, column]);

  const isAllSelected = selected.size > 0 && selected.size === uniqueValues.length;
  const isSomeSelected = selected.size > 0 && selected.size < uniqueValues.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="h-6 w-6 ml-2">
          <Filter className="h-4 w-4" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-64 p-0" align="start">
        <div className="p-2 space-y-2">
           <div className="grid grid-cols-2 gap-2">
              <Button variant="outline" onClick={() => onSort(column, 'asc')}><ArrowUpAZ className="mr-2 h-4 w-4"/> Sort Ascending</Button>
              <Button variant="outline" onClick={() => onSort(column, 'desc')}><ArrowDownAZ className="mr-2 h-4 w-4"/> Sort Descending</Button>
            </div>
            <div className="flex justify-between items-center pt-2">
                <h3 className="font-semibold text-sm">Filter by</h3>
                <Button variant="link" className="h-auto p-0 text-xs" onClick={handleClear}>Clear All</Button>
            </div>
            <Command className="border rounded-md">
              <CommandInput placeholder="Search values..." value={searchTerm} onValueChange={setSearchTerm}/>
              <CommandList>
                <CommandEmpty>No values found.</CommandEmpty>
                <CommandGroup>
                    <ScrollArea className="h-48">
                    <CommandItem onSelect={() => handleSelectAll(!isAllSelected)}>
                        <Checkbox className="mr-2" checked={isAllSelected || (isSomeSelected ? 'indeterminate' : false)} />
                        Select All
                    </CommandItem>
                    {filteredUniqueValues.map((value, index) => (
                        <CommandItem key={index} onSelect={() => {}}>
                        <div className="flex items-center w-full" onClick={() => handleSelect(value)}>
                            <Checkbox className="mr-2" checked={selected.has(value)} />
                            <span>{String(value) || "(Blank)"}</span>
                        </div>
                        </CommandItem>
                    ))}
                    </ScrollArea>
                </CommandGroup>
              </CommandList>
            </Command>
        </div>
      </PopoverContent>
    </Popover>
  );
};


const EditRecordDialog = ({
  open,
  onOpenChange,
  record,
  columns,
  onSave,
  isUpdating
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  record: BnfRecord | null;
  columns: string[];
  onSave: (data: BnfRecord) => Promise<void>;
  isUpdating: boolean;
}) => {
  const form = useForm<BnfRecord>({
    defaultValues: record || {}
  });

  useEffect(() => {
    form.reset(record || {});
  }, [record, form]);

  const onSubmit = (data: BnfRecord) => {
    onSave(data);
  };

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Beneficiary: {record.l_benef_name}</DialogTitle>
          <DialogDescription>Record ID: {record.id} (Read-only)</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[60vh] p-1">
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {columns
                  .filter(col => col !== 'id') // Make key fields read-only
                  .map((column) => (
                  <FormField
                    key={column}
                    control={form.control}
                    name={column}
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>{column.replace(/_/g, ' ')}</FormLabel>
                        <FormControl>
                          <Input {...field} value={field.value ?? ''} onChange={field.onChange} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                ))}
              </div>
            </ScrollArea>
            <DialogFooter className="mt-4">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancel
              </Button>
              <Button type="submit" disabled={isUpdating}>
                {isUpdating && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default function BeneficiaryDatabasePage() {
  const [allRecords, setAllRecords] = useState<BnfRecord[]>([]);
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, Set<any>>>({});
  const [sortConfig, setSortConfig] = useState<{key: string; direction: 'asc' | 'desc'} | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<BnfRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<BnfRecord | null>(null);

  const [numNewColumns, setNumNewColumns] = useState(1);
  const [newColumns, setNewColumns] = useState([{ name: '', type: 'TEXT' }]);
  const [isAddingColumn, setIsAddingColumn] = useState(false);

  // State for the new update section
  const [sourceDb, setSourceDb] = useState('');
  const [sourceData, setSourceData] = useState<any[]>([]);
  const [sourceColumns, setSourceColumns] = useState<string[]>([]);
  const [sourceUniqueIdCol, setSourceUniqueIdCol] = useState('');
  const [targetUniqueIdCol, setTargetUniqueIdCol] = useState('');
  const [updateColumnMapping, setUpdateColumnMapping] = useState<Map<string, string>>(new Map());
  const [manualUpdateMapping, setManualUpdateMapping] = useState({ source: '', target: '' });
  const [isUpdatingFromSource, setIsUpdatingFromSource] = useState(false);


  const itemsPerPage = 20;
  const { toast } = useToast();
  
  const fetchAllRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projRes, bnfRes] = await Promise.all([
          fetch('/api/projects'),
          fetch("/api/bnf-assessed")
      ]);
      if (!projRes.ok) throw new Error("Failed to fetch projects.");
      if (!bnfRes.ok) throw new Error("Failed to fetch beneficiary data.");
      setProjects(await projRes.json());
      setAllRecords(await bnfRes.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllRecords();
  }, [fetchAllRecords]);

  // Fetch source data when source DB changes
  useEffect(() => {
    if (!sourceDb || !selectedProjectId) {
      setSourceData([]);
      setSourceColumns([]);
      return;
    }
    const fetchSourceData = async () => {
      try {
        let url = '';
        if (sourceDb === 'educators.db') url = '/api/ed-selection';
        else if (sourceDb === 'enrollment-review.db') url = `/api/enrollment-review`;
        else return;

        const res = await fetch(url);
        if (!res.ok) throw new Error(`Failed to fetch from ${sourceDb}`);
        
        let data = await res.json();
        // Always filter by project ID
        data = data.filter((row: any) => row.project_id === selectedProjectId);

        setSourceData(data);
        if (data.length > 0) {
          setSourceColumns(Object.keys(data[0]));
        }
      } catch (err: any) {
        toast({ title: 'Error', description: `Failed to load data from ${sourceDb}: ${err.message}`, variant: 'destructive' });
      }
    };
    fetchSourceData();
  }, [sourceDb, selectedProjectId, toast]);

  const records = useMemo(() => {
      if (selectedProjectId === 'all' || !selectedProjectId) {
          return allRecords;
      }
      return allRecords.filter(r => r.project_id === selectedProjectId);
  }, [allRecords, selectedProjectId]);


  const handleUpdateRecord = async (updatedData: BnfRecord) => {
    setIsUpdating(true);
    try {
      const res = await fetch('/api/bnf-assessed', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([updatedData])
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Failed to update record for beneficiary ${updatedData.id}.`);
      }

      toast({ title: "Success", description: `Record for beneficiary ${updatedData.l_benef_name} has been updated.` });
      setEditingRecord(null);
      await fetchAllRecords();

    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleDeleteRecord = async () => {
    if (!deletingRecord) return;
    setIsUpdating(true);
    try {
      const res = await fetch('/api/bnf-assessed', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [deletingRecord.id] })
      });
       if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Failed to delete record.`);
      }
      toast({ title: "Success", description: "Record deleted."});
      setDeletingRecord(null);
      await fetchAllRecords();
    } catch(err: any) {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };


  const handleFilterChange = useCallback((column: string, selected: Set<any>) => {
    setFilters(prev => ({
      ...prev,
      [column]: selected
    }));
    setCurrentPage(1);
  }, []);

  const handleSortChange = useCallback((column: string, direction: 'asc' | 'desc') => {
    setSortConfig({ key: column, direction });
  }, []);
  
  const handleClearFilter = useCallback((column: string) => {
      setFilters(prev => {
          const newFilters = { ...prev };
          delete newFilters[column];
          return newFilters;
      });
       if(sortConfig?.key === column) {
        setSortConfig(null);
      }
      setCurrentPage(1);
  }, [sortConfig]);

  const uniqueColumnValues = useMemo(() => {
    const allCols = records.length > 0 ? Object.keys(records[0]) : [];
    const uniqueVals: Record<string, any[]> = {};
    allCols.forEach(col => {
      uniqueVals[col] = [...new Set(records.map(r => r[col]))].sort((a, b) => {
        if (a === null || a === undefined) return 1;
        if (b === null || b === undefined) return -1;
        if (typeof a === 'number' && typeof b === 'number') return a - b;
        return String(a).localeCompare(String(b));
      });
    });
    return uniqueVals;
  }, [records]);

  const filteredRecords = useMemo(() => {
    let filtered = [...records];
    
    if (globalSearchTerm) {
      const lowercasedTerm = globalSearchTerm.toLowerCase();
      filtered = filtered.filter(record =>
        String(record.id).toLowerCase().includes(lowercasedTerm) ||
        String(record.l_benef_name).toLowerCase().includes(lowercasedTerm)
      );
    }
    
    Object.entries(filters).forEach(([column, selectedValues]) => {
      if (selectedValues.size > 0) {
        filtered = filtered.filter(record => selectedValues.has(record[column]));
      }
    });

    if (sortConfig !== null) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        
        if (aVal === null || aVal === undefined) return 1;
        if (bVal === null || bVal === undefined) return -1;
        
        if (typeof aVal === 'number' && typeof bVal === 'number') {
            return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
        }

        const strA = String(aVal).toLowerCase();
        const strB = String(bVal).toLowerCase();

        if (strA < strB) return sortConfig.direction === 'asc' ? -1 : 1;
        if (strA > strB) return sortConfig.direction === 'asc' ? 1 : -1;
        return 0;
      });
    }

    return filtered;
  }, [records, globalSearchTerm, filters, sortConfig]);
  
  const paginatedRecords = useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      return filteredRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRecords, currentPage]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);

  const summaryStats = useMemo(() => ({
    totalRecords: records.length,
    totalClusters: new Set(records.map(r => r.Generated_Cluster_ID).filter(Boolean)).size,
    totalDuplicates: records.filter(r => r.groupDecision === 'تكرار').length,
  }), [records]);

  const allColumns = useMemo(() => {
    if (records.length === 0) return [];
    return Object.keys(records[0]);
  }, [records]);
  
    const handleDownload = () => {
    if (filteredRecords.length === 0) {
      toast({ title: "No Data", description: "There is no data to download.", variant: "destructive" });
      return;
    }
    exportBnfToExcel(filteredRecords, allColumns);
    toast({ title: "Download Started", description: "Your Excel file is being generated." });
  };
  
    // --- Update from Source Logic ---
  const unmappedSourceColumns = useMemo(() => sourceColumns.filter(c => !Array.from(updateColumnMapping.keys()).includes(c) && c !== sourceUniqueIdCol), [sourceColumns, updateColumnMapping, sourceUniqueIdCol]);
  const unmappedTargetColumns = useMemo(() => allColumns.filter(c => !Array.from(updateColumnMapping.values()).includes(c) && c !== targetUniqueIdCol), [allColumns, updateColumnMapping, targetUniqueIdCol]);

  const handleAutoMap = useCallback(() => {
    const newMapping = new Map<string, string>();
    unmappedSourceColumns.forEach(sourceCol => {
        const match = unmappedTargetColumns.find(targetCol => targetCol.toLowerCase() === sourceCol.toLowerCase());
        if (match) {
            newMapping.set(sourceCol, match);
        }
    });
    setUpdateColumnMapping(prev => new Map([...prev, ...newMapping]));
    toast({ title: "Auto-match complete", description: `Mapped ${newMapping.size} columns.` });
  }, [unmappedSourceColumns, unmappedTargetColumns, toast]);

  const handleAddManualUpdateMapping = () => {
    if (manualUpdateMapping.source && manualUpdateMapping.target) {
        setUpdateColumnMapping(prev => new Map(prev).set(manualUpdateMapping.source, manualUpdateMapping.target));
        setManualUpdateMapping({ source: '', target: '' });
    }
  };

  const handleExecuteUpdate = useCallback(async () => {
    if (!sourceUniqueIdCol || !targetUniqueIdCol || !selectedProjectId) {
      toast({ title: "Incomplete Setup", description: "Please select source, unique IDs, and a project.", variant: "destructive" });
      return;
    }
    setIsUpdatingFromSource(true);
    try {
      const sourceMap = new Map(sourceData.map(row => [row[sourceUniqueIdCol], row]));
      
      const recordsToUpdate = records
        .map(targetRecord => {
            const sourceRecord = sourceMap.get(targetRecord[targetUniqueIdCol]);
            if (sourceRecord) {
                const updatedRecord: Record<string, any> = { [targetUniqueIdCol]: targetRecord[targetUniqueIdCol] };
                updateColumnMapping.forEach((targetCol, sourceCol) => {
                    if (sourceRecord.hasOwnProperty(sourceCol)) {
                        updatedRecord[targetCol] = sourceRecord[sourceCol];
                    }
                });
                return updatedRecord;
            }
            return null;
        }).filter(Boolean);

      if (recordsToUpdate.length === 0) {
        toast({ title: "No Matches Found", description: "No records could be matched between the two databases based on the selected IDs." });
        return;
      }

      const res = await fetch('/api/bnf-assessed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'save', mode: 'replace', records: recordsToUpdate, projectId: selectedProjectId, uniqueIdDbCol: targetUniqueIdCol })
      });

      const result = await res.json();
      if (!res.ok) throw new Error(result.details || 'Update API call failed.');

      toast({ title: "Update Complete", description: `${result.updated} records in bnf-assessed.db have been updated.` });
      await fetchAllRecords(); // Refresh data

    } catch (err: any) {
      toast({ title: "Update Failed", description: err.message, variant: "destructive" });
    } finally {
      setIsUpdatingFromSource(false);
    }
  }, [records, sourceData, sourceUniqueIdCol, targetUniqueIdCol, updateColumnMapping, selectedProjectId, toast, fetchAllRecords]);

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Beneficiaries Database</h1>
         <div className="flex gap-2">
            <Button variant="outline" asChild>
                <Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Link>
            </Button>
            <Button onClick={handleDownload} disabled={loading}>
                <FileDown className="mr-2 h-4 w-4" /> Download as Excel
            </Button>
        </div>
      </div>
      
      <Card>
        <CardHeader>
            <CardTitle>Project Filter</CardTitle>
        </CardHeader>
        <CardContent>
             <Select onValueChange={setSelectedProjectId} value={selectedProjectId}>
                <SelectTrigger className="w-full md:w-1/2">
                    <SelectValue placeholder="Select a project to filter records..." />
                </SelectTrigger>
                <SelectContent>
                    <SelectItem value="all">All Projects</SelectItem>
                    {projects.map(p => (
                        <SelectItem key={p.projectId} value={p.projectId}>{p.projectName}</SelectItem>
                    ))}
                </SelectContent>
            </Select>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Update from Another Database</CardTitle>
            <CardDescription>Update columns in this database using data from another source.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <div className="space-y-2">
                    <Label>Source Database</Label>
                    <Select onValueChange={setSourceDb} value={sourceDb}>
                        <SelectTrigger><SelectValue placeholder="Select Source..." /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="educators.db">Educators DB</SelectItem>
                            <SelectItem value="enrollment-review.db">Enrollment Review DB</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2">
                    <Label>Source Unique ID</Label>
                    <Select onValueChange={setSourceUniqueIdCol} value={sourceUniqueIdCol} disabled={!sourceDb}>
                        <SelectTrigger><SelectValue placeholder="Select Source ID..." /></SelectTrigger>
                        <SelectContent><ScrollArea className="h-60">{sourceColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</ScrollArea></SelectContent>
                    </Select>
                </div>
                 <div className="space-y-2">
                    <Label>Target Unique ID (bnf-assessed.db)</Label>
                    <Select onValueChange={setTargetUniqueIdCol} value={targetUniqueIdCol}>
                        <SelectTrigger><SelectValue placeholder="Select Target ID..." /></SelectTrigger>
                        <SelectContent><ScrollArea className="h-60">{allColumns.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}</ScrollArea></SelectContent>
                    </Select>
                </div>
            </div>

            <Card>
                <CardHeader>
                    <div className="flex justify-between items-center">
                        <CardTitle className="text-lg">Column Mapping</CardTitle>
                        <Button onClick={handleAutoMap} variant="outline" disabled={!sourceDb}><GitCompareArrows className="mr-2 h-4 w-4" />Auto-match</Button>
                    </div>
                </CardHeader>
                <CardContent className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                        <div className="space-y-2">
                            <Label>Source Column</Label>
                             <Select value={manualUpdateMapping.source} onValueChange={(v) => setManualUpdateMapping(p => ({...p, source: v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><ScrollArea className="h-60">{unmappedSourceColumns.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</ScrollArea></SelectContent></Select>
                        </div>
                         <div className="space-y-2">
                            <Label>Target Column</Label>
                             <Select value={manualUpdateMapping.target} onValueChange={(v) => setManualUpdateMapping(p => ({...p, target: v}))}><SelectTrigger><SelectValue/></SelectTrigger><SelectContent><ScrollArea className="h-60">{unmappedTargetColumns.map(c=><SelectItem key={c} value={c}>{c}</SelectItem>)}</ScrollArea></SelectContent></Select>
                        </div>
                        <Button onClick={handleAddManualUpdateMapping}><Plus className="mr-2 h-4 w-4"/>Add Mapping</Button>
                    </div>
                    <ScrollArea className="h-48 border rounded-md">
                        <Table>
                            <TableHeader><TableRow><TableHead>Source Column</TableHead><TableHead>Target Column (bnf-assessed)</TableHead><TableHead>Action</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {Array.from(updateColumnMapping.entries()).map(([source, target]) => (
                                    <TableRow key={source}><TableCell>{source}</TableCell><TableCell>{target}</TableCell>
                                    <TableCell><Button variant="ghost" size="icon" onClick={()=>setUpdateColumnMapping(p=>{const n=new Map(p);n.delete(source);return n;})}><Trash2 className="h-4 w-4 text-destructive"/></Button></TableCell></TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </ScrollArea>
                </CardContent>
            </Card>
            <Button onClick={handleExecuteUpdate} disabled={!sourceUniqueIdCol || !targetUniqueIdCol || isUpdatingFromSource}>
                 {isUpdatingFromSource && <Loader2 className="mr-2 h-4 w-4 animate-spin"/>}
                Execute Update
            </Button>
        </CardContent>
      </Card>


      <Card>
        <CardHeader>
          <CardTitle>Beneficiary Records</CardTitle>
          <CardDescription>
            Displaying {paginatedRecords.length} of {filteredRecords.length} records.
          </CardDescription>
          <div className="relative pt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
            <Input
              placeholder="Search by ID or name..."
              value={globalSearchTerm}
              onChange={(e) => {
                setGlobalSearchTerm(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-10"
            />
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
          ) : error ? (
            <div className="text-center text-red-500">{error}</div>
          ) : allRecords.length === 0 ? (
             <div className="text-center text-muted-foreground py-10">
                <p>No records found in the database.</p>
            </div>
          ) : (
            <>
              <div className="w-full overflow-x-auto">
                <Table>
                  <TableHeader>
                  <TableRow>
                      <TableHead className="sticky left-0 bg-card z-10">Actions</TableHead>
                      {allColumns.map((col) => (
                      <TableHead key={col} className="whitespace-nowrap px-4">
                          <div className="flex items-center gap-2">
                              {col.replace(/_/g, ' ')}
                              <ColumnFilter
                                  column={col}
                                  onFilter={handleFilterChange}
                                  onSort={handleSortChange}
                                  onClear={handleClearFilter}
                                  uniqueValues={uniqueColumnValues[col] || []}
                              />
                          </div>
                      </TableHead>
                      ))}
                  </TableRow>
                  </TableHeader>
                  <TableBody>
                  {paginatedRecords.map((record) => (
                      <TableRow key={record.id}>
                      <TableCell className="sticky left-0 bg-card z-10">
                          <div className="flex gap-1">
                              <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setEditingRecord(record)}>
                              <Edit className="h-4 w-4" />
                              </Button>
                              <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => setDeletingRecord(record)}>
                                  <Trash2 className="h-4 w-4" />
                              </Button>
                          </div>
                      </TableCell>
                      {allColumns.map((col) => (
                          <TableCell key={col} className="whitespace-nowrap px-4">
                              {String(record[col] ?? '')}
                          </TableCell>
                      ))}
                      </TableRow>
                  ))}
                  </TableBody>
                </Table>
              </div>
                <div className="flex justify-between items-center mt-4">
                    <span className="text-sm text-muted-foreground">
                        Page {currentPage} of {totalPages}
                    </span>
                    <div className="flex gap-2">
                        <Button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} variant="outline">
                            <ChevronLeft className="mr-2 h-4 w-4" /> Previous
                        </Button>
                        <Button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} variant="outline">
                            Next <ChevronRight className="ml-2 h-4 w-4" />
                        </Button>
                    </div>
                </div>
            </>
          )}
        </CardContent>
      </Card>
      
       <AlertDialog open={!!deletingRecord} onOpenChange={() => setDeletingRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete the record for {deletingRecord?.l_benef_name} (ID: {deletingRecord?.id}). This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeleteRecord} disabled={isUpdating}>
              {isUpdating ? "Deleting..." : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      {editingRecord && (
        <EditRecordDialog
            open={!!editingRecord}
            onOpenChange={(isOpen) => !isOpen && setEditingRecord(null)}
            record={editingRecord}
            onSave={handleUpdateRecord}
            columns={allColumns}
            isUpdating={isUpdating}
        />
      )}
    </div>
  );
}