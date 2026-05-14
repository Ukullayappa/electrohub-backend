import express from "express";
import pool from "../db/pool.js";
import { isLoggedIn, isAdmin } from "../middleware/auth.js";

const router = express.Router();

const generateOrderNumber = () => {
  const timestamp = Date.now().toString(36).toUpperCase();
  const random = Math.random().toString(36).substring(2, 6).toUpperCase();
  return `EH-${timestamp}-${random}`;
};

// MUST be before /:id — otherwise Express matches "admin" as an order id
router.get("/admin/stats", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const [totalOrders, revenueByMonth, totalUsers, totalProducts, recentOrders, topProducts] =
      await Promise.all([
        pool.query(`
          SELECT
            COUNT(*) AS count,
            SUM(CASE WHEN status != 'cancelled' THEN total ELSE 0 END) AS revenue
          FROM orders
        `),
        pool.query(`
          SELECT
            DATE_TRUNC('month', created_at) AS month,
            SUM(total) AS revenue,
            COUNT(*) AS orders
          FROM orders
          WHERE created_at >= NOW() - INTERVAL '6 months'
            AND status != 'cancelled'
          GROUP BY month
          ORDER BY month
        `),
        pool.query("SELECT COUNT(*) AS count FROM users WHERE role = 'customer'"),
        pool.query("SELECT COUNT(*) AS count FROM products"),
        pool.query(`
          SELECT o.*, u.name AS user_name
          FROM orders o
          LEFT JOIN users u ON o.user_id = u.id
          ORDER BY o.created_at DESC
          LIMIT 5
        `),
        pool.query(
          "SELECT name, images, sold_count, price FROM products ORDER BY sold_count DESC LIMIT 5"
        ),
      ]);

    res.json({
      success: true,
      stats: {
        totalOrders:   parseInt(totalOrders.rows[0].count),
        totalRevenue:  parseFloat(totalOrders.rows[0].revenue || 0),
        totalUsers:    parseInt(totalUsers.rows[0].count),
        totalProducts: parseInt(totalProducts.rows[0].count),
        revenueChart:  revenueByMonth.rows,
        recentOrders:  recentOrders.rows,
        topProducts:   topProducts.rows,
      },
    });
  } catch (error) {
    console.error("Stats error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.get("/", isLoggedIn, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;

    let query, params;

    if (req.user.role === "admin") {
      query = `
        SELECT o.*, u.name AS user_name, u.email AS user_email
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        ORDER BY o.created_at DESC
        LIMIT $1 OFFSET $2
      `;
      params = [parseInt(limit), parseInt(offset)];
    } else {
      query = `
        SELECT * FROM orders
        WHERE user_id = $1
        ORDER BY created_at DESC
        LIMIT $2 OFFSET $3
      `;
      params = [req.user.id, parseInt(limit), parseInt(offset)];
    }

    const result = await pool.query(query, params);

    const orders = await Promise.all(
      result.rows.map(async (order) => {
        const items = await pool.query(
          `SELECT oi.*, p.name, p.slug, p.images, p.brand
           FROM order_items oi
           LEFT JOIN products p ON oi.product_id = p.id
           WHERE oi.order_id = $1`,
          [order.id]
        );
        return { ...order, items: items.rows };
      })
    );

    res.json({ success: true, orders });
  } catch (error) {
    console.error("Get orders error:", error);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/", isLoggedIn, async (req, res) => {
  const client = await pool.connect();

  try {
    await client.query("BEGIN");

    const { shippingAddress, billingAddress, paymentMethod, notes } = req.body;

    if (!shippingAddress || !paymentMethod) {
      await client.query("ROLLBACK");
      return res.status(400).json({
        success: false,
        message: "Shipping address and payment method are required",
      });
    }

    const cartResult = await client.query(
      `SELECT ci.*, p.price, p.stock, p.name AS product_name, p.images
       FROM cart_items ci
       JOIN products p ON ci.product_id = p.id
       WHERE ci.user_id = $1`,
      [req.user.id]
    );

    if (cartResult.rows.length === 0) {
      await client.query("ROLLBACK");
      return res.status(400).json({ success: false, message: "Your cart is empty" });
    }

    const items = cartResult.rows;

    for (const item of items) {
      if (item.stock < item.quantity) {
        await client.query("ROLLBACK");
        return res.status(400).json({
          success: false,
          message: `"${item.product_name}" is out of stock (${item.stock} left)`,
        });
      }
    }

    const subtotal = items.reduce(
      (sum, item) => sum + parseFloat(item.price) * item.quantity,
      0
    );
    const tax      = subtotal * 0.18;
    const shipping = subtotal > 5000 ? 0 : 199;
    const total    = subtotal + tax + shipping;
    const orderNumber = generateOrderNumber();

    const orderResult = await client.query(
      `INSERT INTO orders
         (user_id, order_number, subtotal, tax, shipping, total,
          shipping_address, billing_address, payment_method, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)
       RETURNING *`,
      [
        req.user.id, orderNumber,
        subtotal, tax, shipping, total,
        JSON.stringify(shippingAddress),
        JSON.stringify(billingAddress || shippingAddress),
        paymentMethod,
        notes || null,
      ]
    );

    const order = orderResult.rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO order_items (order_id, product_id, quantity, price, product_snapshot)
         VALUES ($1,$2,$3,$4,$5)`,
        [
          order.id, item.product_id, item.quantity, item.price,
          JSON.stringify({ name: item.product_name, images: item.images }),
        ]
      );

      await client.query(
        "UPDATE products SET stock = stock - $1, sold_count = sold_count + $1 WHERE id = $2",
        [item.quantity, item.product_id]
      );
    }

    await client.query("DELETE FROM cart_items WHERE user_id = $1", [req.user.id]);
    await client.query("COMMIT");

    res.status(201).json({
      success: true,
      message: "Order placed successfully!",
      order: { ...order, items },
    });
  } catch (error) {
    await client.query("ROLLBACK");
    console.error("Create order error:", error);
    res.status(500).json({ success: false, message: "Failed to place order" });
  } finally {
    client.release();
  }
});

// MUST be after /admin/stats
router.get("/:id", isLoggedIn, async (req, res) => {
  try {
    let query, params;

    if (req.user.role === "admin") {
      query = `
        SELECT o.*, u.name AS user_name, u.email
        FROM orders o
        LEFT JOIN users u ON o.user_id = u.id
        WHERE o.id = $1
      `;
      params = [req.params.id];
    } else {
      query = "SELECT * FROM orders WHERE id=$1 AND user_id=$2";
      params = [req.params.id, req.user.id];
    }

    const orderResult = await pool.query(query, params);

    if (orderResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    const itemsResult = await pool.query(
      `SELECT oi.*, p.name, p.slug, p.images, p.brand
       FROM order_items oi
       LEFT JOIN products p ON oi.product_id = p.id
       WHERE oi.order_id = $1`,
      [req.params.id]
    );

    res.json({
      success: true,
      order: { ...orderResult.rows[0], items: itemsResult.rows },
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.put("/:id/status", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { status, payment_status, tracking_number } = req.body;

    const result = await pool.query(
      `UPDATE orders
       SET status=$1,
           payment_status = COALESCE($2, payment_status),
           tracking_number = COALESCE($3, tracking_number),
           updated_at = NOW()
       WHERE id=$4
       RETURNING *`,
      [status, payment_status || null, tracking_number || null, req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Order not found" });
    }

    res.json({ success: true, message: "Order status updated", order: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
