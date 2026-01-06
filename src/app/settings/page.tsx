// src/app/settings/page.tsx
"use client";

import React, { useEffect, useState, useCallback } from "react";
import { computePairScore, applyAutoRule, preprocessRow, PreprocessedRow } from "@/workers/cluster.worker";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Save, RotateCcw, Upload, Download, Loader2, Plus, Minus, ArrowLeft, Trash2, Search, TestTube2 } from "lucide-react";
import Link from "next/link";
import { useTranslation } from "@/hooks/use-translation";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { loadCachedResult } from "@/lib/cache";


type Settings = any;
const PROGRESS_KEY_PREFIX = "progress-";

type SavedProgressFile = {
  key: string;
  name: string;
  size: string;
  date: string;
};

type AutoRule = {
  id: string;
  pattern: any;
  [key: string]: any; // Allow other properties
};


export default function SettingsPage() {
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
      const res = await fetch('/rules/auto-rules.json', { cache: 'no-store' });
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
             // Fallback for old key format
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
          // Merge fetched settings with defaults to ensure all keys exist
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
          // If missing, load defaults
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
        // Simple validation
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
    setLastResult({ source: 'Full Engine', ...res });
  }

  function testSelectedRule() {
    if (!settings || selectedRules.length !== 1) {
      toast({ title: "Please select exactly one rule to test.", variant: "destructive" });
      return;
    }
    const rule = autoRules.find(r => r.id === selectedRules[0]);
    if (!rule) {
      toast({ title: "Selected rule not found.", variant: "destructive" });
      return;
    }
    
    // We need to preprocess the raw test records before applying the rule
    const processedA = preprocessRow(testA);
    const processedB = preprocessRow(testB);

    const result = applyAutoRule(rule, processedA, processedB, settings);
    
    setLastResult({ 
      source: `Auto-Rule: ${rule.id}`,
      score: result?.score,
      reasons: result?.reasons,
      breakdown: result ? 'Rule Matched' : 'Rule Did Not Match'
    });
  }
  
  if (loading || !settings) {
    return (<div className="flex items-center justify-center h-64"><Loader2 className="h-8 w-8 animate-spin" /> <span className="ml-2">Loading settings...</span></div>);
  }

  return (
    <div className="space-y-6">
      <Card>
          <CardHeader>
              <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
                <div>
                  <CardTitle className="text-2xl">{t('settings.title')}</CardTitle>
                  <CardDescription>{t('settings.description')}</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                   <Button variant="outline" asChild>
                    <Link href="/upload">
                        <ArrowLeft className="mr-2" />
                        {t('settings.buttons.goToUpload')}
                    </Link>
                  </Button>
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

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>{t('settings.thresholds.title')}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="grid grid-cols-12 items-center gap-4">
                  <Label htmlFor="minPair" className="col-span-12 sm:col-span-3 flex items-center">{t('settings.thresholds.minPair')}: <b className="mx-1">{settings.thresholds.minPair}</b></Label>
                  <Slider dir="ltr" id="minPair" min={0} max={1} step={0.01} value={[settings.thresholds.minPair]} onValueChange={(v)=>update("thresholds.minPair", v[0])} className="col-span-12 sm:col-span-6" />
                  <div className="col-span-12 sm:col-span-3 flex items-center gap-1 justify-end">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleNumericChange('thresholds.minPair', -0.01)}><Minus className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleNumericChange('thresholds.minPair', 0.01)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
                 <p className="text-xs text-muted-foreground mt-1 pl-1">{t('settings.thresholds.minPairDescription')}</p>
              </div>
              <div>
                <div className="grid grid-cols-12 items-center gap-4">
                  <Label htmlFor="minInternal" className="col-span-12 sm:col-span-3 flex items-center">{t('settings.thresholds.minInternal')}: <b className="mx-1">{settings.thresholds.minInternal}</b></Label>
                  <Slider dir="ltr" id="minInternal" min={0} max={1} step={0.01} value={[settings.thresholds.minInternal]} onValueChange={(v)=>update("thresholds.minInternal", v[0])} className="col-span-12 sm:col-span-6" />
                  <div className="col-span-12 sm:col-span-3 flex items-center gap-1 justify-end">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleNumericChange('thresholds.minInternal', -0.01)}><Minus className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleNumericChange('thresholds.minInternal', 0.01)}><Plus className="h-4 w-4" /></Button>
                  </div>
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
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleWeightChange(k, -0.01)}><Minus className="h-4 w-4" /></Button>
                        <Input type="number" step="0.01" value={v || ''} onChange={(e)=>update(`finalScoreWeights.${k}`, parseFloat(e.target.value) || 0)} className="w-24 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"/>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleWeightChange(k, 0.01)}><Plus className="h-4 w-4" /></Button>
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
                    <Button variant="secondary" size="sm" onClick={testSelectedRule} disabled={selectedRules.length !== 1}>
                        <TestTube2 className="mr-2 h-4 w-4" />
                        Test Selected Rule
                    </Button>
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
                          <pre className="text-xs font-mono mt-1 p-2 bg-background rounded text-muted-foreground">
                            {JSON.stringify(rule.params || rule.pattern, null, 2)}
                          </pre>
                        </div>
                      </div>
                    ))}
                  </div>
                </ScrollArea>
              ) : (
                <p className="text-sm text-muted-foreground text-center py-8">No rules have been learned yet. Use the "Data Correction" feature on the Upload page to teach the system.</p>
              )}
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
                <Button onClick={runTestScoring}>{t('settings.testScoring.runTest')}</Button>
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
          
           <Card>
            <CardHeader>
                <CardTitle>Manage Saved Progress</CardTitle>
                <CardDescription>Manage or delete saved clustering progress files to free up space or remove old data.</CardDescription>
            </CardHeader>
            <CardContent>
                {savedProgressFiles.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">No saved progress found.</p>
                ) : (
                    <>
                        <div className="flex justify-end gap-2 mb-4">
                             <Button variant="outline" size="sm" onClick={handleDeleteAll}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete All
                            </Button>
                            <Button variant="destructive" size="sm" onClick={handleDeleteSelected} disabled={selectedFiles.length === 0}>
                                <Trash2 className="mr-2 h-4 w-4" />
                                Delete Selected ({selectedFiles.length})
                            </Button>
                        </div>
                        <ScrollArea className="h-48 rounded-md border">
                            <div className="p-4 space-y-2">
                                {savedProgressFiles.map((file) => (
                                    <div key={file.key} className="flex items-center justify-between p-2 rounded-md hover:bg-muted">
                                        <div className="flex items-center gap-3">
                                            <Checkbox
                                                id={file.key}
                                                checked={selectedFiles.includes(file.key)}
                                                onCheckedChange={(checked) => handleSelectFile(file.key, checked)}
                                            />
                                            <div className="grid gap-0.5">
                                                <label htmlFor={file.key} className="text-sm font-medium leading-none truncate max-w-[200px]" title={file.name}>
                                                    {file.name}
                                                </label>
                                                <p className="text-xs text-muted-foreground">
                                                    {file.size} - {file.date}
                                                </p>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </ScrollArea>
                    </>
                )}
            </CardContent>
           </Card>

            <Card>
                <CardHeader>
                    <CardTitle>{t('settings.cache.title')}</CardTitle>
                    <CardDescription>{t('settings.cache.description')}</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="flex flex-col gap-2">
                        <Button onClick={loadCache} disabled={cacheLoading}>
                            {cacheLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                            {t('settings.cache.button')}
                        </Button>
                        {rawCachedDataObject && (
                            <div className="relative">
                                <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                                <Input
                                    type="text"
                                    placeholder="Search cached data..."
                                    className="pl-10"
                                    value={cacheSearchQuery}
                                    onChange={(e) => setCacheSearchQuery(e.target.value)}
                                />
                            </div>
                        )}
                    </div>
                    {rawCachedDataObject && (
                        <Textarea
                            readOnly
                            className="mt-4 h-64 font-mono text-xs"
                            value={filteredCachedDataString}
                            placeholder={t('settings.cache.loading')}
                        />
                    )}
                </CardContent>
            </Card>

        </aside>
      </main>
    </div>
  );
}
