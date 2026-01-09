import { usePrivy } from '@privy-io/react-auth'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export default function Login() {
  const { login, authenticated } = usePrivy()
  const navigate = useNavigate()

  useEffect(() => {
    if (authenticated) {
      navigate('/portfolio')
    }
  }, [authenticated, navigate])

  const handleLogin = () => {
    login()
  }

  return (
    <div style={{ 
      display: 'flex', 
      flexDirection: 'column', 
      justifyContent: 'center', 
      alignItems: 'center', 
      height: '100vh',
      gap: '1rem'
    }}>
      <h1>Login to Predix</h1>
      <p>Sign in to manage your portfolio</p>
      
      <button 
        onClick={handleLogin}
        style={{
          padding: '0.75rem 2rem',
          backgroundColor: '#676FFF',
          color: 'white',
          border: 'none',
          borderRadius: '4px',
          fontSize: '1rem',
          cursor: 'pointer',
          marginTop: '1rem'
        }}
      >
        Login with Privy
      </button>
    </div>
  )
}
