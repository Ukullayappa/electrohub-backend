import express from "express";
import pool from "../db/pool.js";
import { isLoggedIn, isAdmin } from "../middleware/auth.js";

const router = express.Router();

// ── LIST ALL CATEGORIES ────────────────────────────────────
// GET /api/categories
router.get("/", async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT c.*, COUNT(p.id) AS product_count
       FROM categories c
       LEFT JOIN products p ON p.category_id = c.id
       GROUP BY c.id
       ORDER BY c.name`
    );
    res.json({ success: true, categories: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── GET ONE CATEGORY ───────────────────────────────────────
// GET /api/categories/:slug


router.get("/:slug", async (req, res) => {
  try {
    const result = await pool.query(
      "SELECT * FROM categories WHERE slug = $1",
      [req.params.slug]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: "Category not found" });
    }

    res.json({ success: true, category: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── CREATE CATEGORY ────────────────────────────────────────
// POST /api/categories
// Admin only — isLoggedIn checks for a session, isAdmin checks the role

router.post("/", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, slug, description, icon, image } = req.body;

    const result = await pool.query(
      "INSERT INTO categories (name, slug, description, icon, image) VALUES ($1,$2,$3,$4,$5) RETURNING *",
      [name, slug, description, icon, image]
    );

    res.status(201).json({ success: true, category: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── UPDATE CATEGORY ────────────────────────────────────────
// PUT /api/categories/:id
// Admin only

router.put("/:id", isLoggedIn, isAdmin, async (req, res) => {
  try {
    const { name, description, icon, image } = req.body;

    const result = await pool.query(
      "UPDATE categories SET name=$1, description=$2, icon=$3, image=$4 WHERE id=$5 RETURNING *",
      [name, description, icon, image, req.params.id]
    );

    res.json({ success: true, category: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── DELETE CATEGORY ────────────────────────────────────────
// DELETE /api/categories/:id
// Admin only

router.delete("/:id", isLoggedIn, isAdmin, async (req, res) => {
  try {
    await pool.query("DELETE FROM categories WHERE id=$1", [req.params.id]);
    res.json({ success: true, message: "Category deleted" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;