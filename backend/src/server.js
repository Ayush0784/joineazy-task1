const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const fs = require('fs');
const path = require('path');
const pool = require('./config/db');
const { authenticate, authorizeRole } = require('./middleware/auth');
require('dotenv').config();

// Auto-initialize Neon database tables on startup
pool.query(fs.readFileSync(path.join(__dirname, 'schema.sql'), 'utf8'))
  .then(() => console.log('Database schema initialized'))
  .catch((err) => console.error('Schema init error:', err.message));

const app = express();
app.use(cors());
app.use(express.json());

// ==================== AUTH ROUTES ====================
app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, password, role } = req.body;
    const hashed = await bcrypt.hash(password, 10);
    const result = await pool.query(
      'INSERT INTO users (name, email, password_hash, role) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role',
      [name, email, hashed, role.toUpperCase()]
    );
    res.status(201).json({ user: result.rows[0] });
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    const result = await pool.query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];
    if (!user || !(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }
    const token = jwt.sign(
      { id: user.id, role: user.role, name: user.name },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );
    res.json({
      token,
      user: { id: user.id, name: user.name, email: user.email, role: user.role }
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== GROUP ROUTES (STUDENT) ====================
// Create a group and add creator as first member
app.post('/api/groups', authenticate, authorizeRole('STUDENT'), async (req, res) => {
  try {
    const { name } = req.body;
    const groupRes = await pool.query(
      'INSERT INTO groups (name, created_by) VALUES ($1, $2) RETURNING *',
      [name, req.user.id]
    );
    const group = groupRes.rows[0];
    await pool.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
      [group.id, req.user.id]
    );
    res.status(201).json(group);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Add member by student email or student ID
app.post('/api/groups/:id/members', authenticate, authorizeRole('STUDENT'), async (req, res) => {
  try {
    const { identifier } = req.body; // email or numeric user ID
    const isNumeric = !isNaN(identifier);
    const userRes = await pool.query(
      isNumeric
        ? 'SELECT id, name, email FROM users WHERE id = $1 AND role = $2'
        : 'SELECT id, name, email FROM users WHERE email = $1 AND role = $2',
      [identifier, 'STUDENT']
    );
    if (userRes.rows.length === 0) {
      return res.status(404).json({ error: 'Student not found with that email or ID' });
    }
    const member = userRes.rows[0];
    await pool.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
      [req.params.id, member.id]
    );
    res.status(201).json({ message: 'Member added', member });
  } catch (err) {
    res.status(400).json({ error: 'Member already in group or invalid request' });
  }
});

// Get logged-in student's group & members
app.get('/api/groups/my', authenticate, authorizeRole('STUDENT'), async (req, res) => {
  try {
    const groupRes = await pool.query(
      `SELECT g.* FROM groups g
       JOIN group_members gm ON g.id = gm.group_id
       WHERE gm.user_id = $1 LIMIT 1`,
      [req.user.id]
    );
    if (groupRes.rows.length === 0) return res.json(null);

    const group = groupRes.rows[0];
    const membersRes = await pool.query(
      `SELECT u.id, u.name, u.email FROM users u
       JOIN group_members gm ON u.id = gm.user_id
       WHERE gm.group_id = $1`,
      [group.id]
    );
    res.json({ ...group, members: membersRes.rows });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all groups (for Admin dropdown when targeting specific groups)
app.get('/api/groups', authenticate, authorizeRole('ADMIN'), async (req, res) => {
  try {
    const result = await pool.query('SELECT id, name FROM groups ORDER BY id ASC');
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// ==================== ASSIGNMENT ROUTES ====================
// Admin: Create assignment
app.post('/api/assignments', authenticate, authorizeRole('ADMIN'), async (req, res) => {
  try {
    const { title, description, due_date, onedrive_link, target_type, group_ids } = req.body;
    const assignRes = await pool.query(
      `INSERT INTO assignments (title, description, due_date, onedrive_link, target_type, created_by)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [title, description, due_date, onedrive_link, target_type || 'ALL', req.user.id]
    );
    const assignment = assignRes.rows[0];

    if (target_type === 'SPECIFIC' && Array.isArray(group_ids)) {
      for (const gid of group_ids) {
        await pool.query(
          'INSERT INTO assignment_targets (assignment_id, group_id) VALUES ($1, $2)',
          [assignment.id, gid]
        );
      }
    }
    res.status(201).json(assignment);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Admin: Edit assignment
app.put('/api/assignments/:id', authenticate, authorizeRole('ADMIN'), async (req, res) => {
  try {
    const { title, description, due_date, onedrive_link } = req.body;
    const result = await pool.query(
      `UPDATE assignments SET title = $1, description = $2, due_date = $3, onedrive_link = $4
       WHERE id = $5 RETURNING *`,
      [title, description, due_date, onedrive_link, req.params.id]
    );
    res.json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: err.message });
  }
});

// Both: View assignments (Filtered by group & joined with submission status for Students)
app.get('/api/assignments', authenticate, async (req, res) => {
  try {
    if (req.user.role === 'ADMIN') {
      const result = await pool.query('SELECT * FROM assignments ORDER BY due_date ASC');
      return res.json(result.rows);
    }

    // Student view: find student's group
    const groupRes = await pool.query(
      'SELECT group_id FROM group_members WHERE user_id = $1 LIMIT 1',
      [req.user.id]
    );
    const groupId = groupRes.rows[0]?.group_id || null;

    const result = await pool.query(
      `SELECT DISTINCT a.*, s.status AS submission_status, s.confirmed_at
       FROM assignments a
       LEFT JOIN assignment_targets at ON a.id = at.assignment_id
       LEFT JOIN submissions s ON a.id = s.assignment_id AND s.group_id = $1
       WHERE a.target_type = 'ALL' OR at.group_id = $1
       ORDER BY a.due_date ASC`,
      [groupId]
    );
    res.json(result.rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Student: Two-step confirmed submission
app.post('/api/assignments/:id/confirm', authenticate, authorizeRole('STUDENT'), async (req, res) => {
  try {
    const groupRes = await pool.query(
      'SELECT group_id FROM group_members WHERE user_id = $1 LIMIT 1',
      [req.user.id]
    );
    if (groupRes.rows.length === 0) {
      return res.status(400).json({ error: 'You must join or create a group before submitting.' });
    }
    const groupId = groupRes.rows[0].group_id;

    const result = await pool.query(
      `INSERT INTO submissions (assignment_id, group_id, confirmed_by, status)
       VALUES ($1, $2, $3, 'SUBMITTED') RETURNING *`,
      [req.params.id, groupId, req.user.id]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    res.status(400).json({ error: 'Assignment already confirmed for this group.' });
  }
});

// Admin: Analytics & group-wise tracking
app.get('/api/analytics', authenticate, authorizeRole('ADMIN'), async (req, res) => {
  try {
    const assignments = (await pool.query('SELECT id, title, target_type FROM assignments')).rows;
    const groups = (await pool.query('SELECT id, name FROM groups')).rows;
    const submissions = (await pool.query(
      `SELECT s.*, u.name AS confirmed_by_name
       FROM submissions s
       LEFT JOIN users u ON s.confirmed_by = u.id`
    )).rows;

    res.json({ assignments, groups, submissions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Backend running on http://localhost:${PORT}`));