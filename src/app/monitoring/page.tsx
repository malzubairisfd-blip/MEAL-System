// src/app/monitoring/page.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ClipboardList, PlayCircle, Flag } from "lucide-react";
import { cn } from '@/lib/utils';

export default function MonitoringPage() {
  const monitoringStages = [
    {
      title: "Initiation and Planning",
      description: "Creating the roadmap for your M&E system.",
      href: "/monitoring/initiation-and-planning",
      icon: <ClipboardList className="h-8 w-8 text-blue-500" />
    },
    {
      title: "Implementation",
      description: "Doing the work and monitoring progress.",
      href: "/monitoring/implementation",
      icon: <PlayCircle className="h-8 w-8 text-green-500" />
    },
    {
      title: "Closure",
      description: "Finalizing deliverables and lessons learned.",
      href: "/monitoring/closure",
      icon: <Flag className="h-8 w-8 text-red-500" />
    }
  ];

  return (
    <div className="space-y-8">
       <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">M&E System Lifecycle</h1>
        <Button variant="outline" asChild>
            <Link href="/meal-system">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to MEAL System
            </Link>
        </Button>
      </div>

      <div className="flex flex-col items-center justify-center gap-0 md:flex-row md:gap-4">
        {monitoringStages.map((stage, index) => (
          <React.Fragment key={stage.title}>
            <Link href={stage.href} className="block w-full md:w-1/3 transition-all duration-300 hover:shadow-lg hover:-translate-y-1 rounded-lg">
               <Card className={cn("flex flex-col text-center h-full items-center justify-center p-6")}>
                 <div className="rounded-lg bg-muted p-4 mb-4">
                    {stage.icon}
                 </div>
                 <CardHeader className="p-0">
                    <CardTitle className="text-lg font-semibold">{stage.title}</CardTitle>
                 </CardHeader>
                 <CardContent className="p-4">
                    <CardDescription>{stage.description}</CardDescription>
                 </CardContent>
               </Card>
            </Link>
            {index < monitoringStages.length - 1 && (
              <ArrowRight className="h-8 w-8 text-muted-foreground my-4 md:my-0" />
            )}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
