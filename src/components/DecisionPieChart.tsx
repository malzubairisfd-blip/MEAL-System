"use client";

import React from 'react';
import { PieSeries, AccumulationChartComponent, AccumulationDataLabel, Inject, AccumulationTooltip } from '@syncfusion/ej2-react-charts';

interface ChartData {
    x: string;
    y: number;
    text: string;
    fill: string;
}

interface DecisionPieChartProps {
    data: ChartData[];
}

export const DecisionPieChart: React.FC<DecisionPieChartProps> = ({ data }) => {
    if (!data || data.length === 0) {
        return <div className="text-center text-muted-foreground py-10">No data available to display chart.</div>;
    }

    return (
        <AccumulationChartComponent
            id="decision-pie-chart"
            enableSmartLabels={true}
            tooltip={{ enable: true, format: '${point.x}: <b>${point.y} (${point.text})</b>' }}
            legendSettings={{ visible: false }}
        >
            <Inject services={[PieSeries, AccumulationDataLabel, AccumulationTooltip]} />
            <PieSeries
                dataSource={data}
                xName="x"
                yName="y"
                innerRadius="40%"
                dataLabel={{
                    visible: true,
                    position: 'Inside',
                    name: 'text',
                    font: {
                        fontWeight: '600',
                        color: '#ffffff'
                    }
                }}
                pointColorMapping='fill'
            />
        </AccumulationChartComponent>
    );
};
