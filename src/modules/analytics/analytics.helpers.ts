import { ElapsedTimeRow, ElapsedTimeReport, ElapsedTimeBucket } from './analytics.dto';

// ─── Hour buckets ──────────────────────────────────────────────────────────────
const HOUR_BUCKETS: { label: string; max: number }[] = [
    { label: '0-4h', max: 4 },
    { label: '4-24h', max: 24 },
    { label: '24-72h', max: 72 },
    { label: '72h+', max: Infinity },
];

// Day buckets (para /report-to-billing-time, unidade em dias)
const DAY_BUCKETS: { label: string; max: number }[] = [
    { label: '0-1d', max: 1 },
    { label: '1-3d', max: 3 },
    { label: '3-7d', max: 7 },
    { label: '7d+', max: Infinity },
];

type BucketUnit = 'hours' | 'days';

/**
 * Constrói o relatório ElapsedTimeReport a partir de rows já vindas da BD.
 * As estatísticas de summary são calculadas aqui em JS.
 * Os buckets são fixos (ver constantes acima).
 */
export function buildElapsedTimeReport(
    rows: ElapsedTimeRow[],
    unit: BucketUnit = 'hours'
): ElapsedTimeReport {
    const buckets = unit === 'days' ? DAY_BUCKETS : HOUR_BUCKETS;

    // Inicializar distribuição com zeros
    const distribution: ElapsedTimeBucket[] = buckets.map(b => ({ bucket: b.label, count: 0 }));

    if (rows.length === 0) {
        return {
            summary: { count: 0, avgHours: 0, medianHours: 0, minHours: 0, maxHours: 0, p90Hours: 0 },
            distribution,
            details: [],
        };
    }

    const values = rows.map(r => r.hoursElapsed).sort((a, b) => a - b);
    const count = values.length;
    const sum = values.reduce((acc, v) => acc + v, 0);
    const avg = sum / count;
    const min = values[0];
    const max = values[count - 1];

    // Median
    const midIdx = Math.floor(count / 2);
    const median = count % 2 === 0
        ? (values[midIdx - 1] + values[midIdx]) / 2
        : values[midIdx];

    // P90
    const p90Idx = Math.min(Math.ceil(count * 0.9) - 1, count - 1);
    const p90 = values[p90Idx];

    // Distribuição por buckets
    for (const row of rows) {
        const val = row.hoursElapsed;
        for (let i = 0; i < buckets.length; i++) {
            if (val < buckets[i].max || buckets[i].max === Infinity) {
                distribution[i].count++;
                break;
            }
        }
    }

    return {
        summary: {
            count,
            avgHours: parseFloat(avg.toFixed(2)),
            medianHours: parseFloat(median.toFixed(2)),
            minHours: parseFloat(min.toFixed(2)),
            maxHours: parseFloat(max.toFixed(2)),
            p90Hours: parseFloat(p90.toFixed(2)),
        },
        distribution,
        details: rows,
    };
}
