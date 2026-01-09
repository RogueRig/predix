import express from "express";
import cors from "cors";
import { verifyPrivyToken } from "./auth.js";

const app = express();
app.use(express.json());

app.use(cors({
  origin: process.env.FRONTEND_URL,
  credentials: true
}));

app.post("/auth/verify", async (req, res) => {
  try {
    const { token } = req.body;
    const user = await verifyPrivyToken(token);
    res.json({ user });
  } catch (err) {
    res.status(401).json({ error: "Unauthorized" });
  }
});

app.listen(process.env.PORT || 10000, () =>
  console.log("🚀 Predix backend running")
);