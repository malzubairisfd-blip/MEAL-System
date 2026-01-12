"use client";
import React from "react";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";

export function ITTHeaderBar({
  projectName,
  period
}: {
  projectName: string;
  period: string;
}) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 flex justify-between items-center">
      <div>
        <h1 className="text-xl font-bold">Indicator Tracking Table (ITT)</h1>
        <p className="text-sm text-slate-400">
          Project: {projectName} • Reporting Period: {period}
        </p>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" size="sm">
          <FileSpreadsheet className="h-4 w-4 mr-2" />
          Export Excel
        </Button>
        <Button variant="outline" size="sm">
          <FileText className="h-4 w-4 mr-2" />
          Export PDF
        </Button>
      </div>
    </div>
  );
}
