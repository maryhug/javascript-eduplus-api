-- =====================================================
-- EduPlus - Esquema Normalizado 3FN
-- Autor: Maryhug - Riwi Bootcamp M4
-- =====================================================

-- 🔴 SECCIÓN 1: DROPS (idempotencia)
DROP TABLE IF EXISTS enrollments CASCADE;
DROP TABLE IF EXISTS courses CASCADE;
DROP TABLE IF EXISTS students CASCADE;
DROP TABLE IF EXISTS instructors CASCADE;
DROP TABLE IF EXISTS subscription_plans CASCADE;

-- =====================================================
-- SECCIÓN 2: TABLAS MAESTRAS (orden correcto por FKs)
-- =====================================================

-- Planes de suscripción (datos estáticos)
CREATE TABLE subscription_plans (
                                    id SERIAL PRIMARY KEY,
                                    name VARCHAR(50) UNIQUE NOT NULL,
                                    monthly_price INTEGER NOT NULL CHECK (monthly_price > 0),
                                    max_courses_allowed INTEGER NOT NULL CHECK (max_courses_allowed > 0),
                                    created_at TIMESTAMP DEFAULT NOW()
);

-- Instructores (maestros)
CREATE TABLE instructors (
                             id SERIAL PRIMARY KEY,
                             name VARCHAR(100) NOT NULL,
                             email VARCHAR(150) UNIQUE NOT NULL,
                             specialty_area VARCHAR(100) NOT NULL,
                             created_at TIMESTAMP DEFAULT NOW()
);

-- Estudiantes (maestros - soft delete)
CREATE TABLE students (
                          id SERIAL PRIMARY KEY,
                          name VARCHAR(100) NOT NULL,
                          email VARCHAR(150) UNIQUE NOT NULL,
                          phone VARCHAR(20),
                          city VARCHAR(80) NOT NULL,
                          is_active BOOLEAN DEFAULT TRUE,
                          created_at TIMESTAMP DEFAULT NOW()
);

-- Cursos (depende de instructors)
CREATE TABLE courses (
                         id SERIAL PRIMARY KEY,
                         title VARCHAR(200) NOT NULL,
                         category VARCHAR(100) NOT NULL,
                         price INTEGER NOT NULL CHECK (price > 0),
                         duration_hours INTEGER NOT NULL CHECK (duration_hours > 0),
                         instructor_id INTEGER NOT NULL REFERENCES instructors(id) ON DELETE RESTRICT,
                         created_at TIMESTAMP DEFAULT NOW()
);

-- Inscripciones (une todo)
CREATE TABLE enrollments (
                             id TEXT PRIMARY KEY,  -- Cambiado a TEXT para UUIDs
                             enrollment_date DATE NOT NULL,
                             completion_percentage INTEGER NOT NULL CHECK (completion_percentage BETWEEN 0 AND 100),
                             amount_paid INTEGER NOT NULL CHECK (amount_paid >= 0),
                             student_id INTEGER NOT NULL REFERENCES students(id) ON DELETE RESTRICT,
                             course_id INTEGER NOT NULL REFERENCES courses(id) ON DELETE RESTRICT,
                             subscription_plan_id INTEGER NOT NULL REFERENCES subscription_plans(id) ON DELETE RESTRICT,
                             completed_at TIMESTAMP NULL
);

-- =====================================================
-- SECCIÓN 3: TRIGGERS (lógica automática)
-- =====================================================
CREATE OR REPLACE FUNCTION update_completed_at()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.completion_percentage = 100 AND OLD.completion_percentage < 100 THEN
    NEW.completed_at = NOW();
  ELSIF NEW.completion_percentage < 100 THEN
    NEW.completed_at = NULL;
END IF;
RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_completion
    BEFORE UPDATE ON enrollments
    FOR EACH ROW EXECUTE FUNCTION update_completed_at();
