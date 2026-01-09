import express from "express";

const router = express.Router();

router.post("/privy", async (req, res) => {
  try {
    const { user } = req.body;

    if (!user || !user.id) {
      return res.status(401).json({
        ok: false,
        error: "Invalid Privy user",
      });
    }

    // ✅ SUCCESS
    return res.json({
      ok: true,
      userId: user.id,
      email: user.email?.address || null,
      wallet: user.wallet?.address || null,
    });
  } catch (err) {
    console.error("Auth error:", err);
    res.status(500).json({ ok: false });
  }
});

export default router;