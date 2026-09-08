import { Pool } from 'pg';
import { GroupedMetricResult } from './analytics.dto';

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface BaseReportFilters {
    startDate: string;
    endDate: string;
    clientIds?: number[];
    technicianIds?: string[];
    equipmentCategory?: string;
    serviceTypes?: string[];
    classifications?: string[];
}

export type GroupDimension = 'client' | 'technician' | 'equipment' | 'serviceType' | 'classification';
export type GroupMetric = 'hours' | 'count';

interface WhereResult {
    whereClause: string;
    params: any[];
    joinClause: string;
}

// ─── Whitelist de dimensões ────────────────────────────────────────────────────

const DIMENSION_MAP: Record<
    GroupDimension,
    {
        selectCols: string;
        groupByCols: string;
        joinClause: string;
        keyCol: string;
        labelExpr: string;
        fromExtra?: string;
    }
> = {
    client: {
        selectCols: 'c.id as "groupKey", c.name as "groupLabel"',
        groupByCols: 'c.id, c.name',
        joinClause: 'JOIN clients c ON r."clientId" = c.id',
        keyCol: 'c.id',
        labelExpr: 'c.name',
    },
    technician: {
        selectCols: 'p.id as "groupKey", CONCAT(p.first_name, \' \', p.last_name) as "groupLabel"',
        groupByCols: 'p.id, p.first_name, p.last_name',
        joinClause: 'JOIN report_technicians rt ON rt."reportId" = r.id JOIN profiles p ON rt."technicianId" = p.id',
        keyCol: 'p.id',
        labelExpr: "CONCAT(p.first_name, ' ', p.last_name)",
    },
    equipment: {
        selectCols: "CONCAT(e.brand, ' ', e.model) as \"groupKey\", CONCAT(e.brand, ' ', e.model) as \"groupLabel\"",
        groupByCols: 'e.brand, e.model',
        joinClause: 'JOIN equipments e ON r."equipmentId" = e.id',
        keyCol: "CONCAT(e.brand, ' ', e.model)",
        labelExpr: "CONCAT(e.brand, ' ', e.model)",
    },
    serviceType: {
        selectCols: 'service_type as "groupKey", service_type as "groupLabel"',
        groupByCols: 'service_type',
        joinClause: '',
        fromExtra: 'CROSS JOIN LATERAL jsonb_array_elements_text(CASE WHEN r."serviceType" IS NOT NULL AND jsonb_typeof(r."serviceType"::jsonb) = \'array\' THEN r."serviceType"::jsonb WHEN r."serviceType" IS NOT NULL THEN jsonb_build_array(r."serviceType"::text) ELSE \'[]\'::jsonb END) as service_type',
        keyCol: 'service_type',
        labelExpr: 'service_type',
    },
    classification: {
        selectCols: 'r.classification as "groupKey", r.classification as "groupLabel"',
        groupByCols: 'r.classification',
        joinClause: '',
        keyCol: 'r.classification',
        labelExpr: 'r.classification',
    },
};

// ─── buildBaseReportFilter ─────────────────────────────────────────────────────

function buildBaseReportFilter(filters: BaseReportFilters): WhereResult {
    const conditions: string[] = ['r.deleted_at IS NULL'];
    const params: any[] = [];
    let idx = 1;
    const joins: string[] = [];

    // Date range
    conditions.push(`r."serviceDate" >= $${idx++}`);
    params.push(filters.startDate);
    conditions.push(`r."serviceDate" <= $${idx++}`);
    params.push(filters.endDate);

    // clientIds
    if (filters.clientIds && filters.clientIds.length > 0) {
        conditions.push(`r."clientId" = ANY($${idx++})`);
        params.push(filters.clientIds);
    }

    // technicianIds — via EXISTS subquery
    if (filters.technicianIds && filters.technicianIds.length > 0) {
        conditions.push(
            `EXISTS (SELECT 1 FROM report_technicians rt_sub WHERE rt_sub."reportId" = r.id AND rt_sub."technicianId"::text = ANY($${idx++}))`
        );
        params.push(filters.technicianIds);
    }

    // equipmentCategory
    if (filters.equipmentCategory) {
        joins.push('LEFT JOIN equipments e ON r."equipmentId" = e.id');
        conditions.push(`e.category = $${idx++}`);
        params.push(filters.equipmentCategory);
    }

    // serviceTypes
    if (filters.serviceTypes && filters.serviceTypes.length > 0) {
        conditions.push(`r."serviceType"::jsonb ?| $${idx++}::text[]`);
        params.push(filters.serviceTypes);
    }

    // classifications
    if (filters.classifications && filters.classifications.length > 0) {
        conditions.push(`r.classification = ANY($${idx++})`);
        params.push(filters.classifications);
    }

    return {
        whereClause: `WHERE ${conditions.join(' AND ')}`,
        params,
        joinClause: joins.join(' '),
    };
}

