import { pool } from './src/config/db';

async function diagnose() {
    try {
        console.log('--- 1. PROFILES ---');
        const profiles = await pool.query(`SELECT id, first_name, last_name, email, role FROM profiles WHERE first_name ILIKE '%António%' OR last_name ILIKE '%Pedroso%' OR first_name ILIKE '%Antonio%'`);
        console.log(profiles.rows);

        if (profiles.rows.length > 0) {
            for (const p of profiles.rows) {
                console.log(`\n--- 2. REPORTS FOR ${p.first_name} ${p.last_name} (${p.id}) ---`);
                const rts = await pool.query(`
                    SELECT 
                        rt."reportId",
                        rt."technicianId",
                        r.report_number,
                        r."serviceDate",
                        r.hours,
                        r.time_blocks,
                        r.deleted_at,
                        (SELECT COUNT(*) FROM report_technicians rt2 WHERE rt2."reportId" = r.id) as num_technicians
                    FROM report_technicians rt
                    JOIN reports r ON rt."reportId" = r.id
                    WHERE rt."technicianId" = $1
                    ORDER BY r."serviceDate" DESC
                `, [p.id]);
                console.log(`Found ${rts.rows.length} reports in report_technicians:`);
                console.log(rts.rows.slice(0, 10));

                console.log(`\n--- 3. SCHEDULES FOR ${p.first_name} ${p.last_name} (${p.id}) ---`);
                const st = await pool.query(`
                    SELECT 
                        st."scheduleId",
                        s.title,
                        s."startDate",
                        s."endDate",
                        s."timeBlocks",
                        s."isCompleted",
                        s."hasReport"
                    FROM schedule_technicians st
                    JOIN schedules s ON st."scheduleId" = s.id
                    WHERE st."technicianId" = $1
                    ORDER BY s."startDate" DESC
                    LIMIT 10
                `, [p.id]);
                console.log(`Found ${st.rows.length} schedules in schedule_technicians:`);
                console.log(st.rows);
            }
        }

        console.log('\n--- 4. ALL TECHNICIANS IN REPORT_TECHNICIANS (AGGREGATE) ---');
        const agg = await pool.query(`
            SELECT 
                p.id,
                p.first_name,
                p.last_name,
                COUNT(DISTINCT r.id) as report_count,
                SUM(r.hours) as total_hours_raw,
                SUM(r.hours / NULLIF(tc.cnt, 0)) as total_hours_divided
            FROM report_technicians rt
            JOIN profiles p ON rt."technicianId" = p.id
            JOIN reports r ON rt."reportId" = r.id
            JOIN (SELECT "reportId", COUNT(*) as cnt FROM report_technicians GROUP BY "reportId") tc ON tc."reportId" = r.id
            WHERE r.deleted_at IS NULL
            GROUP BY p.id, p.first_name, p.last_name
            ORDER BY total_hours_divided DESC
        `);
        console.log(agg.rows);

        console.log('\n--- 5. CHECK REPORTS TABLE SAMPLE WITH HOURS ---');
        const sampleReports = await pool.query(`
            SELECT id, report_number, "serviceDate", hours, time_blocks, deleted_at
            FROM reports
            WHERE deleted_at IS NULL
            ORDER BY id DESC
            LIMIT 10
        `);
        console.log(sampleReports.rows);

    } catch (err) {
        console.error('Error in diagnose:', err);
    } finally {
        await pool.end();
    }
}

diagnose();
