// components/dashboard/MealDashboard.tsx
import { ImpactCard } from "@/components/cards/ImpactCard";
import { OutcomeTrendChart } from "@/components/charts/OutcomeTrendChart";
import { EvidenceTable } from "@/components/tables/EvidenceTable";

export function MealDashboard() {
  const data = [
    { period: 'Jan', value: 120 },
    { period: 'Feb', value: 180 },
    { period: 'Mar', value: 150 },
    { period: 'Apr', value: 220 },
    { period: 'May', value: 300 },
  ];
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

      <OutcomeTrendChart data={data} />
      <EvidenceTable rows={rows} />
    </div>
  );
}
