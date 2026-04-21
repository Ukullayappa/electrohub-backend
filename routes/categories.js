const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authenticate, isAdmin } = require('../middleware/auth');

// @GET /api/categories
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT c.*, COUNT(p.id) as product_count
      FROM categories c
      LEFT JOIN products p ON p.category_id = c.id
      GROUP BY c.id
      ORDER BY c.name
    `);
    res.json({ success: true, categories: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @GET /api/categories/:slug
router.get('/:slug', async (req, res) => {
  try {
    const result = await pool.query('SELECT * FROM categories WHERE slug = $1', [req.params.slug]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Category not found' });
    }
    res.json({ success: true, category: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @POST /api/categories
router.post('/', authenticate, isAdmin, async (req, res) => {
  try {
    const { name, slug, description, icon, image } = req.body;
    const result = await pool.query(
      'INSERT INTO categories (name, slug, description, icon, image) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [name, slug, description, icon, image]
    );
    res.status(201).json({ success: true, category: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @PUT /api/categories/:id
router.put('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const { name, description, icon, image } = req.body;
    const result = await pool.query(
      'UPDATE categories SET name=$1, description=$2, icon=$3, image=$4 WHERE id=$5 RETURNING *',
      [name, description, icon, image, req.params.id]
    );
    res.json({ success: true, category: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @DELETE /api/categories/:id
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    await pool.query('DELETE FROM categories WHERE id=$1', [req.params.id]);
    res.json({ success: true, message: 'Category deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
