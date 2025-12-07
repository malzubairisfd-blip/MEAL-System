
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
import { Separator } from '@/components/ui/separator';

const SETTINGS_KEY = 'beneficiary-insights-settings';

const DEFAULT_SETTINGS = {
  // Thresholds
  minPairScore: 0.45,
  minInternalScore: 0.67,
  blockChunkSize: 5000,
  // Weights
  w_firstName: 0.15,
  w_familyName: 0.25,
  w_advancedName: 0.12,
  w_tokenReorder: 0.10,
  w_husband: 0.12,
  w_id: 0.08,
  w_phone: 0.05,
  w_children: 0.04,
  w_location: 0.04,
};

type SettingsKeys = keyof typeof DEFAULT_SETTINGS;
type WeightKeys = `w_${string}`;

export default function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [isLoaded, setIsLoaded] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    try {
      const savedSettings = localStorage.getItem(SETTINGS_KEY);
      if (savedSettings) {
        setSettings(prev => ({...DEFAULT_SETTINGS, ...JSON.parse(savedSettings)}));
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
        description: 'Your new clustering settings have been saved.',
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
        description: 'Clustering settings have been reset to their default values.',
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
      const clampedValue = Math.max(0, Math.min(1, newValue));
      return {...prev, [key]: key === 'blockChunkSize' ? newValue : clampedValue };
    });
  };

  const WeightSetting = ({ id, label }: { id: WeightKeys, label: string }) => (
     <div className="space-y-4">
        <Label htmlFor={id} className="text-base">{label}</Label>
        <Slider
          id={id}
          min={0}
          max={1}
          step={0.01}
          value={[settings[id]]}
          onValueChange={(val) => handleSliderChange(id, val)}
        />
        <div className="flex items-center gap-2">
          <Button variant="outline" size="icon" onClick={() => handleStep(id, -0.01)}><Minus /></Button>
          <Input
              type="number"
              className="w-24 text-center font-mono"
              value={settings[id].toFixed(2)}
              onChange={(e) => handleInputChange(id, e.target.value)}
              step={0.01}
              min={0}
              max={1}
          />
          <Button variant="outline" size="icon" onClick={() => handleStep(id, 0.01)}><Plus /></Button>
        </div>
      </div>
  );
  
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
                  Adjust the sensitivity of the AI-powered clustering engine.
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

      <Card>
        <CardHeader>
          <CardTitle>Thresholds</CardTitle>
          <CardDescription>
            Control the initial matching and refinement process.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-8">
          {/* Min Pair Score */}
          <div className="space-y-4">
            <Label htmlFor="min-pair-score" className="text-base">Minimum Pair Score</Label>
            <p className="text-sm text-muted-foreground">
              The initial similarity threshold (0 to 1) for any two records to be considered a potential match. A lower value increases sensitivity. Default: {DEFAULT_SETTINGS.minPairScore.toFixed(2)}
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
          
          <Separator />

          {/* Min Internal Score */}
          <div className="space-y-4">
            <Label htmlFor="min-internal-score" className="text-base">Minimum Internal Score</Label>
             <p className="text-sm text-muted-foreground">
              The minimum similarity required to keep two records connected within a large, refined cluster. Default: {DEFAULT_SETTINGS.minInternalScore.toFixed(2)}
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
           
           <Separator />

           {/* Block Chunk Size */}
           <div className="space-y-4">
            <Label htmlFor="block-chunk-size" className="text-base">Block Chunk Size</Label>
             <p className="text-sm text-muted-foreground">
              Performance setting for very large datasets. Smaller is more thorough but slower; larger is faster. Default: {DEFAULT_SETTINGS.blockChunkSize}
            </p>
            <Slider
              id="block-chunk-size"
              min={500}
              max={10000}
              step={100}
              value={[settings.blockChunkSize]}
              onValueChange={(val) => handleSliderChange('blockChunkSize', val)}
            />
            <div className="flex items-center gap-2">
               <Button variant="outline" size="icon" onClick={() => handleStep('blockChunkSize', -100)}><Minus /></Button>
                <Input
                    type="number"
                    className="w-32 text-center font-mono"
                    value={settings.blockChunkSize}
                    onChange={(e) => handleInputChange('blockChunkSize', e.target.value)}
                    step={100}
                />
                <Button variant="outline" size="icon" onClick={() => handleStep('blockChunkSize', 100)}><Plus /></Button>
            </div>
          </div>
        </CardContent>
      </Card>
      
      <Card>
         <CardHeader>
            <CardTitle>Final Score Weights</CardTitle>
            <CardDescription>
                Adjust the importance of each component in the final similarity score. The weights do not need to sum to 1.
            </CardDescription>
        </CardHeader>
        <CardContent className="grid md:grid-cols-2 gap-x-8 gap-y-12">
            <WeightSetting id="w_firstName" label="First Name" />
            <WeightSetting id="w_familyName" label="Family Name" />
            <WeightSetting id="w_husband" label="Husband Name" />
            <WeightSetting id="w_id" label="National ID" />
            <WeightSetting id="w_phone" label="Phone Number" />
            <WeightSetting id="w_children" label="Children's Names" />
            <WeightSetting id="w_location" label="Location" />
            <WeightSetting id="w_advancedName" label="Advanced Name (Internal)" />
            <WeightSetting id="w_tokenReorder" label="Name Reorder (Internal)" />
        </CardContent>
      </Card>
    </div>
  );
}

    