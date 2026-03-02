/*
import { Router } from 'express';
const router = Router();

router.get('/', (req, res) => res.json({ message: 'Enrollments routes working!' }));
router.post('/', (req, res) => res.status(201).json({ message: 'POST enrollments' }));
router.get('/student/:studentId', (req, res) => res.json({ message: `GET enrollments student ${req.params.studentId}` }));
router.patch('/:id/progress', (req, res) => res.json({ message: `PATCH progress ${req.params.id}` }));
router.delete('/:id', (req, res) => res.json({ message: `DELETE enrollment ${req.params.id}` }));

export default router;
*/

import { Router } from 'express';
import {
    createEnrollment,
    updateEnrollmentProgress,
    getStudentEnrollments
} from '../services/enrollmentService.js';

const router = Router();

// CREATE
router.post('/', async (req, res) => {
    try {
        const enrollment = await createEnrollment(req.body);
        res.status(201).json({
            ok: true,
            message: 'Enrollment created successfully',
            enrollment
        });
    } catch (error) {
        res.status(400).json({ ok: false, error: error.message });
    }
});

// READ student enrollments
router.get('/student/:studentId', async (req, res) => {
    try {
        const enrollments = await getStudentEnrollments(req.params.studentId);
        res.json({
            ok: true,
            count: enrollments.length,
            enrollments
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// UPDATE progress
router.patch('/:id/progress', async (req, res) => {
    try {
        const { completionPercentage } = req.body;
        const enrollment = await updateEnrollmentProgress(req.params.id, completionPercentage);
        res.json({
            ok: true,
            message: 'Progress updated successfully',
            enrollment
        });
    } catch (error) {
        if (error.message.includes('Invalid percentage')) {
            return res.status(400).json({ ok: false, error: error.message });
        }
        if (error.message === 'Enrollment not found') {
            return res.status(404).json({ ok: false, error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

export default router;
