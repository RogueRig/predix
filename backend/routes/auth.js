import express from "express";
import jwt from "jsonwebtoken";
import { privy } from "../privy.js";

const router = express.Router();

router.post("/login", async (req, res) => {
  try {
    const { privyToken } = req.body;
    if (!privyToken) {
      return res.status(400).json({ error: "Missing token" });
    }

    const user = await privy.verifyAuthToken(privyToken);

    const token = jwt.sign(
      {
        userId: user.userId,
        wallet: user.wallet?.address || null
      },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    res.json({ token });
  } catch (e) {
    res.status(401).json({ error: "Invalid token" });
  }
});

export default router;