// ─── AnalyticsRepository ──────────────────────────────────────────────────────

export class AnalyticsRepository {
    constructor(private pool: Pool) {}

    /**
     * Agrupamento genérico por dimensão e métrica.
     * Aplica regra 1 (horas por técnico = hours/N) quando dimension='technician'.
     */
    async getGroupedMetric(
        dimension: GroupDimension,
        metric: GroupMetric,
        filters: BaseReportFilters
    ): Promise<GroupedMetricResult[]> {
        const dim = DIMENSION_MAP[dimension];
        const filter = buildBaseReportFilter(filters);

        let metricExpr: string;
        if (metric === 'count') {
            metricExpr = 'COUNT(DISTINCT r.id)';
        } else if (dimension === 'technician') {
            // Regra 1: SUM(hours / N técnicos do relatório)
            metricExpr = `SUM(r.hours / NULLIF(tc.cnt, 0))`;
        } else {
            metricExpr = 'SUM(r.hours)';
        }

        // Para technician+hours precisamos de subquery com contagem de técnicos por relatório
        const techCountJoin =
            dimension === 'technician' && metric === 'hours'
                ? `JOIN (SELECT "reportId", COUNT(*) as cnt FROM report_technicians GROUP BY "reportId") tc ON tc."reportId" = r.id`
                : '';

        const fromExtra = dim.fromExtra ?? '';
        const clientJoin = dimension === 'client' ? '' : 'LEFT JOIN clients c ON r."clientId" = c.id';
        const equipmentJoin = (dimension === 'equipment' || filters.equipmentCategory) ? '' : 'LEFT JOIN equipments e ON r."equipmentId" = e.id';

        const sql = `
            SELECT
                ${dim.selectCols},
                ${metricExpr}::numeric as value,
                COUNT(DISTINCT r.id)::int as "reportCount",
                json_agg(
                    DISTINCT jsonb_build_object(
                        'id', r.id,
                        'reportNumber', r.report_number,
                        'serviceDate', r."serviceDate",
                        'clientName', COALESCE(c.name, '—'),
                        'equipmentName', COALESCE(CONCAT(e.brand, ' ', e.model), '—'),
                        'technicians', COALESCE((
                            SELECT json_agg(CONCAT(p_t.first_name, ' ', p_t.last_name))
                            FROM report_technicians rt_t
                            JOIN profiles p_t ON rt_t."technicianId" = p_t.id
                            WHERE rt_t."reportId" = r.id
                        ), '[]'::json),
                        'hours', r.hours,
                        'classification', r.classification
                    )
                ) as reports
            FROM reports r ${fromExtra}
            ${dim.joinClause}
            ${clientJoin}
            ${equipmentJoin}
            ${techCountJoin}
            ${filter.joinClause}
            ${filter.whereClause}
            GROUP BY ${dim.groupByCols}
            ORDER BY value DESC
            LIMIT 1000
        `;

        const { rows } = await this.pool.query(sql, filter.params);
        return rows.map(r => ({
            groupKey: r.groupKey,
            groupLabel: r.groupLabel,
            value: parseFloat(r.value) || 0,
            reportCount: r.reportCount,
            reports: Array.isArray(r.reports) ? r.reports.sort((a: any, b: any) => (b.serviceDate || '').localeCompare(a.serviceDate || '')) : [],
        }));
    }

    // ─── /parts-usage ────────────────────────────────────────────────────────────

