"use client";

import React from 'react';
import ReactECharts from 'echarts-for-react';
import { useDashboard } from '@/app/report/page';

export function KPISection() {
  const kpis = [
    { label: "IDPs", value: "5.7M", icon: "👣" },
    { label: "Refugees", value: "2.2M", icon: "🧍" },
    { label: "People in Need", value: "31.4M", icon: "🚨" },
    { label: "People Targeted", value: "20.5M", icon: "🎯" },
    { label: "Funds Required", value: "$4.9B", icon: "💰" },
    { label: "Funds Received", value: "$388M", icon: "🏦" },
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
        values: [15, 18, 22, 25, 28]
    };
    const nutritionData = {
        years: ['2020', '2021', '2022', '2023', '2024'],
        values: [5, 6, 7, 8, 9]
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
    const { setSelectedRegion } = useDashboard();
    const countries = ['Nigeria', 'Mali', 'Niger', 'Burkina Faso', 'Chad'];
    const values = [12, 8, 6, 5, 4];
    
    const barOption = {
        title: { 
            text: 'People in Need by Country (Millions)',
            textStyle: { fontSize: 14, fontWeight: 'normal' }
        },
        xAxis: { type: "category", data: countries },
        yAxis: { type: "value" },
        series: [{
            type: "bar",
            data: values,
            itemStyle: { color: "#41b6c4" }
        }],
        grid: { left: '15%', right: '5%', top: '20%', bottom: '15%' },
        tooltip: { trigger: 'axis' }
    };
    
    const onEvents = {
        click: (params: any) => setSelectedRegion(params.name)
    };

    return (
        <div className="chart-container">
            <ReactECharts option={barOption} style={{ height: '520px', width: '100%' }} onEvents={onEvents}/>
        </div>
    );
}

export function BottomDonuts() {
    const { setSelectedRegion } = useDashboard();
    const fundingOption = {
        title: { 
            text: 'Funding Status ($4.9B Required)',
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
              { value: 388, name: "Funded" },
              { value: 4512, name: "Unmet" }
            ]
        }]
    };
    
    const countryData = [
        { value: 12, name: 'Nigeria' },
        { value: 8, name: 'Mali' },
        { value: 6, name: 'Niger' },
        { value: 5, name: 'Burkina Faso' },
        { value: 4, name: 'Chad' },
    ];
    
    const countryOption = {
        title: { 
            text: 'People in Need by Country',
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
        click: (params: any) => setSelectedRegion(params.name)
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
          <input type="checkbox" checked={layerState.bubbles}
            onChange={() => setLayerState(s => ({ ...s, bubbles: !s.bubbles }))} />
          Population Bubbles
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={layerState.heatmap}
            onChange={() => setLayerState(s => ({ ...s, heatmap: !s.heatmap }))} />
          Security Heatmap
        </label>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={layerState.incidents}
            onChange={() => setLayerState(s => ({ ...s, incidents: !s.incidents }))} />
          Incident Points
        </label>
      </div>
    </div>
  );
}

export function DataTable() {
    // This is a placeholder. A real implementation would fetch and display data.
    const { selectedRegion } = useDashboard();
    return (
        <div className="data-table-container">
            <h3 className="text-lg font-semibold">Data Table</h3>
            <p className="text-sm text-muted-foreground">Currently selected region: <span className="font-bold text-primary">{selectedRegion || 'None'}</span></p>
            {/* Table implementation would go here */}
        </div>
    )
}
