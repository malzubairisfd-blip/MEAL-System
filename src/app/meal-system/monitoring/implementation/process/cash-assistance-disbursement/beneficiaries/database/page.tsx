
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
import { Users, Archive, Database, Upload, ArrowLeft, Filter, Edit3, Trash2 } from "lucide-react";

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

export default function BeneficiariesCashdisbursementDatabasePage() {
  const { toast } = useToast();
  const [projects, setProjects] = useState<Project[]>([]);
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [records, setRecords] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [columnFilters, setColumnFilters] = useState<Record<string, string>>({});
  const [selectedBeneficiary, setSelectedBeneficiary] = useState("");
  const [editPayload, setEditPayload] = useState("");
  const [editingRecord, setEditingRecord] = useState<any | null>(null);
  const [deletingRecord, setDeletingRecord] = useState<any | null>(null);
  const phonePanelRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetch("/api/projects").then((res) => res.json()).then((data) => setProjects(data));
  }, []);

  useEffect(() => {
    if (!selectedProjectId) {
      setRecords([]);
      return;
    }
    setLoading(true);
    fetch(`/api/bnf-cash-disbursement?projectId=${selectedProjectId}`)
      .then((res) => res.json())
      .then((data) => setRecords(Array.isArray(data) ? data : []))
      .finally(() => setLoading(false));
  }, [selectedProjectId]);

  const beneficiaryOptions = useMemo(
    () =>
      records
        .map((row) => ({
          id: row.benef_id,
          label: `${row.benef_id} - ${row.bnf_name}`,
        }))
        .filter((option) => option.id),
    [records]
  );

  const selectedBeneficiaryRow = useMemo(() => records.find((row) => row.benef_id === selectedBeneficiary), [
    records,
    selectedBeneficiary,
  ]);

  const filteredRecords = useMemo(() => {
    return records.filter((row) => {
      if (searchTerm) {
        const lower = searchTerm.toLowerCase();
        const combined = Object.values(row)
          .map((value) => (value !== null && value !== undefined ? String(value).toLowerCase() : ""))
          .join(" ");
        if (!combined.includes(lower)) return false;
      }
      for (const [col, value] of Object.entries(columnFilters)) {
        if (!value) continue;
        const cell = row[col];
        const cellValue = cell !== null && cell !== undefined ? String(cell).toLowerCase() : "";
        if (!cellValue.includes(value.toLowerCase())) return false;
      }
      return true;
    });
  }, [records, searchTerm, columnFilters]);

  const handleEdit = (record: any) => {
    setEditingRecord(record);
    setEditPayload(JSON.stringify(record, null, 2));
  };

  const saveEdit = async () => {
    if (!editingRecord) return;
    try {
      const payload = JSON.parse(editPayload);
      await fetch("/api/bnf-cash-disbursement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "update_record", id: editingRecord.Id, payload }),
      });
      setEditingRecord(null);
      setEditPayload("");
      toast({ title: "Updated", description: "Record updated successfully." });
      if (selectedProjectId) {
        const res = await fetch(`/api/bnf-cash-disbursement?projectId=${selectedProjectId}`);
        const data = await res.json();
        setRecords(Array.isArray(data) ? data : []);
      }
    } catch (error: any) {
      toast({ title: "Update Failed", description: error.message, variant: "destructive" });
    }
  };

  const confirmDelete = async () => {
    if (!deletingRecord) return;
    try {
      await fetch("/api/bnf-cash-disbursement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "delete_record", id: deletingRecord.Id }),
      });
      setDeletingRecord(null);
      toast({ title: "Deleted", description: "Record removed." });
      if (selectedProjectId) {
        const res = await fetch(`/api/bnf-cash-disbursement?projectId=${selectedProjectId}`);
        const data = await res.json();
        setRecords(Array.isArray(data) ? data : []);
      }
    } catch (error: any) {
      toast({ title: "Delete Failed", description: error.message, variant: "destructive" });
    }
  };

  const displayedColumns = ["benef_id", "bnf_name", "pc_id", "pc_name", "total_pay_list", "total_pay_amt", "total_cashed_amt", "total_uncashed_amt"];

  return (
    <div className="space-y-6 pb-8">
      <div className="flex flex-col md:flex-row items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Beneficiaries Cash disbursement Database</h1>
          <p className="text-sm text-muted-foreground">Inspect and maintain payment disbursement records.</p>
        </div>
        <div className="flex gap-2">
          <Button asChild><Link href="/meal-system/monitoring/implementation/process/bnf-cash-disbursement/upload"><Upload className="mr-2 h-4 w-4"/>Upload</Link></Button>
          <Button asChild><Link href="/meal-system/monitoring/implementation/process/bnf-cash-disbursement/dashboard"><Archive className="mr-2 h-4 w-4"/>Dashboard</Link></Button>
          <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/bnf-cash-disbursement"><ArrowLeft className="mr-2 h-4 w-4"/>Back to Hub</Link></Button>
        </div>
      </div>
      <Card>
        <CardHeader><CardTitle>Select Project</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Select value={selectedProjectId} onValueChange={setSelectedProjectId}>
            <SelectTrigger>
              <SelectValue placeholder="Select project..." />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.projectId} value={project.projectId}>
                  {project.projectName} ({project.projectId})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input placeholder="Search entire table..." value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Beneficiary Summary</CardTitle></CardHeader>
        <CardContent className="space-y-4">
          <Select value={selectedBeneficiary} onValueChange={setSelectedBeneficiary}>
            <SelectTrigger>
              <SelectValue placeholder="Select beneficiary..." />
            </SelectTrigger>
            <SelectContent>
              {beneficiaryOptions.map((option) => (
                <SelectItem key={option.id} value={option.id}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {selectedBeneficiaryRow && (
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              {SUMMARY_COLUMNS.map((column) => (
                <Card key={column}>
                  <CardHeader className="pb-2">
                    <CardTitle className="text-xs font-medium text-muted-foreground">{column}</CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="text-lg font-semibold">{selectedBeneficiaryRow[column] ?? "-"}</div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6" ref={phonePanelRef}>
        <div className="lg:col-span-2">
          <div className="bg-background rounded-[1rem] overflow-hidden">
            <div className="p-3 border-b text-center">
              <h3 className="text-lg font-semibold">Records Table</h3>
            </div>
            <div className="p-4 space-y-4">
              <ScrollArea className="h-[400px]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      {displayedColumns.map((col) => (
                        <TableHead key={col}>
                          <div className="flex items-center gap-2">
                            {col}
                            <Button size="sm" variant="ghost" onClick={() => setColumnFilters((prev) => ({ ...prev, [col]: prev[col] || "" }))}>
                              <Filter className="h-4 w-4" />
                            </Button>
                          </div>
                          {columnFilters[col] !== undefined && (
                            <Input
                              className="mt-2"
                              value={columnFilters[col]}
                              onChange={(event) => setColumnFilters((prev) => ({ ...prev, [col]: event.target.value }))}
                              placeholder="Filter..."
                            />
                          )}
                        </TableHead>
                      ))}
                      <TableHead>Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRecords.map((row) => (
                      <TableRow key={row.Id}>
                        {displayedColumns.map((col) => (
                          <TableCell key={`${row.Id}-${col}`}>{String(row[col] ?? "-")}</TableCell>
                        ))}
                        <TableCell className="flex gap-2">
                          <Button size="sm" variant="ghost" onClick={() => handleEdit(row)}>
                            <Edit3 className="h-4 w-4" />
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => setDeletingRecord(row)}>
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </ScrollArea>
            </div>
          </div>
        </div>
        <div className="space-y-4">
          <Card>
            <CardHeader><CardTitle>Editing Panel</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {editingRecord ? (
                <>
                  <Input
                    className="h-40"
                    as="textarea"
                    value={editPayload}
                    onChange={(event) => setEditPayload(event.target.value)}
                  />
                  <div className="flex gap-2">
                    <Button onClick={saveEdit}>Save</Button>
                    <Button variant="outline" onClick={() => setEditingRecord(null)}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Select a record to edit its payload.</p>
              )}
            </CardContent>
          </Card>
          <Card>
            <CardHeader><CardTitle>Delete Confirmation</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {deletingRecord ? (
                <>
                  <p className="text-sm text-muted-foreground">
                    Are you sure you want to delete <strong>{deletingRecord.benef_id}</strong>?
                  </p>
                  <div className="flex gap-2">
                    <Button variant="destructive" onClick={confirmDelete}>
                      Delete
                    </Button>
                    <Button variant="outline" onClick={() => setDeletingRecord(null)}>
                      Cancel
                    </Button>
                  </div>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">Select a record to delete.</p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>

      <Card>
        <CardContent className="flex gap-2">
          <Button asChild><Link href="/meal-system/monitoring/implementation/process/bnf-cash-disbursement/dashboard"><Archive className="mr-2 h-4 w-4"/>Dashboard</Link></Button>
          <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/bnf-cash-disbursement/upload"><Upload className="mr-2 h-4 w-4"/>Upload</Link></Button>
          <Button variant="outline" asChild><Link href="/meal-system/monitoring/implementation/process/bnf-cash-disbursement"><ArrowLeft className="mr-2 h-4 w-4"/>Back to Hub</Link></Button>
        </CardContent>
      </Card>
    </div>
  );
}
