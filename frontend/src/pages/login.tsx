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
    <div>
      <h1>Login to Predix</h1>
      {ready && !authenticated && (
        <button onClick={login}>Login with Privy</button>
      )}
    </div>
  )
}
