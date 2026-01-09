import { useState, useEffect } from 'react'

interface HealthResponse {
  status: string
  timestamp: string
  service: string
}

function Home() {
  const [healthData, setHealthData] = useState<HealthResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchHealth = async () => {
      try {
        const apiUrl = import.meta.env.VITE_API_URL?.trim() || 'http://localhost:3000'
        const response = await fetch(`${apiUrl}/api/health`)
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`)
        }
        
        const data = await response.json()
        setHealthData(data)
        setError(null)
      } catch (err) {
        console.error('Failed to fetch health data:', err)
        setError('Failed to fetch health data')
        setHealthData(null)
      } finally {
        setLoading(false)
      }
    }

    fetchHealth()
  }, [])

  return (
    <div className="home">
      <h1>Predix Home</h1>
      
      <div className="health-status">
        <h2>Backend Health Status</h2>
        
        {loading && <p className="loading" role="status" aria-live="polite">Loading...</p>}
        
        {error && (
          <div className="error">
            <p>Error: {error}</p>
          </div>
        )}
        
        {healthData && (
          <div className="health-data">
            <p><strong>Status:</strong> {healthData.status}</p>
            <p><strong>Service:</strong> {healthData.service}</p>
            <p><strong>Timestamp:</strong> {healthData.timestamp}</p>
          </div>
        )}
      </div>
    </div>
  )
}

export default Home
