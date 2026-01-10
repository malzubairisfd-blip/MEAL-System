// components/charts/OutcomeTrendChart.tsx
"use client";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

export function OutcomeTrendChart({ data }: { data: any[] }) {
  return (
    <div className="bg-surface border border-border rounded-lg p-5">
      <h3 className="font-semibold text-lg mb-4">Outcome Trend</h3>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
          <XAxis dataKey="period" stroke="rgba(255,255,255,0.4)" />
          <YAxis stroke="rgba(255,255,255,0.4)" />
          <Tooltip contentStyle={{ backgroundColor: 'hsl(var(--background))', border: '1px solid hsl(var(--border))' }}/>
          <Area type="monotone" dataKey="value" stroke="hsl(var(--primary))" fill="hsl(var(--primary))" fillOpacity={0.3} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
