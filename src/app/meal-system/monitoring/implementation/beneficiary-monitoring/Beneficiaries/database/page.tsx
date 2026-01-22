// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries/database/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { useForm } from "react-hook-form";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Loader2, Search, ArrowLeft, Users, FileDown, Edit, Trash2 } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from '@/components/ui/scroll-area';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { exportBnfToExcel } from '@/lib/exportBnfToExcel';


interface BeneficiaryRecord {
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
  record: BeneficiaryRecord;
  columns: string[];
  onSave: (data: BeneficiaryRecord) => Promise<void>;
  isUpdating: boolean;
}) => {
  const form = useForm<BeneficiaryRecord>({
    defaultValues: record
  });

  useEffect(() => {
    form.reset(record);
  }, [record, form]);

  const onSubmit = (data: BeneficiaryRecord) => {
    onSave(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl">
        <DialogHeader>
          <DialogTitle>Edit Record: {record.l_benef_name}</DialogTitle>
          <DialogDescription>Record ID: {record.id} (Read-only)</DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)}>
            <ScrollArea className="h-[60vh] p-1">
              <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
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
  const [records, setRecords] = useState<BeneficiaryRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [editingRecord, setEditingRecord] = useState<BeneficiaryRecord | null>(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [isConfirmOpen, setIsConfirmOpen] = useState(false);
  const [columnToEmpty, setColumnToEmpty] = useState<string | null>(null);
  const [pagination, setPagination] = useState({ currentPage: 1, itemsPerPage: 50 });

  const { toast } = useToast();

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bnf-assessed");
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

  const handleUpdateRecord = async (updatedData: BeneficiaryRecord) => {
    setIsUpdating(true);
    try {
      const res = await fetch('/api/bnf-assessed', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify([updatedData])
      });

      if (!res.ok) {
        const errorData = await res.json();
        throw new Error(errorData.error || `Failed to update record for beneficiary ${updatedData.l_benef_name}.`);
      }

      toast({ title: "Success", description: `Record for ${updatedData.l_benef_name} has been updated.` });
      setEditingRecord(null);
      await fetchRecords();
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleEmptyColumn = async () => {
    if (!columnToEmpty) return;
    
    setIsUpdating(true);
    setIsConfirmOpen(false);

    try {
      const updates = records.map(r => ({
        id: r.id,
        [columnToEmpty]: null
      }));

      const res = await fetch('/api/bnf-assessed', {
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

  const filteredRecords = useMemo(() => {
    if (!globalSearchTerm) return records;
    const lowercasedTerm = globalSearchTerm.toLowerCase();
    return records.filter(record =>
      String(record.l_id).toLowerCase().includes(lowercasedTerm) ||
      String(record.l_benef_name).toLowerCase().includes(lowercasedTerm)
    );
  }, [records, globalSearchTerm]);

  const paginatedRecords = useMemo(() => {
      const startIndex = (pagination.currentPage - 1) * pagination.itemsPerPage;
      return filteredRecords.slice(startIndex, startIndex + pagination.itemsPerPage);
  }, [filteredRecords, pagination]);
  
  const totalPages = Math.ceil(filteredRecords.length / pagination.itemsPerPage);

  const allColumns = useMemo(() => {
    if (records.length === 0) return [];
    return Object.keys(records[0]);
  }, [records]);

  const summary = useMemo(() => ({
      totalRecords: records.length,
      totalClusters: new Set(records.map(r => r.Generated_Cluster_ID).filter(Boolean)).size,
      totalFlagged: records.filter(r => r.Flag).length
  }), [records]);

  const handleDownload = () => {
    exportBnfToExcel(filteredRecords, allColumns);
  };
  
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
            <CardTitle>Database Summary</CardTitle>
            <CardDescription>Overview of the records in `bnf-assessed.db`.</CardDescription>
        </CardHeader>
        <CardContent>
             <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <SummaryCard icon={<Users />} title="Total Records" value={summary.totalRecords} />
                <SummaryCard icon={<Users />} title="Unique Clusters" value={summary.totalClusters} />
                <SummaryCard icon={<Users className="text-orange-500" />} title="Flagged for Review" value={summary.totalFlagged} />
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
                            {allColumns.filter(c => c !== 'id').map(col => (
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
          <CardTitle>Beneficiary Records</CardTitle>
          <CardDescription>
            Displaying {paginatedRecords.length} of {filteredRecords.length} records.
          </CardDescription>
          <div className="relative pt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
            <Input
              placeholder="Search by Beneficiary ID or Woman Name..."
              value={globalSearchTerm}
              onChange={(e) => {
                setGlobalSearchTerm(e.target.value);
                setPagination(p => ({ ...p, currentPage: 1 }));
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
                          {col.replace(/_/g, ' ')}
                      </TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((record, index) => (
                    <TableRow key={record.id || index}>
                      <TableCell className="sticky left-0 bg-card z-10">
                          <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => setEditingRecord(record)}>
                              <Edit className="h-4 w-4" />
                          </Button>
                      </TableCell>
                      {allColumns.map((col) => (
                        <TableCell key={col} className="whitespace-nowrap">
                            {String(record[col] ?? '')}
                        </TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
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
