import express from 'express';
import { pool } from './config/postgres.js';
import { connectMongo } from './config/mongodb.js';

import studentsRouter from './routes/students.js';
import coursesRouter from './routes/courses.js';
import enrollmentsRouter from './routes/enrollments.js';
import reportsRouter from './routes/reports.js';
import migrationRouter from './routes/migration.js';

const app = express();
app.use(express.json());

// Health check
app.get('/api/health', async (req, res) => {
    try {
        await pool.query('SELECT 1');
        res.json({ ok: true, postgres: true });
    } catch {
        res.status(500).json({ ok: false, postgres: false });
    }
});

app.use('/api/students', studentsRouter);
app.use('/api/courses', coursesRouter);
app.use('/api/enrollments', enrollmentsRouter);
app.use('/api/reports', reportsRouter);
app.use('/api/migrate', migrationRouter);

export default app;
