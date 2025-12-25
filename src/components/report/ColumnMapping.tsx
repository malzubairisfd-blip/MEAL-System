
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle } from "lucide-react";

export const MAPPING_FIELDS = [
  "Government", "District", "Subdistrict",
  "Team Leaders", "Surveyor", "Registration days", "Village targeted", 
  "Household registered", "Household Gender", "Dislocated household", 
  "Household having dislocated guest", "Beneficiaries registered", 
  "Pregnant woman", "Mothers having a child under 5 years old",
  "Women have handicapped children from 5 to 17 years old",
  "Handicapped Woman", "Dislocated Woman",
  "Male Children", "Female Children"
];

interface ColumnMappingProps {
  columns: string[];
  mapping: Record<string, string>;
  onMappingChange: (mapping: Record<string, string>) => void;
}

export function ColumnMapping({ columns, mapping, onMappingChange }: ColumnMappingProps) {
  const handleMappingChange = (field: string, value: string) => {
    onMappingChange({ ...mapping, [field]: value });
  };

  return (
    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {MAPPING_FIELDS.map(field => (
        <Card key={field}>
          <CardHeader className="p-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                  {mapping[field] ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                  <Label htmlFor={field} className="font-semibold text-base">{field}</Label>
              </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-48 border-t">
              <RadioGroup value={mapping[field]} onValueChange={(v) => handleMappingChange(field, v)} className="p-4 grid grid-cols-2 gap-2">
                {columns.map(col => (
                  <div key={col} className="flex items-center space-x-2">
                    <RadioGroupItem value={col} id={`${field}-${col}`} />
                    <Label htmlFor={`${field}-${col}`} className="truncate font-normal" title={col}>{col}</Label>
                  </div>
                ))}
              </RadioGroup>
            </ScrollArea>
          </CardContent>
        </Card>
      ))}
    </CardContent>
  );
}
