import { Router } from 'express';
import { authenticateToken, authorizeRoles } from '../../middlewares/auth.middleware';
import { UserRole } from '../../constants/enums';
import { validate } from '../../middlewares/validate.middleware';
import { pool } from '../../config/db';
import { AnalyticsService } from './analytics.service';
import { AnalyticsController } from './analytics.controller';
import {
    partsUsageSchema,
    equipmentAvgHoursSchema,
    hoursByClientSchema,
    hoursByTechnicianSchema,
    serviceTypeBreakdownSchema,
    summarySchema,
    maintenanceGapSchema,
    serviceFrequencySchema,
    equipmentHoursSchema,
    technicianHoursTrendSchema,
    classificationBreakdownSchema,
    dateRangeSchema,
    topClientsCostSchema,
    yearlyTrendSchema,
} from '../../validations/analytics.validation';

const router = Router();

const service = new AnalyticsService(pool);
const controller = new AnalyticsController(service);

const ANALYTICS_STAFF = [
    UserRole.ADMIN,
    UserRole.SUPER_ADMIN,
    UserRole.OFFICE_STAFF,
    UserRole.TECHNICIAN,
];

const auth = [authenticateToken, authorizeRoles(ANALYTICS_STAFF)];

// ─── Endpoints ────────────────────────────────────────────────────────────────

router.get('/parts-usage',                  ...auth, validate(partsUsageSchema),              controller.getPartsUsage);
router.get('/equipment-avg-hours',          ...auth, validate(equipmentAvgHoursSchema),        controller.getEquipmentAvgHours);
router.get('/hours-by-client',              ...auth, validate(hoursByClientSchema),             controller.getHoursByClient);
router.get('/hours-by-technician',          ...auth, validate(hoursByTechnicianSchema),         controller.getHoursByTechnician);
router.get('/service-type-breakdown',       ...auth, validate(serviceTypeBreakdownSchema),      controller.getServiceTypeBreakdown);
router.get('/summary',                      ...auth, validate(summarySchema),                   controller.getSummary);
router.get('/equipment-maintenance-gap',    ...auth, validate(maintenanceGapSchema),            controller.getMaintenanceGap);
router.get('/equipment-service-frequency',  ...auth, validate(serviceFrequencySchema),          controller.getServiceFrequency);
router.get('/equipment-hours',              ...auth, validate(equipmentHoursSchema),            controller.getEquipmentHours);
router.get('/technician-hours-trend',       ...auth, validate(technicianHoursTrendSchema),      controller.getTechnicianHoursTrend);
router.get('/classification-breakdown',     ...auth, validate(classificationBreakdownSchema),   controller.getClassificationBreakdown);
router.get('/ticket-to-report-time',        ...auth, validate(dateRangeSchema),                 controller.getTicketToReportTime);
router.get('/top-clients-parts-cost',       ...auth, validate(topClientsCostSchema),            controller.getTopClientPartsCost);
router.get('/equipment-failure-rate',       ...auth, validate(dateRangeSchema),                 controller.getEquipmentFailureRate);
router.get('/yearly-trend',                 ...auth, validate(yearlyTrendSchema),               controller.getYearlyTrend);
router.get('/time-to-first-schedule',       ...auth, validate(dateRangeSchema),                 controller.getTimeToFirstSchedule);
router.get('/service-end-to-report-time',   ...auth, validate(dateRangeSchema),                 controller.getServiceEndToReportTime);
router.get('/report-to-billing-time',       ...auth, validate(dateRangeSchema),                 controller.getReportToBillingTime);

export default router;
