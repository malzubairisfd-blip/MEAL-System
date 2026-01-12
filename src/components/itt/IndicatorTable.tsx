// src/components/itt/IndicatorTable.tsx
import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Logframe } from '@/lib/logframe';
import { IndicatorTrackingPlan } from '@/types/monitoring-indicators';
import { IndicatorRow } from './IndicatorRow';

interface GroupedData {
    [outcome: string]: {
        [output: string]: any[]
    }
}

export function IndicatorTable({ logframe, indicatorPlan }: { logframe: Logframe | null, indicatorPlan: IndicatorTrackingPlan | null }) {
    
    const groupedIndicators = useMemo(() => {
        if (!logframe || !indicatorPlan) return {};

        const planMap = new Map(indicatorPlan.indicators.map(ind => [ind.indicatorId, ind]));
        
        const groups: GroupedData = {};

        logframe.outputs.forEach(output => {
            output.activities.forEach(activity => {
                 activity.indicators.forEach(logframeIndicator => {
                    const planIndicator = planMap.get(logframeIndicator.description);
                    if (planIndicator) {
                        
                        const outcomeKey = logframe.outcome.description;
                        const outputKey = output.description;

                        if (!groups[outcomeKey]) groups[outcomeKey] = {};
                        if (!groups[outcomeKey][outputKey]) groups[outcomeKey][outputKey] = [];
                        
                        groups[outcomeKey][outputKey].push(planIndicator);
                    }
                });
            });
        });
        
        return groups;

    }, [logframe, indicatorPlan]);

    if (!logframe || !indicatorPlan) {
        return (
             <Card className="mt-6">
                <CardHeader><CardTitle>Indicator Details</CardTitle></CardHeader>
                <CardContent className="text-center text-muted-foreground p-10">
                    <p>No logframe or indicator plan loaded for the selected project.</p>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader>
                <CardTitle>{logframe.goal.description}</CardTitle>
            </CardHeader>
            <CardContent>
                 <div className="border rounded-lg overflow-x-auto">
                    <Table className="min-w-full divide-y divide-border">
                        <TableHeader>
                            <TableRow>
                                <TableHead className="w-[200px]">Indicator</TableHead>
                                <TableHead>Code</TableHead>
                                <TableHead>Type</TableHead>
                                <TableHead>Date</TableHead>
                                <TableHead>LoP Target</TableHead>
                                <TableHead>LoP Actual</TableHead>
                                <TableHead>% of LoP</TableHead>
                                <TableHead>Annual Target</TableHead>
                                <TableHead>YTD Actual</TableHead>
                                <TableHead>% of Annual</TableHead>
                                <TableHead>Q1 Target</TableHead>
                                <TableHead>Q1 Actual</TableHead>
                                <TableHead>Q1 %</TableHead>
                                <TableHead>Q2 Target</TableHead>
                                <TableHead>Q2 Actual</TableHead>
                                <TableHead>Q2 %</TableHead>
                                <TableHead>Q3 Target</TableHead>
                                <TableHead>Q3 Actual</TableHead>
                                <TableHead>Q3 %</TableHead>
                                <TableHead>Q4 Target</TableHead>
                                <TableHead>Q4 Actual</TableHead>
                                <TableHead>Q4 %</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {Object.entries(groupedIndicators).map(([outcome, outputs]) => (
                                <React.Fragment key={outcome}>
                                    <TableRow className="bg-secondary/10">
                                        <TableCell colSpan={22} className="font-bold text-secondary-foreground">{outcome}</TableCell>
                                    </TableRow>
                                    {Object.entries(outputs).map(([output, indicators]) => (
                                         <React.Fragment key={output}>
                                             <TableRow className="bg-muted/50">
                                                <TableCell colSpan={22} className="font-semibold pl-8">{output}</TableCell>
                                            </TableRow>
                                            {indicators.map(indicator => (
                                                <IndicatorRow key={indicator.indicatorId} indicator={indicator} />
                                            ))}
                                         </React.Fragment>
                                    ))}
                                </React.Fragment>
                            ))}
                        </TableBody>
                    </Table>
                </div>
            </CardContent>
        </Card>
    );
}
