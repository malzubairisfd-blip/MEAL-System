// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview/page.tsx
"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, FileText, BarChart2 } from "lucide-react";

export default function CommunityEducatorsInterviewPage() {
  const features = [
    {
      title: "Exporting Interview Statements",
      description: "Generate and download documents for interview sessions.",
      href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview/export-statements",
      icon: <FileText className="h-8 w-8 text-blue-500" />,
    },
    {
      title: "Analyzing Interview Results",
      description: "Analyze scores and results from the interviews.",
      href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview/interview-results",
      icon: <BarChart2 className="h-8 w-8 text-teal-500" />,
    },
    {
      title: "Export Interview Sheets (Exact)",
      description: "Generate an exact replica of the interview scoresheet as a PDF.",
      href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/interview/export-exact-pdf",
      icon: <FileText className="h-8 w-8 text-green-500" />,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Community Educators Interview</h1>
        <Button variant="outline" asChild>
          <Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Community Educators
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
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
