// src/app/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries/database/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useToast } from "@/hooks/use-toast";
import { Users, Archive, Database, Upload, ArrowLeft, Filter, Edit3, Trash2, ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { exportHealthSessionsToExcel as exportDisbursementToExcel } from "@/lib/exportHealthSessionsToExcel"; // Re-using for now

interface Project {
  projectId: string;
  projectName: string;
}

const SUMMARY_COLUMNS = [
  "total_pay_list",
  "total_pay_cyc_cnt",
  "total_pay_amt",
  "total_cashed_cnt",
  "total_cashed_amt",
  "total_uncashed_cnt",
  "total_uncashed_amt",
  "final_comments",
];

export default function BeneficiariesCashDisbursementDatabasePage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [records, setRecords] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<any | null>(null);

  const itemsPerPage = 50;
  const phonePanelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/projects").then((res) => res.json()).then((data) => setProjects(data || []));
  }, []);

  const fetchRecords = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/bnf-cash-disbursement");
      if (!res.ok) throw new Error("Failed to fetch session data.");
      setRecords(await res.json());
    } catch (err: any) {
      setError(err.message);
      toast({ title: "Error", description: err.message, variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRecords();
  }, [fetchRecords]);

  const filteredRecords = useMemo(() => {
    let projectFiltered = records;
    if (selectedProjectId && selectedProjectId !== 'all') {
      projectFiltered = records.filter(r => r.project_id === selectedProjectId);
    }
    
    if (!searchTerm) return projectFiltered;
    
    const lowercasedTerm = searchTerm.toLowerCase();
    return projectFiltered.filter(r =>
      String(r.benef_id).toLowerCase().includes(lowercasedTerm) ||
      String(r.bnf_name).toLowerCase().includes(lowercasedTerm)
    );
  }, [records, searchTerm, selectedProjectId]);

  const paginatedRecords = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredRecords.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredRecords, currentPage]);

  const beneficiarySummary = useMemo(() => {
    if (!selectedBeneficiaryId) return null;
    return records.find(r => r.benef_id === selectedBeneficiaryId);
  }, [selectedBeneficiaryId, records]);

  const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
  const allColumns = useMemo(() => (records.length > 0 ? Object.keys(records[0]) : []), [records]);

  const handleDownload = () => {
    if (filteredRecords.length === 0) {
      toast({ title: "No Data", description: "There is no data to download.", variant: "destructive" });
      return;
    }
    exportDisbursementToExcel(filteredRecords, allColumns);
    toast({ title: "Download Started", description: "Your Excel file is being generated." });
  };
  
  const displayedColumns = ["benef_id", "bnf_name", "pc_id", "pc_name", "total_pay_list", "total_pay_amt", "total_cashed_amt", "total_uncashed_amt"];

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Beneficiaries Cash Disbursement Database</h1>
          <p className="text-sm text-muted-foreground">Inspect and maintain payment disbursement records.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild><Link href="/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries/upload"><Upload className="mr-2 h-4 w-4" />Upload</Link></Button>
          <Button asChild><Link href="/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries/dashboard"><Archive className="mr-2 h-4 w-4" />Dashboard</Link></Button>
          <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries"><ArrowLeft className="mr-2 h-4 w-4" />Back to Hub</Link></Button>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Project Filter & Search</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Filter by project..." />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Projects</SelectItem>
              {projects.map((project) => (
                <SelectItem key={project.projectId} value={project.projectId}>
                  {project.projectName} ({project.projectId})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Search by Beneficiary ID or Name..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Beneficiary Summary</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedBeneficiaryId || ''} onValueChange={setSelectedBeneficiaryId}>
            <SelectTrigger>
              <SelectValue placeholder="Select beneficiary..." />
            </SelectTrigger>
            <SelectContent>
              {filteredRecords.map((option) => (
                <SelectItem key={option.benef_id} value={option.benef_id}>
                  {option.bnf_name} ({option.benef_id})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {beneficiarySummary && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {SUMMARY_COLUMNS.map((column) => (
                <Card key={column}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">{column.replace(/_/g, ' ')}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-semibold">{beneficiarySummary[column] ?? "-"}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" ref={phonePanelRef}>
        <div className="lg:col-span-3">
          <div className="bg-background rounded-[1rem] overflow-hidden">
            <div className="p-3 border-b text-center">
              <h3 className="text-lg font-semibold">Records Table</h3>
            </div>
            <div className="p-4 space-y-4">
                <div className="flex justify-end">
                    <Button onClick={handleDownload} disabled={loading}><FileDown className="mr-2 h-4 w-4"/>Export Table</Button>
                </div>
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {displayedColumns.map((col) => (
                        <TableHead key={col}>{col.replace(/_/g, ' ')}</TableHead>
                      ))}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedRecords.map((row) => (
                      <TableRow key={row.Id}>
                        {displayedColumns.map((col) => (
                          <TableCell key={`${row.Id}-${col}`}>{String(row[col] ?? "-")}</TableCell>
                        ))}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
                <div className="flex justify-between items-center mt-4">
                    <span className="text-sm text-muted-foreground">Page {currentPage} of {totalPages}</span>
                    <div className="flex gap-2">
                        <Button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1} variant="outline"><ChevronLeft className="mr-2 h-4 w-4" /> Previous</Button>
                        <Button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages} variant="outline">Next <ChevronRight className="ml-2 h-4 w-4" /></Button>
                    </div>
                </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
