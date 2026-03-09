// src/app/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening/page.tsx
"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, ScanSearch, Database, FileDown, FileEdit } from "lucide-react";

export default function BeneficiaryScreeningPage() {
  const features = [
    {
      title: "Preparing Beneficiaries CMAM List",
      description: "Prepare and manage the list of beneficiaries for CMAM screening.",
      href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening/preparing",
      icon: <ScanSearch className="h-8 w-8 text-blue-500" />,
    },
    {
      title: "Beneficiaries CMAM Database",
      description: "View and manage the CMAM screening database.",
      href: "/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/screening/database",
      icon: <Database className="h-8 w-8 text-green-500" />,
    },
    {
      title: "Exporting Beneficiaries CMAM Statements",
      description: "Export statements and reports related to CMAM screening.",
      href: "#", // Placeholder
      icon: <FileDown className="h-8 w-8 text-purple-500" />,
    },
    {
      title: "Beneficiaries CMAM Screening Results Data Entry",
      description: "Enter the results from the screening process.",
      href: "#", // Placeholder
      icon: <FileEdit className="h-8 w-8 text-orange-500" />,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Screening Malnutrition Cases</h1>
        <Button variant="outline" asChild>
          <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Beneficiaries CMAM
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
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
                  Proceed <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
