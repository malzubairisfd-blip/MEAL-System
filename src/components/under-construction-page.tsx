"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wrench } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

export function UnderConstructionPage({ title }: { title: string }) {
  const { t } = useTranslation();
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">{title}</h1>
      <Card className="text-center py-20">
        <CardHeader>
          <div className="mx-auto bg-muted rounded-full p-4 w-fit">
            <Wrench className="h-12 w-12 text-muted-foreground" />
          </div>
          <CardTitle className="mt-4">{t('underConstruction.title')}</CardTitle>
          <CardDescription>
            {t('underConstruction.description')}
            <br />
            {t('underConstruction.checkBack')}
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
