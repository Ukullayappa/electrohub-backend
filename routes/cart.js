const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authenticate } = require('../middleware/auth');

// @GET /api/cart
router.get('/', authenticate, async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT ci.id, ci.quantity, ci.product_id,
             p.name, p.slug, p.price, p.original_price, p.discount_percent,
             p.images, p.brand, p.stock, p.rating
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = $1
      ORDER BY ci.created_at DESC
    `, [req.user.id]);

    const items = result.rows;
    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);

    res.json({ success: true, items, subtotal });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @POST /api/cart
router.post('/', authenticate, async (req, res) => {
  try {
    const { productId, quantity = 1 } = req.body;

    // Check product exists and has stock
    const productCheck = await pool.query('SELECT id, stock, price FROM products WHERE id = $1', [productId]);
    if (productCheck.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    if (productCheck.rows[0].stock < quantity) {
      return res.status(400).json({ success: false, message: 'Insufficient stock' });
    }

    // Insert or update
    const result = await pool.query(`
      INSERT INTO cart_items (user_id, product_id, quantity)
      VALUES ($1, $2, $3)
      ON CONFLICT (user_id, product_id)
      DO UPDATE SET quantity = cart_items.quantity + $3, updated_at = NOW()
      RETURNING *
    `, [req.user.id, productId, quantity]);

    res.status(201).json({ success: true, message: 'Added to cart', item: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @PUT /api/cart/:id
router.put('/:id', authenticate, async (req, res) => {
  try {
    const { quantity } = req.body;

    if (quantity < 1) {
      return res.status(400).json({ success: false, message: 'Quantity must be at least 1' });
    }

    const result = await pool.query(
      'UPDATE cart_items SET quantity=$1, updated_at=NOW() WHERE id=$2 AND user_id=$3 RETURNING *',
      [quantity, req.params.id, req.user.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Cart item not found' });
    }

    res.json({ success: true, message: 'Cart updated', item: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @DELETE /api/cart/:id
router.delete('/:id', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM cart_items WHERE id=$1 AND user_id=$2', [req.params.id, req.user.id]);
    res.json({ success: true, message: 'Item removed from cart' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @DELETE /api/cart - Clear cart
router.delete('/', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM cart_items WHERE user_id=$1', [req.user.id]);
    res.json({ success: true, message: 'Cart cleared' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @GET /api/cart/count
router.get('/count', authenticate, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT COALESCE(SUM(quantity), 0) as count FROM cart_items WHERE user_id=$1',
      [req.user.id]
    );
    res.json({ success: true, count: parseInt(result.rows[0].count) });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
