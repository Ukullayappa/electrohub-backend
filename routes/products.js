const express = require('express');
const router = express.Router();
const pool = require('../db/pool');
const { authenticate, isAdmin } = require('../middleware/auth');

// @GET /api/products - Get all products with filters
router.get('/', async (req, res) => {
  try {
    const {
      page = 1, limit = 12, category, brand, minPrice, maxPrice,
      sort = 'created_at', order = 'DESC', search, featured, isNew
    } = req.query;

    const offset = (page - 1) * limit;
    let conditions = [];
    let params = [];
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
      conditions.push(`(p.name ILIKE $${paramCount} OR p.brand ILIKE $${paramCount} OR p.short_description ILIKE $${paramCount})`);
      params.push(`%${search}%`);
      paramCount++;
    }
    if (featured === 'true') {
      conditions.push(`p.is_featured = true`);
    }
    if (isNew === 'true') {
      conditions.push(`p.is_new = true`);
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const allowedSorts = ['price', 'rating', 'created_at', 'sold_count', 'name'];
    const sortField = allowedSorts.includes(sort) ? sort : 'created_at';
    const sortOrder = order.toUpperCase() === 'ASC' ? 'ASC' : 'DESC';

    const query = `
      SELECT p.*, c.name as category_name, c.slug as category_slug
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
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, -2))
    ]);

    const total = parseInt(countResult.rows[0].count);

    res.json({
      success: true,
      products: productsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @GET /api/products/featured
router.get('/featured', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_featured = true
      ORDER BY p.rating DESC LIMIT 8
    `);
    res.json({ success: true, products: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @GET /api/products/new
router.get('/new-arrivals', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.is_new = true
      ORDER BY p.created_at DESC LIMIT 8
    `);
    res.json({ success: true, products: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @GET /api/products/search
router.get('/search', async (req, res) => {
  try {
    const { q, limit = 10 } = req.query;
    if (!q) return res.json({ success: true, products: [] });

    const result = await pool.query(`
      SELECT p.id, p.name, p.slug, p.price, p.images, p.brand, p.rating,
             c.name as category_name
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.name ILIKE $1 OR p.brand ILIKE $1 OR p.short_description ILIKE $1
      ORDER BY p.rating DESC LIMIT $2
    `, [`%${q}%`, parseInt(limit)]);

    res.json({ success: true, products: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @GET /api/products/brands
router.get('/brands', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT DISTINCT brand, COUNT(*) as product_count
      FROM products
      WHERE brand IS NOT NULL
      GROUP BY brand
      ORDER BY product_count DESC
    `);
    res.json({ success: true, brands: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @GET /api/products/:slug
router.get('/:slug', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT p.*, c.name as category_name, c.slug as category_slug
      FROM products p
      LEFT JOIN categories c ON p.category_id = c.id
      WHERE p.slug = $1
    `, [req.params.slug]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }

    const product = result.rows[0];

    // Get related products
    const related = await pool.query(`
      SELECT p.id, p.name, p.slug, p.price, p.original_price, p.discount_percent,
             p.images, p.brand, p.rating, p.review_count
      FROM products p
      WHERE p.category_id = $1 AND p.id != $2
      ORDER BY p.rating DESC LIMIT 4
    `, [product.category_id, product.id]);

    res.json({ success: true, product, relatedProducts: related.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @GET /api/products/:id/reviews
router.get('/:id/reviews', async (req, res) => {
  try {
    const result = await pool.query(`
      SELECT r.*, u.name as user_name, u.avatar as user_avatar
      FROM reviews r
      JOIN users u ON r.user_id = u.id
      WHERE r.product_id = $1
      ORDER BY r.created_at DESC
    `, [req.params.id]);

    res.json({ success: true, reviews: result.rows });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @POST /api/products/:id/reviews
router.post('/:id/reviews', authenticate, async (req, res) => {
  try {
    const { rating, title, body } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const existing = await pool.query(
      'SELECT id FROM reviews WHERE user_id = $1 AND product_id = $2',
      [req.user.id, req.params.id]
    );

    if (existing.rows.length > 0) {
      const result = await pool.query(
        'UPDATE reviews SET rating=$1, title=$2, body=$3, updated_at=NOW() WHERE user_id=$4 AND product_id=$5 RETURNING *',
        [rating, title, body, req.user.id, req.params.id]
      );
      return res.json({ success: true, message: 'Review updated', review: result.rows[0] });
    }

    const result = await pool.query(
      'INSERT INTO reviews (user_id, product_id, rating, title, body) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [req.user.id, req.params.id, rating, title, body]
    );

    res.status(201).json({ success: true, message: 'Review added', review: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// Admin routes
// @POST /api/products
router.post('/', authenticate, isAdmin, async (req, res) => {
  try {
    const { name, slug, description, short_description, price, original_price, discount_percent,
            stock, category_id, brand, sku, images, specifications, features, tags, is_featured, is_new } = req.body;

    const result = await pool.query(`
      INSERT INTO products (name, slug, description, short_description, price, original_price,
        discount_percent, stock, category_id, brand, sku, images, specifications, features, tags, is_featured, is_new)
      VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17) RETURNING *
    `, [name, slug, description, short_description, price, original_price, discount_percent,
        stock, category_id, brand, sku, JSON.stringify(images), JSON.stringify(specifications),
        JSON.stringify(features), JSON.stringify(tags), is_featured, is_new]);

    res.status(201).json({ success: true, product: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error', error: error.message });
  }
});

// @PUT /api/products/:id
router.put('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const { name, description, short_description, price, original_price, discount_percent,
            stock, brand, images, specifications, features, tags, is_featured, is_new } = req.body;

    const result = await pool.query(`
      UPDATE products SET name=$1, description=$2, short_description=$3, price=$4,
        original_price=$5, discount_percent=$6, stock=$7, brand=$8,
        images=$9, specifications=$10, features=$11, tags=$12,
        is_featured=$13, is_new=$14, updated_at=NOW()
      WHERE id=$15 RETURNING *
    `, [name, description, short_description, price, original_price, discount_percent,
        stock, brand, JSON.stringify(images), JSON.stringify(specifications),
        JSON.stringify(features), JSON.stringify(tags), is_featured, is_new, req.params.id]);

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, product: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

// @DELETE /api/products/:id
router.delete('/:id', authenticate, isAdmin, async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM products WHERE id=$1 RETURNING id', [req.params.id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Product not found' });
    }
    res.json({ success: true, message: 'Product deleted' });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Server error' });
  }
});

module.exports = router;
