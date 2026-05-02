import express from "express";
import bcrypt from "bcryptjs";
import passport from "../middleware/passport.js";
import pool from "../db/pool.js";
import { isLoggedIn } from "../middleware/auth.js";

const router = express.Router();

// ── REGISTER ───────────────────────────────────────────────
// POST /api/auth/register
// Creates a new user account

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, phone } = req.body;

    // 1. Basic validation — make sure required fields are present
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Name, email, and password are required",
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters",
      });
    }

    // 2. Check if this email is already registered
    const existing = await pool.query("SELECT id FROM users WHERE email = $1", [email]);
    if (existing.rows.length > 0) {
      return res.status(409).json({
        success: false,
        message: "An account with this email already exists",
      });
    }

    // 3. Hash the password — NEVER store plain text passwords!
    //    bcrypt.hash(password, saltRounds) — 10 rounds is a safe default
    const hashedPassword = await bcrypt.hash(password, 10);

    // 4. Save the new user to the database
    const result = await pool.query(
      "INSERT INTO users (name, email, password, phone) VALUES ($1, $2, $3, $4) RETURNING id, name, email, role, avatar, phone",
      [name, email, hashedPassword, phone]
    );

    const newUser = result.rows[0];

    // 5. Log them in automatically after registering
    //    req.login() is added by Passport — it creates the session
    req.login(newUser, (err) => {
      if (err) {
        return res.status(500).json({ success: false, message: "Login after register failed" });
      }
      res.status(201).json({
        success: true,
        message: "Account created successfully!",
        user: newUser,
      });
    });

  } catch (error) {
    console.error("Register error:", error);
    res.status(500).json({ success: false, message: "Server error during registration" });
  }
});

// ── LOGIN ──────────────────────────────────────────────────
// POST /api/auth/login
// passport.authenticate("local") calls our LocalStrategy from passport.js
// If login succeeds → req.user is set and session cookie is created
// If login fails → returns 401 with error message

router.post("/login", (req, res, next) => {
  passport.authenticate("local", (err, user, info) => {
    // err = server/database error
    // user = the user object if login worked, false if it failed
    // info = the message we passed in done(null, false, { message: "..." })

    if (err) {
      return next(err); // unexpected error — let the error handler deal with it
    }

    if (!user) {
      // Login failed (wrong email or password)
      return res.status(401).json({
        success: false,
        message: info?.message || "Invalid email or password",
      });
    }

    // Login worked! Now create the session.
    req.login(user, (err) => {
      if (err) return next(err);

      // Don't send the password back to the client
      const { password, ...userWithoutPassword } = user;

      res.json({
        success: true,
        message: "Logged in successfully!",
        user: userWithoutPassword,
      });
    });

  })(req, res, next);
});

// ── LOGOUT ─────────────────────────────────────────────────
// POST /api/auth/logout
// Destroys the session — user is now logged out

router.post("/logout", (req, res) => {
  req.logout((err) => {
    if (err) {
      return res.status(500).json({ success: false, message: "Logout failed" });
    }
    res.json({ success: true, message: "Logged out successfully" });
  });
});

// ── GET CURRENT USER ───────────────────────────────────────
// GET /api/auth/me
// Returns the currently logged-in user's info
// isLoggedIn guard makes sure only authenticated users can access this

router.get("/me", isLoggedIn, async (req, res) => {
  try {
    // req.user is loaded by Passport from the session automatically
    const result = await pool.query(
      "SELECT id, name, email, role, avatar, phone, address, created_at FROM users WHERE id = $1",
      [req.user.id]
    );
    res.json({ success: true, user: result.rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── UPDATE PROFILE ─────────────────────────────────────────
// PUT /api/auth/profile
// Lets the user update their name, phone, and address

router.put("/profile", isLoggedIn, async (req, res) => {
  try {
    const { name, phone, address } = req.body;

    const result = await pool.query(
      "UPDATE users SET name=$1, phone=$2, address=$3, updated_at=NOW() WHERE id=$4 RETURNING id, name, email, role, avatar, phone, address",
      [name, phone, JSON.stringify(address), req.user.id]
    );

    res.json({
      success: true,
      message: "Profile updated",
      user: result.rows[0],
    });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

// ── CHANGE PASSWORD ────────────────────────────────────────
// PUT /api/auth/password
// User must provide their current password to set a new one

router.put("/password", isLoggedIn, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    // 1. Fetch the current hashed password from DB
    const result = await pool.query("SELECT password FROM users WHERE id=$1", [req.user.id]);
    const user = result.rows[0];

    // 2. Make sure the current password they typed is correct
    const isMatch = await bcrypt.compare(currentPassword, user.password);
    if (!isMatch) {
      return res.status(400).json({
        success: false,
        message: "Current password is incorrect",
      });
    }

    // 3. Hash and save the new password
    const hashedNewPassword = await bcrypt.hash(newPassword, 10);
    await pool.query(
      "UPDATE users SET password=$1, updated_at=NOW() WHERE id=$2",
      [hashedNewPassword, req.user.id]
    );

    res.json({ success: true, message: "Password changed successfully" });
  } catch (error) {
    res.status(500).json({ success: false, message: "Server error" });
  }
});

export default router;