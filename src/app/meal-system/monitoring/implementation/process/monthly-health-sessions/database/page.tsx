// src/app/meal-system/monitoring/implementation/process/monthly-health-sessions/database/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Loader2, Search, ArrowLeft, ChevronLeft, ChevronRight, FileDown } from "lucide-react";
import { Input } from '@/components/ui/input';
import { exportHealthSessionsToExcel } from '@/lib/exportHealthSessionsToExcel';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

export default function HealthSessionsDatabasePage() {
    const [records, setRecords] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
    const [currentPage, setCurrentPage] = useState(1);
    const [selectedBeneficiaryId, setSelectedBeneficiaryId] = useState<string | null>(null);

    const itemsPerPage = 50;
    const phonePanelRef = useRef<HTMLDivElement>(null);
    const { toast } = useToast();

    useEffect(() => {
        const fetchRecords = async () => {
            setLoading(true);
            try {
                const res = await fetch('/api/monthly-health-sessions');
                if (!res.ok) throw new Error("Failed to fetch session data.");
                setRecords(await res.json());
            } catch (err: any) {
                setError(err.message);
                toast({ title: "Error", description: err.message, variant: 'destructive' });
            } finally {
                setLoading(false);
            }
        };
        fetchRecords();
    }, [toast]);

    const filteredRecords = useMemo(() => {
        if (!searchTerm) return records;
        const lowercasedTerm = searchTerm.toLowerCase();
        return records.filter(r => 
            String(r.benef_id).toLowerCase().includes(lowercasedTerm) ||
            String(r.bnf_name).toLowerCase().includes(lowercasedTerm)
        );
    }, [records, searchTerm]);

    const paginatedRecords = useMemo(() => {
        const startIndex = (currentPage - 1) * itemsPerPage;
        return filteredRecords.slice(startIndex, startIndex + itemsPerPage);
    }, [filteredRecords, currentPage]);
    
    const beneficiarySummary = useMemo(() => {
        if (!selectedBeneficiaryId) return null;
        const record = records.find(r => r.benef_id === selectedBeneficiaryId);
        if (!record) return null;

        let total_appear = 0;
        let total_absence = 0;
        let total_alternative = 0;

        for (let i = 1; i <= 76; i++) {
            if (record[`bnf_appear_s${i}`] === 1) total_appear++;
            if (record[`absent_s${i}`] === 1) total_absence++;
            if (record[`has_alternative_s${i}`]) total_alternative++;
        }
        
        const total_attending = total_appear - total_absence;

        return { total_appear, total_attending, total_absence, total_alternative };
    }, [selectedBeneficiaryId, records]);

    const totalPages = Math.ceil(filteredRecords.length / itemsPerPage);
    const allColumns = useMemo(() => (records.length > 0 ? Object.keys(records[0]) : []), [records]);
    
    const handleDownload = () => {
        if (records.length === 0) {
          toast({ title: "No Data", description: "There is no data to download.", variant: "destructive" });
          return;
        }
        exportHealthSessionsToExcel(records, allColumns);
        toast({ title: "Download Started", description: "Your Excel file is being generated." });
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Health Sessions Database</h1>
                <div className="flex gap-2">
                    <Button variant="outline" asChild>
                        <Link href="/meal-system/monitoring/implementation/process/monthly-health-sessions">
                            <ArrowLeft className="mr-2 h-4 w-4" /> Back to Hub
                        </Link>
                    </Button>
                    <Button onClick={handleDownload} disabled={loading}>
                        <FileDown className="mr-2 h-4 w-4" /> Download as Excel
                    </Button>
                </div>
            </div>
            
            <Card>
                <CardHeader>
                    <CardTitle>Beneficiary Summary</CardTitle>
                    <CardDescription>Select a beneficiary to see their overall session summary.</CardDescription>
                </CardHeader>
                <CardContent>
                    <Select onValueChange={setSelectedBeneficiaryId} value={selectedBeneficiaryId || ''}>
                        <SelectTrigger className="w-full md:w-1/2">
                            <SelectValue placeholder="Select a beneficiary..." />
                        </SelectTrigger>
                        <SelectContent>
                            {records.map(r => (
                                <SelectItem key={r.benef_id} value={r.benef_id}>
                                    {r.bnf_name} ({r.benef_id})
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>

                    {beneficiarySummary && (
                        <div className="mt-4 border rounded-lg overflow-hidden">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Total Appearances</TableHead>
                                        <TableHead>Total Attendance</TableHead>
                                        <TableHead>Total Absence</TableHead>
                                        <TableHead>Total Alternatives</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    <TableRow>
                                        <TableCell>{beneficiarySummary.total_appear}</TableCell>
                                        <TableCell>{beneficiarySummary.total_attending}</TableCell>
                                        <TableCell>{beneficiarySummary.total_absence}</TableCell>
                                        <TableCell>{beneficiarySummary.total_alternative}</TableCell>
                                    </TableRow>
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Session Records</CardTitle>
                    <CardDescription>
                        Displaying {paginatedRecords.length} of {filteredRecords.length} records.
                    </CardDescription>
                     <div className="relative pt-4">
                        <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground -translate-y-1/2" />
                        <Input
                        placeholder="Search by Beneficiary ID or Name..."
                        value={searchTerm}
                        onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
                        className="pl-10"
                        />
                    </div>
                </CardHeader>
                 <CardContent>
                     {loading ? (
                        <div className="flex justify-center items-center h-64"><Loader2 className="h-8 w-8 animate-spin" /></div>
                     ) : error ? (
                        <div className="text-center text-red-500 py-10">{error}</div>
                     ) : (
                        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" ref={phonePanelRef}>
                            <div className="lg:col-span-3">
                                <div className="bg-background rounded-[1rem] overflow-hidden">
                                    <div className="p-3 border-b text-center"><h3 className="font-bold">Health Session Records</h3></div>
                                    <div className="p-4 w-full overflow-x-auto">
                                        <Table>
                                            <TableHeader><TableRow>
                                                {allColumns.map(col => <TableHead key={col} className="whitespace-nowrap px-4">{col.replace(/_/g, ' ')}</TableHead>)}
                                            </TableRow></TableHeader>
                                            <TableBody>
                                                {paginatedRecords.map(record => (
                                                    <TableRow key={record.id}>
                                                        {allColumns.map(col => <TableCell key={col} className="whitespace-nowrap px-4">{String(record[col] ?? '')}</TableCell>)}
                                                    </TableRow>
                                                ))}
                                            </TableBody>
                                        </Table>
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
                     )}
                 </CardContent>
            </Card>
        </div>
    );
}
