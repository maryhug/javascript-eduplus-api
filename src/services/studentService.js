import { pool } from '../config/postgres.js';

export async function createStudent(data) {
    const { name, email, phone, city, subscriptionPlanId } = data;

    if (!name || !email) {
        throw new Error('name and email are required');
    }

    const client = await pool.connect();
    try {
        await client.query('BEGIN');

        // Verificar plan existe
        const planCheck = await client.query(
            'SELECT id FROM subscription_plans WHERE id = $1', [subscriptionPlanId]
        );
        if (planCheck.rows.length === 0) {
            throw new Error('Invalid subscription plan');
        }

        // Verificar email único
        const emailCheck = await client.query(
            'SELECT id FROM students WHERE email = $1', [email.toLowerCase().trim()]
        );
        if (emailCheck.rows.length > 0) {
            throw new Error('Email already registered');
        }

        const result = await client.query(
            `INSERT INTO students (name, email, phone, city, created_at)
       VALUES ($1, $2, $3, $4, NOW()) RETURNING *`,
            [name.trim(), email.toLowerCase().trim(), phone, city]
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

export async function getAllStudents(filters = {}) {
    let query = `
        SELECT s.id, s.name, s.email, s.city, s.phone, s.is_active, s.created_at
        FROM students s
        WHERE s.is_active = TRUE
    `;
    const params = [];
    let whereClause = 'WHERE s.is_active = TRUE';

    if (filters.city) {
        whereClause += ` AND s.city ILIKE $${params.length + 1}`;
        params.push(`%${filters.city}%`);
    }

    if (filters.plan) {
        whereClause += ` AND EXISTS (
      SELECT 1 FROM enrollments e 
      JOIN subscription_plans sp ON e.subscription_plan_id = sp.id 
      WHERE e.student_id = s.id AND sp.name ILIKE $${params.length + 1}
    )`;
        params.push(`%${filters.plan}%`);
    }

    query = `
    SELECT s.id, s.name, s.email, s.city, s.phone, s.is_active, s.created_at
    FROM students s
    ${whereClause}
    ORDER BY s.name ASC
  `;

    const result = await pool.query(query, params);
    return result.rows;
}


export async function getStudentById(id) {
    const result = await pool.query(
        `SELECT s.*, 
            ARRAY_AGG(JSON_BUILD_OBJECT(
              'course', c.title,
              'category', c.category, 
              'completionPercentage', e.completion_percentage,
              'amountPaid', e.amount_paid,
              'enrollmentDate', e.enrollment_date
            )) FILTER (WHERE e.id IS NOT NULL) as enrollments
     FROM students s
     LEFT JOIN enrollments e ON s.id = e.student_id
     LEFT JOIN courses c ON e.course_id = c.id
     WHERE s.id = $1 AND s.is_active = TRUE
     GROUP BY s.id`,
        [id]
    );

    if (result.rows.length === 0) {
        throw new Error('Student not found');
    }
    return result.rows[0];
}

export async function updateStudent(id, data) {
    const allowedFields = ['name', 'phone', 'city'];
    const updates = [];
    const params = [id];

    if (data.email) {
        throw new Error('Email cannot be modified');
    }

    for (const [key, value] of Object.entries(data)) {
        if (allowedFields.includes(key) && value !== undefined) {
            updates.push(`${key} = $${params.length + 1}`);
            params.push(value);
        }
    }

    if (updates.length === 0) {
        throw new Error('No valid fields to update');
    }

    // Remover updated_at del UPDATE (lo manejamos con trigger o DEFAULT)
    const query = `UPDATE students SET ${updates.join(', ')} WHERE id = $1 AND is_active = TRUE RETURNING *`;
    const result = await pool.query(query, params);

    if (result.rows.length === 0) {
        throw new Error('Student not found');
    }
    return result.rows[0];
}


export async function softDeleteStudent(id) {
    const result = await pool.query(
        'UPDATE students SET is_active = FALSE WHERE id = $1 RETURNING id',
        [id]
    );

    if (result.rows.length === 0) {
        throw new Error('Student not found');
    }
    return result.rows[0];
}
