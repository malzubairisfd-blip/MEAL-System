"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Save, RotateCcw, ChevronLeft, Plus, Minus } from 'lucide-react';
import { Input } from '@/components/ui/input';

const SETTINGS_KEY = 'beneficiary-insights-settings';
const DEFAULT_SETTINGS = {
  minPairScore: 0.75,
  minInternalScore: 0.65,
  blockChunkSize: 1200,
};

type SettingsKeys = keyof typeof DEFAULT_SETTINGS;

export default function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        setSettings(prev => ({...prev, ...JSON.parse(savedSettings)}));
      }
    } catch (e) {
      console.warn("Could not load settings from localStorage");
    } finally {
        setIsLoaded(true);
    }
  }, []);

  const handleSave = () => {
    try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
      toast({
        title: 'Settings Saved',
        description: 'Your new clustering thresholds have been saved.',
      });
    } catch (e) {
      toast({
        title: 'Error',
        description: 'Could not save settings to your browser\'s local storage.',
        variant: 'destructive',
      });
    }
  };

  const handleReset = () => {
    setSettings(DEFAULT_SETTINGS);
     try {
      localStorage.setItem(SETTINGS_KEY, JSON.stringify(DEFAULT_SETTINGS));
      toast({
        title: 'Settings Reset',
        description: 'Clustering thresholds have been reset to their default values.',
      });
    } catch (e) {
       toast({
        title: 'Error',
        description: 'Could not reset settings.',
        variant: 'destructive',
      });
    }
  };

  const handleSliderChange = (key: SettingsKeys, value: number[]) => {
    setSettings(prev => ({ ...prev, [key]: value[0] }));
  };

  const handleInputChange = (key: SettingsKeys, value: string) => {
    const numValue = key === 'blockChunkSize' ? parseInt(value, 10) : parseFloat(value);
    if (!isNaN(numValue)) {
      setSettings(prev => ({...prev, [key]: numValue}));
    }
  };

  const handleStep = (key: SettingsKeys, step: number) => {
    setSettings(prev => {
      const currentValue = prev[key];
      const newValue = parseFloat((currentValue + step).toFixed(2));
      return {...prev, [key]: newValue};
    });
  };
  
  if (!isLoaded) {
    return <div>Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
              <div>
                <CardTitle>Clustering Settings</CardTitle>
                <CardDescription>
                  Adjust the sensitivity of the AI-powered clustering engine. Lower values will create more, larger clusters. Higher values will be more strict.
                </CardDescription>
              </div>
              <Button variant="outline" asChild>
                  <Link href="/upload">
                      <ChevronLeft className="mr-2 h-4 w-4" />
                      Back to Upload
                  </Link>
              </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-8">
          
          {/* Min Pair Score */}
          <div className="space-y-4">
            <Label htmlFor="min-pair-score" className="text-base">Minimum Pair Score</Label>
            <p className="text-sm text-muted-foreground">
              The minimum similarity score (from 0 to 1) for any two records to be considered a potential match within a block. This is the first filter in the duplicate detection process. Default: 0.75
            </p>
            <Slider
              id="min-pair-score"
              min={0.3}
              max={0.95}
              step={0.01}
              value={[settings.minPairScore]}
              onValueChange={(val) => handleSliderChange('minPairScore', val)}
            />
            <div className="flex items-center gap-2">
              <Button variant="outline" size="icon" onClick={() => handleStep('minPairScore', -0.01)}><Minus /></Button>
              <Input
                  type="number"
                  className="w-24 text-center font-mono"
                  value={settings.minPairScore.toFixed(2)}
                  onChange={(e) => handleInputChange('minPairScore', e.target.value)}
                  step={0.01}
              />
              <Button variant="outline" size="icon" onClick={() => handleStep('minPairScore', 0.01)}><Plus /></Button>
            </div>
          </div>
          
          {/* Min Internal Score */}
          <div className="space-y-4">
            <Label htmlFor="min-internal-score" className="text-base">Minimum Internal Score</Label>
             <p className="text-sm text-muted-foreground">
              When a large cluster is being refined, this is the minimum score required to keep two records connected in the Maximum Spanning Tree. It controls how aggressively large clusters are split. Default: 0.65
            </p>
            <Slider
              id="min-internal-score"
              min={0.2}
              max={0.8}
              step={0.01}
              value={[settings.minInternalScore]}
              onValueChange={(val) => handleSliderChange('minInternalScore', val)}
            />
            <div className="flex items-center gap-2">
                <Button variant="outline" size="icon" onClick={() => handleStep('minInternalScore', -0.01)}><Minus /></Button>
                <Input
                    type="number"
                    className="w-24 text-center font-mono"
                    value={settings.minInternalScore.toFixed(2)}
                    onChange={(e) => handleInputChange('minInternalScore', e.target.value)}
                    step={0.01}
                />
                <Button variant="outline" size="icon" onClick={() => handleStep('minInternalScore', 0.01)}><Plus /></Button>
            </div>
          </div>
           
           {/* Block Chunk Size */}
           <div className="space-y-4">
            <Label htmlFor="block-chunk-size" className="text-base">Block Chunk Size</Label>
             <p className="text-sm text-muted-foreground">
              For high-performance blocking on large datasets (&gt;100k rows), this limits the maximum size of a candidate block. Smaller values are slower but more thorough; larger values are faster but may miss some comparisons. Default: 1200
            </p>
            <Slider
              id="block-chunk-size"
              min={500}
              max={5000}
              step={100}
              value={[settings.blockChunkSize]}
              onValueChange={(val) => handleSliderChange('blockChunkSize', val)}
            />
            <div className="flex items-center gap-2">
               <Button variant="outline" size="icon" onClick={() => handleStep('blockChunkSize', -100)}><Minus /></Button>
                <Input
                    type="number"
                    className="w-24 text-center font-mono"
                    value={settings.blockChunkSize}
                    onChange={(e) => handleInputChange('blockChunkSize', e.target.value)}
                    step={100}
                />
                <Button variant="outline" size="icon" onClick={() => handleStep('blockChunkSize', 100)}><Plus /></Button>
            </div>
          </div>
          
          {/* Action Buttons */}
          <div className="flex gap-4 pt-4 border-t">
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </Button>
             <Button onClick={handleReset} variant="destructive">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
