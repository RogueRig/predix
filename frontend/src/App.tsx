import { PrivyProvider } from '@privy-io/react-auth'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import Home from './pages/home'
import Login from './pages/login'
import Portfolio from './pages/portfolio'

function App() {
  const privyAppId = import.meta.env.VITE_PRIVY_APP_ID
  
  if (!privyAppId) {
    throw new Error('VITE_PRIVY_APP_ID environment variable is required')
  }

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        appearance: {
          theme: 'light',
          accentColor: '#676FFF',
        },
        embeddedWallets: {
          createOnLogin: 'users-without-wallets',
        },
      }}
    >
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/login" element={<Login />} />
          <Route path="/portfolio" element={<Portfolio />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </PrivyProvider>
  )
}

export default App
