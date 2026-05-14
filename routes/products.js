import express from "express";
import pool from "../db/pool.js";
import { isLoggedIn, isAdmin } from "../middleware/auth.js";

const router = express.Router();

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
    if (featured === "true") conditions.push("p.is_featured = true");
    if (isNew === "true") conditions.push("p.is_new = true");

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const allowedSorts = ["price", "rating", "created_at", "name", "sold_count"];
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
    console.error("Get products error:", error.message);
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// MUST be before /:id
router.get("/featured", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.is_featured = true
       ORDER BY p.created_at DESC
       LIMIT 8`
    );
    res.json({ success: true, products: result.rows || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// MUST be before /:id
router.get("/new-arrivals", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.is_new = true
       ORDER BY p.created_at DESC
       LIMIT 8`
    );
    res.json({ success: true, products: result.rows || [] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// Single product — was completely missing before
router.get("/:id", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM products p
       LEFT JOIN categories c ON p.category_id = c.id
       WHERE p.id = $1`,
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.json({ success: true, product: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.post("/", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const {
      name, slug, description, price, original_price,
      discount_percent, brand, stock, images,
      category_id, is_featured, is_new, specifications,
    } = req.body;

    const result = await pool.query(
      `INSERT INTO products
         (name, slug, description, price, original_price, discount_percent,
          brand, stock, images, category_id, is_featured, is_new, specifications)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
       RETURNING *`,
      [
        name, slug, description, price, original_price || null,
        discount_percent || 0, brand, stock || 0,
        JSON.stringify(images || []), category_id,
        is_featured || false, is_new || false,
        JSON.stringify(specifications || {}),
      ]
    );

    res.status(201).json({ success: true, product: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.put("/:id", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const {
      name, slug, description, price, original_price,
      discount_percent, brand, stock, images,
      category_id, is_featured, is_new, specifications,
    } = req.body;

    const result = await pool.query(
      `UPDATE products
       SET name=$1, slug=$2, description=$3, price=$4, original_price=$5,
           discount_percent=$6, brand=$7, stock=$8, images=$9, category_id=$10,
           is_featured=$11, is_new=$12, specifications=$13, updated_at=NOW()
       WHERE id=$14
       RETURNING *`,
      [
        name, slug, description, price, original_price || null,
        discount_percent || 0, brand, stock,
        JSON.stringify(images || []), category_id,
        is_featured || false, is_new || false,
        JSON.stringify(specifications || {}),
        req.params.id,
      ]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.json({ success: true, product: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

router.delete("/:id", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const result = await pool.query(
      "DELETE FROM products WHERE id=$1 RETURNING id",
      [req.params.id]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Product not found" });
    }

    res.json({ success: true, message: "Product deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;
