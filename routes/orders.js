const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authenticate, isAdmin } = require('../middleware/auth');

// Generate order number
const generateOrderNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `EH-${timestamp}-${random}`;
};

// @GET /api/orders - Get user orders
router.get('/', authenticate, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    const query = req.user.role === 'admin'
      ? `SELECT o.*, u.name as user_name, u.email as user_email FROM orders o
         LEFT JOIN users u ON o.user_id = u.id
         ORDER BY o.created_at DESC LIMIT $1 OFFSET $2`
      : `SELECT o.* FROM orders o WHERE o.user_id = $1
         ORDER BY o.created_at DESC LIMIT $2 OFFSET $3`;

    const params = req.user.role === 'admin'
      ? [parseInt(limit), parseInt(offset)]
      : [req.user.id, parseInt(limit), parseInt(offset)];

    const result = await pool.query(query, params);

    // Get order items for each order
    const orders = await Promise.all(result.rows.map(async (order) => {
      const items = await pool.query(`
        SELECT oi.*, p.name, p.slug, p.images, p.brand
        FROM order_items oi
        LEFT JOIN products p ON oi.product_id = p.id
        WHERE oi.order_id = $1
      `, [order.id]);
      return { ...order, items: items.rows };
    }));

    res.json({ success: true, orders });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @POST /api/orders - Create order
router.post('/', authenticate, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { shippingAddress, billingAddress, paymentMethod, notes } = req.body;

    // Get cart items
    const cartResult = await client.query(`
      SELECT ci.*, p.price, p.stock, p.name as product_name, p.images
      FROM cart_items ci
      JOIN products p ON ci.product_id = p.id
      WHERE ci.user_id = $1
    `, [req.user.id]);

    if (cartResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({ success: false, message: 'Cart is empty' });
    }

    const items = cartResult.rows;

    // Verify stock for all items
    for (const item of items) {
      if (item.stock < item.quantity) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: `Insufficient stock for ${item.product_name}`
        });
      }
    }

    const subtotal = items.reduce((sum, item) => sum + (item.price * item.quantity), 0);
    const tax = subtotal * 0.18; // 18% GST
    const shipping = subtotal > 5000 ? 0 : 199;
    const total = subtotal + tax + shipping;
    const orderNumber = generateOrderNumber();

    // Create order
    const orderResult = await client.query(`
      INSERT INTO orders (user_id, order_number, subtotal, tax, shipping, total,
        shipping_address, billing_address, payment_method, notes)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *
    `, [req.user.id, orderNumber, subtotal, tax, shipping, total,
        JSON.stringify(shippingAddress), JSON.stringify(billingAddress || shippingAddress),
        paymentMethod, notes]);

    const order = orderResult.rows[0];

    // Create order items and update stock
    for (const item of items) {
      await client.query(`
        INSERT INTO order_items (order_id, product_id, quantity, price, product_snapshot)
        VALUES ($1, $2, $3, $4, $5)
      `, [order.id, item.product_id, item.quantity, item.price,
          JSON.stringify({ name: item.product_name, images: item.images })]);

      await client.query(`
        UPDATE products SET stock = stock - $1, sold_count = sold_count + $1 WHERE id = $2
      `, [item.quantity, item.product_id]);
    }

    // Clear cart
    await client.query('DELETE FROM cart_items WHERE user_id = $1', [req.user.id]);

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Order placed successfully',
      order: { ...order, items }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create order error:', error);
    res.status(500).json({ success: false, message: 'Server error while creating order' });
  } finally {
    client.release();
  }
});

// @GET /api/orders/:id
router.get('/:id', authenticate, async (req, res) => {
  try {
    const query = req.user.role === 'admin'
      ? 'SELECT o.*, u.name as user_name, u.email FROM orders o LEFT JOIN users u ON o.user_id = u.id WHERE o.id = $1'
      : 'SELECT * FROM orders WHERE id = $1 AND user_id = $2';

    const params = req.user.role === 'admin' ? [req.params.id] : [req.params.id, req.user.id];
    const orderResult = await pool.query(query, params);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    const items = await pool.query(`
      SELECT oi.*, p.name, p.slug, p.images, p.brand
      FROM order_items oi
      LEFT JOIN products p ON oi.product_id = p.id
      WHERE oi.order_id = $1
    `, [req.params.id]);

    res.json({ success: true, order: { ...orderResult.rows[0], items: items.rows } });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @PUT /api/orders/:id/status - Admin update order status
router.put('/:id/status', authenticate, isAdmin, async (req, res) => {
  try {
    const { status, payment_status, tracking_number } = req.body;

    const result = await pool.query(`
      UPDATE orders SET status=$1, payment_status=COALESCE($2, payment_status),
        tracking_number=COALESCE($3, tracking_number), updated_at=NOW()
      WHERE id=$4 RETURNING *
    `, [status, payment_status, tracking_number, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    res.json({ success: true, message: 'Order status updated', order: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @GET /api/orders/admin/stats
router.get('/admin/stats', authenticate, isAdmin, async (req, res) => {
  try {
    const [totalOrders, totalRevenue, totalUsers, totalProducts, recentOrders, topProducts] = await Promise.all([
      pool.query(`SELECT COUNT(*) as count, SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END) as revenue FROM orders`),
      pool.query(`SELECT DATE_TRUNC('month', created_at) as month, SUM(total) as revenue, COUNT(*) as orders FROM orders WHERE created_at >= NOW() - INTERVAL '6 months' AND status != 'cancelled' GROUP BY month ORDER BY month`),
      pool.query(`SELECT COUNT(*) as count FROM users WHERE role = 'customer'`),
      pool.query(`SELECT COUNT(*) as count FROM products`),
      pool.query(`SELECT o.*, u.name as user_name FROM orders o LEFT JOIN users u ON o.user_id = u.id ORDER BY o.created_at DESC LIMIT 5`),
      pool.query(`SELECT p.name, p.images, p.sold_count, p.price FROM products p ORDER BY p.sold_count DESC LIMIT 5`)
    ]);

    res.json({
      success: true,
      stats: {
        totalOrders: parseInt(totalOrders.rows[0].count),
        totalRevenue: parseFloat(totalOrders.rows[0].revenue || 0),
        totalUsers: parseInt(totalUsers.rows[0].count),
        totalProducts: parseInt(totalProducts.rows[0].count),
        revenueChart: totalRevenue.rows,
        recentOrders: recentOrders.rows,
        topProducts: topProducts.rows
      }
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
