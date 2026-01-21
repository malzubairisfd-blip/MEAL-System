// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/database/page.tsx
"use client";

import React, { useState, useEffect, useMemo, useCallback } from "react";
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { exportEducatorsToExcel } from "@/lib/exportEducatorsToExcel";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  UserCheck,
  UserX,
  Users,
  FileDown,
} from "lucide-react";


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

export default function EducatorDatabasePage() {
  const [records, setRecords] = useState<ApplicantRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 20;
  const { toast } = useToast();

  useEffect(() => {
    const fetchRecords = async () => {
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
    };
    fetchRecords();
  }, []);

  const filteredRecords = useMemo(() => {
    if (!searchTerm) return records;
    const lowercasedTerm = searchTerm.toLowerCase();
    return records.filter(record =>
      Object.values(record).some(value =>
        String(value).toLowerCase().includes(lowercasedTerm)
      )
    );
  }, [records, searchTerm]);
  
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
    if (records.length === 0) {
      toast({
        title: "No Data",
        description: "There is no data to download.",
        variant: "destructive",
      });
      return;
    }
    exportEducatorsToExcel(records, allColumns);
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
          <CardTitle>Applicant Records</CardTitle>
          <CardDescription>
            Displaying {paginatedRecords.length} of {filteredRecords.length} records.
          </CardDescription>
          <div className="relative pt-4">
            <Search className="absolute left-3 top-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search all columns..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
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
                    {allColumns.map((col) => (
                      <TableHead key={col} className="whitespace-nowrap">{col.replace(/_/g, ' ')}</TableHead>
                    ))}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {paginatedRecords.map((record, index) => (
                    <TableRow key={index}>
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
    </div>
  );
}
