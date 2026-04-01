// src/app/meal-system/monitoring/implementation/process/cash-assistance-disbursement/page.tsx
"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, ArrowRight, Users, UserCog } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

export default function CashAssistanceDisbursementPage() {
  const { t } = useTranslation();
  const features = [
    {
      labelKey: "hubs.cashDisbursement.beneficiaries",
      descriptionKey: "hubs.cashDisbursement.beneficiariesDesc",
      href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/beneficiaries",
      icon: <Users className="h-8 w-8 text-blue-500" />,
    },
    {
      labelKey: "hubs.cashDisbursement.educators",
      descriptionKey: "hubs.cashDisbursement.educatorsDesc",
      href: "/meal-system/monitoring/implementation/process/cash-assistance-disbursement/educators",
      icon: <UserCog className="h-8 w-8 text-green-500" />,
    },
  ];

  return (
    <div className="space-y-8">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">{t('hubs.cashDisbursement.title')}</h1>
        <Button variant="outline" asChild>
          <Link href="/meal-system/monitoring/implementation/process">
            <ArrowLeft className="mr-2 h-4 w-4" />
            {t('hubs.cashDisbursement.back')}
          </Link>
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {features.map((feature) => (
          <Card key={feature.labelKey} className="flex flex-col text-center items-center justify-center p-6 transition-all duration-300 hover:shadow-xl hover:-translate-y-2">
            <div className="p-4 bg-muted rounded-full mb-4">
              {feature.icon}
            </div>
            <CardHeader className="p-0">
              <CardTitle className="text-lg">{t(feature.labelKey)}</CardTitle>
              <CardDescription className="pt-2">{t(feature.descriptionKey)}</CardDescription>
            </CardHeader>
            <CardContent className="p-4 mt-auto">
              <Button variant="secondary" size="sm" className="group" asChild>
                <Link href={feature.href}>
                  {t('hubs.buttons.proceed')} <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
