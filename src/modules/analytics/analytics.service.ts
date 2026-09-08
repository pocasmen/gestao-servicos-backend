import { Pool } from 'pg';
import { AnalyticsRepository, BaseReportFilters, GroupMetric } from './analytics.repository';
import { buildElapsedTimeReport } from './analytics.helpers';

export class AnalyticsService {
    private repo: AnalyticsRepository;

    constructor(pool: Pool) {
        this.repo = new AnalyticsRepository(pool);
    }

    // ─── /parts-usage ─────────────────────────────────────────────────────────
    getPartsUsage(filters: BaseReportFilters) {
        return this.repo.getPartsUsage(filters);
    }

    // ─── /equipment-avg-hours ─────────────────────────────────────────────────
    async getEquipmentAvgHours(filters: BaseReportFilters, orderBy: 'total' | 'avg' = 'total') {
        const rows = await this.repo.getGroupedMetric('equipment', 'hours', filters);
        if (orderBy === 'avg') {
            return rows
                .map(r => ({ ...r, avg: r.reportCount > 0 ? r.value / r.reportCount : 0 }))
                .sort((a, b) => b.avg - a.avg);
        }
        return rows;
    }

    // ─── /hours-by-client ─────────────────────────────────────────────────────
    getHoursByClient(filters: BaseReportFilters) {
        return this.repo.getGroupedMetric('client', 'hours', filters);
    }

    // ─── /hours-by-technician ─────────────────────────────────────────────────
    getHoursByTechnician(filters: BaseReportFilters) {
        return this.repo.getGroupedMetric('technician', 'hours', filters);
    }

    // ─── /service-type-breakdown ──────────────────────────────────────────────
    getServiceTypeBreakdown(filters: BaseReportFilters, metric: GroupMetric = 'count') {
        return this.repo.getGroupedMetric('serviceType', metric, filters);
    }

    // ─── /summary ─────────────────────────────────────────────────────────────
    getSummary(startDate: string, endDate: string) {
        return this.repo.getSummary(startDate, endDate);
    }

    // ─── /equipment-maintenance-gap ───────────────────────────────────────────
    getMaintenanceGap(months: number) {
        return this.repo.getMaintenanceGap(months);
    }

    // ─── /equipment-service-frequency ────────────────────────────────────────
    getServiceFrequency(serviceType: string, months: number) {
        return this.repo.getServiceFrequency(serviceType, months);
    }

    // ─── /equipment-hours (reutiliza getGroupedMetric) ───────────────────────
    getEquipmentHours(filters: BaseReportFilters) {
        return this.repo.getGroupedMetric('equipment', 'hours', filters);
    }

    // ─── /technician-hours-trend ──────────────────────────────────────────────
    getTechnicianHoursTrend(startDate: string, endDate: string, granularity: 'month' | 'week') {
        return this.repo.getTechnicianHoursTrend(startDate, endDate, granularity);
    }

    // ─── /classification-breakdown ────────────────────────────────────────────
    getClassificationBreakdown(filters: BaseReportFilters, metric: GroupMetric = 'count') {
        return this.repo.getGroupedMetric('classification', metric, filters);
    }

    // ─── /ticket-to-report-time ───────────────────────────────────────────────
    async getTicketToReportTime(startDate: string, endDate: string) {
        const rows = await this.repo.getTicketToReportTime(startDate, endDate);
        return buildElapsedTimeReport(rows);
    }

    // ─── /top-clients-parts-cost ──────────────────────────────────────────────
    getTopClientPartsCost(startDate: string, endDate: string, clientIds?: number[], technicianIds?: string[], serviceTypes?: string[], classifications?: string[]) {
        return this.repo.getTopClientPartsCost(startDate, endDate, clientIds, technicianIds, serviceTypes, classifications);
    }

    // ─── /equipment-failure-rate ──────────────────────────────────────────────
    getEquipmentFailureRate(startDate: string, endDate: string) {
        return this.repo.getEquipmentFailureRate(startDate, endDate);
    }

    // ─── /yearly-trend ────────────────────────────────────────────────────────
    getYearlyTrend(startDate: string, endDate: string, granularity: 'week' | 'month' | 'quarter') {
        return this.repo.getYearlyTrend(startDate, endDate, granularity);
    }

    // ─── /time-to-first-schedule ──────────────────────────────────────────────
    async getTimeToFirstSchedule(startDate: string, endDate: string) {
        const rows = await this.repo.getTimeToFirstSchedule(startDate, endDate);
        return buildElapsedTimeReport(rows);
    }

    // ─── /service-end-to-report-time ─────────────────────────────────────────
    async getServiceEndToReportTime(startDate: string, endDate: string) {
        const rows = await this.repo.getServiceEndToReportTime(startDate, endDate);
        return buildElapsedTimeReport(rows);
    }

    // ─── /report-to-billing-time ─────────────────────────────────────────────
    async getReportToBillingTime(startDate: string, endDate: string) {
        const rows = await this.repo.getReportToBillingTime(startDate, endDate);
        return buildElapsedTimeReport(rows, 'days');
    }
}
