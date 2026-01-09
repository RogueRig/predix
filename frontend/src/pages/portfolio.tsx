import { usePrivy } from '@privy-io/react-auth'
import { Link } from 'react-router-dom'

export default function Portfolio() {
  const { user, logout } = usePrivy()

  const handleLogout = () => {
    logout()
  }

  return (
    <div style={{ padding: '2rem', maxWidth: '800px', margin: '0 auto' }}>
      <div style={{ 
        display: 'flex', 
        justifyContent: 'space-between', 
        alignItems: 'center',
        marginBottom: '2rem'
      }}>
        <h1>Portfolio</h1>
        <button 
          onClick={handleLogout}
          style={{
            padding: '0.5rem 1rem',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '4px',
            cursor: 'pointer'
          }}
        >
          Logout
        </button>
      </div>

      <div style={{ 
        backgroundColor: '#f8f9fa', 
        padding: '1.5rem', 
        borderRadius: '8px',
        marginBottom: '2rem'
      }}>
        <h2>User Information</h2>
        <div style={{ marginTop: '1rem' }}>
          <p><strong>User ID:</strong> {user?.id || 'N/A'}</p>
          {user?.email && <p><strong>Email:</strong> {user.email?.address}</p>}
          {user?.wallet && <p><strong>Wallet:</strong> {user.wallet?.address}</p>}
          <p><strong>Created At:</strong> {user?.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}</p>
        </div>
      </div>

      <div>
        <h2>Your Portfolio</h2>
        <p>Portfolio management features coming soon...</p>
        <Link to="/" style={{ color: '#676FFF' }}>Back to Home</Link>
      </div>
    </div>
  )
}
