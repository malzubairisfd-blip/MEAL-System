// components/dashboard/MealDashboard.tsx
"use client";

import { useState, useEffect, useMemo } from 'react';
import { ImpactCard } from "@/components/cards/ImpactCard";
import { OutcomeTrendChart } from "@/components/charts/OutcomeTrendChart";
import { EvidenceTable } from "@/components/tables/EvidenceTable";
import { Loader2 } from 'lucide-react';

interface Project {
  budget: number;
  startDateYear: string;
  startDateMonth: string;
}

export function MealDashboard() {
  const [chartData, setChartData] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProjectData = async () => {
      try {
        const res = await fetch('/api/projects');
        if (!res.ok) {
          // Silently fail, dashboard will show empty state.
          // The developer can see the failed network request in the browser dev tools.
          return;
        }
        const projects: Project[] = await res.json();
        
        const budgetByMonth: { [key: string]: number } = {};
        
        projects.forEach(project => {
          if (project.startDateYear && project.startDateMonth && project.budget) {
            const date = new Date(parseInt(project.startDateYear), parseInt(project.startDateMonth) - 1);
            const key = date.toISOString().slice(0, 7); // YYYY-MM
            budgetByMonth[key] = (budgetByMonth[key] || 0) + project.budget;
          }
        });

        const sortedKeys = Object.keys(budgetByMonth).sort();
        let cumulativeBudget = 0;
        const processedData = sortedKeys.map(key => {
            cumulativeBudget += budgetByMonth[key];
            const date = new Date(key + '-02'); // Use day 02 to avoid timezone issues
            return {
                period: date.toLocaleDateString('en-US', { month: 'short', year: 'numeric'}),
                value: cumulativeBudget,
            };
        });

        setChartData(processedData);

      } catch (error) {
        console.warn("Failed to process project data for chart:", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProjectData();
  }, []);

  const rows = [
    { indicator: 'Child Vaccination', target: 100, actual: 95, status: 'Met' },
    { indicator: 'School Enrollment', target: 500, actual: 470, status: 'At Risk' },
    { indicator: 'Water Access', target: 300, actual: 280, status: 'Off Track' },
  ];

  return (
    <div className="space-y-8">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <ImpactCard title="Indicators Met" value="82%" impact="high" />
        <ImpactCard title="At Risk" value="11%" impact="medium" />
        <ImpactCard title="Off Track" value="7%" impact="low" />
      </div>

      {loading ? (
        <div className="flex items-center justify-center h-[364px] bg-surface border border-border rounded-lg">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <OutcomeTrendChart data={chartData} />
      )}
      <EvidenceTable rows={rows} />
    </div>
  );
}
