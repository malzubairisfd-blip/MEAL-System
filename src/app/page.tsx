
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Upload,
  Microscope,
  ClipboardList,
  ArrowRight,
  MoveRight,
  BarChartHorizontal,
  FileDown,
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
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/use-translation";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const router = useRouter();
  const { t, isLoading: isTranslationLoading } = useTranslation();

  const mealFeatures = [
    { icon: <Briefcase className="h-8 w-8 text-indigo-500" />, title: "Project Page" },
    { icon: <Monitor className="h-8 w-8 text-blue-500" />, title: "Monitoring Page" },
    { icon: <ClipboardCheck className="h-8 w-8 text-green-500" />, title: "Evaluation Page" },
    { icon: <Database className="h-8 w-8 text-sky-500" />, title: "Data Collection Page" },
    { icon: <PieChart className="h-8 w-8 text-purple-500" />, title: "Analysis Page" },
    { icon: <FileText className="h-8 w-8 text-slate-500" />, title: "Reporting Page" },
    { icon: <ShieldAlert className="h-8 w-8 text-red-500" />, title: "Risk Page" },
    { icon: <MessageSquareWarning className="h-8 w-8 text-yellow-500" />, title: "Compliant Page" },
    { icon: <ListChecks className="h-8 w-8 text-cyan-500" />, title: "Logframe page" },
    { icon: <Target className="h-8 w-8 text-orange-500" />, title: "Indicator Page" },
  ];

  if (isTranslationLoading) {
    return (
      <div className="space-y-12">
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full mt-12" />
      </div>
    );
  }

  return (
    <div className="space-y-12">
      <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-primary/10 via-background to-background p-8 sm:p-12">
         <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3csvg xmlns=&quot;http://www.w3.org/2000/svg&quot; viewBox=&quot;0 0 32 32&quot; width=&quot;32&quot; height=&quot;32&quot; fill=&quot;none&quot; stroke=&quot;hsl(var(--primary))&quot; opacity=&quot;0.05&quot;%3e%3cpath d=&quot;M0 32 L 32 0 M-4 4 L 4 -4 M16 36 L 36 16&quot;/%3e%3c/svg%3e')]"></div>
         <div className="relative">
             <h1 className="text-4xl sm:text-5xl font-bold text-foreground">{t("dashboard.title")}</h1>
             <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
                 {t("dashboard.description")}
             </p>
             <Button size="lg" className="mt-8" onClick={() => router.push('/upload')}>
                 {t("dashboard.getStarted")} <MoveRight className="ml-2 h-5 w-5" />
             </Button>
         </div>
      </div>

       <div className="relative overflow-hidden rounded-lg bg-gradient-to-br from-secondary/20 via-background to-background p-8 sm:p-12">
         <div className="absolute inset-0 bg-[url('data:image/svg+xml,%3csvg xmlns=&quot;http://www.w3.org/2000/svg&quot; viewBox=&quot;0 0 32 32&quot; width=&quot;32&quot; height=&quot;32&quot; fill=&quot;none&quot; stroke=&quot;hsl(var(--secondary-foreground))&quot; opacity=&quot;0.05&quot;%3e%3cpath d=&quot;M0 32 L 32 0 M-4 4 L 4 -4 M16 36 L 36 16&quot;/%3e%3c/svg%3e')]"></div>
         <div className="relative">
             <h1 className="text-4xl sm:text-5xl font-bold text-foreground">MEAL System</h1>
             <p className="mt-4 max-w-2xl text-lg text-muted-foreground">
                 Design a well functional M&E system for good Project management and accountability
             </p>
             <Button size="lg" className="mt-8" onClick={() => { /* Redirect or handle click */ }}>
                 Let's Start <MoveRight className="ml-2 h-5 w-5" />
             </Button>
         </div>
      </div>
      
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
        {mealFeatures.map((feature, index) => (
            <Card key={index} className="flex flex-col items-center justify-center p-4 text-center transition-all duration-300 hover:shadow-lg hover:-translate-y-1">
                <div className="rounded-lg bg-muted p-4 mb-4">
                    {feature.icon}
                </div>
                <h3 className="font-semibold text-sm mb-2">{feature.title}</h3>
                <Button variant="secondary" size="sm" className="w-full mt-auto group">
                    Go <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
            </Card>
        ))}
      </div>

    </div>
  );
}
