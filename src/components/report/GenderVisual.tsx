
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { User, Users } from "lucide-react";

interface GenderVisualProps {
  gender: 'male' | 'female';
  value: number;
  total: number;
}

export function GenderVisual({ gender, value, total }: GenderVisualProps) {
  const percentage = total > 0 ? (value / total) * 100 : 0;
  const color = gender === 'male' ? 'bg-blue-500' : 'bg-pink-500';

  return (
    <Card>
      <CardHeader>
        <CardTitle className="capitalize">{gender} Children</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col items-center justify-center">
        <div className="w-full h-24 bg-gray-200 rounded-lg flex items-center p-2">
            {Array.from({length: 10}).map((_, i) => (
                <User key={i} className={`h-8 w-8 ${i < Math.round(percentage/10) ? (gender === 'male' ? 'text-blue-500' : 'text-pink-500') : 'text-gray-300'}`} />
            ))}
        </div>
        <div className="text-2xl font-bold mt-4">{value.toLocaleString()}</div>
        <div className="text-sm text-muted-foreground">{percentage.toFixed(1)}% of Total</div>
      </CardContent>
    </Card>
  );
}
