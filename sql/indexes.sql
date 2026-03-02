-- =====================================================
-- ÍNDICES - Optimización de consultas frecuentes
-- =====================================================

-- 1. students.email - Búsquedas por login (ya tiene UNIQUE)
CREATE INDEX idx_students_email ON students(email);

-- 2. courses.category - Filtros por categoría
CREATE INDEX idx_courses_category ON courses(category);

-- 3. enrollments.student_id - Dashboard de estudiante
CREATE INDEX idx_enrollments_student_id ON enrollments(student_id);

-- 4. enrollments.enrollment_date - Reportes temporales
CREATE INDEX idx_enrollments_date ON enrollments(enrollment_date);

-- 5. enrollments.course_id - Conteo de estudiantes por curso
CREATE INDEX idx_enrollments_course_id ON enrollments(course_id);

-- 6. Composite para reportes avanzados
CREATE INDEX idx_enrollments_course_category ON enrollments(course_id);
