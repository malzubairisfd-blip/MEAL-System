// src/components/itt/IndicatorRow.tsx
import React, { useMemo } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { ITTIndicator, calculateLoPActual, calculateYearToDateActual, calculatePercentage } from '@/lib/itt-calculations';

export function IndicatorRow({ indicator }: { indicator: ITTIndicator }) {
    
    const lopTarget = useMemo(() => indicator.units?.reduce((sum, unit) => sum + (unit.targeted || 0), 0) || 0, [indicator.units]);
    const annualTarget = lopTarget; // Assuming annual is same as LoP for this case

    const lopActual = useMemo(() => calculateLoPActual(indicator), [indicator]);
    const ytdActual = useMemo(() => calculateYearToDateActual(indicator), [indicator]);
    
    const lopPercentage = useMemo(() => calculatePercentage(lopActual, lopTarget), [lopActual, lopTarget]);
    const annualPercentage = useMemo(() => calculatePercentage(ytdActual, annualTarget), [ytdActual, annualTarget]);

    const q1Percentage = useMemo(() => calculatePercentage(indicator.q1Actual, indicator.q1Target), [indicator.q1Actual, indicator.q1Target]);
    const q2Percentage = useMemo(() => calculatePercentage(indicator.q2Actual, indicator.q2Target), [indicator.q2Actual, indicator.q2Target]);
    const q3Percentage = useMemo(() => calculatePercentage(indicator.q3Actual, indicator.q3Target), [indicator.q3Actual, indicator.q3Target]);
    const q4Percentage = useMemo(() => calculatePercentage(indicator.q4Actual, indicator.q4Target), [indicator.q4Actual, indicator.q4Target]);


    return (
        <TableRow>
            <TableCell className="font-medium pl-12">{indicator.indicatorId}</TableCell>
            <TableCell>{indicator.indicatorCode}</TableCell>
            <TableCell>{indicator.type}</TableCell>
            <TableCell>{indicator.endDate ? new Date(indicator.endDate).toLocaleDateString() : 'N/A'}</TableCell>
            <TableCell>{lopTarget}</TableCell>
            <TableCell>{lopActual}</TableCell>
            <TableCell>{lopPercentage.toFixed(2)}%</TableCell>
            <TableCell>{annualTarget}</TableCell>
            <TableCell>{ytdActual}</TableCell>
            <TableCell>{annualPercentage.toFixed(2)}%</TableCell>
            <TableCell>{indicator.q1Target || '-'}</TableCell>
            <TableCell>{indicator.q1Actual || '-'}</TableCell>
            <TableCell>{q1Percentage.toFixed(2)}%</TableCell>
            <TableCell>{indicator.q2Target || '-'}</TableCell>
            <TableCell>{indicator.q2Actual || '-'}</TableCell>
            <TableCell>{q2Percentage.toFixed(2)}%</TableCell>
            <TableCell>{indicator.q3Target || '-'}</TableCell>
            <TableCell>{indicator.q3Actual || '-'}</TableCell>
            <TableCell>{q3Percentage.toFixed(2)}%</TableCell>
            <TableCell>{indicator.q4Target || '-'}</TableCell>
            <TableCell>{indicator.q4Actual || '-'}</TableCell>
            <TableCell>{q4Percentage.toFixed(2)}%</TableCell>
        </TableRow>
    );
}
