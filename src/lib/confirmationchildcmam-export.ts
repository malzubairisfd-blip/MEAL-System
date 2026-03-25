// src/lib/confirmationchildcmam-export.ts

/**
 * This file is now deprecated. 
 * The PDF generation logic has been moved to a server-side API route 
 * at /api/child-cmam-confirmation-export/route.ts
 * to improve performance and reliability.
 */
import { saveAs } from 'file-saver';

export async function exportConfirmationPdfs(projectId: string, isSample: boolean = false): Promise<void> {
    const response = await fetch('/api/child-cmam-confirmation-export', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectId, isSample })
    });

    if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || 'PDF generation failed on the server.');
    }

    const blob = await response.blob();
    const fileName = isSample 
        ? `CMAM_Confirmation_Sample_${projectId}.pdf` 
        : `CMAM_Confirmations_${projectId}.zip`;
        
    saveAs(blob, fileName);
}
