import express from 'express'
import cors from 'cors'
import fetch from 'node-fetch'

const app = express()
const PORT = process.env.PORT || 10000

// ✅ middleware (ONLY ONCE)
app.use(cors())
app.use(express.json())

// ✅ health check
app.get('/health', (_req, res) => {
  res.json({ ok: true })
})

// 🔐 PRIVY VERIFY ROUTE
app.post('/auth/verify', async (req, res) => {
  try {
    const { token } = req.body

    if (!token) {
      return res.status(400).json({ error: 'Missing token' })
    }

    // 🔑 Verify with Privy
    const privyRes = await fetch('https://auth.privy.io/api/v1/me', {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })

    if (!privyRes.ok) {
      return res.status(401).json({ error: 'Invalid Privy token' })
    }

    const user = await privyRes.json()

    // ✅ success
    res.json({
      success: true,
      user: {
        id: user.id,
        wallet: user.wallet?.address ?? null,
        email: user.email?.address ?? null,
      },
    })
  } catch (err) {
    console.error('❌ Auth verify failed', err)
    res.status(500).json({ error: 'Auth verification failed' })
  }
})

// 🚀 start server
app.listen(PORT, () => {
  console.log(`🚀 Predix backend running on port ${PORT}`)
})