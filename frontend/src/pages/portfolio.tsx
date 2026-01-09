import { usePrivy } from '@privy-io/react-auth'
import { Link } from 'react-router-dom'

export default function Portfolio() {
  const { user, logout } = usePrivy()

  const handleLogout = () => {
    logout()
  }

  const formatCreatedAt = (createdAt: number | Date | undefined): string => {
    if (!createdAt) return 'N/A'
    try {
      return new Date(createdAt).toLocaleDateString()
    } catch {
      return 'Invalid date'
    }
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
          className="logout-button"
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
          {user?.email && <p><strong>Email:</strong> {user.email.address}</p>}
          {user?.wallet && <p><strong>Wallet:</strong> {user.wallet.address}</p>}
          <p><strong>Created At:</strong> {formatCreatedAt(user?.createdAt)}</p>
        </div>
      </div>

      <div>
        <h2>Your Portfolio</h2>
        <p>Portfolio management features coming soon...</p>
        <Link to="/" style={{ color: '#676FFF' }}>Back to Home</Link>
      </div>

      <style>{`
        .logout-button {
          padding: 0.5rem 1rem;
          background-color: #dc3545;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background-color 0.15s ease, box-shadow 0.15s ease;
        }

        .logout-button:hover {
          background-color: #c82333;
        }

        .logout-button:focus-visible {
          outline: 2px solid #dc3545;
          outline-offset: 2px;
          box-shadow: 0 0 0 3px rgba(220, 53, 69, 0.4);
        }
      `}</style>
    </div>
  )
}
