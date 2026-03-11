// src/app/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/confirmation/entry/page.tsx
"use client";

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { ArrowLeft } from 'lucide-react';
import { UnderConstructionPage } from '@/components/under-construction-page';

export default function ConfirmationDataEntryPage() {
  return (
    <div className="space-y-4">
       <div className="flex justify-end">
         <Button variant="outline" asChild>
           <Link href="/meal-system/monitoring/implementation/process/CMAM-cases/beneficiaries/confirmation">
             <ArrowLeft className="mr-2 h-4 w-4" />
             Back to Confirmation Hub
           </Link>
         </Button>
       </div>
      <UnderConstructionPage title="Confirmation Malnutrition Results Data Entry" />
    </div>
  );
}
