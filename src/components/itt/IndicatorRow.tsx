
// src/components/itt/IndicatorRow.tsx
import React, { useMemo } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { ITTIndicator, calculateLoPActual, calculateYearToDateActual, calculatePercentage } from '@/lib/itt-calculations';

export function IndicatorRow({ indicator }: { indicator: ITTIndicator }) {
    
    // Correctly use the lopTarget from the indicator object itself
    const lopTarget = useMemo(() => indicator.lopTarget || 0, [indicator.lopTarget]);
    const annualTarget = useMemo(() => indicator.annualTarget || 0, [indicator.annualTarget]); // Use annual target if available

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
            <TableCell>{indicator.type === '%' ? `${lopTarget}%` : lopTarget}</TableCell>
            <TableCell>{indicator.type === '%' ? `${lopActual}%` : lopActual}</TableCell>
            <TableCell>{lopPercentage.toFixed(2)}%</TableCell>
            <TableCell>{indicator.type === '%' ? `${annualTarget}%` : annualTarget}</TableCell>
            <TableCell>{indicator.type === '%' ? `${ytdActual}%` : ytdActual}</TableCell>
            <TableCell>{annualPercentage.toFixed(2)}%</TableCell>
            <TableCell>{indicator.q1Target ? (indicator.type === '%' ? `${indicator.q1Target}%` : indicator.q1Target) : '-'}</TableCell>
            <TableCell>{indicator.q1Actual ? (indicator.type === '%' ? `${indicator.q1Actual}%` : indicator.q1Actual) : '-'}</TableCell>
            <TableCell>{q1Percentage.toFixed(2)}%</TableCell>
            <TableCell>{indicator.q2Target ? (indicator.type === '%' ? `${indicator.q2Target}%` : indicator.q2Target) : '-'}</TableCell>
            <TableCell>{indicator.q2Actual ? (indicator.type === '%' ? `${indicator.q2Actual}%` : indicator.q2Actual) : '-'}</TableCell>
            <TableCell>{q2Percentage.toFixed(2)}%</TableCell>
            <TableCell>{indicator.q3Target ? (indicator.type === '%' ? `${indicator.q3Target}%` : indicator.q3Target) : '-'}</TableCell>
            <TableCell>{indicator.q3Actual ? (indicator.type === '%' ? `${indicator.q3Actual}%` : indicator.q3Actual) : '-'}</TableCell>
            <TableCell>{q3Percentage.toFixed(2)}%</TableCell>
            <TableCell>{indicator.q4Target ? (indicator.type === '%' ? `${indicator.q4Target}%` : indicator.q4Target) : '-'}</TableCell>
            <TableCell>{indicator.q4Actual ? (indicator.type === '%' ? `${indicator.q4Actual}%` : indicator.q4Actual) : '-'}</TableCell>
            <TableCell>{q4Percentage.toFixed(2)}%</TableCell>
        </TableRow>
    );
}

