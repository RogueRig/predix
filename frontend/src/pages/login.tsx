import { usePrivy } from '@privy-io/react-auth'
import { useNavigate } from 'react-router-dom'
import { useEffect } from 'react'

export default function Login() {
  const { ready, authenticated, login } = usePrivy()
  const navigate = useNavigate()

  useEffect(() => {
    if (ready && authenticated) {
      navigate('/portfolio')
    }
  }, [ready, authenticated, navigate])

  return (
    <div className="container">
      <div className="page-header">
        <h2>Login</h2>
        <p>Sign in to your account</p>
      </div>
      <div className="login-form">
        {ready && !authenticated && (
          <>
            <p style={{ marginBottom: '1.5rem', textAlign: 'center', color: '#7f8c8d' }}>
              Use Privy for secure authentication
            </p>
            <button className="btn" onClick={login}>Login with Privy</button>
          </>
        )}
        {!ready && (
          <p style={{ textAlign: 'center', color: '#95a5a6' }}>Loading...</p>
        )}
      </div>
    </div>
  )
}
