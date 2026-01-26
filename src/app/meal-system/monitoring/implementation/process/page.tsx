"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, UserCheck, HeartPulse, CircleDollarSign, Filter } from "lucide-react";

export default function ProcessMonitoringPage() {
  const activities = [
    {
      title: "Enrollment Management",
      description: "Manage and track beneficiary enrollment processes.",
      href: "/meal-system/monitoring/implementation/enrollment",
      icon: <UserCheck className="h-8 w-8 text-blue-500" />,
    },
    {
      title: "Monthly Health Sessions",
      description: "Monitor attendance and content of monthly health education sessions.",
      href: "#",
      icon: <HeartPulse className="h-8 w-8 text-green-500" />,
    },
    {
      title: "Monthly Cash Payment",
      description: "Track and verify the disbursement of monthly cash payments.",
      href: "#",
      icon: <CircleDollarSign className="h-8 w-8 text-purple-500" />,
    },
    {
      title: "Filtering of CMAM Cases",
      description: "Analyze and filter Community Management of Acute Malnutrition cases.",
      href: "#",
      icon: <Filter className="h-8 w-8 text-orange-500" />,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Process (Activity) Monitoring</h1>
        <Button variant="outline" asChild>
          <Link href="/meal-system/monitoring/implementation">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Implementation
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {activities.map((activity) => (
          <Card key={activity.title} className="flex flex-col text-center items-center justify-center p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-2">
            <div className="p-4 bg-muted rounded-full mb-4">
              {activity.icon}
            </div>
            <CardHeader className="p-0">
              <CardTitle className="text-lg">{activity.title}</CardTitle>
              <CardDescription className="pt-2">{activity.description}</CardDescription>
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
