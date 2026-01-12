"use client";
import React from "react";

import { Indicator, IndicatorValue } from "@/types/indicator";
import {
  calculateLoPActual,
  calculateProgress,
  getIndicatorStatus
} from "@/lib/ittCalculations";

import { ITTCell } from "./ITTTableCell";
import { ITTProgressBar } from "./ITTProgressBar";
import { ITTStatusBadge } from "./ITTStatusBadge";

interface ITTProps {
  indicators: Indicator[];
  indicatorValuesMap: Record<string, IndicatorValue[]>;
}

export function IndicatorTrackingTable({
  indicators,
  indicatorValuesMap
}: ITTProps) {
  return (
    <div className="overflow-auto border border-slate-700 rounded-lg bg-slate-900">
      <table className="min-w-[1900px] border-collapse text-slate-200">
        <thead className="bg-slate-800 sticky top-0 z-10">
          <tr>
            {HEADERS.map(h => (
              <th
                key={h}
                className="px-3 py-2 border border-slate-700 text-left text-sm font-semibold"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>

        <tbody>
          {indicators.map(ind => {
            const values = indicatorValuesMap[ind.id] || [];
            const lopActual = calculateLoPActual(ind, values);
            const progress = calculateProgress(
              lopActual,
              ind.targetValue
            );
            const status = getIndicatorStatus(
              lopActual,
              ind.targetValue
            );

            return (
              <tr key={ind.id} className="hover:bg-slate-800/40">
                <ITTCell>{ind.code}</ITTCell>
                <ITTCell className="max-w-[320px] whitespace-normal break-words">
                  {ind.title}
                </ITTCell>
                <ITTCell className="capitalize">{ind.level}</ITTCell>
                <ITTCell>{ind.unit}</ITTCell>

                <ITTCell>{ind.baselineValue}</ITTCell>
                <ITTCell>{ind.baselineDate}</ITTCell>

                <ITTCell>{ind.targetValue}</ITTCell>
                <ITTCell>{ind.targetDate}</ITTCell>

                <ITTCell className="font-semibold text-blue-400">
                  {lopActual ?? "-"}
                </ITTCell>

                <ITTCell>
                  <ITTProgressBar value={progress} />
                </ITTCell>

                <ITTCell>
                  <ITTStatusBadge status={status} />
                </ITTCell>

                <ITTCell className="max-w-[300px] whitespace-normal break-words">
                  {values.at(-1)?.comments || ""}
                </ITTCell>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const HEADERS = [
  "Indicator Code",
  "Indicator Description",
  "Level",
  "Unit",
  "Baseline",
  "Baseline Date",
  "Target",
  "Target Date",
  "LoP Actual",
  "Progress %",
  "Status",
  "Comments"
];
