import express from "express";
import cors from "cors";
import { PrivyClient } from "@privy-io/server-auth";

const app = express();
const PORT = process.env.PORT || 10000;

/* ===============================
   Middleware
================================ */
app.use(cors());
app.use(express.json());

/* ===============================
   Privy Server Client
================================ */
const PRIVY_APP_ID = process.env.PRIVY_APP_ID;
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET;

if (!PRIVY_APP_ID || !PRIVY_APP_SECRET) {
  console.error("❌ PRIVY_APP_ID or PRIVY_APP_SECRET missing");
  process.exit(1);
}

const privy = new PrivyClient(
  PRIVY_APP_ID,
  PRIVY_APP_SECRET
);

/* ===============================
   Auth Route (Privy)
================================ */
app.post("/auth/privy", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Missing Authorization header",
      });
    }

    const token = authHeader.replace("Bearer ", "");

    // ✅ OFFICIAL PRIVY VERIFICATION
    const verified = await privy.verifyAuthToken(token);

    return res.json({
      ok: true,
      userId: verified.userId,
      wallet: verified.wallet?.address ?? null,
      email: verified.email ?? null,
    });
  } catch (err) {
    console.error("❌ Privy verification failed:", err.message);
    return res.status(401).json({
      error: "Invalid Privy token",
    });
  }
});

/* ===============================
   Health Check
================================ */
app.get("/", (_, res) => {
  res.send("✅ Predix backend running");
});

/* ===============================
   Start Server
================================ */
app.listen(PORT, () => {
  console.log(`🚀 Predix backend listening on ${PORT}`);
});