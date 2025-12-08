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


type Settings = any;

const descriptions = {
  minPair: "The minimum score (0 to 1) for two records to be considered a potential match and form a link. High values create fewer, more confident clusters. Low values create more, but potentially noisier, clusters.",
  minInternal: "The minimum score (0 to 1) used to decide if records within a large, temporary cluster should remain together in the final, smaller clusters. High values result in smaller, more tightly-related final clusters.",
  blockChunkSize: "A performance setting for very large datasets. It breaks down large groups of potential matches into smaller chunks to manage memory. The default is usually fine.",
  weights: {
    womanName: "How much to value the similarity between the woman's full name.",
    husbandName: "How much to value the similarity between the husband's name.",
    household: "A general weight for household-level similarities (currently linked to children).",
    nationalId: "How much to value an exact match on the National ID.",
    phone: "How much to value a partial or exact match on the phone number.",
    village: "How much to value a match on the village or sub-district name.",
  },
  rules: {
    enableArabicNormalizer: "Standardizes Arabic characters (e.g., 'أ', 'إ', 'آ' all become 'ا') to catch more matches despite variations in typing.",
    enableNameRootEngine: "An advanced technique that tries to match names based on their likely root letters, catching more complex variations.",
    enableTribalLineage: "Looks for and gives weight to matches in the tribal or family name parts of a full name.",
    enableMaternalLineage: "Gives weight to similarities found in the maternal parts of a name if they can be identified.",
    enableOrderFreeMatching: "Detects if two names have the same set of words but in a different order (e.g., 'Fatima Ali Ahmed' vs. 'Fatima Ahmed Ali').",
    enablePolygamyRules: "Applies special logic for polygamous relationships, such as checking if two women share the same husband and paternal line.",
    enableIncestBlocking: "Prevents the engine from clustering individuals who are identified as being in a forbidden relationship (e.g., siblings).",
  }
}

const HelpTooltip = ({ content }: { content: string }) => (
  <TooltipProvider>
    <Tooltip>
      <TooltipTrigger asChild>
        <button type="button" className="ml-2 text-muted-foreground hover:text-foreground">
          <Info className="h-4 w-4" />
        </button>
      </TooltipTrigger>
      <TooltipContent className="max-w-xs">
        <p>{content}</p>
      </TooltipContent>
    </Tooltip>
  </TooltipProvider>
);


