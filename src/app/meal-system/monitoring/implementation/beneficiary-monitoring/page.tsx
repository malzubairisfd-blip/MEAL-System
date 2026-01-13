// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/page.tsx
"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, User, Users, UserCheck } from "lucide-react";

export default function BeneficiaryMonitoringPage() {
  const features = [
    { title: "Beneficiaries", href: "/meal-system/monitoring/implementation/beneficiary-monitoring/Beneficiaries", icon: <Users className="h-8 w-8 text-blue-500" /> },
    { title: "Community Educators", href: "#", icon: <UserCheck className="h-8 w-8 text-green-500" /> },
    { title: "Field Coordinator", href: "#", icon: <User className="h-8 w-8 text-orange-500" /> },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Beneficiary Monitoring</h1>
        <Button variant="outline" asChild>
          <Link href="/meal-system/monitoring/implementation">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Implementation
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
              <CardTitle className="text-base">{feature.title}</CardTitle>
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
