import { usePrivy } from '@privy-io/react-auth'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export default function Portfolio() {
  const { ready, authenticated, user, logout } = usePrivy()
  const navigate = useNavigate()

  useEffect(() => {
    if (ready && !authenticated) {
      navigate('/login')
    }
  }, [ready, authenticated, navigate])

  if (!ready || !authenticated) {
    return (
      <div className="container">
        <div className="placeholder-content">
          <p>Loading...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="container">
      <div className="page-header">
        <h2>Portfolio</h2>
        <p>Track your predictions and earnings</p>
      </div>
      <div className="placeholder-content">
        <p>💼 Welcome, {user?.email?.address || user?.wallet?.address || 'User'}!</p>
        <p style={{ marginTop: '1rem' }}>Coming soon: View your active predictions, track performance, and manage your balance</p>
        <button className="btn" style={{ marginTop: '1.5rem' }} onClick={logout}>Logout</button>
      </div>
    </div>
  )
}
