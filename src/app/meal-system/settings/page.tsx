// src/app/meal-system/settings/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, ArrowLeft } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import Link from 'next/link';

interface DataItem {
  id: string;
  name: string;
  [key: string]: any;
}

const DataManagementPanel = ({ title, description, idKey, nameKey, apiEndpoint }: { title: string, description: string, idKey: string, nameKey: string, apiEndpoint: string }) => {
    const { toast } = useToast();
    const [items, setItems] = useState<DataItem[]>([]);
    const [selectedItems, setSelectedItems] = useState<Set<string>>(new Set());
    const [loading, setLoading] = useState(true);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isAlertOpen, setIsAlertOpen] = useState(false);

    const fetchData = useCallback(async () => {
        setLoading(true);
        try {
            const res = await fetch(apiEndpoint);
            if (!res.ok) throw new Error(`Failed to fetch ${title}`);
            const data = await res.json();
            setItems(Array.isArray(data) ? data.map((item: any) => ({
                id: item[idKey],
                name: item[nameKey] || item[idKey], // fallback to id if nameKey is not present
                ...item
            })) : []);
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setLoading(false);
        }
    }, [apiEndpoint, idKey, nameKey, title, toast]);

    useEffect(() => {
        fetchData();
    }, [fetchData]);

    const handleSelect = (id: string, checked: boolean | 'indeterminate') => {
        if (typeof checked !== 'boolean') return;
        setSelectedItems(prev => {
            const newSet = new Set(prev);
            if (checked) {
                newSet.add(id);
            } else {
                newSet.delete(id);
            }
            return newSet;
        });
    };

    const handleSelectAll = (checked: boolean | 'indeterminate') => {
        if (typeof checked !== 'boolean') return;
        if (checked) {
            setSelectedItems(new Set(items.map(item => item.id)));
        } else {
            setSelectedItems(new Set());
        }
    };

    const handleDelete = async () => {
        setIsDeleting(true);
        try {
            const res = await fetch(apiEndpoint, {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ [idKey + 's']: Array.from(selectedItems) }),
            });
            const result = await res.json();
            if (!res.ok) throw new Error(result.error || `Failed to delete ${title}`);
            
            toast({ title: "Success", description: result.message });
            setSelectedItems(new Set());
            fetchData(); // Refresh data
        } catch (error: any) {
            toast({ title: "Error", description: error.message, variant: "destructive" });
        } finally {
            setIsDeleting(false);
            setIsAlertOpen(false);
        }
    };

    const isAllSelected = selectedItems.size > 0 && selectedItems.size === items.length;
    const isSomeSelected = selectedItems.size > 0 && selectedItems.size < items.length;

    return (
        <Card>
            <CardHeader>
                <CardTitle>{title}</CardTitle>
                <CardDescription>{description}</CardDescription>
            </CardHeader>
            <CardContent>
                <div className="flex justify-end mb-4">
                    <Button
                        variant="destructive"
                        disabled={selectedItems.size === 0 || isDeleting}
                        onClick={() => setIsAlertOpen(true)}
                    >
                        {isDeleting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Trash2 className="mr-2 h-4 w-4" />}
                        Delete Selected ({selectedItems.size})
                    </Button>
                </div>
                <ScrollArea className="h-72 border rounded-md">
                    {loading ? (
                        <div className="flex items-center justify-center h-full">
                            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                        </div>
                    ) : items.length === 0 ? (
                        <div className="flex items-center justify-center h-full text-muted-foreground">
                            No {title} found.
                        </div>
                    ) : (
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">
                                        <Checkbox
                                            checked={isAllSelected || (isSomeSelected ? "indeterminate" : false)}
                                            onCheckedChange={handleSelectAll}
                                        />
                                    </TableHead>
                                    <TableHead>ID</TableHead>
                                    <TableHead>Name / Identifier</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {items.map(item => (
                                    <TableRow key={item.id}>
                                        <TableCell>
                                            <Checkbox
                                                checked={selectedItems.has(item.id)}
                                                onCheckedChange={(checked) => handleSelect(item.id, checked)}
                                            />
                                        </TableCell>
                                        <TableCell>{item.id}</TableCell>
                                        <TableCell>{item.name}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    )}
                </ScrollArea>
            </CardContent>
            <AlertDialog open={isAlertOpen} onOpenChange={setIsAlertOpen}>
                <AlertDialogContent>
                    <AlertDialogHeader>
                        <AlertDialogTitle>Are you absolutely sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                            This action cannot be undone. This will permanently delete the selected {selectedItems.size} {title.toLowerCase()}.
                        </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction onClick={handleDelete} disabled={isDeleting}>
                            {isDeleting ? 'Deleting...' : 'Continue'}
                        </AlertDialogAction>
                    </AlertDialogFooter>
                </AlertDialogContent>
            </AlertDialog>
        </Card>
    );
};

export default function MealSettingsPage() {
    return (
        <div className="space-y-8">
            <div className="flex justify-between items-center">
                <h1 className="text-3xl font-bold">MEAL System Settings</h1>
                <Button variant="outline" asChild>
                    <Link href="/meal-system">
                        <ArrowLeft className="mr-2 h-4 w-4" />
                        Back to MEAL System
                    </Link>
                </Button>
            </div>

            <DataManagementPanel
                title="Projects"
                description="Manage all created projects. Deleting a project will also delete its associated logframe and project plan."
                idKey="projectId"
                nameKey="projectName"
                apiEndpoint="/api/projects"
            />
            <DataManagementPanel
                title="Project Plans"
                description="Manage project plans (Gantt charts). Each plan is linked to a project."
                idKey="projectId"
                nameKey="projectId"
                apiEndpoint="/api/project-plan"
            />
            <DataManagementPanel
                title="Logical Frameworks"
                description="Manage logical frameworks. Each logframe is linked to a project."
                idKey="projectId"
                nameKey="projectId"
                apiEndpoint="/api/logframe"
            />
            <DataManagementPanel
                title="Learned Rules"
                description="Manage rules generated by the Data Correction feature."
                idKey="id"
                nameKey="id"
                apiEndpoint="/api/rules"
            />

        </div>
    );
}
