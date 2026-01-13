
// src/components/itt/IndicatorRow.tsx
import React, { useMemo } from 'react';
import { TableCell, TableRow } from '@/components/ui/table';
import { ITTIndicator, calculateLoPActual, calculateYearToDateActual, calculatePercentage } from '@/lib/itt-calculations';

export function IndicatorRow({ indicator }: { indicator: ITTIndicator }) {
    
    const lopActual = useMemo(() => calculateLoPActual(indicator), [indicator]);
    const ytdActual = useMemo(() => calculateYearToDateActual(indicator), [indicator]);
    
    const lopPercentage = useMemo(() => calculatePercentage(lopActual, indicator.lopTarget), [lopActual, indicator.lopTarget]);
    const annualPercentage = useMemo(() => calculatePercentage(ytdActual, indicator.annualTarget), [ytdActual, indicator.annualTarget]);

    const q1Percentage = useMemo(() => calculatePercentage(indicator.q1Actual, indicator.q1Target), [indicator.q1Actual, indicator.q1Target]);
    const q2Percentage = useMemo(() => calculatePercentage(indicator.q2Actual, indicator.q2Target), [indicator.q2Actual, indicator.q2Target]);
    const q3Percentage = useMemo(() => calculatePercentage(indicator.q3Actual, indicator.q3Target), [indicator.q3Actual, indicator.q3Target]);
    const q4Percentage = useMemo(() => calculatePercentage(indicator.q4Actual, indicator.q4Target), [indicator.q4Actual, indicator.q4Target]);


    return (
        <React.Fragment>
            {(indicator.units && indicator.units.length > 0) ? indicator.units.map((unit, index) => (
                <TableRow key={`${indicator.indicatorId}-${unit.unit}-${index}`}>
                    {index === 0 && <TableCell rowSpan={indicator.units.length} className="font-medium pl-12 align-top">{indicator.indicatorId}</TableCell>}
                    {index === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{indicator.indicatorCode}</TableCell>}
                    <TableCell>{unit.unit}</TableCell>
                    {index === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{indicator.type}</TableCell>}
                    {index === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{indicator.endDate ? new Date(indicator.endDate).toLocaleDateString() : 'N/A'}</TableCell>}
                    
                    {/* Display target per unit */}
                    <TableCell>{indicator.type === '%' ? `${unit.targeted}%` : unit.targeted}</TableCell>

                    {index === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{indicator.type === '%' ? `${lopActual}%` : lopActual}</TableCell>}
                    {index === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{lopPercentage.toFixed(2)}%</TableCell>}
                    {index === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{indicator.type === '%' ? `${indicator.annualTarget}%` : indicator.annualTarget}</TableCell>}
                    {index === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{indicator.type === '%' ? `${ytdActual}%` : ytdActual}</TableCell>}
                    {index === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{annualPercentage.toFixed(2)}%</TableCell>}
                    {index === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{indicator.q1Target ? (indicator.type === '%' ? `${indicator.q1Target}%` : indicator.q1Target) : '-'}</TableCell>}
                    {index === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{indicator.q1Actual ? (indicator.type === '%' ? `${indicator.q1Actual}%` : indicator.q1Actual) : '-'}</TableCell>}
                    {index === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{q1Percentage.toFixed(2)}%</TableCell>}
                    {index === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{indicator.q2Target ? (indicator.type === '%' ? `${indicator.q2Target}%` : indicator.q2Target) : '-'}</TableCell>}
                    {index === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{indicator.q2Actual ? (indicator.type === '%' ? `${indicator.q2Actual}%` : indicator.q2Actual) : '-'}</TableCell>}
                    {index === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{q2Percentage.toFixed(2)}%</TableCell>}
                    {index === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{indicator.q3Target ? (indicator.type === '%' ? `${indicator.q3Target}%` : indicator.q3Target) : '-'}</TableCell>}
                    {index === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{indicator.q3Actual ? (indicator.type === '%' ? `${indicator.q3Actual}%` : indicator.q3Actual) : '-'}</TableCell>}
                    {index === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{q3Percentage.toFixed(2)}%</TableCell>}
                    {index === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{indicator.q4Target ? (indicator.type === '%' ? `${indicator.q4Target}%` : indicator.q4Target) : '-'}</TableCell>}
                    {index === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{indicator.q4Actual ? (indicator.type === '%' ? `${indicator.q4Actual}%` : indicator.q4Actual) : '-'}</TableCell>}
                    {index === 0 && <TableCell rowSpan={indicator.units.length} className="align-top">{q4Percentage.toFixed(2)}%</TableCell>}
                </TableRow>
            )) : (
                 <TableRow>
                    <TableCell className="font-medium pl-12">{indicator.indicatorId}</TableCell>
                    <TableCell>{indicator.indicatorCode}</TableCell>
                    <TableCell>N/A</TableCell>
                    <TableCell>{indicator.type}</TableCell>
                    <TableCell>{indicator.endDate ? new Date(indicator.endDate).toLocaleDateString() : 'N/A'}</TableCell>
                    <TableCell>{indicator.type === '%' ? `${indicator.lopTarget}%` : indicator.lopTarget}</TableCell>
                    <TableCell>{indicator.type === '%' ? `${lopActual}%` : lopActual}</TableCell>
                    <TableCell>{lopPercentage.toFixed(2)}%</TableCell>
                    <TableCell>{indicator.type === '%' ? `${indicator.annualTarget}%` : indicator.annualTarget}</TableCell>
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
            )}
        </React.Fragment>
    );
}

