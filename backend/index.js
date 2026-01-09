import authRoutes from "./auth.js";
import express from "express";
import cors from "cors";
import { PrivyClient } from "@privy-io/server-auth";

const app = express();
const PORT = process.env.PORT || 10000;

/* 🔐 Privy client */
const privy = new PrivyClient(
  process.env.PRIVY_APP_ID,
  process.env.PRIVY_APP_SECRET
);

/* ✅ REQUIRED middleware */
app.use(cors());
app.use(express.json());

/* 🔎 Health check */
app.get("/", (_req, res) => {
  res.json({ ok: true, service: "predix-backend" });
});

/* 🔐 PRIVY AUTH VERIFY */
app.post("/auth/privy", async (req, res) => {
  try {
    const { user } = req.body;

    if (!user?.id) {
      return res.status(400).json({ error: "Missing user object" });
    }

    // Verify user with Privy
    const verifiedUser = await privy.getUser(user.id);

    return res.json({
      ok: true,
      userId: verifiedUser.id,
    });
  } catch (err) {
    console.error("❌ Privy auth error:", err);
    res.status(401).json({ error: "Privy verification failed" });
  }
});

/* 🚀 Start server */
app.listen(PORT, () => {
  console.log(`🚀 Predix backend running on ${PORT}`);
});