export default function SettingsPage() {
  const [settings, setSettings] = useState<Settings | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testA, setTestA] = useState({ womanName: "", husbandName: "", nationalId: "", phone: "" });
  const [testB, setTestB] = useState({ womanName: "", husbandName: "", nationalId: "", phone: "" });
  const [lastResult, setLastResult] = useState<any>(null);
  const { toast } = useToast();

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((j) => {
        if (j.ok) {
          setSettings(j.settings);
        } else {
          // If missing, load defaults
          setSettings(getDefaultSettings());
          toast({ title: "Settings not found", description: "Loading default settings. Save to create a settings file.", variant: "default" });
        }
      })
      .catch(() => {
        setSettings(getDefaultSettings());
        toast({ title: "Error loading settings", description: "Could not fetch settings from server. Using defaults.", variant: "destructive" });
      })
      .finally(() => setLoading(false));
  }, [toast]);

  function getDefaultSettings() {
    return {
      minPair: 0.52,
      minInternal: 0.65,
      blockChunkSize: 5000,
      weights: { womanName: 0.45, husbandName: 0.25, household: 0.1, nationalId: 0.1, phone: 0.05, village: 0.05 },
      rules: {
        enableArabicNormalizer: true,
        enableNameRootEngine: true,
        enableTribalLineage: true,
        enableMaternalLineage: true,
        enableOrderFreeMatching: true,
        enablePolygamyRules: true,
        enableIncestBlocking: true
      }
    };
  }

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
    handleNumericChange(`weights.${key}`, change);
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
      if (!j.ok) throw new Error(j.error || "Save failed");
      toast({ title: "Settings Saved", description: "Your changes have been saved successfully." });
    } catch (err: any) {
      toast({ title: "Save Failed", description: err.message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  function resetDefaults() {
    if (confirm("Are you sure you want to reset all settings to their defaults?")) {
      setSettings(getDefaultSettings());
      toast({ title: "Settings Reset", description: "Settings have been reset. Click Save to persist." });
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
        if (parsed.weights && parsed.rules) {
          setSettings(parsed);
          toast({ title: "Settings Imported", description: "Imported settings previewed. Click Save to persist them." });
        } else {
          throw new Error("Invalid settings file structure.");
        }
      } catch (err: any) {
        toast({ title: "Import Failed", description: err.message, variant: "destructive" });
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
                  <CardTitle className="text-2xl">Clustering — Admin Settings (Enterprise)</CardTitle>
                  <CardDescription>Fine-tune the clustering engine, weights, and rules.</CardDescription>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                   <Button variant="outline" asChild>
                    <Link href="/upload">
                        <ArrowLeft className="mr-2" />
                        Go to Upload
                    </Link>
                  </Button>
                  <Button onClick={exportJSON} variant="outline"><Download className="mr-2" />Export</Button>
                  <Button asChild variant="outline">
                    <Label>
                      <Upload className="mr-2" />
                      Import
                      <input type="file" accept="application/json" className="hidden" onChange={(e) => importJSON(e.target.files?.[0] ?? null)} />
                    </Label>
                  </Button>
                  <Button onClick={resetDefaults} variant="destructive"><RotateCcw className="mr-2" />Reset</Button>
                  <Button onClick={save} disabled={saving}>
                    {saving ? <Loader2 className="mr-2 animate-spin" /> : <Save className="mr-2" />}
                    Save
                  </Button>
                </div>
              </div>
          </CardHeader>
      </Card>

      <main className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Thresholds & Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <div>
                <div className="grid grid-cols-12 items-center gap-4">
                  <Label htmlFor="minPair" className="col-span-12 sm:col-span-3 flex items-center">Min Pair Score: <b className="mx-1">{settings.minPair}</b> <HelpTooltip content={descriptions.minPair} /></Label>
                  <Slider id="minPair" min={0} max={1} step={0.01} value={[settings.minPair]} onValueChange={(v)=>update("minPair", v[0])} className="col-span-12 sm:col-span-6" />
                  <div className="col-span-12 sm:col-span-3 flex items-center gap-1 justify-end">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleNumericChange('minPair', -0.01)}><Minus className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleNumericChange('minPair', 0.01)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
                 <p className="text-xs text-muted-foreground mt-1 pl-1">The minimum score for two records to form a match. High values = fewer, more confident matches. Low values = more, noisier matches.</p>
              </div>
              <div>
                <div className="grid grid-cols-12 items-center gap-4">
                  <Label htmlFor="minInternal" className="col-span-12 sm:col-span-3 flex items-center">Min Internal Score: <b className="mx-1">{settings.minInternal}</b> <HelpTooltip content={descriptions.minInternal} /></Label>
                  <Slider id="minInternal" min={0} max={1} step={0.01} value={[settings.minInternal]} onValueChange={(v)=>update("minInternal", v[0])} className="col-span-12 sm:col-span-6" />
                  <div className="col-span-12 sm:col-span-3 flex items-center gap-1 justify-end">
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleNumericChange('minInternal', -0.01)}><Minus className="h-4 w-4" /></Button>
                      <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleNumericChange('minInternal', 0.01)}><Plus className="h-4 w-4" /></Button>
                  </div>
                </div>
                 <p className="text-xs text-muted-foreground mt-1 pl-1">Score to decide if records in a large group stay together. High values = smaller, tighter final clusters.</p>
              </div>
              <div>
                <Label htmlFor="blockChunkSize" className="flex items-center">Block Chunk Size <HelpTooltip content={descriptions.blockChunkSize} /></Label>
                <Input id="blockChunkSize" type="number" value={settings.blockChunkSize} onChange={(e)=>update("blockChunkSize", parseInt(e.target.value||"0"))}/>
                <p className="text-xs text-muted-foreground mt-1">Performance setting for large datasets. Breaks work into chunks to avoid memory issues. Default is usually fine.</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Weights</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {Object.entries(settings.weights).map(([k, v]: any) => (
                <div key={k}>
                  <div className="grid grid-cols-1 md:grid-cols-12 items-center gap-4">
                    <Label htmlFor={`w-${k}`} className="col-span-12 md:col-span-3 capitalize flex items-center">{k.replace(/([A-Z])/g, ' $1')} <HelpTooltip content={descriptions.weights[k as keyof typeof descriptions.weights]} /></Label>
                    <Slider id={`w-${k}`} min={0} max={1} step={0.01} value={[v]} onValueChange={(val)=>update(`weights.${k}`, val[0])} className="col-span-12 md:col-span-6" />
                    <div className="col-span-12 md:col-span-3 flex items-center gap-1">
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleWeightChange(k, -0.01)}><Minus className="h-4 w-4" /></Button>
                        <Input type="number" step="0.01" value={v} onChange={(e)=>update(`weights.${k}`, parseFloat(e.target.value))} className="w-24 text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"/>
                        <Button variant="outline" size="icon" className="h-8 w-8" onClick={() => handleWeightChange(k, 0.01)}><Plus className="h-4 w-4" /></Button>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1 md:ml-[26%]">{descriptions.weights[k as keyof typeof descriptions.weights]}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle>Rules</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {Object.entries(settings.rules).map(([k, v]: any) => (
                <div key={k} className="flex items-start justify-between p-3 rounded-lg border">
                  <div className="flex flex-col gap-1">
                    <Label htmlFor={`r-${k}`} className="capitalize flex items-center">{k.replace(/([A-Z])/g, ' $1').replace('Enable ', '')}</Label>
                    <p className="text-xs text-muted-foreground">{descriptions.rules[k as keyof typeof descriptions.rules]}</p>
                  </div>
                  <Switch id={`r-${k}`} checked={v} onCheckedChange={(val)=>update(`rules.${k}`, val)} />
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <aside className="space-y-6">
          <Card>
            <CardHeader><CardTitle>Test Scoring</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2 p-3 border rounded-md">
                <h4 className="font-medium">Record A</h4>
                <Label>Woman Name</Label>
                <Input value={testA.womanName} onChange={e=>setTestA({...testA, womanName: e.target.value})}/>
                <Label>Husband Name</Label>
                <Input value={testA.husbandName} onChange={e=>setTestA({...testA, husbandName: e.target.value})}/>
                <Label>National ID</Label>
                <Input value={testA.nationalId} onChange={e=>setTestA({...testA, nationalId: e.target.value})}/>
                <Label>Phone</Label>
                <Input value={testA.phone} onChange={e=>setTestA({...testA, phone: e.target.value})}/>
              </div>

              <div className="space-y-2 p-3 border rounded-md">
                <h4 className="font-medium">Record B</h4>
                <Label>Woman Name</Label>
                <Input value={testB.womanName} onChange={e=>setTestB({...testB, womanName: e.target.value})}/>
                <Label>Husband Name</Label>
                <Input value={testB.husbandName} onChange={e=>setTestB({...testB, husbandName: e.target.value})}/>
                <Label>National ID</Label>
                <Input value={testB.nationalId} onChange={e=>setTestB({...testB, nationalId: e.target.value})}/>
                <Label>Phone</Label>
                <Input value={testB.phone} onChange={e=>setTestB({...testB, phone: e.target.value})}/>
              </div>

              <div className="flex gap-2">
                <Button onClick={runTestScoring}>Run Test</Button>
                <Button onClick={() => { setTestA({womanName:"",husbandName:"",nationalId:"",phone:""}); setTestB({womanName:"",husbandName:"",nationalId:"",phone:""}); setLastResult(null); }} variant="outline">Clear</Button>
              </div>

              {lastResult && (
                <div className="mt-3 bg-muted p-3 rounded-lg">
                  <div className="font-bold text-lg">Score: {lastResult.score.toFixed(4)}</div>
                  <div className="text-sm mt-2">Compare to minPair: <b>{settings.minPair}</b></div>
                  <details className="mt-2 text-sm">
                      <summary className="cursor-pointer font-medium">View Breakdown</summary>
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
