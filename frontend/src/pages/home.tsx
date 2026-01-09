import { Link } from 'react-router-dom'
import { usePrivy } from '@privy-io/react-auth'

export default function Home() {
  const { authenticated } = usePrivy()

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <h1>Welcome to Predix</h1>
      <p>Your personal portfolio management platform</p>
      
      <div style={{ marginTop: '2rem' }}>
        {authenticated ? (
          <Link to="/portfolio" style={{ 
            padding: '0.75rem 1.5rem', 
            backgroundColor: '#676FFF', 
            color: 'white', 
            textDecoration: 'none', 
            borderRadius: '4px',
            display: 'inline-block'
          }}>
            Go to Portfolio
          </Link>
        ) : (
          <Link to="/login" style={{ 
            padding: '0.75rem 1.5rem', 
            backgroundColor: '#676FFF', 
            color: 'white', 
            textDecoration: 'none', 
            borderRadius: '4px',
            display: 'inline-block'
          }}>
            Get Started
          </Link>
        )}
      </div>
    </div>
  )
}