    async getPartsUsage(filters: BaseReportFilters) {
        const filter = buildBaseReportFilter(filters);

        const sql = `
            SELECT
                p.id as "partId",
                p.reference as "partReference",
                p.designation as "partDesignation",
                SUM(rp.quantity)::numeric as "totalQuantity"
            FROM report_parts rp
            JOIN parts p ON rp."partId" = p.id
            JOIN reports r ON rp."reportId" = r.id
            ${filter.joinClause}
            ${filter.whereClause}
            GROUP BY p.id, p.reference, p.designation
            ORDER BY "totalQuantity" DESC
            LIMIT 1000
        `;

        const { rows } = await this.pool.query(sql, filter.params);
        return rows.map(r => ({
            ...r,
            totalQuantity: parseFloat(r.totalQuantity) || 0,
        }));
    }

    // ─── /summary ────────────────────────────────────────────────────────────────

    async getSummary(startDate: string, endDate: string) {
        const sql = `
            SELECT
                (SELECT COUNT(*) FROM reports r WHERE r.deleted_at IS NULL AND r."serviceDate" >= $1 AND r."serviceDate" <= $2)::int as "totalReports",
                (SELECT COALESCE(SUM(r.hours), 0) FROM reports r WHERE r.deleted_at IS NULL AND r."serviceDate" >= $1 AND r."serviceDate" <= $2)::numeric as "totalHours",
                (SELECT COUNT(*) FROM tickets WHERE status NOT IN ('closed', 'deleted') AND "createdAt" >= $1 AND "createdAt" <= $2)::int as "openTickets",
                (SELECT COUNT(*) FROM tickets WHERE status IN ('closed') AND "createdAt" >= $1 AND "createdAt" <= $2)::int as "closedTickets"
        `;
        const { rows } = await this.pool.query(sql, [startDate, endDate]);
        const row = rows[0];
        return {
            totalReports: row.totalReports,
            totalHours: parseFloat(row.totalHours) || 0,
            openTickets: row.openTickets,
            closedTickets: row.closedTickets,
        };
    }

    // ─── /equipment-maintenance-gap ──────────────────────────────────────────────

    async getMaintenanceGap(months: number) {
        const sql = `
            SELECT
                e.id as "equipmentId",
                e.brand,
                e.model,
                c.name as "clientName",
                MAX(r."serviceDate") as "lastMaintenanceDate",
                EXTRACT(DAY FROM NOW() - MAX(r."serviceDate"))::int as "daysSinceLastMaintenance"
            FROM equipments e
            LEFT JOIN clients c ON e."clientId" = c.id
            LEFT JOIN reports r ON r."equipmentId" = e.id
                AND r.deleted_at IS NULL
                AND r."serviceType"::jsonb ? 'manutencao'
                AND r."serviceDate" >= NOW() - ($1 || ' months')::interval
            GROUP BY e.id, e.brand, e.model, c.name
            ORDER BY "lastMaintenanceDate" ASC NULLS FIRST
            LIMIT 1000
        `;
        const { rows } = await this.pool.query(sql, [months]);
        return rows;
    }

    // ─── /equipment-service-frequency ────────────────────────────────────────────

    async getServiceFrequency(serviceType: string, months: number) {
        const sql = `
            SELECT
                e.id as "equipmentId",
                e.brand,
                e.model,
                COUNT(r.id)::int as "serviceCount"
            FROM equipments e
            JOIN reports r ON r."equipmentId" = e.id
                AND r.deleted_at IS NULL
                AND r."serviceType"::jsonb ? $1
                AND r."serviceDate" >= NOW() - ($2 || ' months')::interval
            GROUP BY e.id, e.brand, e.model
            ORDER BY "serviceCount" DESC
            LIMIT 1000
        `;
        const { rows } = await this.pool.query(sql, [serviceType, months]);
        return rows;
    }

    // ─── /technician-hours-trend ──────────────────────────────────────────────────

