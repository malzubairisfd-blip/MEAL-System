
"use client";

import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { Save, RotateCcw } from 'lucide-react';

const SETTINGS_KEY = 'beneficiary-insights-settings';
const DEFAULT_SETTINGS = {
  minPairScore: 0.60,
  minInternalScore: 0.50,
};

export default function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        setSettings(JSON.parse(savedSettings));
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
              The minimum similarity score (from 0 to 1) required for any two records to be considered a potential match and be included in the initial clustering phase.
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
              When a large cluster needs to be split into smaller groups (max 4 records), this is the minimum score required for records to remain together in a subgroup.
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
          <div className="flex gap-4">
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
