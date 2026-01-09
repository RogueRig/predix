import { usePrivy } from '@privy-io/react-auth'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const { ready, authenticated } = usePrivy()
  const navigate = useNavigate()

  if (!ready) {
    return <div>Loading...</div>
  }

  return (
    <div>
      <h1>Welcome to Predix</h1>
      {authenticated ? (
        <button onClick={() => navigate('/portfolio')}>Go to Portfolio</button>
      ) : (
        <button onClick={() => navigate('/login')}>Login</button>
      )}
    </div>
  )
}
