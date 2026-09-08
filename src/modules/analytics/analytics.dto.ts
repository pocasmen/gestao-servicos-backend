// Analytics DTOs — formatos de resposta dos 18 endpoints

export interface GroupedMetricReportItem {
    id: number;
    reportNumber: string | number;
    serviceDate: string;
    clientName: string;
    equipmentName: string;
    technicians: string[];
    hours: number;
    classification?: string;
}

export interface GroupedMetricResult {
    groupKey: string | number;
    groupLabel: string;
    value: number;
    reportCount: number;
    reports?: GroupedMetricReportItem[];
}

export interface ElapsedTimeSummary {
    count: number;
    avgHours: number;
    medianHours: number;
    minHours: number;
    maxHours: number;
    p90Hours: number;
}

export interface ElapsedTimeBucket {
    bucket: string;
    count: number;
}

export interface ElapsedTimeRow {
    id: string | number;
    label: string;
    hoursElapsed: number;
}

export interface ElapsedTimeReport {
    summary: ElapsedTimeSummary;
    distribution: ElapsedTimeBucket[];
    details: ElapsedTimeRow[];
}

export interface TrendPoint {
    period: string;
    technicianId?: string;
    technicianName?: string;
    technicianColor?: string | null;
    hours: number;
}

export interface TotalTrendPoint {
    period: string;
    totalHours: number;
}

export interface SummaryKPIs {
    totalReports: number;
    totalHours: number;
    openTickets: number;
    closedTickets: number;
}

export interface PartUsageResult {
    partId: number;
    partReference: string;
    partDesignation: string;
    totalQuantity: number;
}

export interface TopClientPartsCost {
    clientId: number;
    clientName: string;
    totalCost: number;
}

export interface EquipmentFailureRate {
    equipmentId: number;
    brand: string;
    model: string;
    ticketCount: number;
}

export interface MaintenanceGapResult {
    equipmentId: number;
    brand: string;
    model: string;
    clientName: string;
    lastMaintenanceDate: string | null;
    daysSinceLastMaintenance: number | null;
}

export interface ServiceFrequencyResult {
    equipmentId: number;
    brand: string;
    model: string;
    serviceCount: number;
}

export interface YearlyTrendPoint {
    period: string;
    totalHours: number;
    reportCount: number;
    distinctPartsCount: number;
}
