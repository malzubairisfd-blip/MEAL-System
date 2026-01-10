// src/app/monitoring/implementation/page.tsx
"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, BarChart, Activity, ShieldCheck, Globe, Users, DollarSign, Building } from "lucide-react";

export default function ImplementationPage() {
  const monitoringActivities = [
    { title: "Results monitoring", icon: <BarChart className="h-8 w-8 text-blue-500" /> },
    { title: "Process (activity) monitoring", icon: <Activity className="h-8 w-8 text-green-500" /> },
    { title: "Compliance monitoring", icon: <ShieldCheck className="h-8 w-8 text-red-500" /> },
    { title: "Context (situation) monitoring", icon: <Globe className="h-8 w-8 text-purple-500" /> },
    { title: "Beneficiary monitoring", icon: <Users className="h-8 w-8 text-orange-500" /> },
    { title: "Financial monitoring", icon: <DollarSign className="h-8 w-8 text-yellow-500" /> },
    { title: "Organizational monitoring", icon: <Building className="h-8 w-8 text-indigo-500" /> },
  ];

  return (
    <div className="space-y-8">
       <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Implementation Monitoring</h1>
         <Button variant="outline" asChild>
            <Link href="/monitoring">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to M&E Lifecycle
            </Link>
        </Button>
      </div>

       <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {monitoringActivities.map((activity) => (
          <Card key={activity.title} className="flex flex-col text-center items-center justify-center p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-2">
            <div className="p-4 bg-muted rounded-full mb-4">
                {activity.icon}
            </div>
            <CardHeader className="p-0">
                <CardTitle className="text-base">{activity.title}</CardTitle>
            </CardHeader>
            <CardContent className="p-4">
                <Button variant="secondary" size="sm" className="mt-4">
                    View Details
                </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
