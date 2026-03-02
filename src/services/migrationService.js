import fs from 'fs';
import csv from 'csv-parser';
import { pool } from '../config/postgres.js';
import { db } from '../config/mongodb.js';

export async function migrateFromCSV(csvPath, options = {}) {
    const { clearBefore = false } = options;

    console.log('🚀 Starting migration...');
    const startTime = Date.now();
    const stats = {
        students: 0, instructors: 0, subscriptionPlans: 0,
        courses: 0, enrollments: 0, mongoDocuments: 0
    };

    // 1. Limpiar datos si se pide
    if (clearBefore) {
        await pool.query('DELETE FROM enrollments');
        await pool.query('DELETE FROM courses');
        await pool.query('DELETE FROM students');
        await pool.query('DELETE FROM instructors');
        await pool.query('DELETE FROM subscription_plans');
        await db.collection('student_progress').deleteMany({});
    }

    // 2. Mapas para desduplicar
    const studentMap = new Map();
    const instructorMap = new Map();
    const planMap = new Map();
    const courseMap = new Map();
    const studentProgressMap = new Map();

    // 3. Leer CSV fila por fila
    const rows = [];
    return new Promise((resolve, reject) => {
        fs.createReadStream(csvPath)
            .pipe(csv())
            .on('data', (row) => rows.push(row))
            .on('end', async () => {
                try {
                    // 4. PROCESAR DESDUPLICACIÓN Y NORMALIZACIÓN
                    for (const row of rows) {
                        // Normalizar datos
                        const normalizedRow = {
                            enrollment_id: row.enrollment_id,
                            enrollment_date: row.enrollment_date,
                            completion_percentage: parseInt(row.completion_percentage),
                            amount_paid: parseInt(row.amount_paid),
                            student_email: row.student_email.toLowerCase().trim(),
                            student_name: row.student_name.trim().replace(/\b\w/g, l => l.toUpperCase()),
                            student_phone: row.student_phone,
                            student_city: row.student_city.trim(),
                            instructor_email: row.instructor_email.toLowerCase().trim(),
                            instructor_name: row.instructor_name.trim().replace(/\b\w/g, l => l.toUpperCase()),
                            instructor_specialty: row.specialty_area.trim(),
                            course_title: row.course_title.trim(),
                            course_category: row.course_category.trim(),
                            course_price: parseInt(row.course_price),
                            duration_hours: parseInt(row.duration_hours),
                            subscription_plan: row.subscription_plan.trim()
                        };

                        // Upsert subscription_plans
                        if (!planMap.has(normalizedRow.subscription_plan)) {
                            const result = await pool.query(
                                `INSERT INTO subscription_plans(name, monthly_price, max_courses_allowed)
                 VALUES($1, $2, $3) ON CONFLICT (name) DO UPDATE SET 
                 monthly_price = EXCLUDED.monthly_price, max_courses_allowed = EXCLUDED.max_courses_allowed
                 RETURNING id`,
                                [normalizedRow.subscription_plan, 35000, 3] // valores fijos del CSV
                            );
                            planMap.set(normalizedRow.subscription_plan, result.rows[0].id);
                            stats.subscriptionPlans++;
                        }

                        // Upsert instructors
                        if (!instructorMap.has(normalizedRow.instructor_email)) {
                            const result = await pool.query(
                                `INSERT INTO instructors(name, email, specialty_area)
                 VALUES($1, $2, $3) ON CONFLICT (email) DO NOTHING RETURNING id`,
                                [normalizedRow.instructor_name, normalizedRow.instructor_email, normalizedRow.instructor_specialty]
                            );
                            if (result.rows.length > 0) {
                                instructorMap.set(normalizedRow.instructor_email, result.rows[0].id);
                                stats.instructors++;
                            } else {
                                // Si ya existe, obtener ID
                                const existing = await pool.query('SELECT id FROM instructors WHERE email = $1', [normalizedRow.instructor_email]);
                                instructorMap.set(normalizedRow.instructor_email, existing.rows[0].id);
                            }
                        }

                        // Upsert students
                        if (!studentMap.has(normalizedRow.student_email)) {
                            const result = await pool.query(
                                `INSERT INTO students(name, email, phone, city)
                 VALUES($1, $2, $3, $4) ON CONFLICT (email) DO NOTHING RETURNING id`,
                                [normalizedRow.student_name, normalizedRow.student_email, normalizedRow.student_phone, normalizedRow.student_city]
                            );
                            if (result.rows.length > 0) {
                                studentMap.set(normalizedRow.student_email, result.rows[0].id);
                                stats.students++;
                            } else {
                                const existing = await pool.query('SELECT id FROM students WHERE email = $1', [normalizedRow.student_email]);
                                studentMap.set(normalizedRow.student_email, existing.rows[0].id);
                            }
                        }

                        // Upsert courses
                        const courseKey = `${normalizedRow.course_title}-${normalizedRow.instructor_email}`;
                        if (!courseMap.has(courseKey)) {
                            const instructorId = instructorMap.get(normalizedRow.instructor_email);
                            const result = await pool.query(
                                `INSERT INTO courses(title, category, price, duration_hours, instructor_id)
                 VALUES($1, $2, $3, $4, $5) ON CONFLICT DO NOTHING RETURNING id`,
                                [normalizedRow.course_title, normalizedRow.course_category, normalizedRow.course_price, normalizedRow.duration_hours, instructorId]
                            );
                            if (result.rows.length > 0) {
                                courseMap.set(courseKey, result.rows[0].id);
                                stats.courses++;
                            } else {
                                const existing = await pool.query(
                                    `SELECT id FROM courses WHERE title = $1 AND instructor_id = $2`,
                                    [normalizedRow.course_title, instructorId]
                                );
                                courseMap.set(courseKey, existing.rows[0].id);
                            }
                        }

                        // Insert enrollment
                        const studentId = studentMap.get(normalizedRow.student_email);
                        const courseId = courseMap.get(courseKey);
                        const planId = planMap.get(normalizedRow.subscription_plan);

                        await pool.query(
                            `INSERT INTO enrollments(id, enrollment_date, completion_percentage, amount_paid, 
                                       student_id, course_id, subscription_plan_id)
               VALUES($1, $2, $3, $4, $5, $6, $7) ON CONFLICT (id) DO NOTHING`,
                            [normalizedRow.enrollment_id, normalizedRow.enrollment_date, normalizedRow.completion_percentage,
                                normalizedRow.amount_paid, studentId, courseId, planId]
                        );
                        stats.enrollments++;

                        // Construir documento MongoDB
                        if (!studentProgressMap.has(normalizedRow.student_email)) {
                            studentProgressMap.set(normalizedRow.student_email, {
                                studentEmail: normalizedRow.student_email,
                                studentName: normalizedRow.student_name,
                                city: normalizedRow.student_city,
                                subscriptionPlan: normalizedRow.subscription_plan,
                                enrollments: [],
                                summary: { totalSpent: 0, completedCourses: 0 }
                            });
                        }

                        const progressDoc = studentProgressMap.get(normalizedRow.student_email);
                        progressDoc.enrollments.push({
                            enrollmentId: normalizedRow.enrollment_id,
                            enrollmentDate: normalizedRow.enrollment_date,
                            completionPercentage: normalizedRow.completion_percentage,
                            amountPaid: normalizedRow.amount_paid,
                            course: {
                                title: normalizedRow.course_title,
                                category: normalizedRow.course_category,
                                price: normalizedRow.course_price,
                                durationHours: normalizedRow.duration_hours
                            },
                            instructor: {
                                name: normalizedRow.instructor_name,
                                email: normalizedRow.instructor_email,
                                specialtyArea: normalizedRow.instructor_specialty
                            }
                        });
                        progressDoc.summary.totalSpent += normalizedRow.amount_paid;
                        if (normalizedRow.completion_percentage === 100) {
                            progressDoc.summary.completedCourses++;
                        }
                    }

                    // 5. Insertar documentos MongoDB
                    for (const doc of studentProgressMap.values()) {
                        await db.collection('student_progress').updateOne(
                            { studentEmail: doc.studentEmail },
                            { $set: doc },
                            { upsert: true }
                        );
                        stats.mongoDocuments++;
                    }

                    stats.duration = ((Date.now() - startTime) / 1000).toFixed(1) + 's';
                    console.log('✅ Migration completed:', stats);
                    resolve(stats);

                } catch (error) {
                    reject(error);
                }
            });
    });
}
