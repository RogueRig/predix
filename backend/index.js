import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import jwksClient from "jwks-rsa";

const app = express();
const PORT = process.env.PORT || 10000;

/* ===============================
   Middleware
================================ */
app.use(cors());
app.use(express.json());

/* ===============================
   Privy Config
================================ */
const PRIVY_APP_ID = process.env.PRIVY_APP_ID;

if (!PRIVY_APP_ID) {
  console.error("❌ PRIVY_APP_ID is missing");
  process.exit(1);
}

/* ===============================
   JWKS Client
================================ */
const jwks = jwksClient({
  jwksUri: "https://auth.privy.io/.well-known/jwks.json",
  cache: true,
  rateLimit: true,
});

/* ===============================
   JWKS Key Resolver
================================ */
function getKey(header, callback) {
  jwks.getSigningKey(header.kid, (err, key) => {
    if (err) {
      console.error("❌ JWKS error:", err.message);
      return callback(err);
    }
    callback(null, key.getPublicKey());
  });
}

/* ===============================
   Auth Route (Privy)
================================ */
app.post("/auth/privy", (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        error: "Missing Authorization header (Bearer token required)",
      });
    }

    const token = authHeader.replace("Bearer ", "");

    jwt.verify(
      token,
      getKey,
      {
        audience: PRIVY_APP_ID,
        issuer: "https://auth.privy.io",
        algorithms: ["RS256"],
      },
      (err, decoded) => {
        if (err) {
          console.error("❌ Privy JWT verification failed:", err.message);
          return res.status(401).json({ error: "Invalid Privy token" });
        }

        // ✅ VERIFIED TOKEN
        return res.json({
          ok: true,
          userId: decoded.sub,
          email: decoded.email ?? null,
          wallet: decoded.wallet_address ?? null,
          issuer: decoded.iss,
        });
      }
    );
  } catch (err) {
    console.error("❌ Auth server error:", err);
    return res.status(500).json({ error: "Server error" });
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