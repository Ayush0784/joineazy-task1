# Joineazy – Student, Group & Assignment Management System (Task 1)

A full-stack role-based academic workflow platform enabling **Professors (Admins)** to create and track assignments with OneDrive submission links, and **Students** to form groups, invite peers, and perform two-step verified assignment submissions.

- **Live Frontend (Vercel):** https://joineazy-task1-chi.vercel.app
- **Live Backend API (Render):** https://joineazy-task1-bie6.onrender.com
- **Demo Credentials:**
  - **Professor (Admin):** `prof@joineazy.com` / `123456`
  - **Student:** `student1@joineazy.com` / `123456`

---

## 1. Overview of Implementation
- **Role-Based JWT Authentication:** Supports `STUDENT` and `ADMIN` (Professor) roles with `bcryptjs` password hashing and stateless Bearer JWT tokens (`24h` expiry).
- **Student Group Management:** Students create groups, automatically become the initial member, and invite peers via student email or numeric ID.
- **Targeted Assignment Distribution:** Professors create and edit assignments with external OneDrive folder links and target either `ALL` students or `SPECIFIC` groups.
- **Two-Step Submission Confirmation:** Students access the OneDrive submission folder and confirm group-level submission once, preventing duplicate submissions via database-level unique constraints (`UNIQUE(assignment_id, group_id)`).
- **Real-Time Admin Analytics:** Professors monitor total assignments, active student groups, overall submission completion rates, and group-by-group submission status.

---

## 2. System Architecture & Data Flow
```text
┌───────────────────────────┐       HTTPS / REST JSON        ┌──────────────────────────────────┐
│   React + Tailwind CSS    │ ─────────────────────────────▶ │     Node.js + Express API        │
│    (Hosted on Vercel)     │ ◀───────────────────────────── │        (Hosted on Render)        │
└───────────────────────────┘     JWT Bearer Authorization   └──────────────────────────────────┘
                                                                              │
                                                                    SSL PostgreSQL Pool
                                                                              ▼
                                                             ┌──────────────────────────────────┐
                                                             │    Neon Serverless PostgreSQL    │
                                                             │  (Auto-initialized schema.sql)   │
                                                             └──────────────────────────────────┘