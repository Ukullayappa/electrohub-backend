import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: {
        rejectUnauthorized: false, // 🔥 FIX for SELF_SIGNED_CERT_IN_CHAIN
      },
    })
  : new Pool({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      database: process.env.DB_NAME || "electronics_store",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD,
      ssl: false, // local
    });

// Log successful connection
pool.on("connect", () => {
  console.log("✅ Connected to PostgreSQL database");
});

// Log unexpected errors
pool.on("error", (err) => {
  console.error("❌ Database error:", err.message);
});

export default pool;