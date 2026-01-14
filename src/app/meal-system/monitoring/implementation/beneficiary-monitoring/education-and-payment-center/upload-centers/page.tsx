// src/app/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center/upload-centers/page.tsx
"use client";

import React, { useState } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, ArrowLeft, Save, Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';

export default function UploadCentersPage() {
    const [file, setFile] = useState<File | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const { toast } = useToast();

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
        }
    };

    const handleSave = async () => {
        if (!file) {
            toast({ title: "No file selected", description: "Please select a file to upload.", variant: "destructive" });
            return;
        }

        setIsSaving(true);
        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch('/api/education-payment-centers', {
                method: 'POST',
                body: formData,
            });

            const result = await response.json();
            if (!response.ok) {
                throw new Error(result.error || 'Failed to save centers file.');
            }

            toast({ title: "Success!", description: `Education and Payment Center data has been saved successfully. ${result.count} records processed.` });
            setFile(null);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">Upload Education & Payment Centers</h1>
                <Button variant="outline" asChild>
                    <Link href="/meal-system/monitoring/implementation/beneficiary-monitoring/education-and-payment-center">
                        <ArrowLeft className="mr-2 h-4 w-4" /> Back
                    </Link>
                </Button>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Upload Center File</CardTitle>
                    <CardDescription>Upload a file (XLSX, CSV, etc.) containing the Education and Payment Centers data. This will overwrite any existing 'epc.json'.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                     <label htmlFor="file-upload" className="flex-1">
                        <div className="flex items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-muted">
                            <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center">
                                <Upload className="w-10 h-10 mb-3 text-muted-foreground" />
                                {file ? (
                                  <p className="font-semibold text-primary">{file.name}</p>
                                ) : (
                                  <>
                                   <p className="mb-2 text-sm text-muted-foreground"><span className="font-semibold">Click to upload</span> or drag and drop</p>
                                   <p className="text-xs text-muted-foreground">XLS, XLSX, XLSM, XLSB, CSV, TXT</p>
                                  </>
                                )}
                            </div>
                            <input id="file-upload" type="file" className="hidden" onChange={handleFileChange} accept=".xlsx,.xls,.csv,.xlsm,.xlsb,.txt" />
                        </div>
                    </label>

                    <Button onClick={handleSave} disabled={!file || isSaving}>
                        {isSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                        Save to epc.json
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}
