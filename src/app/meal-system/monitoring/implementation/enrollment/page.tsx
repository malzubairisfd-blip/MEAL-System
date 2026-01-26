"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, FileText, Fingerprint, ClipboardCheck } from "lucide-react";

export default function EnrollmentManagementPage() {
  const features = [
    {
      title: "Creating Enrollment Sheets",
      description: "Generate enrollment sheets for beneficiaries.",
      href: "/meal-system/monitoring/implementation/enrollment/create-sheets",
      icon: <FileText className="h-8 w-8 text-blue-500" />,
    },
    {
      title: "Creating Beneficiaries ID Cards",
      description: "Generate ID cards for registered beneficiaries.",
      href: "/meal-system/monitoring/implementation/enrollment/create-id-cards",
      icon: <Fingerprint className="h-8 w-8 text-green-500" />,
    },
    {
      title: "Enrollment Management Review",
      description: "Review and manage enrollment data.",
      href: "#",
      icon: <ClipboardCheck className="h-8 w-8 text-purple-500" />,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Enrollment Management</h1>
        <Button variant="outline" asChild>
          <Link href="/meal-system/monitoring/implementation/process">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Process Monitoring
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
