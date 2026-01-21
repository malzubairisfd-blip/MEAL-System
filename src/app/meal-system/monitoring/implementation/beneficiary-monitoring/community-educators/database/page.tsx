
// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/database/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useForm } from "react-hook-form";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ChevronLeft, ChevronRight, ArrowLeft, UserCheck, UserX, Users, FileDown, Filter, ArrowUpAZ, ArrowDownAZ, Trash2, Edit } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from '@/components/ui/label';

import { useToast } from "@/hooks/use-toast";
import { exportEducatorsToExcel } from "@/lib/exportEducatorsToExcel";
import { cn } from "@/lib/utils";

interface ApplicantRecord {
  [key: string]: any;
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
                        <CommandItem key={index} onSelect={(currentValue) => {
                            // The onSelect of CommandItem is for keyboard nav, we need to handle the click on the checkbox
                        }}>
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
  record: ApplicantRecord;
  columns: string[];
  onSave: (data: ApplicantRecord) => Promise<void>;
  isUpdating: boolean;
}) => {
  const form = useForm<ApplicantRecord>({
    defaultValues: record
  });

  const onSubmit = (data: ApplicantRecord) => {
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Record: {record.applicant_name}</DialogTitle>
          <DialogDescription>Applicant ID: {record.applicant_id} (Read-only)</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[60vh] p-1">
              <div className="p-4 space-y-4">
                {columns
                  .filter(col => col !== 'applicant_id' && col !== 'id') // Make key fields read-only
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

export default function EducatorDatabasePage() {
  const [records, setRecords] = useState<ApplicantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, Set<any>>>({});
  const [sortConfig, setSortConfig] = useState<{key: string; direction: 'asc' | 'desc'} | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [columnToEmpty, setColumnToEmpty] = useState<string | null>(null);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<ApplicantRecord | null>(null);


  const itemsPerPage = 20;
  const { toast } = useToast();

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/ed-selection");
      if (!res.ok) {
        throw new Error("Failed to fetch data from the database.");
      }
      const data = await res.json();
      setRecords(Array.isArray(data) ? data : []);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const handleUpdateRecord = async (updatedData: ApplicantRecord) => {
    setIsUpdating(true);
    try {
      const res = await fetch('/api/ed-selection', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([updatedData])
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Failed to update record for applicant ${updatedData.applicant_id}.`);
      }

      toast({ title: "Success", description: `Record for applicant ${updatedData.applicant_name} has been updated.` });
      setEditingRecord(null);
      await fetchRecords();

    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEmptyColumn = async () => {
    if (!columnToEmpty) {
      toast({ title: "No Column Selected", description: "Please select a column to empty.", variant: "destructive" });
      return;
    }
    
    setIsUpdating(true);
    setIsConfirmOpen(false);

    try {
      const updates = records.map(r => ({
        applicant_id: r.applicant_id,
        [columnToEmpty]: null
      }));

      const res = await fetch('/api/ed-selection', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates)
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Failed to empty column ${columnToEmpty}.`);
      }

      toast({ title: "Success", description: `Column "${columnToEmpty}" has been emptied for all records.` });
      
      await fetchRecords();

    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
      setColumnToEmpty(null);
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
    
    // Global search
    if (globalSearchTerm) {
      const lowercasedTerm = globalSearchTerm.toLowerCase();
      filtered = filtered.filter(record =>
        String(record.applicant_id).toLowerCase().includes(lowercasedTerm) ||
        String(record.applicant_name).toLowerCase().includes(lowercasedTerm)
      );
    }
    
    // Column filters
    Object.entries(filters).forEach(([column, selectedValues]) => {
      if (selectedValues.size > 0) {
        filtered = filtered.filter(record => selectedValues.has(record[column]));
      }
    });

    // Sorting
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

        if (strA < strB) {
          return sortConfig.direction === 'asc' ? -1 : 1;
        }
        if (strA > strB) {
          return sortConfig.direction === 'asc' ? 1 : -1;
        }
        return 0;
      });
    }

    return filtered;
  }, [records, globalSearchTerm, filters, sortConfig]);
  
  const paginatedRecords = useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      return filteredRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRecords, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);

  const totalAccepted = useMemo(() => records.filter(r => r.acceptance_results === "مقبولة").length, [records]);
  const totalUnaccepted = useMemo(() => records.filter(r => r.acceptance_results === "غير مقبولة").length, [records]);

  const allColumns = useMemo(() => {
    if (records.length === 0) return [];
    return Object.keys(records[0]);
  }, [records]);

  const handleDownload = () => {
    if (filteredRecords.length === 0) {
      toast({
        title: "No Data",
        description: "There is no data to download based on the current filters.",
        variant: "destructive",
      });
      return;
    }
    exportEducatorsToExcel(filteredRecords, allColumns);
    toast({
        title: "Download Started",
        description: "Your Excel file is being generated.",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Community Educators Database</h1>
         <div className="flex gap-2">
            <Button variant="outline" asChild>
                <Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators">
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
            <CardTitle>Database Summary</CardTitle>
            <CardDescription>Overview of the records in `educators.db`.</CardDescription>
        </CardHeader>
        <CardContent>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SummaryCard icon={<Users />} title="Total Applicants" value={records.length} />
                <SummaryCard icon={<UserCheck className="text-green-500"/>} title="Accepted" value={totalAccepted} />
                <SummaryCard icon={<UserX className="text-red-500"/>} title="Unaccepted" value={totalUnaccepted} />
            </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
            <CardTitle>Data Management</CardTitle>
            <CardDescription>Perform bulk operations on the database. These actions are irreversible.</CardDescription>
        </CardHeader>
        <CardContent className="flex items-end gap-4">
            <div className="flex-1 space-y-2">
                <Label htmlFor="column-to-empty">Column to Empty</Label>
                <Select onValueChange={setColumnToEmpty} value={columnToEmpty || ''}>
                    <SelectTrigger id="column-to-empty">
                        <SelectValue placeholder="Select a column..." />
                    </SelectTrigger>
                    <SelectContent>
                        <ScrollArea className="h-60">
                            {allColumns.filter(c => c !== 'applicant_id').map(col => (
                                <SelectItem key={col} value={col}>{col.replace(/_/g, ' ')}</SelectItem>
                            ))}
                        </ScrollArea>
                    </SelectContent>
                </Select>
            </div>
            <Button 
                variant="destructive" 
                onClick={() => setIsConfirmOpen(true)}
                disabled={!columnToEmpty || isUpdating}
            >
                {isUpdating ? <Loader2 className="mr-2 h-4 w-4 animate-spin"/> : <Trash2 className="mr-2 h-4 w-4"/>}
                Empty Selected Column
            </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Applicant Records</CardTitle>
          <CardDescription>
            Displaying {paginatedRecords.length} of {filteredRecords.length} records.
          </CardDescription>
          <div className="relative pt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
            <Input
              placeholder="Search by applicant ID or name..."
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
            <div className="flex justify-center items-center h-64">
              <Loader2 className="h-8 w-8 animate-spin" />
            </div>
          ) : error ? (
            <div className="text-center text-red-500">{error}</div>
          ) : records.length === 0 ? (
             <div className="text-center text-muted-foreground py-10">
                <p>No records found in the database.</p>
                <p className="text-sm">Please upload a file on the selection page to populate the database.</p>
            </div>
          ) : (
            <>
            <div className="border rounded-md overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="sticky left-0 bg-card z-10">Actions</TableHead>
                    {allColumns.map((col) => (
                      <TableHead key={col} className="whitespace-nowrap">
                          <div className="flex items-center">
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
                  {paginatedRecords.map((record, index) => (
                    <TableRow key={index}>
                      <TableCell className="sticky left-0 bg-card z-10">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setEditingRecord(record)}>
                              <Edit className="h-4 w-4" />
                          </Button>
                      </TableCell>
                      {allColumns.map((col) => (
                        <TableCell key={col} className="whitespace-nowrap">
                            {record[col] === 'مقبولة' ? <Badge variant="default" className="bg-green-500">مقبولة</Badge>
                             : record[col] === 'غير مقبولة' ? <Badge variant="destructive">غير مقبولة</Badge>
                             : String(record[col] ?? '')}
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
       <AlertDialog open={isConfirmOpen} onOpenChange={setIsConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>
              This action cannot be undone. This will permanently delete all data from the column
              <span className="font-bold text-destructive"> "{columnToEmpty}" </span> 
              for all {records.length} records.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleEmptyColumn} className="bg-destructive hover:bg-destructive/90">
              Yes, empty column
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
