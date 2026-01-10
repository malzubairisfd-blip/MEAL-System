

"use client";

import React from 'react';
import ReactECharts from 'echarts-for-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { ScrollArea } from '@/components/ui/scroll-area';
import { useTranslation } from '@/hooks/use-translation';

interface ChartData {
  name: string;
  value: number;
}

interface ChartProps {
  data: ChartData[];
}

const TableWithBarChart = ({ title, data, dataKeyLabel }: { title: string; data: ChartData[]; dataKeyLabel: string }) => {
  const { t } = useTranslation();
  const sortedData = [...data].sort((a, b) => b.value - a.value);

  const option = {
    tooltip: { trigger: 'axis', axisPointer: { type: 'shadow' } },
    grid: { left: '3%', right: '4%', bottom: '3%', containLabel: true },
    xAxis: { type: 'value', boundaryGap: [0, 0.01] },
    yAxis: { type: 'category', data: sortedData.map(d => d.name).reverse(), axisLabel: { interval: 0, rotate: 0 } },
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
      <CardContent>
        {/* The ScrollArea height is removed to allow full content rendering for image capture */}
        <ScrollArea>
          <Table>
            <TableHeader className="bg-primary text-primary-foreground">
              <TableRow>
                <TableHead className="font-bold text-black">{dataKeyLabel}</TableHead>
                <TableHead className="text-right font-bold text-black">{t('report.charts.beneficiaries')}</TableHead>
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
        <div className="h-72 mt-4">
          <ReactECharts option={option} style={{ height: '100%', width: '100%' }} />
        </div>
      </CardContent>
    </Card>
  );
};

export const BeneficiariesByVillageChart = ({ data }: ChartProps) => {
  const { t } = useTranslation();
  return <TableWithBarChart title={t('report.charts.byVillage')} data={data} dataKeyLabel={t('report.charts.village')} />
};

export const BeneficiariesByDayChart = ({ data }: ChartProps) => {
  const { t } = useTranslation();
  return <TableWithBarChart title={t('report.charts.byDay')} data={data} dataKeyLabel={t('report.charts.day')} />
};

export const WomenAndChildrenDonut = ({ data }: ChartProps) => {
    const { t } = useTranslation();
    const option = {
      tooltip: { trigger: 'item' },
      legend: { top: '5%', left: 'center' },
      series: [{
        name: t('report.charts.womenAndChildren'),
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
                <CardTitle>{t('report.charts.womenAndChildren')}</CardTitle>
                <CardDescription>{t('report.charts.womenAndChildrenDescription')}</CardDescription>
            </CardHeader>
            <CardContent className="h-72">
                 <ReactECharts option={option} style={{ height: '100%', width: '100%' }}/>
            </CardContent>
        </Card>
    );
};
