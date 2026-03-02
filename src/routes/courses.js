/*
import { Router } from 'express';
const router = Router();

router.get('/', (req, res) => res.json({ message: 'Courses routes working!' }));
router.post('/', (req, res) => res.status(201).json({ message: 'POST courses' }));
router.get('/:id', (req, res) => res.json({ message: `GET course ${req.params.id}` }));
router.put('/:id', (req, res) => res.json({ message: `PUT course ${req.params.id}` }));
router.delete('/:id', (req, res) => res.json({ message: `DELETE course ${req.params.id}` }));

export default router;
*/

import { Router } from 'express';
import {
    createCourse,
    getAllCourses,
    getCourseById,
    updateCourse,
    deleteCourse
} from '../services/courseService.js';

const router = Router();

// CREATE
router.post('/', async (req, res) => {
    try {
        const course = await createCourse(req.body);
        res.status(201).json({
            ok: true,
            message: 'Course created successfully',
            course
        });
    } catch (error) {
        res.status(400).json({ ok: false, error: error.message });
    }
});

// READ ALL
router.get('/', async (req, res) => {
    try {
        const courses = await getAllCourses(req.query.category);
        res.json({
            ok: true,
            count: courses.length,
            courses
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// READ ONE
router.get('/:id', async (req, res) => {
    try {
        const course = await getCourseById(req.params.id);
        res.json({ ok: true, course });
    } catch (error) {
        if (error.message === 'Course not found') {
            return res.status(404).json({ ok: false, error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

// UPDATE
router.put('/:id', async (req, res) => {
    try {
        const course = await updateCourse(req.params.id, req.body);
        res.json({
            ok: true,
            message: 'Course updated successfully',
            course
        });
    } catch (error) {
        if (error.message === 'Course not found') {
            return res.status(404).json({ ok: false, error: error.message });
        }
        res.status(400).json({ ok: false, error: error.message });
    }
});

// DELETE
router.delete('/:id', async (req, res) => {
    try {
        await deleteCourse(req.params.id);
        res.json({
            ok: true,
            message: 'Course deleted successfully'
        });
    } catch (error) {
        if (error.message.includes('active enrollments')) {
            return res.status(409).json({ ok: false, error: error.message });
        }
        if (error.message === 'Course not found') {
            return res.status(404).json({ ok: false, error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

export default router;
