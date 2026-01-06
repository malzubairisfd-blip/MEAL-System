
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
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/use-translation";
import { Skeleton } from "@/components/ui/skeleton";

export default function DashboardPage() {
  const router = useRouter();
  const { t, isLoading: isTranslationLoading } = useTranslation();

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
             <Button size="lg" className="mt-8" onClick={() => router.push('/meal-system')}>
                 Let's Start <MoveRight className="ml-2 h-5 w-5" />
             </Button>
         </div>
      </div>

    </div>
  );
}
