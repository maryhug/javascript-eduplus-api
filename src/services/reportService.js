import { pool } from '../config/postgres.js';

export async function getRevenueByCategory() {
    const result = await pool.query(`
    SELECT 
      c.category,
      SUM(e.amount_paid) AS total_revenue,
      COUNT(e.id) AS total_enrollments,
      ROUND(AVG(e.completion_percentage)::numeric, 2) AS avg_completion
    FROM enrollments e
    JOIN courses c ON e.course_id = c.id
    GROUP BY c.category
    HAVING COUNT(e.id) > 2
    ORDER BY total_revenue DESC
  `);
    return result.rows;
}

export async function getTopInstructors() {
    const result = await pool.query(`
    SELECT 
      i.name AS instructor_name,
      i.email,
      i.specialty_area,
      COUNT(c.id) as courses_count,
      COALESCE(SUM(e.amount_paid), 0) as total_revenue
    FROM instructors i
    LEFT JOIN courses c ON i.id = c.instructor_id
    LEFT JOIN enrollments e ON c.id = e.course_id
    GROUP BY i.id, i.name, i.email, i.specialty_area
    ORDER BY total_revenue DESC, courses_count DESC
    LIMIT 5
  `);
    return result.rows;
}

export async function getTopStudents() {
    const result = await pool.query(`
    SELECT 
      s.name as student_name,
      s.email,
      s.city,
      COUNT(CASE WHEN e.completion_percentage = 100 THEN 1 END) as completed_courses,
      SUM(e.amount_paid) as total_spent
    FROM students s
    JOIN enrollments e ON s.id = e.student_id
    WHERE s.is_active = TRUE
    GROUP BY s.id, s.name, s.email, s.city
    HAVING COUNT(CASE WHEN e.completion_percentage = 100 THEN 1 END) > 0
    ORDER BY completed_courses DESC, total_spent DESC
  `);
    return result.rows;
}

export async function getLowPerformanceCourses() {
    const result = await pool.query(`
    SELECT 
      c.title,
      c.category,
      AVG(e.completion_percentage) as avg_completion,
      COUNT(e.id) as total_students
    FROM courses c
    JOIN enrollments e ON c.id = e.course_id
    GROUP BY c.id, c.title, c.category
    HAVING AVG(e.completion_percentage) < 40 AND COUNT(e.id) > 2
    ORDER BY avg_completion ASC
  `);
    return result.rows;
}
