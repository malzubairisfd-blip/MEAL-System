
"use client";

import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useDashboard } from '@/app/report/page';

export function KPISection() {
  const kpis = [
    { label: "People in Need", value: "21.6M", icon: "🚨" },
    { label: "IDPs", value: "4.5M", icon: "👣" },
    { label: "Returnees", value: "1.2M", icon: "🧍" },
    { label: "People Targeted", value: "17.3M", icon: "🎯" },
    { label: "Funds Required", value: "$4.34B", icon: "💰" },
    { label: "Funds Received", value: "$1.32B", icon: "🏦" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
      {kpis.map(k => (
        <div key={k.label} className="kpi-card">
          <div className="icon">{k.icon}</div>
          <div className="value">{k.value}</div>
          <div className="label">{k.label}</div>
        </div>
      ))}
    </div>
  );
}
