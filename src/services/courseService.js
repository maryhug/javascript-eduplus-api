import { pool } from '../config/postgres.js';

export async function createCourse(data) {
    const { title, category, price, duration_hours, instructor_id } = data;

    // Validar instructor existe
    const instructorCheck = await pool.query(
        'SELECT id FROM instructors WHERE id = $1', [instructor_id]
    );
    if (instructorCheck.rows.length === 0) {
        throw new Error('Instructor not found');
    }

    const result = await pool.query(
        `INSERT INTO courses (title, category, price, duration_hours, instructor_id, created_at)
     VALUES ($1, $2, $3, $4, $5, NOW()) RETURNING *`,
        [title, category, price, duration_hours, instructor_id]
    );
    return result.rows[0];
}

export async function getAllCourses(category = null) {
    let query = `
    SELECT c.id, c.title, c.category, c.price, c.duration_hours,
           i.name as instructor_name, i.email as instructor_email,
           COUNT(e.id) as enrolled_students
    FROM courses c
    JOIN instructors i ON c.instructor_id = i.id
    LEFT JOIN enrollments e ON c.id = e.course_id
  `;
    const params = [];

    if (category) {
        query += ` WHERE c.category ILIKE $${params.length + 1}`;
        params.push(`%${category}%`);
    }

    query += `
    GROUP BY c.id, i.name, i.email
    ORDER BY c.title ASC
  `;

    const result = await pool.query(query, params);
    return result.rows;
}

export async function getCourseById(id) {
    const result = await pool.query(
        `SELECT c.*, 
            i.name as instructor_name,
            COUNT(e.id) as enrolled_students,
            COUNT(CASE WHEN e.completion_percentage < 100 THEN 1 END) as active_students
     FROM courses c
     JOIN instructors i ON c.instructor_id = i.id
     LEFT JOIN enrollments e ON c.id = e.course_id
     WHERE c.id = $1
     GROUP BY c.id, i.name`,
        [id]
    );

    if (result.rows.length === 0) {
        throw new Error('Course not found');
    }
    return result.rows[0];
}

export async function updateCourse(id, data) {
    const allowedFields = ['title', 'category', 'price', 'duration_hours'];
    const updates = [];
    const params = [id];

    for (const [key, value] of Object.entries(data)) {
        if (allowedFields.includes(key)) {
            updates.push(`${key} = $${params.length + 1}`);
            params.push(value);
        }
    }

    if (updates.length === 0) {
        throw new Error('No valid fields to update');
    }

    const query = `UPDATE courses SET ${updates.join(', ')} WHERE id = $1 RETURNING *`;
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
        throw new Error('Course not found');
    }
    return result.rows[0];
}

export async function deleteCourse(id) {
    // Validar no tiene estudiantes activos
    const activeCheck = await pool.query(
        `SELECT COUNT(*) as count 
     FROM enrollments e 
     WHERE e.course_id = $1 AND e.completion_percentage < 100`,
        [id]
    );

    if (parseInt(activeCheck.rows[0].count) > 0) {
        throw new Error('Cannot delete course with active enrollments');
    }

    const result = await pool.query(
        'DELETE FROM courses WHERE id = $1 RETURNING id',
        [id]
    );

    if (result.rows.length === 0) {
        throw new Error('Course not found');
    }
    return result.rows[0];
}
