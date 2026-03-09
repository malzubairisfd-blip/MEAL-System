// src/app/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/database/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, ArrowLeft, ChevronLeft, ChevronRight, FileDown, Filter, ArrowUpAZ, ArrowDownAZ, Trash2, Edit } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from '@/components/ui/input';
import { useForm } from 'react-hook-form';
import { exportCmamToExcel } from '@/lib/exportCmamToExcel';

interface DbRecord {
  id: number;
  [key: string]: any;
}

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
  record: DbRecord | null;
  columns: string[];
  onSave: (data: DbRecord) => Promise<void>;
  isUpdating: boolean;
}) => {
  const form = useForm<DbRecord>({
    defaultValues: record || {}
  });

  useEffect(() => {
    form.reset(record || {});
  }, [record, form]);

  const onSubmit = (data: DbRecord) => {
    onSave(data);
  };

  if (!record) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit CMAM Record: {record.BENEF_NAME}</DialogTitle>
          <DialogDescription>Record ID: {record.id} (Read-only)</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[60vh] p-1">
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {columns
                  .filter(col => col !== 'id')
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

export default function BeneficiaryCMAMDatabasePage() {
  const [allRecords, setAllRecords] = useState<DbRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [filters, setFilters] = useState<Record<string, Set<any>>>({});
  const [sortConfig, setSortConfig] = useState<{key: string; direction: 'asc' | 'desc'} | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [deletingRecord, setDeletingRecord] = useState<DbRecord | null>(null);
  const [editingRecord, setEditingRecord] = useState<DbRecord | null>(null);

  const itemsPerPage = 20;
  const { toast } = useToast();
  
  const fetchAllRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bnf-cmam");
      if (!res.ok) throw new Error("Failed to fetch CMAM data.");
      setAllRecords(await res.json());
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchAllRecords();
  }, [fetchAllRecords]);

  const handleUpdateRecord = async (updatedData: DbRecord) => {
    setIsUpdating(true);
    try {
      const res = await fetch('/api/bnf-cmam', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([updatedData])
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Failed to update record for beneficiary ${updatedData.id}.`);
      }

      toast({ title: "Success", description: `Record for beneficiary ${updatedData.BENEF_NAME} has been updated.` });
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
      const res = await fetch('/api/bnf-cmam', {
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
    setFilters(prev => ({ ...prev, [column]: selected }));
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
       if(sortConfig?.key === column) setSortConfig(null);
      setCurrentPage(1);
  }, [sortConfig]);

  const uniqueColumnValues = useMemo(() => {
    const allCols = allRecords.length > 0 ? Object.keys(allRecords[0]) : [];
    const uniqueVals: Record<string, any[]> = {};
    allCols.forEach(col => {
      uniqueVals[col] = [...new Set(allRecords.map(r => r[col]))].sort((a, b) => {
        if (a === null || a === undefined) return 1;
        if (b === null || b === undefined) return -1;
        if (typeof a === 'number' && typeof b === 'number') return a - b;
        return String(a).localeCompare(String(b));
      });
    });
    return uniqueVals;
  }, [allRecords]);

  const filteredRecords = useMemo(() => {
    let filtered = [...allRecords];
    
    if (globalSearchTerm) {
      const lowercasedTerm = globalSearchTerm.toLowerCase();
      filtered = filtered.filter(record =>
        String(record.id).toLowerCase().includes(lowercasedTerm) ||
        String(record.BENEF_NAME).toLowerCase().includes(lowercasedTerm)
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
  }, [allRecords, globalSearchTerm, filters, sortConfig]);
  
  const paginatedRecords = useMemo(() => {
      const startIndex = (currentPage - 1) * itemsPerPage;
      return filteredRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRecords, currentPage]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);

  const allColumns = useMemo(() => {
    if (allRecords.length === 0) return [];
    return Object.keys(allRecords[0]);
  }, [allRecords]);
  
  const handleDownload = () => {
    if (filteredRecords.length === 0) {
      toast({ title: "No Data", description: "There is no data to download based on the current filters.", variant: "destructive" });
      return;
    }
    exportCmamToExcel(filteredRecords, allColumns);
    toast({ title: "Download Started", description: "Your Excel file is being generated." });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Beneficiaries CMAM Database</h1>
         <div className="flex gap-2">
            <Button variant="outline" asChild>
                <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening">
                    <ArrowLeft className="mr-2 h-4 w-4" /> Back
                </Link>
            </Button>
            <Button onClick={handleDownload} disabled={loading}>
                <FileDown className="mr-2 h-4 w-4" /> Download as Excel
            </Button>
        </div>
      </div>
      
      <Card className="w-full">
        <CardHeader>
          <CardTitle>CMAM Records</CardTitle>
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
             <div className="text-center text-muted-foreground py-10"><p>No records found in the database.</p></div>
          ) : (
            <ScrollArea className="h-[70vh]">
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
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setEditingRecord(record)}><Edit className="h-4 w-4" /></Button>
                          <Button variant="destructive" size="icon" className="h-8 w-8" onClick={() => setDeletingRecord(record)}><Trash2 className="h-4 w-4" /></Button>
                        </div>
                      </TableCell>
                      {allColumns.map((col) => <TableCell key={col} className="whitespace-nowrap px-4">{String(record[col] ?? '')}</TableCell>)}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </ScrollArea>
          )}
          {!loading && allRecords.length > 0 && (
             <div className="flex justify-between items-center mt-4">
                <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                <div className="flex gap-2">
                    <Button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} variant="outline"><ChevronLeft className="mr-2 h-4 w-4" /> Previous</Button>
                    <Button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} variant="outline">Next <ChevronRight className="ml-2 h-4 w-4" /></Button>
                </div>
            </div>
          )}
        </CardContent>
      </Card>
      
       <AlertDialog open={!!deletingRecord} onOpenChange={() => setDeletingRecord(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
            <AlertDialogDescription>This will permanently delete the record for {deletingRecord?.BENEF_NAME} (ID: {deletingRecord?.id}).</AlertDialogDescription>
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
