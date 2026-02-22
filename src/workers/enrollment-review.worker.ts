// src/workers/enrollment-review.worker.ts
import { openDB } from 'idb';
import { normalizeArabicWithCompounds, calculateAdvancedNameSimilarity, getModificationLevel } from '@/lib/name-engine';

const ENROLLMENT_CACHE_DB_NAME = 'enrollment-review-cache-db';
const ENROLLMENT_CACHE_STORE_NAME = 'files';
const ENROLLMENT_CACHE_KEY = 'enrollmentData';

self.onmessage = async (event) => {
    const { uniqueIdCol } = event.data;

    try {
        postMessage({ type: 'progress', status: 'Loading data from cache...', progress: 5 });
        const db = await openDB(ENROLLMENT_CACHE_DB_NAME, 1);
        const cachedData = await db.get(ENROLLMENT_CACHE_STORE_NAME, ENROLLMENT_CACHE_KEY);
        if (!cachedData || !Array.isArray(cachedData)) {
            throw new Error("No data found in cache. Please upload a file first.");
        }
        
        postMessage({ type: 'progress', status: 'Analyzing & Preparing Records for Cache...', progress: 10 });
        
        const totalRecords = cachedData.length;
        const processedRecords = cachedData.map((record: any, index: number) => {
            
            const newRecord = { ...record };

            // 1. Generate unique_id
            newRecord.unique_id = record[uniqueIdCol];

            // 2. Normalization
            const normalizedColumns = [
                'curr_bnf_1name', 'curr_bnf_2name', 'curr_bnf_3name', 'curr_bnf_4name', 'curr_bnf_5name',
                'curr_hsbnd_1name', 'curr_hsbnd_2name', 'curr_hsbnd_3name', 'curr_hsbnd_4name', 'curr_hsbnd_5name',
                'bnf_name', 'hsbnd_name', 'new_bnf_name', 'new_hsbnd_name',
                'correcting_the_first_name', 'correcting_the_fathers_name', 'correcting_the_grandfathers_name', 'correcting_the_fourth_name', 'correcting_the_title',
                'correcting_the_first_name_6', 'correcting_the_fathers_name_8', 'correcting_the_grandfathers_name_10', 'correcting_the_fourth_name_12', 'title_correction_14'
            ];
            normalizedColumns.forEach(col => {
                newRecord[`${col}_normalized`] = normalizeArabicWithCompounds(record[col]);
            });

            // 3. Difference Calculation
            const nameParts = [
                { key: 'bnf1', oldNameCol: 'curr_bnf_1name_normalized', newNameCol: 'correcting_the_first_name_normalized', flagCol: 'corrected_part_of_the_targets_namefirst_name' },
                { key: 'bnf2', oldNameCol: 'curr_bnf_2name_normalized', newNameCol: 'correcting_the_fathers_name_normalized', flagCol: 'the_corrected_part_of_the_targets_namefathers_name' },
                { key: 'bnf3', oldNameCol: 'curr_bnf_3name_normalized', newNameCol: 'correcting_the_grandfathers_name_normalized', flagCol: 'the_corrected_part_of_the_targets_namegrandfathers_name' },
                { key: 'bnf4', oldNameCol: 'curr_bnf_4name_normalized', newNameCol: 'correcting_the_fourth_name_normalized', flagCol: 'corrected_part_of_the_targets_namefourth_name' },
                { key: 'bnf5', oldNameCol: 'curr_bnf_5name_normalized', newNameCol: 'correcting_the_title_normalized', flagCol: 'corrected_part_of_the_targets_nametitle' },
                { key: 'hus1', oldNameCol: 'curr_hsbnd_1name_normalized', newNameCol: 'correcting_the_first_name_6_normalized', flagCol: 'corrected_part_of_husbands_namefirst_name' },
                { key: 'hus2', oldNameCol: 'curr_hsbnd_2name_normalized', newNameCol: 'correcting_the_fathers_name_8_normalized', flagCol: 'corrected_part_of_husbands_namefathers_name' },
                { key: 'hus3', oldNameCol: 'curr_hsbnd_3name_normalized', newNameCol: 'correcting_the_grandfathers_name_10_normalized', flagCol: 'the_corrected_part_of_the_husbands_namegrandfathers_name' },
                { key: 'hus4', oldNameCol: 'curr_hsbnd_4name_normalized', newNameCol: 'correcting_the_fourth_name_12_normalized', flagCol: 'corrected_part_of_husbands_namefourth_name' },
                { key: 'hus5', oldNameCol: 'curr_hsbnd_5name_normalized', newNameCol: 'title_correction_14_normalized', flagCol: 'corrected_part_of_husbands_namesurname' },
            ];
            
            nameParts.forEach(part => {
                if (Number(record[part.flagCol]) === 1) {
                    const scoreResult = calculateAdvancedNameSimilarity(newRecord[part.oldNameCol], newRecord[part.newNameCol]);
                    newRecord[`diff_per_${part.key}`] = scoreResult.totalScore;
                    newRecord[`diff_level_${part.key}`] = getModificationLevel(scoreResult.totalScore);
                }
            });

            // 4. Whole Name Difference & Details
            const bnfScoreResult = calculateAdvancedNameSimilarity(newRecord['bnf_name_normalized'], newRecord['new_bnf_name_normalized']);
            newRecord['diff_per_bnf'] = bnfScoreResult.totalScore;
            newRecord['diff_level_bnf'] = getModificationLevel(bnfScoreResult.totalScore);
            Object.assign(newRecord, bnfScoreResult.details);

            const husScoreResult = calculateAdvancedNameSimilarity(newRecord['hsbnd_name_normalized'], newRecord['new_hsbnd_name_normalized']);
            newRecord['diff_per_hus'] = husScoreResult.totalScore;
            newRecord['diff_level_hus'] = getModificationLevel(husScoreResult.totalScore);

            // 5. Placeholder for Similarity and Clustering
            newRecord.enroll_bnf_sim_score = null;
            newRecord.enroll_hsbnd_sim_score = null;
            newRecord.enroll_cluster_id = null;
            newRecord.branch_recommendation = '';
            newRecord.HQ_recommendation = '';
            newRecord.enroll_recom = '';

            return newRecord;
        });
        
        postMessage({ type: 'progress', status: 'Saving results to cache...', progress: 95 });
        await db.put(ENROLLMENT_CACHE_STORE_NAME, processedRecords, ENROLLMENT_CACHE_KEY);
        
        postMessage({ type: 'done' });

    } catch (e: any) {
        postMessage({ type: 'error', error: e.message || 'An unknown error occurred in the worker.' });
    }
};
