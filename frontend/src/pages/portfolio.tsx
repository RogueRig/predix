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
    return <div>Loading...</div>
  }

  return (
    <div>
      <h1>Portfolio</h1>
      <p>Welcome, {user?.email?.address || 'User'}!</p>
      <button onClick={logout}>Logout</button>
    </div>
  )
}
