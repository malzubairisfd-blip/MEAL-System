// src/app/meal-system/monitoring/implementation/process/CMAM-cases/children/screening/database/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, ArrowLeft, ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { Input } from '@/components/ui/input';
import { useToast } from '@/hooks/use-toast';
import { exportChildCmamToExcel } from '@/lib/exportChildCmamToExcel'; 

interface DbRecord {
  id: number;
  [key: string]: any;
}

export default function ChildCMAMDatabasePage() {
  const [allRecords, setAllRecords] = useState<DbRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [globalSearchTerm, setGlobalSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 50;
  const { toast } = useToast();

  useEffect(() => {
    const fetchRecords = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch("/api/child-cmam");
        if (!res.ok) {
          throw new Error("Failed to fetch data from the database.");
        }
        const data = await res.json();
        setAllRecords(Array.isArray(data) ? data : []);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchRecords();
  }, []);

  const filteredRecords = useMemo(() => {
    if (!globalSearchTerm) return allRecords;
    const lowercasedTerm = globalSearchTerm.toLowerCase();
    return allRecords.filter(record =>
      String(record.id).toLowerCase().includes(lowercasedTerm) ||
      String(record.child_name).toLowerCase().includes(lowercasedTerm) ||
      String(record.benef_id).toLowerCase().includes(lowercasedTerm)
    );
  }, [allRecords, globalSearchTerm]);

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
      toast({ title: "No Data", description: "There is no data to download.", variant: "destructive" });
      return;
    }
    exportChildCmamToExcel(filteredRecords, allColumns);
    toast({ title: "Download Started", description: "Your Excel file is being generated." });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Child CMAM Database</h1>
        <div className="flex gap-2">
          <Button variant="outline" asChild>
            <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/children/screening">
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
          <CardTitle>Child CMAM Records</CardTitle>
          <CardDescription>
            Displaying {paginatedRecords.length} of {filteredRecords.length} records.
          </CardDescription>
          <div className="relative pt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
            <Input
              placeholder="Search by ID, Child Name, or Beneficiary ID..."
              value={globalSearchTerm}
              onChange={(e) => { setGlobalSearchTerm(e.target.value); setCurrentPage(1); }}
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
            <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {allColumns.map((col) => (
                      <TableHead key={col} className="whitespace-nowrap px-4">{col.replace(/_/g, " ")}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((record) => (
                    <TableRow key={record.id}>
                      {allColumns.map((col) => (
                        <TableCell key={col} className="whitespace-nowrap px-4">{String(record[col] ?? '')}</TableCell>
                      ))}
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              <div className="flex justify-between items-center mt-4">
                <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                <div className="flex gap-2">
                  <Button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} variant="outline">
                    <ChevronLeft className="mr-2 h-4 w-4" /> Previous
                  </Button>
                  <Button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} variant="outline">
                    Next <ChevronRight className="ml-2 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
