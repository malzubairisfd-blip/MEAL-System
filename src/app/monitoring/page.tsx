
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Target,
  Database,
  BarChart3,
  FileText,
  Users,
  CircleDollarSign,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

export default function MonitoringPage() {
  const monitoringSteps = [
    { href: "#", icon: <Target className="h-8 w-8 text-indigo-500" />, title: "Identify the purpose and scope of the M&E system" },
    { href: "#", icon: <Database className="h-8 w-8 text-blue-500" />, title: "Plan for data collection and management" },
    { href: "#", icon: <BarChart3 className="h-8 w-8 text-green-500" />, title: "Plan for data analysis" },
    { href: "#", icon: <FileText className="h-8 w-8 text-sky-500" />, title: "Plan for information reporting and utilization" },
    { href: "#", icon: <Users className="h-8 w-8 text-purple-500" />, title: "Plan for M&E human resources and capacity building" },
    { href: "#", icon: <CircleDollarSign className="h-8 w-8 text-slate-500" />, title: "Prepare the M&E budget" },
  ];

  return (
    <div className="space-y-8">
       <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">M&E System Planning</h1>
        <Button variant="outline" asChild>
            <Link href="/meal-system">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to MEAL System
            </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {monitoringSteps.map((step, index) => (
          <Card key={index} className="flex flex-col transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <CardHeader className="flex-row items-center gap-4 space-y-0">
                <div className="rounded-lg bg-muted p-4">
                    {step.icon}
                </div>
                <CardTitle className="text-base font-semibold">{step.title}</CardTitle>
            </CardHeader>
            <CardContent className="mt-auto flex justify-end">
                <Button variant="secondary" size="sm" className="group" asChild>
                    <Link href={step.href}>
                        Go <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
