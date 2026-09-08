CREATE OR REPLACE VIEW v_ticket_lifecycle AS
SELECT
    t.id as ticket_id,
    t.title as ticket_title,
    t.client_id,
    c.name as client_name,
    t."createdAt" as ticket_created_at,
    s.id as schedule_id,
    s.created_at as schedule_created_at,
    r.id as report_id,
    r.report_number,
    LEAST(r.created_at, bt.created_at) as report_created_at,
    r."serviceDate" as report_service_date,
    r.time_blocks,
    bt.id as billing_task_id,
    bt.status as billing_status,
    bt.billed_at
FROM tickets t
LEFT JOIN clients c ON t.client_id = c.id
LEFT JOIN schedules s ON s.id = t."scheduleId"
LEFT JOIN reports r ON r."scheduleId" = s.id AND r.deleted_at IS NULL
LEFT JOIN billing_tasks bt ON bt.report_id = r.id;
