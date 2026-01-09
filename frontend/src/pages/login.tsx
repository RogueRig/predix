import { useState } from 'react'

function Login() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    // No backend logic yet - this is just a placeholder
    console.log('Login form submitted (no backend yet)')
  }

  return (
    <div className="container">
      <div className="page-header">
        <h2>Login</h2>
        <p>Sign in to your account</p>
      </div>
      <form className="login-form" onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="email">Email</label>
          <input
            type="email"
            id="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            required
          />
        </div>
        <div className="form-group">
          <label htmlFor="password">Password</label>
          <input
            type="password"
            id="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Enter your password"
            required
          />
        </div>
        <button type="submit" className="btn">
          Login
        </button>
        <p style={{ marginTop: '1rem', textAlign: 'center', color: '#95a5a6' }}>
          Note: Backend authentication not yet implemented
        </p>
      </form>
    </div>
  )
}

export default Login
