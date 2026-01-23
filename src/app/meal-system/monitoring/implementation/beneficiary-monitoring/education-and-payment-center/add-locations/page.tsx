// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/add-locations/page.tsx
"use client";

import React from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Database } from 'lucide-react';

export default function AddLocationsPage() {
    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Location Data</h1>
                <Button variant="outline" asChild>
                    <Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Location Master Data</CardTitle>
                    <CardDescription>
                        The location data (`loc.json`) is now automatically managed and seeded into the `locations.db` database.
                        Manual uploads are no longer necessary.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center text-center py-12">
                     <Database className="h-16 w-16 text-green-500 mb-4" />
                     <p className="text-lg font-medium">Location Database is Active</p>
                     <p className="text-muted-foreground">The system will use the `locations.db` file as the source of truth.</p>
                </CardContent>
            </Card>
        </div>
    );
}
