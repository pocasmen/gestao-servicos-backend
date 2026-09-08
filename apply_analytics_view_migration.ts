import { pool } from './src/config/db';
import fs from 'fs';
import path from 'path';

async function runMigration() {
    const migrationPath = path.join(__dirname, 'migrations', '20260828_create_view_ticket_lifecycle.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');

    try {
        console.log('Applying analytics view migration...');
        await pool.query(sql);
        console.log('Migration applied successfully!');
    } catch (err) {
        console.error('Error applying migration:', err);
    } finally {
        await pool.end();
    }
}

runMigration();
