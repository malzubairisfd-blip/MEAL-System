"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, FileText, UserX, UserCheck } from "lucide-react";

export default function ContractsPage() {
  const features = [
    {
      title: "Exporting Community Educators Contracts",
      description: "Generate and download contract documents.",
      href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/contracts/export",
      icon: <FileText className="h-8 w-8 text-blue-500" />,
    },
    {
      title: "Termination of Community Educators Contracts",
      description: "Process the termination of educator contracts.",
      href: "#",
      icon: <UserX className="h-8 w-8 text-red-500" />,
    },
    {
      title: "Renewal Community Educators Contracts",
      description: "Manage the renewal of educator contracts.",
      href: "#",
      icon: <UserCheck className="h-8 w-8 text-green-500" />,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Community Educators Contracts</h1>
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
