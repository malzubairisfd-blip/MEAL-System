// src/app/meal-system/settings/page.tsx
"use client";

import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Trash2, ArrowLeft, Save, RotateCcw, Upload, Download, TestTube2, Search } from 'lucide-react';
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
import { computePairScore } from "@/workers/preprocess";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { Textarea } from "@/components/ui/textarea";
import { useTranslation } from "@/hooks/use-translation";
import { loadCachedResult } from "@/lib/cache";

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

type Settings = any;
type SavedProgressFile = {
  key: string;
  name: string;
  size: string;
  date: string;
};

type AutoRule = {
  id: string;
  code: string;
  params: any;
  [key: string]: any; 
};

const PROGRESS_KEY_PREFIX = "progress-";

export default function MealSettingsPage() {
    const { t } = useTranslation();
    const [settings, setSettings] = useState<Settings | null>(null);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [testA, setTestA] = useState({ womanName: "", husbandName: "", nationalId: "", phone: "" });
    const [testB, setTestB] = useState({ womanName: "", husbandName: "", nationalId: "", phone: "" });
    const [lastResult, setLastResult] = useState<any>(null);
    const { toast } = useToast();
    
    const [savedProgressFiles, setSavedProgressFiles] = useState<SavedProgressFile[]>([]);
    const [selectedFiles, setSelectedFiles] = useState<string[]>([]);
    
    const [rawCachedDataObject, setRawCachedDataObject] = useState<any>(null);
    const [filteredCachedDataString, setFilteredCachedDataString] = useState('');
    const [cacheSearchQuery, setCacheSearchQuery] = useState('');
    const [cacheLoading, setCacheLoading] = useState(false);
  
    const [autoRules, setAutoRules] = useState<AutoRule[]>([]);
    const [rulesLoading, setRulesLoading] = useState(true);
    const [selectedRules, setSelectedRules] = useState<string[]>([]);
  
    const fetchRules = useCallback(async () => {
      setRulesLoading(true);
      try {
        const res = await fetch('/api/rules', { cache: 'no-store' });
        if (res.ok) {
          const rules = await res.json();
          setAutoRules(Array.isArray(rules) ? rules : []);
        } else {
          setAutoRules([]);
        }
      } catch (error) {
        setAutoRules([]);
        console.error("Failed to fetch auto-rules:", error);
      } finally {
        setRulesLoading(false);
      }
    }, []);
  
    useEffect(() => {
      fetchRules();
    }, [fetchRules]);
  
    const handleDeleteRules = async () => {
      if (selectedRules.length === 0) return;
      try {
        const res = await fetch('/api/rules', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'delete', ids: selectedRules }),
        });
        if (!res.ok) throw new Error('Failed to delete rules');
        toast({ title: "Rules Deleted", description: `Successfully deleted ${selectedRules.length} rule(s).` });
        setSelectedRules([]);
        fetchRules(); // Refresh the list
      } catch (err: any) {
        toast({ title: "Error", description: err.message, variant: 'destructive' });
      }
    };
  
    const handleSelectRule = (id: string, checked: boolean | 'indeterminate') => {
      if (typeof checked !== 'boolean') return;
      setSelectedRules(prev => {
        if (checked) {
          return [...prev, id];
        } else {
          return prev.filter(ruleId => ruleId !== id);
        }
      });
    };
  
    const loadCache = async () => {
      setCacheLoading(true);
      setCacheSearchQuery('');
      const data = await loadCachedResult();
      setRawCachedDataObject(data);
      if (data) {
        setFilteredCachedDataString(JSON.stringify(data, null, 2));
      } else {
        setFilteredCachedDataString("No cached data found.");
      }
      setCacheLoading(false);
    };
    
    useEffect(() => {
      if (!rawCachedDataObject) return;
  
      if (!cacheSearchQuery.trim()) {
          setFilteredCachedDataString(JSON.stringify(rawCachedDataObject, null, 2));
          return;
      }
  
      try {
          const query = cacheSearchQuery.toLowerCase();
          
          const deepFilter = (obj: any): any => {
              if (!obj) return null;
  
              if (Array.isArray(obj)) {
                  const filteredArray = obj.map(deepFilter).filter(item => item !== null && (typeof item !== 'object' || Object.keys(item).length > 0));
                  return filteredArray.length > 0 ? filteredArray : null;
              }
  
              if (typeof obj === 'object') {
                  const isMatch = Object.values(obj).some(val => String(val).toLowerCase().includes(query));
                  if (isMatch) return obj;
  
                  const newObj: any = {};
                  for (const key in obj) {
                      const result = deepFilter(obj[key]);
                      if (result !== null) {
                          newObj[key] = result;
                      }
                  }
                  return Object.keys(newObj).length > 0 ? newObj : null;
              }
              
              return null;
          };
          
          const filtered = deepFilter({rows: rawCachedDataObject.rows, clusters: rawCachedDataObject.clusters});
          setFilteredCachedDataString(JSON.stringify(filtered, null, 2));
  
      } catch (e) {
          setFilteredCachedDataString("Error while filtering data.");
      }
  
    }, [cacheSearchQuery, rawCachedDataObject]);
  
    const loadSavedProgress = useCallback(() => {
      if (typeof window === 'undefined') return;
      const files: SavedProgressFile[] = [];
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(PROGRESS_KEY_PREFIX)) {
          try {
              const parts = key.substring(PROGRESS_KEY_PREFIX.length).split('-');
              const date = new Date(parseInt(parts[parts.length-1])).toLocaleDateString();
              const size = (parseInt(parts[parts.length-2]) / (1024*1024)).toFixed(2) + ' MB';
              const name = parts.slice(0, -2).join('-');
              files.push({ key, name, size, date });
          } catch {
               files.push({ key, name: key.substring(PROGRESS_KEY_PREFIX.length), size: 'N/A', date: 'N/A' });
          }
        }
      }
      setSavedProgressFiles(files);
    }, []);
  
    useEffect(() => {
      loadSavedProgress();
    }, [loadSavedProgress]);
  
  
    const handleDeleteSelected = () => {
      if (selectedFiles.length === 0) return;
      selectedFiles.forEach(key => localStorage.removeItem(key));
      toast({ title: `Deleted ${selectedFiles.length} saved progress file(s).`});
      setSelectedFiles([]);
      loadSavedProgress();
    };
  
    const handleDeleteAll = () => {
      if (confirm("Are you sure you want to delete all saved progress data? This cannot be undone.")) {
          savedProgressFiles.forEach(file => localStorage.removeItem(file.key));
          toast({ title: "All saved progress has been deleted." });
          setSelectedFiles([]);
          loadSavedProgress();
      }
    };
    
    const handleSelectFile = (key: string, isSelected: boolean | 'indeterminate') => {
        if (typeof isSelected !== 'boolean') return;
        if (isSelected) {
            setSelectedFiles(prev => [...prev, key]);
        } else {
            setSelectedFiles(prev => prev.filter(k => k !== key));
        }
    };
  
    const getDefaultSettings = () => ({
      thresholds: {
        minPair: 0.62,
        minInternal: 0.54,
        blockChunkSize: 3000
      },
      finalScoreWeights: {
        firstNameScore: 0.15,
        familyNameScore: 0.25,
        advancedNameScore: 0.12,
        tokenReorderScore: 0.10,
        husbandScore: 0.12,
        idScore: 0.08,
        phoneScore: 0.05,
        childrenScore: 0.04,
        locationScore: 0.04
      },
      rules: {
        enableNameRootEngine: true,
        enableTribalLineage: true,
        enableMaternalLineage: true,
        enablePolygamyRules: true
      }
    });
  
  
    useEffect(() => {
      fetch("/api/settings")
        .then((r) => r.json())
        .then((j) => {
          if (j.ok) {
            const defaults = getDefaultSettings();
            const mergedSettings = {
                ...defaults,
                ...j.settings,
                thresholds: { ...defaults.thresholds, ...j.settings.thresholds },
                finalScoreWeights: { ...defaults.finalScoreWeights, ...j.settings.finalScoreWeights },
                rules: { ...defaults.rules, ...j.settings.rules },
            };
            setSettings(mergedSettings);
          } else {
            setSettings(getDefaultSettings());
            toast({ title: t('settings.toasts.defaultsLoaded.title'), description: t('settings.toasts.defaultsLoaded.description'), variant: "default" });
          }
        })
        .catch(() => {
          setSettings(getDefaultSettings());
          toast({ title: t('settings.toasts.loadError.title'), description: t('settings.toasts.loadError.description'), variant: "destructive" });
        })
        .finally(() => setLoading(false));
    }, [toast, t]);
  
  
    function update(path: string, value: any) {
      if (!settings) return;
      const clone = JSON.parse(JSON.stringify(settings));
      const parts = path.split(".");
      let cur: any = clone;
      for (let i = 0; i < parts.length - 1; i++) {
        cur[parts[i]] = cur[parts[i]] ?? {};
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
      setSettings(clone);
    }
    
    function handleNumericChange(path: string, change: number) {
        if (!settings) return;
        const parts = path.split(".");
        let cur: any = settings;
        for (let i = 0; i < parts.length - 1; i++) {
          cur = cur[parts[i]];
        }
        const currentValue = cur[parts[parts.length - 1]] || 0;
        const newValue = Math.max(0, Math.min(1, parseFloat((currentValue + change).toFixed(2))));
        update(path, newValue);
    }
  
    function handleWeightChange(key: string, change: number) {
      handleNumericChange(`finalScoreWeights.${key}`, change);
    }
  
    async function save() {
      if (!settings) return;
      setSaving(true);
      try {
        const res = await fetch("/api/settings", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(settings)
        });
        const j = await res.json();
        if (!j.ok) throw new Error(j.error || t('settings.toasts.saveFailed'));
        toast({ title: t('settings.toasts.saveSuccess.title'), description: t('settings.toasts.saveSuccess.description') });
      } catch (err: any) {
        toast({ title: t('settings.toasts.saveFailed'), description: err.message, variant: "destructive" });
      } finally {
        setSaving(false);
      }
    }
  
    function resetDefaults() {
      if (confirm(t('settings.toasts.resetConfirm'))) {
        setSettings(getDefaultSettings());
        toast({ title: t('settings.toasts.resetSuccess.title'), description: t('settings.toasts.resetSuccess.description') });
      }
    }
  
    function exportJSON() {
      if (!settings) return;
      const blob = new Blob([JSON.stringify(settings, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "clustering-settings.json";
      a.click();
      URL.revokeObjectURL(url);
    }
  
    function importJSON(file: File | null) {
      if (!file) return;
      const r = new FileReader();
      r.onload = (e) => {
        try {
          const parsed = JSON.parse(String(e.target?.result));
          if (parsed.thresholds && parsed.rules && parsed.finalScoreWeights) {
            setSettings(parsed);
            toast({ title: t('settings.toasts.importSuccess.title'), description: t('settings.toasts.importSuccess.description') });
          } else {
            throw new Error("Invalid settings file structure.");
          }
        } catch (err: any) {
          toast({ title: t('settings.toasts.importFailed'), description: err.message, variant: "destructive" });
        }
      };
      r.readAsText(file);
    }
  
    function runTestScoring() {
      if (!settings) { toast({ title: "Settings not loaded", variant: "destructive" }); return; }
      const res = computePairScore(testA, testB, settings);
      setLastResult({ source: 'Client Test', ...res });
    }
    
    if (loading || !settings) {
      return (<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Loading settings...</span></div>);
    }

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

            <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <section className="lg:col-span-2 space-y-6">
                    <Card>
                        <CardHeader>
                            <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                                <div>
                                <CardTitle className="text-2xl">{t('settings.title')}</CardTitle>
                                <CardDescription>{t('settings.description')}</CardDescription>
                                </div>
                                <div className="flex items-center gap-2 flex-wrap">
                                <Button onClick={exportJSON} variant="outline"><Download className="mr-2" />{t('settings.buttons.export')}</Button>
                                <Button asChild variant="outline">
                                    <Label>
                                    <Upload className="mr-2" />
                                    {t('settings.buttons.import')}
                                    <input type="file" accept="application/json" className="hidden" onChange={(e) => importJSON(e.target.files?.[0] ?? null)} />
                                    </Label>
                                </Button>
                                <Button onClick={resetDefaults} variant="destructive"><RotateCcw className="mr-2" />{t('settings.buttons.reset')}</Button>
                                <Button onClick={save} disabled={saving}>
                                    {saving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                                    {saving ? t('settings.buttons.saving') : t('settings.buttons.save')}
                                </Button>
                                </div>
                            </div>
                        </CardHeader>
                    </Card>
                    <Card>
                        <CardHeader>
                            <CardTitle>{t('settings.thresholds.title')}</CardTitle>
                        </CardHeader>
                        <CardContent className="space-y-6">
                        <div>
                            <div className="grid grid-cols-12 items-center gap-4">
                            <Label htmlFor="minPair" className="col-span-12 sm:col-span-3 flex items-center">{t('settings.thresholds.minPair')}: <b className="mx-1">{settings.thresholds.minPair}</b></Label>
                            <Slider dir="ltr" id="minPair" min={0} max={1} step={0.01} value={[settings.thresholds.minPair]} onValueChange={(v)=>update("thresholds.minPair", v[0])} className="col-span-12 sm:col-span-6" />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 pl-1">{t('settings.thresholds.minPairDescription')}</p>
                        </div>
                        <div>
                            <div className="grid grid-cols-12 items-center gap-4">
                            <Label htmlFor="minInternal" className="col-span-12 sm:col-span-3 flex items-center">{t('settings.thresholds.minInternal')}: <b className="mx-1">{settings.thresholds.minInternal}</b></Label>
                            <Slider dir="ltr" id="minInternal" min={0} max={1} step={0.01} value={[settings.thresholds.minInternal]} onValueChange={(v)=>update("thresholds.minInternal", v[0])} className="col-span-12 sm:col-span-6" />
                            </div>
                            <p className="text-xs text-muted-foreground mt-1 pl-1">{t('settings.thresholds.minInternalDescription')}</p>
                        </div>
                        <div>
                            <Label htmlFor="blockChunkSize">{t('settings.thresholds.blockChunkSize')}</Label>
                            <Input id="blockChunkSize" type="number" value={settings.thresholds.blockChunkSize} onChange={(e)=>update("thresholds.blockChunkSize", parseInt(e.target.value||"0"))}/>
                            <p className="text-xs text-muted-foreground mt-1">{t('settings.thresholds.blockChunkSizeDescription')}</p>
                        </div>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>{t('settings.weights.title')}</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(settings.finalScoreWeights).map(([k, v]: [string, any]) => (
                            <div key={k} className="flex flex-col gap-2 p-3 border rounded-md">
                            <div className="flex justify-between items-center">
                                <Label htmlFor={`fsw-${k}`} className="capitalize flex items-center">{t(`settings.weights.${k}`)}</Label>
                            </div>
                            <div className="flex items-center gap-2">
                                <Input type="number" step="0.01" value={v || ''} onChange={(e)=>update(`finalScoreWeights.${k}`, parseFloat(e.target.value) || 0)} className="w-24 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"/>
                            </div>
                                <Slider dir="ltr" id={`fsw-${k}`} min={0} max={1} step={0.01} value={[v]} onValueChange={(val)=>update(`finalScoreWeights.${k}`, val[0])} />
                                <p className="text-xs text-muted-foreground mt-1">{t(`settings.weights.${k}Description`)}</p>
                            </div>
                        ))}
                        </CardContent>
                    </Card>
                    <Card>
                        <CardHeader><CardTitle>{t('settings.rules.title')}</CardTitle></CardHeader>
                        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {Object.entries(settings.rules).map(([k, v]: [string, any]) => (
                            <div key={k} className="flex items-start justify-between p-3 rounded-lg border">
                            <div className="flex flex-col gap-1 flex-1 ltr:mr-4 rtl:ml-4">
                                <Label htmlFor={`r-${k}`} className="capitalize flex items-center">{t(`settings.rules.${k}`)}</Label>
                                <p className="text-xs text-muted-foreground">{t(`settings.rules.${k}Description`)}</p>
                            </div>
                            <Switch id={`r-${k}`} checked={v} onCheckedChange={(val)=>update(`rules.${k}`, val)} />
                            </div>
                        ))}
                        </CardContent>
                    </Card>
                </section>
                <aside className="space-y-6">
                    <Card>
                        <CardHeader><CardTitle>{t('settings.testScoring.title')}</CardTitle></CardHeader>
                        <CardContent className="space-y-4">
                            <div className="space-y-2 p-3 border rounded-md">
                                <h4 className="font-medium">{t('settings.testScoring.recordA')}</h4>
                                <Label>{t('settings.fieldNames.womanName')}</Label>
                                <Input value={testA.womanName} onChange={e=>setTestA({...testA, womanName: e.target.value})}/>
                                <Label>{t('settings.fieldNames.husbandName')}</Label>
                                <Input value={testA.husbandName} onChange={e=>setTestA({...testA, husbandName: e.target.value})}/>
                                <Label>{t('settings.fieldNames.nationalId')}</Label>
                                <Input value={testA.nationalId} onChange={e=>setTestA({...testA, nationalId: e.target.value})}/>
                                <Label>{t('settings.fieldNames.phone')}</Label>
                                <Input value={testA.phone} onChange={e=>setTestA({...testA, phone: e.target.value})}/>
                            </div>
                            <div className="space-y-2 p-3 border rounded-md">
                                <h4 className="font-medium">{t('settings.testScoring.recordB')}</h4>
                                <Label>{t('settings.fieldNames.womanName')}</Label>
                                <Input value={testB.womanName} onChange={e=>setTestB({...testB, womanName: e.target.value})}/>
                                <Label>{t('settings.fieldNames.husbandName')}</Label>
                                <Input value={testB.husbandName} onChange={e=>setTestB({...testB, husbandName: e.target.value})}/>
                                <Label>{t('settings.fieldNames.nationalId')}</Label>
                                <Input value={testB.nationalId} onChange={e=>setTestB({...testB, nationalId: e.target.value})}/>
                                <Label>{t('settings.fieldNames.phone')}</Label>
                                <Input value={testB.phone} onChange={e=>setTestB({...testB, phone: e.target.value})}/>
                            </div>
                            <div className="flex gap-2">
                                <Button onClick={runTestScoring}><TestTube2 className="mr-2" />{t('settings.testScoring.runTest')}</Button>
                                <Button onClick={() => { setTestA({womanName:"",husbandName:"",nationalId:"",phone:""}); setTestB({womanName:"",husbandName:"",nationalId:"",phone:""}); setLastResult(null); }} variant="outline">{t('settings.testScoring.clear')}</Button>
                            </div>
                            {lastResult && (
                                <div className="mt-3 bg-muted p-3 rounded-lg">
                                <div className="font-bold text-lg">Source: {lastResult.source}</div>
                                {lastResult.score !== undefined && lastResult.score !== null ? (
                                    <>
                                    <div className="font-bold text-lg">{t('settings.testScoring.score')}: {lastResult.score.toFixed(4)}</div>
                                    <div className="text-sm mt-2">{t('settings.testScoring.compareToMinPair')}: <b>{settings.thresholds.minPair}</b></div>
                                    </>
                                ) : <div className="font-bold text-lg">No Match</div> }
                                <details className="mt-2 text-sm">
                                    <summary className="cursor-pointer font-medium">{t('settings.testScoring.viewBreakdown')}</summary>
                                    <pre className="text-xs mt-2 bg-background p-2 rounded">{JSON.stringify(lastResult.breakdown, null, 2)}</pre>
                                </details>
                                </div>
                            )}
                        </CardContent>
                    </Card>
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
                    <Card>
                        <CardHeader>
                        <div className="flex justify-between items-center">
                            <div>
                            <CardTitle>Learned Rules</CardTitle>
                            <CardDescription>
                                These rules were automatically generated by the system based on your feedback.
                            </CardDescription>
                            </div>
                            <div className="flex gap-2">
                                <Button variant="destructive" size="sm" onClick={handleDeleteRules} disabled={selectedRules.length === 0}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Selected ({selectedRules.length})
                                </Button>
                            </div>
                        </div>
                        </CardHeader>
                        <CardContent>
                        {rulesLoading ? (
                            <div className="flex items-center justify-center h-24">
                            <Loader2 className="h-6 w-6 animate-spin" />
                            </div>
                        ) : autoRules.length > 0 ? (
                            <ScrollArea className="h-64 border rounded-md">
                            <div className="p-4 space-y-2">
                                {autoRules.map((rule) => (
                                <div key={rule.id} className="flex items-start gap-3 p-2 rounded-md hover:bg-muted">
                                    <Checkbox
                                    id={`rule-${rule.id}`}
                                    checked={selectedRules.includes(rule.id)}
                                    onCheckedChange={(checked) => handleSelectRule(rule.id, checked)}
                                    className="mt-1"
                                    />
                                    <div className="flex-1">
                                    <label htmlFor={`rule-${rule.id}`} className="font-mono text-xs font-semibold">{rule.id}</label>
                                    <pre className="text-xs font-mono mt-1 p-2 bg-background rounded text-muted-foreground whitespace-pre-wrap">
                                        {rule.code}
                                    </pre>
                                    </div>
                                </div>
                                ))}
                            </div>
                            </ScrollArea>
                        ) : (
                            <p className="text-sm text-muted-foreground text-center py-8">No rules have been learned yet. Use the "Data Correction" feature to teach the system.</p>
                        )}
                        </CardContent>
                    </Card>
                </aside>
            </main>
        </div>
    );
}
