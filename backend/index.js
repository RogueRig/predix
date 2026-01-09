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
   Privy JWT Verification Setup
================================ */

const PRIVY_APP_ID = process.env.PRIVY_APP_ID;

if (!PRIVY_APP_ID) {
  console.error("❌ PRIVY_APP_ID missing");
  process.exit(1);
}

const jwks = jwksClient({
  jwksUri: "https://auth.privy.io/.well-known/jwks.json",
});

function getKey(header, callback) {
  jwks.getSigningKey(header.kid, function (err, key) {
    if (err) return callback(err);
    const signingKey = key.getPublicKey();
    callback(null, signingKey);
  });
}

/* ===============================
   Auth Route
================================ */

app.post("/auth/privy", async (req, res) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({ error: "Missing Authorization header" });
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
          console.error("❌ JWT verify failed:", err.message);
          return res.status(401).json({ error: "Invalid token" });
        }

        // ✅ SUCCESS
        return res.json({
          ok: true,
          userId: decoded.sub,
          wallet: decoded.wallet_address || null,
          email: decoded.email || null,
        });
      }
    );
  } catch (err) {
    console.error("❌ Auth error:", err);
    res.status(500).json({ error: "Server error" });
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