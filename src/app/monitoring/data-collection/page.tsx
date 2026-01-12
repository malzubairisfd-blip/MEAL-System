// src/app/monitoring/data-collection/page.tsx
"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Table, DatabaseZap, Binary, Percent, FileQuestion, Users, UserCheck, Sheet, Target } from "lucide-react";

export default function DataCollectionPlanPage() {
  const dataCollectionSteps = [
    { title: "Develop an M&E plan table", icon: <Table className="h-8 w-8 text-blue-500" />, href: "/monitoring/me-plan-table" },
    { title: "Prepare Monitoring indicators", icon: <Target className="h-8 w-8 text-orange-500" />, href: "/monitoring/prepare-indicators" },
    { title: "Availability of secondary data", icon: <DatabaseZap className="h-8 w-8 text-indigo-500" />, href: "#" },
    { title: "Determine the quantitative and qualitative data", icon: <Binary className="h-8 w-8 text-purple-500" />, href: "#" },
    { title: "Determine sampling requirements", icon: <Percent className="h-8 w-8 text-sky-500" />, href: "/monitoring/sampling-calculator" },
    { title: "Prepare for any surveys", icon: <FileQuestion className="h-8 w-8 text-green-500" />, href: "#" },
    { title: "Establish Monitoring staff selection Crietria", icon: <UserCheck className="h-8 w-8 text-red-500" />, href: "#" },
    { title: "indicator tracking table (ITT)", icon: <Sheet className="h-8 w-8 text-yellow-500" />, href: "/monitoring/data-collection/itt" },
  ];

  return (
    <div className="space-y-8">
       <div className="flex justify-between items-center">
        <div>
            <h1 className="text-3xl font-bold">Plan for Data Collection and Management</h1>
            <CardDescription>Outline the steps for gathering and managing project data.</CardDescription>
        </div>
        <Button variant="outline" asChild>
            <Link href="/monitoring/initiation-and-planning">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Initiation & Planning
            </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {dataCollectionSteps.map((step) => (
          <Card key={step.title} className="flex flex-col text-center items-center justify-center p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-2">
            <div className="p-4 bg-muted rounded-full mb-4">
                {step.icon}
            </div>
            <CardHeader className="p-0">
                <CardTitle className="text-base">{step.title}</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
                <Button variant="secondary" size="sm" className="mt-4 group" asChild>
                    <Link href={step.href}>
                        View Details <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