    async getTechnicianHoursTrend(
        startDate: string,
        endDate: string,
        granularity: 'month' | 'week'
    ) {
        const trunc = granularity === 'week' ? 'week' : 'month';

        // Per-technician trend (regra 1)
        const sqlTech = `
            SELECT
                DATE_TRUNC('${trunc}', r."serviceDate")::date::text as period,
                p.id as "technicianId",
                CONCAT(p.first_name, ' ', p.last_name) as "technicianName",
                p.color as "technicianColor",
                SUM(r.hours / NULLIF(tc.cnt, 0))::numeric as hours
            FROM reports r
            JOIN report_technicians rt ON rt."reportId" = r.id
            JOIN profiles p ON rt."technicianId" = p.id
            JOIN (SELECT "reportId", COUNT(*) as cnt FROM report_technicians GROUP BY "reportId") tc ON tc."reportId" = r.id
            WHERE r.deleted_at IS NULL
              AND r."serviceDate" >= $1
              AND r."serviceDate" <= $2
            GROUP BY DATE_TRUNC('${trunc}', r."serviceDate"), p.id, p.first_name, p.last_name, p.color
            ORDER BY period, "technicianName"
            LIMIT 1000
        `;

        // Total trend
        const sqlTotal = `
            SELECT
                DATE_TRUNC('${trunc}', r."serviceDate")::date::text as period,
                SUM(r.hours)::numeric as "totalHours"
            FROM reports r
            WHERE r.deleted_at IS NULL
              AND r."serviceDate" >= $1
              AND r."serviceDate" <= $2
            GROUP BY DATE_TRUNC('${trunc}', r."serviceDate")
            ORDER BY period
        `;

        const [techRows, totalRows] = await Promise.all([
            this.pool.query(sqlTech, [startDate, endDate]),
            this.pool.query(sqlTotal, [startDate, endDate]),
        ]);

        return {
            byTechnician: techRows.rows.map(r => ({
                period: r.period,
                technicianId: r.technicianId,
                technicianName: r.technicianName,
                technicianColor: r.technicianColor,
                hours: parseFloat(r.hours) || 0,
            })),
            total: totalRows.rows.map(r => ({
                period: r.period,
                totalHours: parseFloat(r.totalHours) || 0,
            })),
        };
    }

    // ─── /ticket-to-report-time ───────────────────────────────────────────────────

    async getTicketToReportTime(startDate: string, endDate: string) {
        const sql = `
            SELECT
                ticket_id as id,
                ticket_title as label,
                EXTRACT(EPOCH FROM (report_created_at - ticket_created_at)) / 3600 as "hoursElapsed"
            FROM v_ticket_lifecycle
            WHERE ticket_created_at >= $1
              AND ticket_created_at <= $2
              AND report_created_at IS NOT NULL
            ORDER BY "hoursElapsed" DESC
            LIMIT 1000
        `;
        const { rows } = await this.pool.query(sql, [startDate, endDate]);
        return rows.map(r => ({ ...r, hoursElapsed: parseFloat(r.hoursElapsed) || 0 }));
    }

    // ─── /top-clients-parts-cost ─────────────────────────────────────────────────

