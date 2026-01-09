import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom'
import { usePrivy } from '@privy-io/react-auth'
import Home from './pages/home'
import Login from './pages/login'
import Portfolio from './pages/portfolio'

function App() {
  const { ready, authenticated } = usePrivy()

  if (!ready) {
    return (
      <div style={{ 
        display: 'flex', 
        justifyContent: 'center', 
        alignItems: 'center', 
        height: '100vh' 
      }}>
        Loading...
      </div>
    )
  }

  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route 
          path="/login" 
          element={authenticated ? <Navigate to="/portfolio" replace /> : <Login />} 
        />
        <Route 
          path="/portfolio" 
          element={authenticated ? <Portfolio /> : <Navigate to="/login" replace />} 
        />
      </Routes>
    </Router>
  )
}

export default App
