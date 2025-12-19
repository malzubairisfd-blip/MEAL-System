"use client";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Upload, Microscope, ClipboardList, ArrowRight, MoveRight, BarChartHorizontal } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslation } from "@/hooks/use-translation";

export default function DashboardPage() {
  const router = useRouter();
  const { t } = useTranslation();

  const features = [
    {
      icon: <Upload className="h-10 w-10 text-blue-500" />,
      title: t("dashboard.features.upload.title"),
      description: t("dashboard.features.upload.description"),
      link: "/upload",
      buttonText: t("dashboard.features.upload.button"),
      borderColor: "border-blue-500/20",
    },
    {
      icon: <Microscope className="h-10 w-10 text-purple-500" />,
      title: t("dashboard.features.review.title"),
      description: t("dashboard.features.review.description"),
      link: "/review",
      buttonText: t("dashboard.features.review.button"),
      borderColor: "border-purple-500/20",
    },
    {
      icon: <ClipboardList className="h-10 w-10 text-green-500" />,
      title: t("dashboard.features.audit.title"),
      description: t("dashboard.features.audit.description"),
      link: "/audit",
      buttonText: t("dashboard.features.audit.button"),
      borderColor: "border-green-500/20",
    },
     {
      icon: <BarChartHorizontal className="h-10 w-10 text-yellow-500" />,
      title: t("sidebar.report"),
      description: t("dashboard.features.report.description"),
      link: "/report",
      buttonText: t("dashboard.features.report.button"),
      borderColor: "border-yellow-500/20",
    },
  ];

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

      <div>
        <h2 className="text-2xl font-semibold mb-6">{t("dashboard.howItWorks")}</h2>
        <div className="grid md:grid-cols-1 lg:grid-cols-4 gap-6">
          {features.map((feature, index) => (
            <Card key={index} className={`flex flex-col transition-all duration-300 hover:shadow-xl hover:-translate-y-1 ${feature.borderColor} border-2`}>
              <CardHeader className="flex-col items-start gap-4">
                <div className="rounded-lg bg-muted p-3">
                    {feature.icon}
                </div>
                <CardTitle>{feature.title}</CardTitle>
              </CardHeader>
              <CardContent className="flex-1">
                <p className="text-muted-foreground">{feature.description}</p>
              </CardContent>
              <div className="p-6 pt-0">
                 <Button onClick={() => router.push(feature.link)} variant="secondary" className="w-full group">
                  {feature.buttonText}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </div>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
