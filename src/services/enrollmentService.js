import { pool } from '../config/postgres.js';
import { db } from '../config/mongodb.js';

export async function createEnrollment(data) {
    const { studentId, courseId, subscriptionPlanId, amountPaid } = data;

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // 1. Validar duplicado
        const duplicateCheck = await client.query(
            'SELECT id FROM enrollments WHERE student_id = $1 AND course_id = $2',
            [studentId, courseId]
        );
        if (duplicateCheck.rows.length > 0) {
            throw new Error('Student already enrolled in this course');
        }

        // 2. Validar precio <= course_price
        const coursePrice = await client.query(
            'SELECT price FROM courses WHERE id = $1', [courseId]
        );
        if (!coursePrice.rows[0]) {
            throw new Error('Course not found');
        }
        if (amountPaid > coursePrice.rows[0].price) {
            throw new Error('Amount paid exceeds course price');
        }

        // 3. Insertar
        const result = await client.query(
            `INSERT INTO enrollments (id, enrollment_date, completion_percentage, amount_paid, 
                               student_id, course_id, subscription_plan_id)
       VALUES (gen_random_uuid()::text, NOW(), 0, $1, $2, $3, $4) RETURNING *`,
            [amountPaid, studentId, courseId, subscriptionPlanId]
        );

        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function updateEnrollmentProgress(enrollmentId, completionPercentage) {
    if (completionPercentage < 0 || completionPercentage > 100) {
        throw new Error('Invalid percentage (0-100)');
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        const result = await client.query(
            `UPDATE enrollments 
       SET completion_percentage = $1
       WHERE id = $2 RETURNING student_id`,
            [completionPercentage, enrollmentId]
        );

        if (result.rows.length === 0) {
            throw new Error('Enrollment not found');
        }

        const studentId = result.rows[0].student_id;

        // 4. Actualizar MongoDB
        await db.collection('student_progress').updateOne(
            { studentEmail: { $exists: true } }, // Actualizar el primero que encuentre (mejora después)
            {
                $set: {
                    "enrollments.$[elem].completionPercentage": completionPercentage
                }
            },
            {
                arrayFilters: [{ "elem.id": enrollmentId }]
            }
        );

        await client.query('COMMIT');
        return result.rows[0];
    } catch (error) {
        await client.query('ROLLBACK');
        throw error;
    } finally {
        client.release();
    }
}

export async function getStudentEnrollments(studentId) {
    const result = await pool.query(
        `SELECT e.id, e.enrollment_date, e.completion_percentage, e.amount_paid,
            c.title as course_title, i.name as instructor_name, c.category
     FROM enrollments e
     JOIN courses c ON e.course_id = c.id
     JOIN instructors i ON c.instructor_id = i.id
     WHERE e.student_id = $1
     ORDER BY e.enrollment_date DESC`,
        [studentId]
    );
    return result.rows;
}
