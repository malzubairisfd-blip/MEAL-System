// src/app/monitoring/closure/page.tsx
"use client";

import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Flag } from "lucide-react";

export default function ClosurePage() {
  return (
    <div className="space-y-8">
       <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold">Project Closure</h1>
        <Button variant="outline" asChild>
            <Link href="/meal-system/monitoring">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to M&E Lifecycle
            </Link>
        </Button>
      </div>

      <Card className="text-center py-20">
        <CardHeader>
            <div className="mx-auto bg-muted rounded-full p-4 w-fit">
                <Flag className="h-12 w-12 text-muted-foreground" />
            </div>
            <CardTitle className="mt-4">Closure Phase</CardTitle>
            <CardDescription>This section is under construction. It will contain tools and reports for finalizing deliverables and documenting lessons learned.</CardDescription>
        </CardHeader>
        <CardContent>
            <p className="text-muted-foreground">Check back soon for updates!</p>
        </CardContent>
      </Card>
    </div>
  );
}