    async getTopClientPartsCost(
        startDate: string,
        endDate: string,
        clientIds?: number[],
        technicianIds?: string[],
        serviceTypes?: string[],
        classifications?: string[],
    ) {
        const params: any[] = [startDate, endDate];
        let idx = 3;
        const conditions: string[] = [];

        if (clientIds && clientIds.length > 0) {
            conditions.push(`r."clientId" = ANY($${idx++})`);
            params.push(clientIds);
        }
        if (serviceTypes && serviceTypes.length > 0) {
            conditions.push(`r."serviceType"::jsonb ?| $${idx++}::text[]`);
            params.push(serviceTypes);
        }
        if (classifications && classifications.length > 0) {
            conditions.push(`r.classification = ANY($${idx++})`);
            params.push(classifications);
        }
        if (technicianIds && technicianIds.length > 0) {
            conditions.push(
                `EXISTS (SELECT 1 FROM report_technicians rt_sub WHERE rt_sub."reportId" = r.id AND rt_sub."technicianId"::text = ANY($${idx++}))`
            );
            params.push(technicianIds);
        }

        const extraWhere = conditions.length > 0 ? 'AND ' + conditions.join(' AND ') : '';

        const sql = `
            WITH client_parts_agg AS (
                SELECT
                    c.id as client_id,
                    p.id as part_id,
                    p.reference as part_reference,
                    p.designation as part_designation,
                    COALESCE(p.price, 0) as part_unit_price,
                    SUM(rp.quantity)::numeric as total_quantity,
                    SUM(rp.quantity * COALESCE(p.price, 0))::numeric as total_cost,
                    COUNT(DISTINCT r.id)::int as report_count,
                    json_agg(
                        DISTINCT jsonb_build_object(
                            'id', r.id,
                            'reportNumber', r.report_number,
                            'serviceDate', r."serviceDate",
                            'quantity', rp.quantity,
                            'equipmentName', COALESCE(CONCAT(e.brand, ' ', e.model), '—'),
                            'technicians', COALESCE((
                                SELECT json_agg(CONCAT(p_t.first_name, ' ', p_t.last_name))
                                FROM report_technicians rt_t
                                JOIN profiles p_t ON rt_t."technicianId" = p_t.id
                                WHERE rt_t."reportId" = r.id
                            ), '[]'::json)
                        )
                    ) as reports
                FROM report_parts rp
                JOIN parts p ON rp."partId" = p.id
                JOIN reports r ON rp."reportId" = r.id
                JOIN clients c ON r."clientId" = c.id
                LEFT JOIN equipments e ON r."equipmentId" = e.id
                WHERE r.deleted_at IS NULL
                  AND r."serviceDate" >= $1
                  AND r."serviceDate" <= $2
                  ${extraWhere}
                GROUP BY c.id, p.id, p.reference, p.designation, p.price
            )
            SELECT
                c.id as "clientId",
                c.name as "clientName",
                COALESCE(SUM(cpa.total_cost), 0)::numeric as "totalCost",
                COALESCE(
                    json_agg(
                        json_build_object(
                            'partId', cpa.part_id,
                            'reference', cpa.part_reference,
                            'designation', cpa.part_designation,
                            'unitPrice', cpa.part_unit_price,
                            'quantity', cpa.total_quantity,
                            'totalCost', cpa.total_cost,
                            'reportCount', cpa.report_count,
                            'reports', cpa.reports
                        ) ORDER BY cpa.total_cost DESC
                    ) FILTER (WHERE cpa.part_id IS NOT NULL),
                    '[]'::json
                ) as parts
            FROM clients c
            JOIN client_parts_agg cpa ON cpa.client_id = c.id
            GROUP BY c.id, c.name
            ORDER BY "totalCost" DESC
            LIMIT 1000
        `;
        const { rows } = await this.pool.query(sql, params);
        return rows.map(r => ({
            clientId: r.clientId,
            clientName: r.clientName,
            totalCost: parseFloat(r.totalCost) || 0,
            parts: Array.isArray(r.parts)
                ? r.parts.map((p: any) => ({
                      partId: p.partId,
                      reference: p.reference,
                      designation: p.designation,
                      unitPrice: parseFloat(p.unitPrice) || 0,
                      quantity: parseFloat(p.quantity) || 0,
                      totalCost: parseFloat(p.totalCost) || 0,
                      reportCount: p.reportCount || 0,
                      reports: Array.isArray(p.reports)
                          ? p.reports.sort((a: any, b: any) => (b.serviceDate || '').localeCompare(a.serviceDate || ''))
                          : [],
                  }))
                : [],
        }));
    }

    // ─── /equipment-failure-rate ─────────────────────────────────────────────────

    async getEquipmentFailureRate(startDate: string, endDate: string) {
        const sql = `
            SELECT
                e.id as "equipmentId",
                e.brand,
                e.model,
                COUNT(t.id)::int as "ticketCount"
            FROM tickets t
            JOIN equipments e ON t."equipmentId" = e.id
            WHERE t."createdAt" >= $1
              AND t."createdAt" <= $2
              AND t.status != 'deleted'
            GROUP BY e.id, e.brand, e.model
            ORDER BY "ticketCount" DESC
            LIMIT 1000
        `;
        const { rows } = await this.pool.query(sql, [startDate, endDate]);
        return rows;
    }

    // ─── /yearly-trend ────────────────────────────────────────────────────────────

