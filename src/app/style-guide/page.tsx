
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Paintbrush, Rows, Type, Shapes, PlaySquare, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";

interface StyleTheme {
  name: string;
  colors: { name: string; hex: string }[];
  layout: string[];
  typography: string[];
  iconography: string[];
  animation: string[];
}

const themes: StyleTheme[] = [
  {
    name: "Modern Map / Data App",
    colors: [
      { name: "Primary: Soft Blue", hex: "#5DADE2" },
      { name: "Secondary: Light Blue", hex: "#A9CCE3" },
      { name: "Neutral: White / Dark Gray", hex: "#FDFEFE" },
      { name: "Background: Charcoal Black", hex: "#17202A" },
    ],
    layout: ["Clean and intuitive layout with a map-first focus.", "UI elements are minimal, spaced, and non-intrusive.", "Grid-based structure", "Clear visual hierarchy", "Responsive across screen sizes"],
    typography: ["Font: Inter, sans-serif", "Headlines: Medium / Semibold", "Body text: Regular", "Consistent line height and spacing"],
    iconography: ["Simple, line-based icons", "Consistent stroke width", "Rounded edges", "Meaningful and minimal"],
    animation: ["Subtle animations to guide the user", "Smooth transitions during map loading", "Soft progress indicators"],
  },
  {
    name: "Professional Dashboard",
    colors: [
        { name: "Primary: Deep Blue", hex: "#2874A6" },
        { name: "Accent: Sky Blue", hex: "#85C1E9" },
        { name: "Status Colors: Green, Amber, Red", hex: "#2ECC71" },
        { name: "Background: Dark Slate", hex: "#212F3D" },
    ],
    layout: ["Structured dashboard layout for data visibility", "Sidebar navigation", "Content-focused main area", "Logical grouping of controls"],
    typography: ["Font: Inter", "Clear contrast between headings and body", "Avoid decorative fonts", "Optimized for accessibility"],
    iconography: ["Functional-first approach", "Monochrome icons", "Used only where they add clarity", "Paired with labels when necessary"],
    animation: ["Reinforce system feedback", "Button hover feedback", "Loading skeletons", "Fade-in content transitions"],
  },
  {
    name: "Minimal Tech Tool",
    colors: [
      { name: "Primary: Blue", hex: "#3498DB" },
      { name: "Neutral: White / Gray", hex: "#E5E7E9" },
      { name: "Background: Near-Black", hex: "#1B2631" },
    ],
    layout: ["Minimal UI that reduces cognitive load", "Large interactive areas", "Clear margins and padding", "Focused content zones"],
    typography: ["Font: Inter", "Consistent sizing scale", "High contrast for readability", "No font mixing"],
    iconography: ["Flat icons designed for clarity", "Action-based symbols", "No decorative elements", "Consistent alignment"],
    animation: ["Purpose-driven animations only", "Loading indicators", "State changes", "Respects reduced-motion settings"],
  }
];

const StyleGuideCard = ({ theme, onUseStyle }: { theme: StyleTheme, onUseStyle: (themeName: string) => void }) => {
  return (
    <Card className="bg-gray-800 text-white border-gray-700 flex flex-col">
      <CardHeader>
        <CardTitle className="text-xl font-bold tracking-wider uppercase">{theme.name}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6 flex-1">
        <div className="flex items-start gap-4">
          <Paintbrush className="h-5 w-5 text-gray-400 mt-1" />
          <div>
            <h3 className="font-semibold text-lg">Color</h3>
            <p className="text-sm text-gray-400 mb-2">Primary palette uses cool blues and neutral grays to ensure clarity and trust.</p>
            <div className="flex flex-wrap items-center gap-2 mt-1">
              {theme.colors.map((color, index) => (
                <div key={index} className="flex items-center gap-2">
                    <div
                      className="h-6 w-6 rounded-full border-2 border-gray-600"
                      style={{ backgroundColor: color.hex }}
                    />
                    <span className="text-xs text-gray-300">{color.name}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <Rows className="h-5 w-5 text-gray-400 mt-1" />
          <div>
            <h3 className="font-semibold text-lg">Layout</h3>
             <ul className="text-sm text-gray-300 mt-1 list-disc pl-5 space-y-1">
                {theme.layout.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <Type className="h-5 w-5 text-gray-400 mt-1" />
          <div>
            <h3 className="font-semibold text-lg">Typography</h3>
            <ul className="text-sm text-gray-300 mt-1 list-disc pl-5 space-y-1">
                {theme.typography.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <Shapes className="h-5 w-5 text-gray-400 mt-1" />
          <div>
            <h3 className="font-semibold text-lg">Iconography</h3>
            <ul className="text-sm text-gray-300 mt-1 list-disc pl-5 space-y-1">
                {theme.iconography.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        </div>

        <div className="flex items-start gap-4">
          <PlaySquare className="h-5 w-5 text-gray-400 mt-1" />
          <div>
            <h3 className="font-semibold text-lg">Animation</h3>
            <ul className="text-sm text-gray-300 mt-1 list-disc pl-5 space-y-1">
                {theme.animation.map((item, i) => <li key={i}>{item}</li>)}
            </ul>
          </div>
        </div>
      </CardContent>
      <div className="p-6 mt-auto">
        <Button className="w-full bg-blue-600 hover:bg-blue-700 text-white" onClick={() => onUseStyle(theme.name)}>
            <Check className="mr-2"/> Use Style
        </Button>
      </div>
    </Card>
  );
};


export default function StyleGuidePage() {
  const { toast } = useToast();

  const handleSetTheme = (themeName: string) => {
      toast({
        title: "Theme Selected",
        description: `You've selected the "${themeName}" theme. I will now apply this style to the project in the next step.`,
      });
      // In a real app, this would trigger the CSS change.
      // Here, it just notifies the user what will happen next.
  }

  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Style Guide Samples</h1>
      <p className="text-muted-foreground">Review the different theme directions below. When you're ready, click "Use Style" on your preferred theme, and I'll update the entire application's appearance.</p>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {themes.map(theme => (
            <StyleGuideCard key={theme.name} theme={theme} onUseStyle={handleSetTheme} />
        ))}
      </div>
    </div>
  );
}
