"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Wrench } from "lucide-react";

export function UnderConstructionPage({ title }: { title: string }) {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">{title}</h1>
      <Card className="text-center py-20">
        <CardHeader>
          <div className="mx-auto bg-muted rounded-full p-4 w-fit">
            <Wrench className="h-12 w-12 text-muted-foreground" />
          </div>
          <CardTitle className="mt-4">Under Construction</CardTitle>
          <CardDescription>
            This section is under construction. It will contain tools and reports for finalizing deliverables and documenting lessons learned.
            <br />
            Check back soon for updates!
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
