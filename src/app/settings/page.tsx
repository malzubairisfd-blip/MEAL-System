// src/app/settings/page.tsx
"use client";

import React, { useEffect, useState } from "react";
import { computePairScore } from "@/lib/scoringClient";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Slider } from "@/components/ui/slider";
import { useToast } from "@/hooks/use-toast";
import { Save, RotateCcw, Upload, Download, Loader2, Plus, Minus, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Info } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";


type Settings = any;

const descriptions: Record<string, any> = {
  minPair: "The minimum score (0 to 1) for two records to be considered a potential match and form a link. High values create fewer, more confident clusters. Low values create more, but potentially noisier, clusters.",
  minInternal: "The minimum score (0 to 1) used to decide if records within a large, temporary cluster should remain together in the final, smaller clusters. High values result in smaller, more tightly-related final clusters.",
  blockChunkSize: "A performance setting for very large datasets. It breaks down large groups of potential matches into smaller chunks to manage memory. The default is usually fine.",
  finalScoreWeights: {
    firstNameScore: "Weight for the similarity of the first name.",
    familyNameScore: "Weight for the similarity of the family name (all parts except the first).",
    advancedNameScore: "Weight for advanced name matching techniques, like root-letter matching.",
    tokenReorderScore: "Weight for detecting names with the same words but in a different order.",
    husbandScore: "Weight for the similarity of the husband's name.",
    idScore: "Weight for matches on the National ID.",
    phoneScore: "Weight for matches on the phone number.",
    childrenScore: "Weight for matching children's names.",
    locationScore: "Weight for matching village or sub-district names."
  },
  rules: {
    enableNameRootEngine: "An advanced technique that tries to match names based on their likely root letters, catching more complex variations.",
    enableTribalLineage: "Looks for and gives weight to matches in the tribal or family name parts of a full name.",
    enableMaternalLineage: "Gives weight to similarities found in the maternal parts of a name if they can be identified.",
    enablePolygamyRules: "Applies special logic for polygamous relationships, such as checking if two women share the same husband and paternal line.",
  }
}

export default function SettingsPage() {
  const { t } = useTranslation();
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testA, setTestA] = useState({ womanName: "", husbandName: "", nationalId: "", phone: "" });
  const [testB, setTestB] = useState({ womanName: "", husbandName: "", nationalId: "", phone: "" });
  const [lastResult, setLastResult] = useState<any>(null);
  const { toast } = useToast();

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
    setLastResult(res);
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
                  <Slider id="minPair" min={0} max={1} step={0.01} value={[settings.thresholds.minPair]} onValueChange={(v)=>update("thresholds.minPair", v[0])} className="col-span-12 sm:col-span-6" />
                  <div className="col-span-12 sm:col-span-3 flex items-center gap-1 justify-end">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleNumericChange('thresholds.minPair', -0.01)}><Minus className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleNumericChange('thresholds.minPair', 0.01)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
                 <p className="text-xs text-muted-foreground mt-1 pl-1">{descriptions.minPair}</p>
              </div>
              <div>
                <div className="grid grid-cols-12 items-center gap-4">
                  <Label htmlFor="minInternal" className="col-span-12 sm:col-span-3 flex items-center">{t('settings.thresholds.minInternal')}: <b className="mx-1">{settings.thresholds.minInternal}</b></Label>
                  <Slider id="minInternal" min={0} max={1} step={0.01} value={[settings.thresholds.minInternal]} onValueChange={(v)=>update("thresholds.minInternal", v[0])} className="col-span-12 sm:col-span-6" />
                  <div className="col-span-12 sm:col-span-3 flex items-center gap-1 justify-end">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleNumericChange('thresholds.minInternal', -0.01)}><Minus className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleNumericChange('thresholds.minInternal', 0.01)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
                 <p className="text-xs text-muted-foreground mt-1 pl-1">{descriptions.minInternal}</p>
              </div>
              <div>
                <Label htmlFor="blockChunkSize">{t('settings.thresholds.blockChunkSize')}</Label>
                <Input id="blockChunkSize" type="number" value={settings.thresholds.blockChunkSize} onChange={(e)=>update("thresholds.blockChunkSize", parseInt(e.target.value||"0"))}/>
                <p className="text-xs text-muted-foreground mt-1">{descriptions.blockChunkSize}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('settings.weights.title')}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(settings.finalScoreWeights).map(([k, v]: [string, any]) => (
                <div key={k} className="flex flex-col gap-2 p-3 border rounded-md">
                   <div className="flex justify-between items-center">
                     <Label htmlFor={`fsw-${k}`} className="capitalize flex items-center">{k.replace(/([A-Z])/g, ' $1')}</Label>
                   </div>
                   <div className="flex items-center gap-2">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleWeightChange(k, -0.01)}><Minus className="h-4 w-4" /></Button>
                        <Input type="number" step="0.01" value={v || ''} onChange={(e)=>update(`finalScoreWeights.${k}`, parseFloat(e.target.value) || 0)} className="w-24 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"/>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleWeightChange(k, 0.01)}><Plus className="h-4 w-4" /></Button>
                   </div>
                    <Slider id={`fsw-${k}`} min={0} max={1} step={0.01} value={[v]} onValueChange={(val)=>update(`finalScoreWeights.${k}`, val[0])} />
                    <p className="text-xs text-muted-foreground mt-1">{descriptions.finalScoreWeights[k]}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>{t('settings.rules.title')}</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(settings.rules).map(([k, v]: [string, any]) => (
                <div key={k} className="flex items-start justify-between p-3 rounded-lg border">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`r-${k}`} className="capitalize flex items-center">{k.replace(/([A-Z])/g, ' $1').replace('Enable ', '')}</Label>
                    <p className="text-xs text-muted-foreground">{descriptions.rules[k]}</p>
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
                <Button onClick={runTestScoring}>{t('settings.testScoring.runTest')}</Button>
                <Button onClick={() => { setTestA({womanName:"",husbandName:"",nationalId:"",phone:""}); setTestB({womanName:"",husbandName:"",nationalId:"",phone:""}); setLastResult(null); }} variant="outline">{t('settings.testScoring.clear')}</Button>
              </div>

              {lastResult && (
                <div className="mt-3 bg-muted p-3 rounded-lg">
                  <div className="font-bold text-lg">{t('settings.testScoring.score')}: {lastResult.score.toFixed(4)}</div>
                  <div className="text-sm mt-2">{t('settings.testScoring.compareToMinPair')}: <b>{settings.thresholds.minPair}</b></div>
                  <details className="mt-2 text-sm">
                      <summary className="cursor-pointer font-medium">{t('settings.testScoring.viewBreakdown')}</summary>
                      <pre className="text-xs mt-2 bg-background p-2 rounded">{JSON.stringify(lastResult.breakdown, null, 2)}</pre>
                  </details>
                </div>
              )}
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}
