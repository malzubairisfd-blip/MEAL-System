
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users, User, CalendarDays, Home } from 'lucide-react';

interface KeyFiguresProps {
  data: {
    teamLeaders: number;
    surveyors: number;
    registrationDays: number;
    villages: number;
  };
}

const StatCard = ({ title, value, icon }: { title: string; value: number | string; icon: React.ReactNode }) => (
    <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{title}</CardTitle>
            {icon}
        </CardHeader>
        <CardContent>
            <div className="text-2xl font-bold">{value.toLocaleString()}</div>
        </CardContent>
    </Card>
);

export function KeyFigures({ data }: KeyFiguresProps) {
  return (
    <CardContent>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Team Leaders" value={data.teamLeaders} icon={<Users className="h-4 w-4 text-muted-foreground" />} />
        <StatCard title="Total Surveyors" value={data.surveyors} icon={<User className="h-4 w-4 text-muted-foreground" />} />
        <StatCard title="Total Registration Days" value={data.registrationDays} icon={<CalendarDays className="h-4 w-4 text-muted-foreground" />} />
        <StatCard title="Total Villages Targeted" value={data.villages} icon={<Home className="h-4 w-4 text-muted-foreground" />} />
      </div>
    </CardContent>
  );
}
