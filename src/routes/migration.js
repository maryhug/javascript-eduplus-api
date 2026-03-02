/*
import { Router } from 'express';

const router = Router();

router.post('/', (req, res) => res.json({ message: 'Migration endpoint ready!', body: req.body }));

export default router;
*/

import { Router } from 'express';
import { migrateFromCSV } from '../services/migrationService.js';

const router = Router();

router.post('/', async (req, res) => {
    try {
        const { clearBefore, csvPath = process.env.CSV_PATH } = req.body;

        const stats = await migrateFromCSV(csvPath, { clearBefore });

        res.json({
            ok: true,
            message: 'Migration completed successfully',
            stats
        });
    } catch (error) {
        console.error('Migration error:', error);
        res.status(500).json({
            ok: false,
            error: error.message
        });
    }
});

export default router;
