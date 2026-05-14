<div align="center">

  <img src="https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=node.js&logoColor=white" />
  <img src="https://img.shields.io/badge/Express-000000?style=for-the-badge&logo=express&logoColor=white" />
  <img src="https://img.shields.io/badge/PostgreSQL-4169E1?style=for-the-badge&logo=postgresql&logoColor=white" />
</div>
  
# EduPlus API

EduPlus is an online learning platform backend that uses a **hybrid persistence architecture**:

- **PostgreSQL / Supabase**: master data with strong consistency
  (students, instructors, courses, subscription plans, enrollments)
- **MongoDB**: student progress documents optimized for fast read access
  (`student_progress` collection)

The goal is to migrate from a flat CSV file to a clean, normalized SQL schema plus a NoSQL model for analytics and dashboards.

---

## Tech Stack

- Node.js 18+
- Express.js 4
- PostgreSQL / Supabase (`pg`)
- MongoDB (`mongodb` driver)
- CSV parsing with `csv-parser`
- Environment management with `dotenv`
- API testing with Postman

---

## Project Structure

```text
eduplus-api/
├── src/
│   ├── config/
│   │   ├── postgres.js
│   │   ├── mongodb.js
│   │   └── env.js
│   ├── services/
│   │   ├── migrationService.js
│   │   ├── studentService.js
│   │   ├── courseService.js
│   │   ├── enrollmentService.js
│   │   └── reportService.js
│   ├── routes/
│   │   ├── students.js
│   │   ├── courses.js
│   │   ├── enrollments.js
│   │   ├── reports.js
│   │   └── migration.js
│   ├── app.js
│   └── server.js
├── sql/
│   ├── schema.sql
│   ├── indexes.sql
│   └── queries.sql
├── data/
│   └── eduplus_data.csv
├── .env
├── .env.example
├── package.json
└── README.md
```

---

## Setup Instructions

### 1. Clone the repository

```bash
git clone <your-repo-url>
cd eduplus-api
npm install
```

### 2. Configure environment variables

Create `.env` from `.env.example`:

```env
PORT=3000
DATABASE_URL=postgresql://user:password@host:5432/eduplus
MONGODB_URI=mongodb://localhost:27017
MONGODB_DB=eduplus
CSV_PATH=./data/eduplus_data.csv
```

### 3. Run SQL schema

In Supabase SQL editor, run in this order:

```bash
sql/schema.sql   ← creates all tables with constraints and FKs
sql/indexes.sql  ← creates indexes for frequent queries
```

### 4. Start the server

```bash
npx nodemon src/server.js
```

Expected output:

```
✅ Connected to PostgreSQL
✅ Connected to MongoDB
🚀 Server running on port 3000
```

### 5. Run initial migration

```http
POST /api/migrate
Content-Type: application/json

{
  "clearBefore": true,
  "csvPath": "./data/eduplus_data.csv"
}
```

---

## Architecture Decision

| Data | Database | Reason |
|------|----------|--------|
| students, instructors, courses, enrollments, plans | PostgreSQL | ACID transactions, FK integrity, complex JOINs and reports |
| student_progress | MongoDB | Fast dashboard reads, full history in single document, no JOINs |

### MongoDB document example

```json
{
  "studentEmail": "carlos.j@gmail.com",
  "studentName": "Carlos Jimenez",
  "city": "Medellín",
  "subscriptionPlan": "Plan Básico",
  "enrollments": [
    {
      "enrollmentId": "ENR-2001",
      "completionPercentage": 100,
      "amountPaid": 250000,
      "course": {
        "title": "Fundamentos de JavaScript",
        "category": "Programación",
        "durationHours": 40
      },
      "instructor": {
        "name": "Ana Martínez",
        "specialtyArea": "JavaScript"
      }
    }
  ],
  "summary": {
    "totalSpent": 430000,
    "completedCourses": 2
  }
}
```

---

## Normalization Analysis

The original CSV had all entities in a single flat table, violating normal forms:

### 3NF Violation
`subscription_monthly_price` and `max_courses_allowed` depend on `subscription_plan`, not on `enrollment_id`.
**Solution**: created `subscription_plans(id, name, monthly_price, max_courses_allowed)`.

### 2NF Violation
`instructor_name`, `instructor_email`, `specialty_area` are repeated in every enrollment row.
**Solution**: created `instructors(id, name, email, specialty_area)` and referenced it from `courses`.

### 1NF Issues
Inconsistent name representations: `"Ana Martinez"`, `"Ana Martínez"`, `"ana martinez"`.
**Solution**: `students` and `instructors` tables enforce `UNIQUE(email)` as business key, names normalized on migration.

### Question — Why is hard delete dangerous for a student with paid enrollments?
Deleting a student who has payment records in `enrollments` would destroy financial audit trails.
The company could lose proof of transactions, causing accounting and legal problems.
**Solution**: soft delete with `is_active = FALSE` preserves all payment history.

---

## Database Schema (Mermaid ER)

