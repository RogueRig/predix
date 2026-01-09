import React from 'react'
import ReactDOM from 'react-dom/client'
import { PrivyProvider } from '@privy-io/react-auth'
import App from './App.tsx'
import './styles.css'

const privyAppId = import.meta.env.VITE_PRIVY_APP_ID

const rootElement = document.getElementById('root')!
const root = ReactDOM.createRoot(rootElement)

if (!privyAppId) {
  console.error(
    'VITE_PRIVY_APP_ID is not set. Please add it to your .env file and restart the dev server or rebuild the app.',
  )

  root.render(
    <React.StrictMode>
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif',
          padding: '1.5rem',
          backgroundColor: '#f9fafb',
          color: '#111827',
        }}
      >
        <div
          style={{
            maxWidth: '32rem',
            width: '100%',
            borderRadius: '0.75rem',
            border: '1px solid #e5e7eb',
            backgroundColor: '#ffffff',
            padding: '1.5rem',
            boxShadow: '0 10px 15px -3px rgba(15, 23, 42, 0.1)',
          }}
        >
          <h1 style={{ fontSize: '1.25rem', fontWeight: 600, marginBottom: '0.75rem' }}>
            Configuration error
          </h1>
          <p style={{ marginBottom: '0.75rem', lineHeight: 1.5 }}>
            The <code>VITE_PRIVY_APP_ID</code> environment variable is not set.
          </p>
          <p style={{ marginBottom: '0.75rem', lineHeight: 1.5 }}>
            Please add <code>VITE_PRIVY_APP_ID</code> to your <code>.env</code> file and then
            restart the development server or rebuild the application.
          </p>
        </div>
      </div>
    </React.StrictMode>,
  )
} else {
  root.render(
    <React.StrictMode>
      <PrivyProvider
        appId={privyAppId}
        config={{
          loginMethods: ['email', 'wallet'],
          appearance: {
            theme: 'light',
            accentColor: '#676FFF',
          },
        }}
      >
        <App />
      </PrivyProvider>
    </React.StrictMode>,
  )
}
