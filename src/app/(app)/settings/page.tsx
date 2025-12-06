"use client";

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Save, RotateCcw, ChevronLeft } from 'lucide-react';
import { Input } from '@/components/ui/input';

const SETTINGS_KEY = 'beneficiary-insights-settings';
const DEFAULT_SETTINGS = {
  minPairScore: 0.75,
  minInternalScore: 0.65,
  blockChunkSize: 1200,
};

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

  const handleSliderChange = (key: keyof typeof settings, value: number[]) => {
    setSettings(prev => ({ ...prev, [key]: value[0] }));
  };
  
  if (!isLoaded) {
    return <div>Loading settings...</div>;
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Clustering Settings</CardTitle>
          <CardDescription>
            Adjust the sensitivity of the fuzzy matching algorithm. Lower values will create more, larger clusters. Higher values will be more strict.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          <div className="space-y-4">
            <Label htmlFor="min-pair-score" className="text-base">Minimum Pair Score</Label>
            <p className="text-sm text-muted-foreground">
              The minimum similarity score (from 0 to 1) required for any two records to be considered a potential match and be included in the initial clustering phase. Default: 0.75
            </p>
            <div className="flex items-center gap-4">
              <Slider
                id="min-pair-score"
                min={0.3}
                max={0.95}
                step={0.01}
                value={[settings.minPairScore]}
                onValueChange={(val) => handleSliderChange('minPairScore', val)}
                className="flex-1"
              />
              <span className="font-mono text-lg tabular-nums">{settings.minPairScore.toFixed(2)}</span>
            </div>
          </div>
          <div className="space-y-4">
            <Label htmlFor="min-internal-score" className="text-base">Minimum Internal Score</Label>
             <p className="text-sm text-muted-foreground">
              When a large cluster needs to be split into smaller, more coherent groups, this is the minimum average similarity required for records to remain together. Default: 0.65
            </p>
            <div className="flex items-center gap-4">
              <Slider
                id="min-internal-score"
                min={0.2}
                max={0.8}
                step={0.01}
                value={[settings.minInternalScore]}
                onValueChange={(val) => handleSliderChange('minInternalScore', val)}
                className="flex-1"
              />
              <span className="font-mono text-lg tabular-nums">{settings.minInternalScore.toFixed(2)}</span>
            </div>
          </div>
           <div className="space-y-4">
            <Label htmlFor="block-chunk-size" className="text-base">Block Chunk Size</Label>
             <p className="text-sm text-muted-foreground">
              For very large datasets, this controls the size of sub-blocks during the candidate generation phase. Smaller values are slower but more thorough. Default: 1200
            </p>
            <div className="flex items-center gap-4">
               <Slider
                id="block-chunk-size"
                min={500}
                max={5000}
                step={100}
                value={[settings.blockChunkSize]}
                onValueChange={(val) => handleSliderChange('blockChunkSize', val)}
                className="flex-1"
              />
              <span className="font-mono text-lg tabular-nums">{settings.blockChunkSize}</span>
            </div>
          </div>
          <div className="flex gap-4">
             <Button variant="outline" asChild>
                <Link href="/upload">
                    <ChevronLeft className="mr-2 h-4 w-4" />
                    Back to Upload
                </Link>
            </Button>
            <Button onClick={handleSave}>
              <Save className="mr-2 h-4 w-4" />
              Save Settings
            </Button>
             <Button onClick={handleReset} variant="outline">
              <RotateCcw className="mr-2 h-4 w-4" />
              Reset to Defaults
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
