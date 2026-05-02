import express from "express";
import pool from "../db/pool.js";
import { isLoggedIn, isAdmin } from "../middleware/auth.js";

const router = express.Router();

// ─────────────────────────────────────────────
// GET ALL PRODUCTS (SAFE VERSION)
// ─────────────────────────────────────────────
router.get("/", async (req, res) => {
  try {
    const {
      page = 1,
      limit = 12,
      category,
      brand,
      minPrice,
      maxPrice,
      sort = "created_at",
      order = "DESC",
      search,
      featured,
      isNew,
    } = req.query;

    const offset = (page - 1) * limit;

    const conditions = [];
    const params = [];
    let paramCount = 1;

    if (category) {
      conditions.push(`c.slug = $${paramCount++}`);
      params.push(category);
    }

    if (brand) {
      conditions.push(`LOWER(p.brand) = LOWER($${paramCount++})`);
      params.push(brand);
    }

    if (minPrice) {
      conditions.push(`p.price >= $${paramCount++}`);
      params.push(parseFloat(minPrice));
    }

    if (maxPrice) {
      conditions.push(`p.price <= $${paramCount++}`);
      params.push(parseFloat(maxPrice));
    }

    if (search) {
      conditions.push(
        `(p.name ILIKE $${paramCount} OR p.brand ILIKE $${paramCount})`
      );
      params.push(`%${search}%`);
      paramCount++;
    }

    if (featured === "true") {
      conditions.push("p.is_featured = true");
    }

    if (isNew === "true") {
      conditions.push("p.is_new = true");
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const allowedSorts = ["price", "rating", "created_at", "name"];
    const sortField = allowedSorts.includes(sort) ? sort : "created_at";
    const sortOrder = order.toUpperCase() === "ASC" ? "ASC" : "DESC";

    const productsQuery = `
      SELECT p.*, c.name AS category_name, c.slug AS category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
      ORDER BY p.${sortField} ${sortOrder}
      LIMIT $${paramCount} OFFSET $${paramCount + 1}
    `;

    const countQuery = `
      SELECT COUNT(*) FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      ${whereClause}
    `;

    params.push(parseInt(limit), parseInt(offset));

    const [productsResult, countResult] = await Promise.all([
      pool.query(productsQuery, params),
      pool.query(countQuery, params.slice(0, -2)),
    ]);

    const total = parseInt(countResult.rows[0]?.count || 0);

    res.json({
      success: true,
      products: productsResult.rows || [],
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error("🔥 PRODUCTS ERROR:", error.message);
    console.error("🔥 STACK:", error.stack);

    res.status(500).json({
      success: false,
      message: "Server error",
      error: error.message,
    });
  }
});

// ─────────────────────────────────────────────
// FEATURED PRODUCTS (SAFE)
// ─────────────────────────────────────────────
router.get("/featured", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM products WHERE is_featured = true LIMIT 8`
    );

    res.json({ success: true, products: result.rows || [] });
  } catch (error) {
    console.error("🔥 FEATURED ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

// ─────────────────────────────────────────────
// NEW ARRIVALS (SAFE)
// ─────────────────────────────────────────────
router.get("/new-arrivals", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM products WHERE is_new = true LIMIT 8`
    );

    res.json({ success: true, products: result.rows || [] });
  } catch (error) {
    console.error("🔥 NEW ARRIVALS ERROR:", error.message);

    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
});

export default router;