
"use client";

import React from 'react';
import ReactECharts from 'echarts-for-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';

interface ChartData {
  name: string;
  value: number;
}

interface ChartProps {
  data: ChartData[];
}

const TableWithBarChart = ({ title, data, dataKeyLabel }: { title: string; data: ChartData[]; dataKeyLabel: string }) => {
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', boundaryGap: [0, 0.01] },
    yAxis: { type: 'category', data: sortedData.map(d => d.name).reverse() },
    series: [{
      type: 'bar',
      data: sortedData.map(d => d.value).reverse(),
      itemStyle: { color: '#41b6c4' }
    }]
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <ScrollArea className="h-72">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{dataKeyLabel}</TableHead>
                <TableHead className="text-right">Beneficiaries</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sortedData.map(item => (
                <TableRow key={item.name}>
                  <TableCell>{item.name}</TableCell>
                  <TableCell className="text-right">{item.value}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </ScrollArea>
        <div className="h-72">
          <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
        </div>
      </CardContent>
    </Card>
  );
};

export const BeneficiariesByVillageChart = ({ data }: ChartProps) => (
  <TableWithBarChart title="Beneficiaries by Village" data={data} dataKeyLabel="Village" />
);

export const BeneficiariesByDayChart = ({ data }: ChartProps) => (
  <TableWithBarChart title="Beneficiaries by Registration Day" data={data} dataKeyLabel="Day" />
);

export const WomenAndChildrenDonut = ({ data }: ChartProps) => {
    const option = {
      tooltip: { trigger: 'item' },
      legend: { top: '5%', left: 'center' },
      series: [{
        name: 'Women & Children Stats',
        type: 'pie',
        radius: ['40%', '70%'],
        avoidLabelOverlap: false,
        label: { show: false, position: 'center' },
        emphasis: { label: { show: true, fontSize: '20', fontWeight: 'bold' } },
        labelLine: { show: false },
        data: data
      }]
    };

    return (
        <Card>
            <CardHeader>
                <CardTitle>Women & Children</CardTitle>
                <CardDescription>Distribution of mothers and pregnant women.</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
                 <ReactECharts option={option} style={{ height: '100%', width: '100%' }}/>
            </CardContent>
        </Card>
    );
};
