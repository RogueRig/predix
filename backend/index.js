import express from "express";
import cors from "cors";

const app = express();

app.use(cors());
app.use(express.json());

app.post("/auth/privy", async (req, res) => {
  try {
    const { user } = req.body;

    if (!user || !user.id) {
      return res.status(400).json({ error: "Invalid Privy user" });
    }

    // 🔐 Later we will verify signature / JWT
    console.log("✅ Privy user received:", user.id);

    res.json({
      ok: true,
      userId: user.id,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Auth failed" });
  }
});

app.listen(process.env.PORT || 10000, () => {
  console.log("🚀 Predix backend running");
});