"use client";
import React, { useMemo, useState } from "react";
import { IndicatorTrackingTable } from "@/components/itt/IndicatorTrackingTable";
import { ITTHeaderBar } from "@/components/itt/ITTHeaderBar";
import { ITTFilters } from "@/components/itt/ITTFilters";

import { Indicator, IndicatorValue } from "@/types/indicator";

export default function ITTPage() {
  // TEMP — replace with Firebase hooks
  const indicators: Indicator[] = []; 
  const indicatorValuesMap: Record<string, IndicatorValue[]> = {};

  const [selectedLevel, setSelectedLevel] = useState<string>("all");
  const [selectedPeriod, setSelectedPeriod] = useState<string>("LoP");

  const filteredIndicators = useMemo(() => {
    return indicators.filter(ind =>
      selectedLevel === "all" ? true : ind.level === selectedLevel
    );
  }, [indicators, selectedLevel]);

  return (
    <div className="p-6 space-y-4 bg-slate-950 min-h-screen text-slate-200">
      <ITTHeaderBar
        projectName="Education Recovery Project"
        period={selectedPeriod}
      />

      <ITTFilters
        selectedLevel={selectedLevel}
        onLevelChange={setSelectedLevel}
        selectedPeriod={selectedPeriod}
        onPeriodChange={setSelectedPeriod}
      />

      <IndicatorTrackingTable
        indicators={filteredIndicators}
        indicatorValuesMap={indicatorValuesMap}
      />
    </div>
  );
}
