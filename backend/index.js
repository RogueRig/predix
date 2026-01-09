import express from "express";
import cors from "cors";
import authRoutes from "./auth.js";

const app = express();
const PORT = process.env.PORT || 10000;

/**
 * ✅ STEP 3 — REQUIRED
 * Allows backend to read JSON bodies
 */
app.use(express.json());

/**
 * ✅ CORS — allow frontend + Privy callbacks
 */
app.use(
  cors({
    origin: "*",
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

/**
 * ✅ Auth routes
 */
app.use("/auth", authRoutes);

/**
 * ✅ Health check
 */
app.get("/health", (_req, res) => {
  res.json({ ok: true });
});

/**
 * ✅ Start server
 */
app.listen(PORT, () => {
  console.log(`🚀 Predix backend running on port ${PORT}`);
});