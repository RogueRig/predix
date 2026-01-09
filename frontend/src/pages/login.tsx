import { usePrivy } from '@privy-io/react-auth'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export default function Login() {
  const { ready, authenticated, login, getAccessToken } = usePrivy()
  const navigate = useNavigate()

  // 🔐 Send Privy token to backend
  async function verifyWithBackend() {
    try {
      const token = await getAccessToken()

      const res = await fetch(
        'https://YOUR-RENDER-BACKEND.onrender.com/auth/verify',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ token }),
        }
      )

      if (!res.ok) {
        throw new Error('Backend auth failed')
      }

      console.log('✅ Backend auth success')
    } catch (err) {
      console.error('❌ Backend auth error', err)
    }
  }

  useEffect(() => {
    if (ready && authenticated) {
      // 🔥 IMPORTANT: verify backend BEFORE navigating
      verifyWithBackend().then(() => {
        navigate('/portfolio')
      })
    }
  }, [ready, authenticated, navigate])

  return (
    <div style={{ padding: 24 }}>
      <h1>Login to Predix</h1>

      {ready && !authenticated && (
        <button onClick={login}>Login with Privy</button>
      )}
    </div>
  )
}