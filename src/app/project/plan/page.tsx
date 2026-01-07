// src/app/project/plan/page.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Construction } from 'lucide-react';

export default function ProjectPlanPage() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Project Plan</h1>
                <Button variant="outline" asChild>
                    <Link href="/project">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back to Project Hub
                    </Link>
                </Button>
            </div>

            <Card className="text-center py-20">
                <CardHeader>
                    <div className="mx-auto bg-yellow-100 p-4 rounded-full w-fit">
                        <Construction className="h-12 w-12 text-yellow-500" />
                    </div>
                    <CardTitle className="mt-4 text-2xl">Under Construction</CardTitle>
                    <CardDescription>
                        This page is currently under development. Please check back later!
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <Button asChild>
                        <Link href="/project">Go Back to Project Hub</Link>
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
