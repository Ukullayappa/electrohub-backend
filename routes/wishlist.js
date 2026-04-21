const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

// @GET /api/wishlist
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT w.id, w.product_id, w.created_at,
             p.name, p.slug, p.price, p.original_price, p.discount_percent,
             p.images, p.brand, p.rating, p.review_count, p.stock
      FROM wishlist w
      JOIN products p ON w.product_id = p.id
      WHERE w.user_id = $1
      ORDER BY w.created_at DESC
    `, [req.user.id]);

    res.json({ success: true, items: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @POST /api/wishlist
router.post('/', authenticate, async (req, res) => {
  try {
    const { productId } = req.body;

    // Check if already in wishlist
    const existing = await pool.query(
      'SELECT id FROM wishlist WHERE user_id=$1 AND product_id=$2',
      [req.user.id, productId]
    );

    if (existing.rows.length > 0) {
      // Remove from wishlist (toggle)
      await pool.query('DELETE FROM wishlist WHERE user_id=$1 AND product_id=$2', [req.user.id, productId]);
      return res.json({ success: true, message: 'Removed from wishlist', action: 'removed' });
    }

    await pool.query(
      'INSERT INTO wishlist (user_id, product_id) VALUES ($1, $2)',
      [req.user.id, productId]
    );

    res.status(201).json({ success: true, message: 'Added to wishlist', action: 'added' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @DELETE /api/wishlist/:productId
router.delete('/:productId', authenticate, async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM wishlist WHERE user_id=$1 AND product_id=$2',
      [req.user.id, req.params.productId]
    );
    res.json({ success: true, message: 'Removed from wishlist' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
