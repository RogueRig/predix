import { usePrivy } from '@privy-io/react-auth'
import { useNavigate } from 'react-router-dom'

export default function Home() {
  const { ready, authenticated } = usePrivy()
  const navigate = useNavigate()

  if (!ready) {
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
        <h2>Markets</h2>
        <p>View and predict market outcomes</p>
      </div>
      <div className="placeholder-content">
        <p>📊 Market listings will appear here</p>
        <p>Coming soon: Browse prediction markets, view odds, and place predictions</p>
        {authenticated ? (
          <button className="btn" onClick={() => navigate('/portfolio')}>Go to Portfolio</button>
        ) : (
          <button className="btn" onClick={() => navigate('/login')}>Login to Start</button>
        )}
      </div>
    </div>
  )
}
