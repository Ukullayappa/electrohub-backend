import pg from "pg";
import dotenv from "dotenv";

dotenv.config(); // load .env file

const { Pool } = pg;

// Are we running on the live server (Render) or on our laptop?
const isProduction = process.env.NODE_ENV === "production";

// If DATABASE_URL exists → we're on Render. Otherwise use local config.
const pool = process.env.DATABASE_URL
  ? new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: isProduction ? { rejectUnauthorized: false } : false,
    })
  : new Pool({
      host: process.env.DB_HOST || "localhost",
      port: parseInt(process.env.DB_PORT) || 5432,
      database: process.env.DB_NAME || "electronics_store",
      user: process.env.DB_USER || "postgres",
      password: process.env.DB_PASSWORD,
    });

// This runs once when a connection is first made — just for logging
pool.on("connect", () => {
  console.log("✅ Connected to PostgreSQL database");
});

// This runs if the database crashes unexpectedly
pool.on("error", (err) => {
  console.error("❌ Database error:", err.message);
});

export default pool;