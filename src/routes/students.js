/*
import { Router } from 'express';

const router = Router();

router.get('/', (req, res) => res.json({ message: 'Students routes working!' }));
router.post('/', (req, res) => res.status(201).json({ message: 'POST students' }));
router.get('/:id', (req, res) => res.json({ message: `GET student ${req.params.id}` }));
router.put('/:id', (req, res) => res.json({ message: `PUT student ${req.params.id}` }));
router.delete('/:id', (req, res) => res.json({ message: `DELETE student ${req.params.id}` }));

export default router;
*/

import { Router } from 'express';
import {
    createStudent,
    getAllStudents,
    getStudentById,
    updateStudent,
    softDeleteStudent
} from '../services/studentService.js';

const router = Router();

// CREATE
router.post('/', async (req, res) => {
    try {
        const student = await createStudent(req.body);
        res.status(201).json({
            ok: true,
            message: 'Student created successfully',
            student
        });
    } catch (error) {
        res.status(400).json({
            ok: false,
            error: error.message
        });
    }
});

// READ ALL
router.get('/', async (req, res) => {
    try {
        const students = await getAllStudents(req.query);
        res.json({
            ok: true,
            count: students.length,
            students
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// READ ONE
router.get('/:id', async (req, res) => {
    try {
        const student = await getStudentById(req.params.id);
        res.json({ ok: true, student });
    } catch (error) {
        if (error.message === 'Student not found') {
            return res.status(404).json({ ok: false, error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

// UPDATE
router.put('/:id', async (req, res) => {
    try {
        const student = await updateStudent(req.params.id, req.body);
        res.json({
            ok: true,
            message: 'Student updated successfully',
            student
        });
    } catch (error) {
        if (error.message === 'Student not found') {
            return res.status(404).json({ ok: false, error: error.message });
        }
        res.status(400).json({ ok: false, error: error.message });
    }
});

// DELETE (soft)
router.delete('/:id', async (req, res) => {
    try {
        await softDeleteStudent(req.params.id);
        res.json({
            ok: true,
            message: 'Student soft deleted successfully'
        });
    } catch (error) {
        if (error.message === 'Student not found') {
            return res.status(404).json({ ok: false, error: error.message });
        }
        res.status(500).json({ error: error.message });
    }
});

export default router;
