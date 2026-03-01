// src/workers/enrollment-review.worker.ts
import { normalizeArabicWithCompounds, calculateAdvancedNameSimilarity, getModificationLevel } from '@/lib/name-engine';

self.onmessage = async (event) => {
    const { uploadedData, lookupColumnFile, lookupColumnDb, allDbData, mapping, origin } = event.data;

    try {
        postMessage({ type: 'progress', status: 'Starting analysis...', progress: 5 });

        const dbDataMap = new Map(allDbData.map((row: any) => [String(row[lookupColumnDb]), row]));
        const totalRecords = uploadedData.length;

        const results = uploadedData.map((fileRow: any, index: number) => {
            const lookupValue = fileRow[lookupColumnFile];
            const dbRecord = dbDataMap.get(String(lookupValue));
            
            if (!dbRecord) return null; // Skip if no match in DB

            const updatedRecord = { ...dbRecord };
            
            // Apply mapped data from file to DB record
            for(const [fileCol, dbCol] of Object.entries(mapping)) {
                if(fileRow.hasOwnProperty(fileCol)) {
                    updatedRecord[dbCol as string] = fileRow[fileCol];
                }
            }

            // --- Name Difference Calculations ---
            const nameParts = [
                { key: 'bnf1', oldNameCol: 'bnf_1name', newNameCol: 'correcting_the_first_name', flagCol: 'corrected_part_of_the_targets_namefirst_name' },
                { key: 'bnf2', oldNameCol: 'bnf_2name', newNameCol: 'correcting_the_fathers_name', flagCol: 'the_corrected_part_of_the_targets_namefathers_name' },
                { key: 'bnf3', oldNameCol: 'bnf_3name', newNameCol: 'correcting_the_grandfathers_name', flagCol: 'the_corrected_part_of_the_targets_namegrandfathers_name' },
                { key: 'bnf4', oldNameCol: 'bnf_4name', newNameCol: 'correcting_the_fourth_name', flagCol: 'corrected_part_of_the_targets_namefourth_name' },
                { key: 'bnf5', oldNameCol: 'bnf_5name', newNameCol: 'correcting_the_title', flagCol: 'corrected_part_of_the_targets_nametitle' },
                { key: 'hus1', oldNameCol: 'hsbnd_1name', newNameCol: 'correcting_the_first_name_6', flagCol: 'corrected_part_of_husbands_namefirst_name' },
                { key: 'hus2', oldNameCol: 'hsbnd_2name', newNameCol: 'correcting_the_fathers_name_8', flagCol: 'corrected_part_of_husbands_namefathers_name' },
                { key: 'hus3', oldNameCol: 'hsbnd_3name', newNameCol: 'correcting_the_grandfathers_name_10', flagCol: 'the_corrected_part_of_the_husbands_namegrandfathers_name' },
                { key: 'hus4', oldNameCol: 'hsbnd_4name', newNameCol: 'correcting_the_fourth_name_12', flagCol: 'corrected_part_of_husbands_namefourth_name' },
                { key: 'hus5', oldNameCol: 'hsbnd_5name', newNameCol: 'title_correction_14', flagCol: 'corrected_part_of_husbands_namesurname' },
            ];

            nameParts.forEach(part => {
                if (Number(updatedRecord[part.flagCol]) === 1) {
                    const scoreResult = calculateAdvancedNameSimilarity(updatedRecord[part.oldNameCol], updatedRecord[part.newNameCol]);
                    updatedRecord[`diff_per_${part.key}`] = scoreResult.totalScore;
                    updatedRecord[`diff_level_${part.key}`] = getModificationLevel(scoreResult.totalScore);
                }
            });

            // --- Whole Name Difference ---
            const bnfScoreResult = calculateAdvancedNameSimilarity(updatedRecord['l_benef_name'], updatedRecord['new_bnf_name']);
            updatedRecord['diff_per_bnf'] = bnfScoreResult.totalScore;
            updatedRecord['diff_level_bnf'] = getModificationLevel(bnfScoreResult.totalScore);
            
            const husScoreResult = calculateAdvancedNameSimilarity(updatedRecord['l_hsbnd_name'], updatedRecord['new_hsbnd_name']);
            updatedRecord['diff_per_hus'] = husScoreResult.totalScore;
            updatedRecord['diff_level_hus'] = getModificationLevel(husScoreResult.totalScore);
            
            // --- Similarity Score ---
            updatedRecord['enroll_sim_score'] = 0; // Placeholder for now

            postMessage({ type: 'progress', status: `Processing record ${index + 1}...`, progress: 10 + ((index + 1) / totalRecords) * 80 });
            
            return updatedRecord;

        }).filter(Boolean); // Filter out nulls

        // --- Save to DB ---
        postMessage({ type: 'progress', status: 'Saving results to database...', progress: 95 });

        const saveResponse = await fetch(`${origin}/api/bnf-assessed`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: "save", records: results, uniqueIdDbCol: lookupColumnDb, projectId: 'N/A' })
        });
        
        if (!saveResponse.ok) {
            const error = await saveResponse.json();
            throw new Error(`Failed to save uploaded data: ${error.details || error.error}`);
        }

        postMessage({ type: 'done', data: { processed: results.length } });

    } catch (e: any) {
        postMessage({ type: 'error', error: e.message || 'An unknown error occurred.' });
    }
};
