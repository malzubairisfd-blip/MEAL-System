// src/app/monitoring/implementation/page.tsx
"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, BarChart, Activity, ShieldCheck, Globe, Users, DollarSign, Building } from "lucide-react";

export default function ImplementationPage() {
  const monitoringActivities = [
    { title: "Results monitoring", href: "/monitoring/implementation/results", icon: <BarChart className="h-8 w-8 text-blue-500" /> },
    { title: "Process (activity) monitoring", href: "/monitoring/implementation/process", icon: <Activity className="h-8 w-8 text-green-500" /> },
    { title: "Compliance monitoring", href: "/monitoring/implementation/compliance", icon: <ShieldCheck className="h-8 w-8 text-red-500" /> },
    { title: "Context (situation) monitoring", href: "/monitoring/implementation/context", icon: <Globe className="h-8 w-8 text-purple-500" /> },
    { title: "Beneficiary monitoring", href: "/monitoring/implementation/beneficiary", icon: <Users className="h-8 w-8 text-orange-500" /> },
    { title: "Financial monitoring", href: "/monitoring/implementation/financial", icon: <DollarSign className="h-8 w-8 text-yellow-500" /> },
    { title: "Organizational monitoring", href: "/monitoring/implementation/organizational", icon: <Building className="h-8 w-8 text-indigo-500" /> },
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
            <CardContent className="p-4 mt-auto">
                <Button variant="secondary" size="sm" className="group" asChild>
                    <Link href={activity.href}>
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
