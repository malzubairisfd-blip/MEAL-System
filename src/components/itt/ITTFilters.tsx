"use client";
import React from "react";

export function ITTFilters({
  selectedLevel,
  onLevelChange,
  selectedPeriod,
  onPeriodChange
}: {
  selectedLevel: string;
  onLevelChange: (v: string) => void;
  selectedPeriod: string;
  onPeriodChange: (v: string) => void;
}) {
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 flex flex-wrap gap-4">
      <FilterSelect
        label="Result Level"
        value={selectedLevel}
        onChange={onLevelChange}
        options={[
          { value: "all", label: "All" },
          { value: "goal", label: "Goal" },
          { value: "outcome", label: "Outcome" },
          { value: "output", label: "Output" },
          { value: "activity", label: "Activity" }
        ]}
      />

      <FilterSelect
        label="Reporting Period"
        value={selectedPeriod}
        onChange={onPeriodChange}
        options={[
          { value: "LoP", label: "Life of Project" },
          { value: "2024-Q1", label: "2024 Q1" },
          { value: "2024-Q2", label: "2024 Q2" }
        ]}
      />
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  options
}: any) {
  return (
    <div className="flex flex-col text-sm">
      <label className="text-slate-400 mb-1">{label}</label>
      <select
        value={value}
        onChange={e => onChange(e.target.value)}
        className="bg-slate-800 border border-slate-700 rounded px-3 py-1.5"
      >
        {options.map((o: any) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
