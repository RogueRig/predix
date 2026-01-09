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
    <>
      <style>
        {`
          .login-container {
            display: flex;
            flex-direction: column;
            justify-content: center;
            align-items: center;
            height: 100vh;
            gap: 1rem;
          }

          .login-button {
            padding: 0.75rem 2rem;
            background-color: #676FFF;
            color: white;
            border: none;
            border-radius: 4px;
            font-size: 1rem;
            cursor: pointer;
            margin-top: 1rem;
            transition: background-color 0.15s ease, box-shadow 0.15s ease;
          }

          .login-button:hover {
            background-color: #555be6;
          }

          .login-button:focus-visible {
            outline: 2px solid #2f34ff;
            outline-offset: 2px;
            box-shadow: 0 0 0 3px rgba(103, 111, 255, 0.4);
          }
        `}
      </style>
      <div className="login-container">
        <h1>Login to Predix</h1>
        <p>Sign in to manage your portfolio</p>
        
        <button 
          onClick={handleLogin}
          className="login-button"
        >
          Login with Privy
        </button>
      </div>
    </>
  )
}
