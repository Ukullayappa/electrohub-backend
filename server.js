const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

//  CORS 
app.use(cors({
origin: true,        
credentials: true
}));

//  MIDDLEWARE 
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Static files
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ROUTES 
app.use('/api/auth',       require('./routes/auth'));
app.use('/api/products',   require('./routes/products'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/cart',       require('./routes/cart'));
app.use('/api/orders',     require('./routes/orders'));
app.use('/api/wishlist',   require('./routes/wishlist'));

// HEALTH CHECK 
app.get('/api/health', (req, res) => {
res.json({
success: true,
message: 'ElectroHub API is running',
env: process.env.NODE_ENV || 'development',
timestamp: new Date().toISOString(),
});
});

//  404 HANDLER 
app.use((req, res) => {
res.status(404).json({
success: false,
message: `Route ${req.originalUrl} not found`
});
});

//  ERROR HANDLER 
app.use((err, req, res, next) => {
console.error('Server Error:', err.message);
res.status(err.status || 500).json({
success: false,
message: err.message || 'Internal server error',
});
});

// TO START SERVER 
app.listen(PORT, '0.0.0.0', () => {
console.log(`   ╔══════════════════════════════════════════╗
  ║        ElectroHub API Server             ║
  ║  Port   : ${PORT}                          ║
  ║  Env    : ${(process.env.NODE_ENV || 'development').padEnd(12)}             ║
  ║  DB     : ${process.env.DATABASE_URL ? 'Render PostgreSQL' : 'Local PostgreSQL'}     ║
  ╚══════════════════════════════════════════╝
  `);
});

module.exports = app;
