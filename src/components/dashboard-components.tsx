
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


export function TrendSection() {
    const foodSecurityData = {
        years: ['2020', '2021', '2022', '2023', '2024'],
        values: [17.9, 16.1, 17.4, 19.0, 17.0]
    };
    const nutritionData = {
        years: ['2020', '2021', '2022', '2023', '2024'],
        values: [2.0, 2.2, 2.3, 2.2, 2.4]
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="chart-container">
                <TrendChart title="Food Security Crisis (Millions)" data={foodSecurityData} />
            </div>
            <div className="chart-container">
                <TrendChart title="Acute Malnutrition (Millions)" data={nutritionData} />
            </div>
        </div>
    );
}

export function TrendChart({ title, data }: { title: string, data: { years: string[], values: number[] } }) {
  const option = {
    title: { 
        text: title,
        textStyle: { fontSize: 14, fontWeight: 'normal' }
    },
    xAxis: { type: "category", data: data.years },
    yAxis: { type: "value" },
    series: [{
      type: "line",
      data: data.values,
      smooth: true,
      areaStyle: {}
    }],
    grid: { left: '10%', right: '10%', top: '20%', bottom: '15%' },
    tooltip: { trigger: 'axis' }
  };
  return <ReactECharts option={option} style={{ height: '250px', width: '100%' }} />;
}


export function SideIndicators() {
    const { setSelectedRegion, selectedRegion } = useDashboard();
    const governorates = ['Hajjah', 'Al Hudaydah', 'Taizz', "Sana'a", 'Ibb', 'Dhamar', 'Amanat Al Asimah', 'Saada'];
    const values = [2.2, 2.9, 2.4, 1.3, 1.8, 1.0, 1.9, 0.8];
    
    const barOption = {
        title: { 
            text: 'People in Need by Governorate (Millions)',
            textStyle: { fontSize: 14, fontWeight: 'normal' }
        },
        xAxis: { type: "category", data: governorates, axisLabel: { interval: 0, rotate: 30 } },
        yAxis: { type: "value" },
        series: [{
            type: "bar",
            data: values,
            itemStyle: { color: "#41b6c4" }
        }],
        grid: { left: '15%', right: '5%', top: '20%', bottom: '25%' },
        tooltip: { trigger: 'axis' }
    };
    
    const onEvents = {
        click: (params: any) => setSelectedRegion(params.name === selectedRegion ? null : params.name)
    };

    return (
        <div className="chart-container">
            <ReactECharts option={barOption} style={{ height: '520px', width: '100%' }} onEvents={onEvents}/>
        </div>
    );
}

export function BottomDonuts() {
    const { setSelectedRegion, selectedRegion } = useDashboard();
    const fundingOption = {
        title: { 
            text: 'Funding Status ($4.34B Required)',
            left: 'center',
            textStyle: { fontSize: 14, fontWeight: 'normal' }
        },
        tooltip: { trigger: 'item' },
        legend: { orient: 'vertical', left: 'left', top: 'center' },
        series: [{
            type: "pie",
            radius: ["65%", "85%"],
            avoidLabelOverlap: false,
            label: { show: false, position: 'center' },
            emphasis: { label: { show: true, fontSize: '20', fontWeight: 'bold' } },
            labelLine: { show: false },
            data: [
              { value: 1320, name: "Funded" },
              { value: 3020, name: "Unmet" }
            ]
        }]
    };
    
    const countryData = [
        { value: 2.9, name: 'Al Hudaydah' },
        { value: 2.4, name: 'Taizz' },
        { value: 2.2, name: 'Hajjah' },
        { value: 1.9, name: "Amanat Al Asimah" },
        { value: 1.8, name: 'Ibb' },
    ];
    
    const countryOption = {
        title: { 
            text: 'Top 5 Governorates (People in Need)',
            left: 'center',
            textStyle: { fontSize: 14, fontWeight: 'normal' }
        },
        tooltip: { trigger: 'item' },
        legend: { orient: 'vertical', left: 'left', top: 'center' },
        series: [{
            type: 'pie',
            radius: '70%',
            data: countryData,
            emphasis: {
                itemStyle: {
                    shadowBlur: 10,
                    shadowOffsetX: 0,
                    shadowColor: 'rgba(0, 0, 0, 0.5)'
                }
            }
        }]
    };
    
    const onEvents = {
        click: (params: any) => setSelectedRegion(params.name === selectedRegion ? null : params.name)
    };

    return (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="chart-container">
                <ReactECharts option={fundingOption} style={{ height: '300px', width: '100%' }} />
            </div>
            <div className="chart-container">
                <ReactECharts option={countryOption} style={{ height: '300px', width: '100%' }} onEvents={onEvents} />
            </div>
        </div>
    );
}

export function LayerToggles() {
  const { layerState, setLayerState } = useDashboard();
  return (
    <div className="absolute top-4 right-4 bg-white p-3 rounded shadow-lg z-[1000]">
      <div className="flex flex-col gap-2">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={layerState.clusters}
            onChange={() => setLayerState(s => ({ ...s, clusters: !s.clusters }))} />
          Clusters
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={layerState.heatmap}
            onChange={() => setLayerState(s => ({ ...s, heatmap: !s.heatmap }))} />
          Security Heatmap
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={layerState.admin1}
            onChange={() => setLayerState(s => ({ ...s, admin1: !s.admin1 }))} />
          Admin Boundaries
        </label>
      </div>
    </div>
  );
}

export function DataTable() {
    const { selectedRegion } = useDashboard();
    return (
        <div className="data-table-container chart-container">
            <h3 className="text-lg font-semibold">Data Table</h3>
            <p className="text-sm text-muted-foreground">Currently selected region: <span className="font-bold text-primary">{selectedRegion || 'None'}</span></p>
            {/* Table implementation would go here */}
        </div>
    )
}
