/*
import { Router } from 'express';
const router = Router();

router.get('/revenue-by-category', (req, res) => res.json({ message: 'Revenue by category report' }));
router.get('/top-instructors', (req, res) => res.json({ message: 'Top instructors report' }));
router.get('/top-students', (req, res) => res.json({ message: 'Top students report' }));

export default router;
*/
import { Router } from 'express';
import {
    getRevenueByCategory,
    getTopInstructors,
    getTopStudents,
    getLowPerformanceCourses
} from '../services/reportService.js';

const router = Router();

router.get('/revenue-by-category', async (req, res) => {
    try {
        const reports = await getRevenueByCategory();
        res.json({
            ok: true,
            count: reports.length,
            reports
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/top-instructors', async (req, res) => {
    try {
        const instructors = await getTopInstructors();
        res.json({
            ok: true,
            count: instructors.length,
            instructors
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/top-students', async (req, res) => {
    try {
        const students = await getTopStudents();
        res.json({
            ok: true,
            count: students.length,
            students
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/low-performance-courses', async (req, res) => {
    try {
        const courses = await getLowPerformanceCourses();
        res.json({
            ok: true,
            count: courses.length,
            courses
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

export default router;
