
"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { ScrollArea } from "@/components/ui/scroll-area";
import { CheckCircle, XCircle } from "lucide-react";
import { useTranslation } from "@/hooks/use-translation";

export const MAPPING_FIELDS_KEYS = [
  "government", "district", "subdistrict",
  "teamLeaders", "surveyor", "registrationDays", "villageTargeted", 
  "householdRegistered", "householdGender", "dislocatedHousehold", 
  "householdWithGuest", "beneficiariesRegistered", 
  "pregnantWoman", "lactatingMother",
  "womanWithHandicappedChild",
  "handicappedWoman", "dislocatedWoman",
  "maleChildren", "femaleChildren"
];

interface ColumnMappingProps {
  columns: string[];
  mapping: Record<string, string>;
  onMappingChange: (mapping: Record<string, string>) => void;
}

export function ColumnMapping({ columns, mapping, onMappingChange }: ColumnMappingProps) {
  const { t } = useTranslation();
  const handleMappingChange = (field: string, value: string) => {
    onMappingChange({ ...mapping, [field]: value });
  };

  return (
    <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      {MAPPING_FIELDS_KEYS.map(fieldKey => (
        <Card key={fieldKey}>
          <CardHeader className="p-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                  {mapping[fieldKey] ? <CheckCircle className="h-5 w-5 text-green-500" /> : <XCircle className="h-5 w-5 text-red-500" />}
                  <Label htmlFor={fieldKey} className="font-semibold text-base">{t(`report.mapping.fields.${fieldKey}`)}</Label>
              </div>
          </CardHeader>
          <CardContent className="p-0">
            <ScrollArea className="h-48 border-t">
              <RadioGroup value={mapping[fieldKey]} onValueChange={(v) => handleMappingChange(fieldKey, v)} className="p-4 grid grid-cols-2 gap-2">
                {columns.map(col => (
                  <div key={col} className="flex items-center space-x-2">
                    <RadioGroupItem value={col} id={`${fieldKey}-${col}`} />
                    <Label htmlFor={`${fieldKey}-${col}`} className="truncate font-normal" title={col}>{col}</Label>
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
