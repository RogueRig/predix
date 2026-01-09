import { BrowserRouter as Router, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { usePrivy } from '@privy-io/react-auth'
import Home from './pages/home'
import Login from './pages/login'
import Portfolio from './pages/portfolio'

function ProtectedRoute({ children }: { children: JSX.Element }) {
  const { ready, authenticated } = usePrivy()
  const location = useLocation()

  if (!ready) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        Loading...
      </div>
    )
  }

  if (!authenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return children
}

function LoginRoute() {
  const { ready, authenticated } = usePrivy()
  const location = useLocation()
  const state = location.state as { from?: { pathname?: string } } | null
  const from = state?.from?.pathname || '/portfolio'

  if (!ready) {
    return (
      <div
        role="status"
        aria-live="polite"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
        }}
      >
        Loading...
      </div>
    )
  }

  if (authenticated) {
    return <Navigate to={from} replace />
  }

  return <Login />
}

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/login" element={<LoginRoute />} />
        <Route
          path="/portfolio"
          element={
            <ProtectedRoute>
              <Portfolio />
            </ProtectedRoute>
          }
        />
      </Routes>
    </Router>
  )
}

export default App
