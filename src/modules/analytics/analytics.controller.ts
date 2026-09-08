import { Response } from 'express';
import { AuthenticatedRequest } from '../../middlewares/auth.middleware';
import { catchAsync } from '../../utils/catchAsync';
import { AnalyticsService } from './analytics.service';
import { BaseReportFilters, GroupMetric } from './analytics.repository';

function parseStringArray(val: any): string[] | undefined {
    if (!val) return undefined;
    if (Array.isArray(val)) return val.map(String).filter(Boolean);
    if (typeof val === 'string') {
        return val.split(',').map(s => s.trim()).filter(Boolean);
    }
    return undefined;
}

function parseIntArray(val: any): number[] | undefined {
    if (!val) return undefined;
    if (Array.isArray(val)) {
        const nums = val.map(Number).filter(n => !isNaN(n));
        return nums.length > 0 ? nums : undefined;
    }
    if (typeof val === 'string') {
        const nums = val.split(',').map(s => parseInt(s.trim(), 10)).filter(n => !isNaN(n));
        return nums.length > 0 ? nums : undefined;
    }
    return undefined;
}

export class AnalyticsController {
    constructor(private service: AnalyticsService) {}

    // ─── Helpers ──────────────────────────────────────────────────────────────

    private parseFilters(query: any): BaseReportFilters {
        return {
            startDate: query.startDate,
            endDate: query.endDate,
            clientIds: parseIntArray(query.clientIds),
            technicianIds: parseStringArray(query.technicianIds),
            equipmentCategory: query.equipmentCategory || undefined,
            serviceTypes: parseStringArray(query.serviceTypes),
            classifications: parseStringArray(query.classifications),
        };
    }

    // ─── /parts-usage ─────────────────────────────────────────────────────────

    getPartsUsage = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
        const result = await this.service.getPartsUsage(this.parseFilters(req.query));
        res.json(result);
    });

    // ─── /equipment-avg-hours ─────────────────────────────────────────────────

    getEquipmentAvgHours = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
        const { orderBy, ...rest } = req.query as any;
        const result = await this.service.getEquipmentAvgHours(this.parseFilters(rest), (orderBy as 'total' | 'avg') ?? 'total');
        res.json(result);
    });

    // ─── /hours-by-client ─────────────────────────────────────────────────────

    getHoursByClient = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
        const result = await this.service.getHoursByClient(this.parseFilters(req.query));
        res.json(result);
    });

    // ─── /hours-by-technician ─────────────────────────────────────────────────

    getHoursByTechnician = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
        const result = await this.service.getHoursByTechnician(this.parseFilters(req.query));
        res.json(result);
    });

    // ─── /service-type-breakdown ──────────────────────────────────────────────

    getServiceTypeBreakdown = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
        const metric = (req.query.metric as GroupMetric) ?? 'count';
        const result = await this.service.getServiceTypeBreakdown(this.parseFilters(req.query), metric);
        res.json(result);
    });

    // ─── /summary ─────────────────────────────────────────────────────────────

    getSummary = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
        const { startDate, endDate } = req.query as any;
        const result = await this.service.getSummary(startDate, endDate);
        res.json(result);
    });

    // ─── /equipment-maintenance-gap ───────────────────────────────────────────

    getMaintenanceGap = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
        const months = parseInt(req.query.months as string, 10);
        const result = await this.service.getMaintenanceGap(months);
        res.json(result);
    });

    // ─── /equipment-service-frequency ────────────────────────────────────────

    getServiceFrequency = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
        const { serviceType, months } = req.query as any;
        const result = await this.service.getServiceFrequency(serviceType, parseInt(months, 10));
        res.json(result);
    });

    // ─── /equipment-hours ─────────────────────────────────────────────────────

    getEquipmentHours = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
        const result = await this.service.getEquipmentHours(this.parseFilters(req.query));
        res.json(result);
    });

    // ─── /technician-hours-trend ──────────────────────────────────────────────

    getTechnicianHoursTrend = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
        const { startDate, endDate, granularity } = req.query as any;
        const result = await this.service.getTechnicianHoursTrend(
            startDate,
            endDate,
            (granularity as 'month' | 'week') ?? 'month'
        );
        res.json(result);
    });

    // ─── /classification-breakdown ────────────────────────────────────────────

    getClassificationBreakdown = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
        const metric = (req.query.metric as GroupMetric) ?? 'count';
        const result = await this.service.getClassificationBreakdown(this.parseFilters(req.query), metric);
        res.json(result);
    });

    // ─── /ticket-to-report-time ───────────────────────────────────────────────

    getTicketToReportTime = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
        const { startDate, endDate } = req.query as any;
        const result = await this.service.getTicketToReportTime(startDate, endDate);
        res.json(result);
    });

    // ─── /top-clients-parts-cost ───────────────────────────────────────────────────

    getTopClientPartsCost = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
        const { startDate, endDate, clientIds, technicianIds, serviceTypes, classifications } = req.query as any;
        const parsedClientIds = parseIntArray(clientIds);
        const parsedTechnicianIds = parseStringArray(technicianIds);
        const parsedServiceTypes = parseStringArray(serviceTypes);
        const parsedClassifications = parseStringArray(classifications);
        const result = await this.service.getTopClientPartsCost(
            startDate, endDate,
            parsedClientIds, parsedTechnicianIds, parsedServiceTypes, parsedClassifications
        );
        res.json(result);
    });

    // ─── /equipment-failure-rate ─────────────────────────────────────────────

    getEquipmentFailureRate = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
        const { startDate, endDate } = req.query as any;
        const result = await this.service.getEquipmentFailureRate(startDate, endDate);
        res.json(result);
    });

    // ─── /yearly-trend ────────────────────────────────────────────────────────

    getYearlyTrend = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
        const { startDate, endDate, granularity } = req.query as any;
        const result = await this.service.getYearlyTrend(
            startDate,
            endDate,
            (granularity as 'week' | 'month' | 'quarter') ?? 'month'
        );
        res.json(result);
    });

    // ─── /time-to-first-schedule ─────────────────────────────────────────────

    getTimeToFirstSchedule = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
        const { startDate, endDate } = req.query as any;
        const result = await this.service.getTimeToFirstSchedule(startDate, endDate);
        res.json(result);
    });

    // ─── /service-end-to-report-time ─────────────────────────────────────────

    getServiceEndToReportTime = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
        const { startDate, endDate } = req.query as any;
        const result = await this.service.getServiceEndToReportTime(startDate, endDate);
        res.json(result);
    });

    // ─── /report-to-billing-time ─────────────────────────────────────────────

    getReportToBillingTime = catchAsync(async (req: AuthenticatedRequest, res: Response) => {
        const { startDate, endDate } = req.query as any;
        const result = await this.service.getReportToBillingTime(startDate, endDate);
        res.json(result);
    });
}
