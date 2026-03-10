// src/app/meal-system/monitoring/implementation/process/CMAM-cases/page.tsx
"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Users, HeartPulse, Stethoscope } from "lucide-react";

export default function CMAMCasesPage() {
  const features = [
    {
      title: "Beneficiaries CMAM",
      description: "Manage CMAM data for beneficiaries.",
      href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries",
      icon: <Users className="h-8 w-8 text-blue-500" />,
    },
    {
      title: "Children CMAM",
      description: "Manage CMAM data specifically for children.",
      href: "/meal-system/monitoring/implementation/process/CMAM-cases/children",
      icon: <HeartPulse className="h-8 w-8 text-green-500" />,
    },
    {
      title: "Health Worker Data",
      description: "Data related to health workers involved in CMAM.",
      href: "/meal-system/monitoring/implementation/process/CMAM-cases/health-worker-data",
      icon: <Stethoscope className="h-8 w-8 text-purple-500" />,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">CMAM Cases Management</h1>
        <Button variant="outline" asChild>
          <Link href="/meal-system/monitoring/implementation/process">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Process Monitoring
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {features.map((feature) => (
          <Card key={feature.title} className="flex flex-col text-center items-center justify-center p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-2">
            <div className="p-4 bg-muted rounded-full mb-4">
              {feature.icon}
            </div>
            <CardHeader className="p-0">
              <CardTitle className="text-lg">{feature.title}</CardTitle>
              <CardDescription className="pt-2">{feature.description}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 mt-auto">
              <Button variant="secondary" size="sm" className="group" asChild>
                <Link href={feature.href}>
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