    async getYearlyTrend(startDate: string, endDate: string, granularity: 'week' | 'month' | 'quarter') {
        const trunc = granularity === 'quarter' ? 'quarter' : granularity === 'week' ? 'week' : 'month';

        const sql = `
            SELECT
                m.period,
                m."totalHours",
                m."reportCount",
                COALESCE(p."distinctPartsCount", 0) as "distinctPartsCount"
            FROM (
                SELECT
                    DATE_TRUNC('${trunc}', r."serviceDate")::date::text as period,
                    SUM(r.hours)::numeric as "totalHours",
                    COUNT(DISTINCT r.id)::int as "reportCount"
                FROM reports r
                WHERE r.deleted_at IS NULL
                  AND r."serviceDate" >= $1
                  AND r."serviceDate" <= $2
                GROUP BY DATE_TRUNC('${trunc}', r."serviceDate")
            ) m
            LEFT JOIN (
                SELECT
                    DATE_TRUNC('${trunc}', r."serviceDate")::date::text as period,
                    COUNT(DISTINCT rp."partId")::int as "distinctPartsCount"
                FROM reports r
                JOIN report_parts rp ON rp."reportId" = r.id
                WHERE r.deleted_at IS NULL
                  AND r."serviceDate" >= $1
                  AND r."serviceDate" <= $2
                GROUP BY DATE_TRUNC('${trunc}', r."serviceDate")
            ) p ON m.period = p.period
            ORDER BY m.period
        `;
        const { rows } = await this.pool.query(sql, [startDate, endDate]);
        return rows.map(r => ({
            period: r.period,
            totalHours: parseFloat(r.totalHours) || 0,
            reportCount: r.reportCount,
            distinctPartsCount: r.distinctPartsCount,
        }));
    }

    // ─── /time-to-first-schedule ─────────────────────────────────────────────────

    async getTimeToFirstSchedule(startDate: string, endDate: string) {
        const sql = `
            SELECT
                ticket_id as id,
                ticket_title as label,
                EXTRACT(EPOCH FROM (schedule_created_at - ticket_created_at)) / 3600 as "hoursElapsed"
            FROM v_ticket_lifecycle
            WHERE ticket_created_at >= $1
              AND ticket_created_at <= $2
              AND schedule_id IS NOT NULL
              AND schedule_created_at IS NOT NULL
              AND schedule_created_at >= ticket_created_at
            ORDER BY "hoursElapsed" DESC
            LIMIT 1000
        `;
        const { rows } = await this.pool.query(sql, [startDate, endDate]);
        return rows.map(r => ({ ...r, hoursElapsed: parseFloat(r.hoursElapsed) || 0 }));
    }

    // ─── /service-end-to-report-time ─────────────────────────────────────────────

    async getServiceEndToReportTime(startDate: string, endDate: string) {
        const sql = `
            SELECT
                vlc.report_id as id,
                vlc.report_number as label,
                GREATEST(0, EXTRACT(EPOCH FROM (
                    vlc.report_created_at -
                    (SELECT MAX((block->>'end')::timestamptz) FROM jsonb_array_elements(vlc.time_blocks) block)
                )) / 3600) as "hoursElapsed"
            FROM v_ticket_lifecycle vlc
            WHERE vlc.ticket_created_at >= $1
              AND vlc.ticket_created_at <= $2
              AND vlc.time_blocks IS NOT NULL
              AND vlc.report_id IS NOT NULL
            ORDER BY "hoursElapsed" DESC
            LIMIT 1000
        `;
        const { rows } = await this.pool.query(sql, [startDate, endDate]);
        return rows
            .filter(r => r.hoursElapsed !== null)
            .map(r => ({ ...r, hoursElapsed: parseFloat(r.hoursElapsed) || 0 }));
    }

    // ─── /report-to-billing-time ─────────────────────────────────────────────────

    async getReportToBillingTime(startDate: string, endDate: string) {
        const sql = `
            SELECT
                report_id as id,
                report_number as label,
                GREATEST(0, EXTRACT(EPOCH FROM (billed_at - report_created_at)) / 86400) as "hoursElapsed"
            FROM v_ticket_lifecycle
            WHERE ticket_created_at >= $1
              AND ticket_created_at <= $2
              AND billed_at IS NOT NULL
              AND report_created_at IS NOT NULL
            ORDER BY "hoursElapsed" DESC
            LIMIT 1000
        `;
        const { rows } = await this.pool.query(sql, [startDate, endDate]);
        return rows.map(r => ({ ...r, hoursElapsed: parseFloat(r.hoursElapsed) || 0 }));
    }
}
