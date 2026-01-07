
"use client";

import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  ArrowRight,
  Briefcase,
  Monitor,
  ClipboardCheck,
  Database,
  PieChart,
  FileText,
  ShieldAlert,
  MessageSquareWarning,
  ListChecks,
  Target,
  ArrowLeft,
} from "lucide-react";
import Link from "next/link";

export default function MealSystemPage() {
  const mealFeatures = [
    { href: "/project", icon: <Briefcase className="h-8 w-8 text-indigo-500" />, title: "Project Page" },
    { href: "#", icon: <Monitor className="h-8 w-8 text-blue-500" />, title: "Monitoring Page" },
    { href: "#", icon: <ClipboardCheck className="h-8 w-8 text-green-500" />, title: "Evaluation Page" },
    { href: "#", icon: <Database className="h-8 w-8 text-sky-500" />, title: "Data Collection Page" },
    { href: "#", icon: <PieChart className="h-8 w-8 text-purple-500" />, title: "Analysis Page" },
    { href: "#", icon: <FileText className="h-8 w-8 text-slate-500" />, title: "Reporting Page" },
    { href: "#", icon: <ShieldAlert className="h-8 w-8 text-red-500" />, title: "Risk Page" },
    { href: "#", icon: <MessageSquareWarning className="h-8 w-8 text-yellow-500" />, title: "Compliant Page" },
    { href: "/logframe", icon: <ListChecks className="h-8 w-8 text-cyan-500" />, title: "Logical Framework page" },
    { href: "#", icon: <Target className="h-8 w-8 text-orange-500" />, title: "Indicator Page" },
  ];

  return (
    <div className="space-y-8">
       <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">MEAL System Features</h1>
        <Button variant="outline" asChild>
            <Link href="/">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Dashboard
            </Link>
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {mealFeatures.map((feature, index) => (
          <Card key={index} className="flex flex-col items-center justify-center p-4 text-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
            <div className="rounded-lg bg-muted p-4 mb-4">
              {feature.icon}
            </div>
            <h3 className="font-semibold text-sm mb-2">{feature.title}</h3>
            <Button variant="secondary" size="sm" className="w-full mt-auto group" asChild>
                <Link href={feature.href}>
                    Go <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
            </Button>
          </Card>
        ))}
      </div>
    </div>
  );
}
