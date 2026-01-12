// src/lib/itt-calculations.ts

import type { Indicator } from '@/types/monitoring-indicators';

// The Indicator type from monitoring-indicators includes units with targets
export type ITTIndicator = Indicator & {
    q1Target?: number;
    q1Actual?: number;
    q2Target?: number;
    q2Actual?: number;
    q3Target?: number;
    q3Actual?: number;
    q4Target?: number;
    q4Actual?: number;
};

export const calculateLoPActual = (indicator: ITTIndicator): number => {
    const q1 = indicator.q1Actual || 0;
    const q2 = indicator.q2Actual || 0;
    const q3 = indicator.q3Actual || 0;
    const q4 = indicator.q4Actual || 0;

    if (indicator.type === '%') {
        if (q4 > 0) return q4;
        if (q3 > 0) return q3;
        if (q2 > 0) return q2;
        if (q1 > 0) return q1;
        return 0;
    }
    // For '#' type, it's cumulative
    return q1 + q2 + q3 + q4;
};

export const calculateYearToDateActual = (indicator: ITTIndicator): number => {
    // For this implementation, Year to Date is the same as Life of Project
    return calculateLoPActual(indicator);
};

export const calculatePercentage = (actual?: number, target?: number): number => {
    if (typeof actual !== 'number' || typeof target !== 'number' || target === 0) {
        return 0;
    }
    return (actual / target) * 100;
};
