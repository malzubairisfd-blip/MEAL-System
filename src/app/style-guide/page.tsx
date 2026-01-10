"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Paintbrush, Rows, Type, Shapes, PlaySquare } from "lucide-react";

interface StyleGuideProps {
  theme: {
    name: string;
    colors: string[];
    layout: string;
    typography: string;
    iconography: string;
    animation: string;
  };
}

const StyleGuideCard = ({ theme }: StyleGuideProps) => {
  return (
    <Card className="bg-gray-800 text-white border-gray-700">
      <CardHeader>
        <CardTitle className="text-xl font-bold tracking-wider uppercase">Style Guidelines</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="flex items-center gap-4">
          <Paintbrush className="h-6 w-6 text-gray-400" />
          <div>
            <h3 className="font-semibold">Color</h3>
            <div className="flex items-center gap-2 mt-1">
              {theme.colors.map((color, index) => (
                <div
                  key={index}
                  className="h-6 w-6 rounded-full border-2 border-gray-600"
                  style={{ backgroundColor: color }}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <Rows className="h-6 w-6 text-gray-400 mt-1" />
          <div>
            <h3 className="font-semibold">Layout</h3>
            <p className="text-gray-300 mt-1">{theme.layout}</p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <Type className="h-6 w-6 text-gray-400 mt-1" />
          <div>
            <h3 className="font-semibold">Typography</h3>
            <p className="text-gray-300 mt-1">{theme.typography}</p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <Shapes className="h-6 w-6 text-gray-400 mt-1" />
          <div>
            <h3 className="font-semibold">Iconography</h3>
            <p className="text-gray-300 mt-1">{theme.iconography}</p>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <PlaySquare className="h-6 w-6 text-gray-400 mt-1" />
          <div>
            <h3 className="font-semibold">Animation</h3>
            <p className="text-gray-300 mt-1">{theme.animation}</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};


const themes = [
    {
        name: "Oceanic Calm",
        colors: ["#2563EB", "#FFFFFF", "#0891B2"],
        layout: "Clean, professional, and trustworthy with a focus on data clarity.",
        typography: "Font: 'Inter' sans-serif for a modern, neutral, and highly readable experience.",
        iconography: "Primary blue for standard icons, with a vibrant cyan for key actions to guide the user.",
        animation: "Smooth and subtle transitions for a professional feel."
    },
    {
        name: "Earthy Growth",
        colors: ["#D2B48C", "#FFFBF5", "#F59E0B"],
        layout: "Warm and approachable layout that feels organic and positive.",
        typography: "Font: 'Inter' sans-serif to maintain clean readability within a warmer palette.",
        iconography: "Sandy brown for standard icons, with a gold accent for important interactive elements.",
        animation: "Gentle fades and slides that complement the calm aesthetic."
    },
    {
        name: "Modern Impact",
        colors: ["#6D28D9", "#111827", "#D946EF"],
        layout: "High-contrast dark theme that is bold, energetic, and easy on the eyes in low light.",
        typography: "Font: 'Inter' sans-serif, which remains crisp and clear on dark backgrounds.",
        iconography: "Light gray for standard icons, with the primary purple and accent pink for key actions.",
        animation: "Quick and responsive animations to match the dynamic feel."
    }
]

export default function StyleGuidePage() {
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Style Guide Samples</h1>
      <p className="text-muted-foreground">Here are a few different theme directions we can take. Let me know which one you prefer!</p>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {themes.map(theme => (
            <StyleGuideCard key={theme.name} theme={theme} />
        ))}
      </div>
    </div>
  );
}
