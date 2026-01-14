// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/selection/page.tsx
"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Upload, Microscope, Database, Layers } from "lucide-react";

export default function CommunityEducatorsSelectionPage() {
  const features = [
    { title: "Upload Page", href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/selection/upload", icon: <Upload className="h-8 w-8 text-blue-500" /> },
    { title: "Double Benefits Analysis", href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/selection/double-benefits", icon: <Layers className="h-8 w-8 text-purple-500" /> },
    { title: "ED Review Page", href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/selection/review", icon: <Microscope className="h-8 w-8 text-orange-500" /> },
    { title: "ED Database", href: "/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators/selection/database", icon: <Database className="h-8 w-8 text-green-500" /> },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Community Educators Selection</h1>
        <Button variant="outline" asChild>
          <Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/community-educators">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Community Educators
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
              <CardTitle className="text-base">{feature.title}</CardTitle>
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
