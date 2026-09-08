import { z } from 'zod';

// ─── Helpers para arrays em query params (comma-separated ou multi-value) ──────

const commaSeparatedInts = z.string().transform(s =>
    s.split(',').map(v => parseInt(v.trim(), 10)).filter(n => !isNaN(n))
);

const commaSeparatedStrings = z.string().transform(s =>
    s.split(',').map(v => v.trim()).filter(Boolean)
);

// ─── Schema base com filtros comuns ────────────────────────────────────────────

export const baseAnalyticsSchema = z.object({
    query: z.object({
        startDate: z.string().min(1, 'startDate é obrigatório'),
        endDate: z.string().min(1, 'endDate é obrigatório'),
        clientIds: z.union([commaSeparatedInts, z.array(z.coerce.number())]).optional(),
        technicianIds: z.union([commaSeparatedStrings, z.array(z.string())]).optional(),
        equipmentCategory: z.string().optional(),
        serviceTypes: z.union([commaSeparatedStrings, z.array(z.string())]).optional(),
    }),
});

// ─── /parts-usage ─────────────────────────────────────────────────────────────

export const partsUsageSchema = baseAnalyticsSchema;

// ─── /equipment-avg-hours ─────────────────────────────────────────────────────

export const equipmentAvgHoursSchema = z.object({
    query: baseAnalyticsSchema.shape.query
        .omit({ equipmentCategory: true })
        .extend({ orderBy: z.enum(['total', 'avg']).default('total') }),
});

// ─── /hours-by-client ─────────────────────────────────────────────────────────

export const hoursByClientSchema = baseAnalyticsSchema;

// ─── /hours-by-technician ─────────────────────────────────────────────────────

export const hoursByTechnicianSchema = baseAnalyticsSchema;

// ─── /service-type-breakdown ──────────────────────────────────────────────────

export const serviceTypeBreakdownSchema = z.object({
    query: baseAnalyticsSchema.shape.query
        .extend({ metric: z.enum(['hours', 'count']).default('count') }),
});

// ─── /summary ─────────────────────────────────────────────────────────────────

export const summarySchema = z.object({
    query: z.object({
        startDate: z.string().min(1, 'startDate é obrigatório'),
        endDate: z.string().min(1, 'endDate é obrigatório'),
    }),
});

// ─── /equipment-maintenance-gap ───────────────────────────────────────────────

export const maintenanceGapSchema = z.object({
    query: z.object({
        months: z.coerce.number().int().positive('months é obrigatório e deve ser positivo'),
    }),
});

// ─── /equipment-service-frequency ────────────────────────────────────────────

export const serviceFrequencySchema = z.object({
    query: z.object({
        serviceType: z.string().min(1, 'serviceType é obrigatório'),
        months: z.coerce.number().int().positive('months é obrigatório e deve ser positivo'),
    }),
});

// ─── /equipment-hours ─────────────────────────────────────────────────────────

export const equipmentHoursSchema = z.object({
    query: baseAnalyticsSchema.shape.query.omit({ equipmentCategory: true }),
});

// ─── /technician-hours-trend ──────────────────────────────────────────────────

export const technicianHoursTrendSchema = z.object({
    query: z.object({
        startDate: z.string().min(1, 'startDate é obrigatório'),
        endDate: z.string().min(1, 'endDate é obrigatório'),
        granularity: z.enum(['month', 'week']).default('month'),
    }),
});

// ─── /classification-breakdown ────────────────────────────────────────────────

export const classificationBreakdownSchema = z.object({
    query: baseAnalyticsSchema.shape.query
        .extend({ metric: z.enum(['hours', 'count']).default('count') }),
});

// ─── Endpoints com startDate/endDate simples (v_ticket_lifecycle) ─────────────

export const dateRangeSchema = z.object({
    query: z.object({
        startDate: z.string().min(1, 'startDate é obrigatório'),
        endDate: z.string().min(1, 'endDate é obrigatório'),
    }),
});

// ─── /top-clients-parts-cost ─────────────────────────────────────────────────

export const topClientsCostSchema = z.object({
    query: baseAnalyticsSchema.shape.query
        .omit({ equipmentCategory: true })
        .extend({
            classifications: z.union([commaSeparatedStrings, z.array(z.string())]).optional(),
        }),
});

// ─── /yearly-trend ────────────────────────────────────────────────────────────

export const yearlyTrendSchema = z.object({
    query: z.object({
        startDate: z.string().min(1, 'startDate é obrigatório'),
        endDate: z.string().min(1, 'endDate é obrigatório'),
        granularity: z.enum(['week', 'month', 'quarter']).default('month'),
    }),
});