```mermaid
erDiagram
    subscription_plans {
        int id PK
        varchar name
        int monthly_price
        int max_courses_allowed
    }

    instructors {
        int id PK
        varchar name
        varchar email
        varchar specialty_area
    }

    students {
        int id PK
        varchar name
        varchar email
        varchar phone
        varchar city
        boolean is_active
    }

    courses {
        int id PK
        varchar title
        varchar category
        int price
        int duration_hours
        int instructor_id FK
    }

    enrollments {
        text id PK
        date enrollment_date
        int completion_percentage
        int amount_paid
        int student_id FK
        int course_id FK
        int subscription_plan_id FK
    }

    subscription_plans ||--o{ enrollments : "plan"
    students ||--o{ enrollments : "enrolls"
    instructors ||--o{ courses : "teaches"
    courses ||--o{ enrollments : "has"
```

---

## API Endpoints

### Health

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/api/health` | No | PostgreSQL connection status |

---

### Students

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/students` | Yes | Create a new student |
| GET | `/api/students` | No | List active students (filters: city, plan) |
| GET | `/api/students/:id` | No | Get student with their enrollments |
| PUT | `/api/students/:id` | Yes | Update name, phone or city |
| DELETE | `/api/students/:id` | No | Soft delete (is_active = false) |

**Create student**
```http
POST /api/students
{
  "name": "Daniela Ospina",
  "email": "daniela.o@gmail.com",
  "phone": "3056789012",
  "city": "Pereira",
  "subscriptionPlanId": 1
}
```

**Update student**
```http
PUT /api/students/1
{
  "phone": "3099999999",
  "city": "Barranquilla"
}
```

**Business rules**:
- `email` cannot be modified after creation → `400 Email cannot be modified`
- Duplicate email → `400 Email already registered`
- Student not found → `404 Student not found`

---

### Courses

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/courses` | Yes | Create course linked to an instructor |
| GET | `/api/courses` | No | List courses (optional filter: category) |
| GET | `/api/courses/:id` | No | Course detail with enrollment count |
| PUT | `/api/courses/:id` | Yes | Update title, category, price, duration |
| DELETE | `/api/courses/:id` | No | Delete only if no active enrollments |

**Create course**
```http
POST /api/courses
{
  "title": "Node.js Avanzado",
  "category": "Programación",
  "price": 350000,
  "duration_hours": 50,
  "instructor_id": 1
}
```

**Business rules**:
- `instructor_id` cannot be changed after creation
- Delete with active students → `409 Cannot delete course with active enrollments`
- Instructor not found → `404 Instructor not found`

---

### Enrollments

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/enrollments` | Yes | Enroll a student into a course |
| GET | `/api/enrollments/student/:studentId` | No | Get all enrollments for a student |
| PATCH | `/api/enrollments/:id/progress` | Yes | Update completion percentage |

**Create enrollment**
```http
POST /api/enrollments
{
  "studentId": 4,
  "courseId": 6,
  "subscriptionPlanId": 3,
  "amountPaid": 250000
}
```

**Update progress**
```http
PATCH /api/enrollments/039821f9-0842-4cd3-9486-3e4ec348ecb8/progress
{
  "completionPercentage": 75
}
```

**Business rules**:
- Duplicate enrollment → `409 Student already enrolled in this course`
- `amountPaid` > `course.price` → `400 Amount paid exceeds course price`
- `completionPercentage` outside 0–100 → `400 Invalid percentage (0-100)`

---

### Migration

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| POST | `/api/migrate` | Yes | Idempotent CSV migration to SQL + MongoDB |

```http
POST /api/migrate
{
  "clearBefore": true,
  "csvPath": "./data/eduplus_data.csv"
}
```

Expected response:
```json
{
  "ok": true,
  "message": "Migration completed successfully",
  "stats": {
    "students": 3,
    "instructors": 3,
    "subscriptionPlans": 2,
    "courses": 5,
    "enrollments": 5,
    "mongoDocuments": 3,
    "duration": "1.2s"
  }
}
```

---

### Reports

| Method | Endpoint | Body | Description |
|--------|----------|------|-------------|
| GET | `/api/reports/revenue-by-category` | No | Revenue, enrollments and avg completion per category |
| GET | `/api/reports/top-instructors` | No | Top 5 instructors by revenue |
| GET | `/api/reports/top-students` | No | Students with at least one completed course |
| GET | `/api/reports/low-performance-courses` | No | Courses with avg completion below 40% |

---

## Error Reference

| Code | Meaning |
|------|---------|
| 400 | Validation error (missing fields, invalid values) |
| 404 | Resource not found |
| 409 | Business rule conflict (duplicate, active students) |
| 500 | Unexpected server or database error |

---

## Postman Testing

1. Set variable: `baseUrl = http://localhost:3000`
2. Import collection: `EduPlus_API.postman_collection.json`
3. Run in order: health → migrate → students → courses → enrollments → reports

Example test script:

```js
pm.test("Status is 201", function () {
  pm.response.to.have.status(201);
});

pm.test("ok is true", function () {
  const json = pm.response.json();
  pm.expect(json.ok).to.eql(true);
});
```
--------------------------------------


### Crear el proyecto y dependencias
En tu carpeta de trabajo:

```bash
mkdir eduplus-api && cd eduplus-api
npm init -y
npm install express pg mongodb csv-parser dotenv
npm install nodemon --save-dev
```
