// components/tables/EvidenceTable.tsx
"use client";

import { StatusBadge } from "@/components/feedback/StatusBadge";

interface EvidenceRow {
  indicator: string;
  target: number;
  actual: number;
  status: 'Met' | 'At Risk' | 'Off Track';
}

export function EvidenceTable({ rows }: { rows: EvidenceRow[] }) {
  return (
    <div className="bg-surface border border-border rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-primary text-primary-foreground">
          <tr>
            <th className="px-4 py-3 text-left font-bold text-primary-foreground">Indicator</th>
            <th className="px-4 py-3 font-bold text-primary-foreground">Target</th>
            <th className="px-4 py-3 font-bold text-primary-foreground">Actual</th>
            <th className="px-4 py-3 font-bold text-primary-foreground">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(row => (
            <tr key={row.indicator} className="border-t border-border hover:bg-white/5">
              <td className="px-4 py-3">{row.indicator}</td>
              <td className="px-4 py-3 font-mono">{row.target}</td>
              <td className="px-4 py-3 font-mono">{row.actual}</td>
              <td className="px-4 py-3">
                <StatusBadge status={row.status} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
