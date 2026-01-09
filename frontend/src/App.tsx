import { useState } from 'react'
import Home from './pages/home'
import Login from './pages/login'
import Portfolio from './pages/portfolio'

type Page = 'home' | 'login' | 'portfolio'

function App() {
  const [currentPage, setCurrentPage] = useState<Page>('home')

  const renderPage = () => {
    switch (currentPage) {
      case 'home':
        return <Home />
      case 'login':
        return <Login />
      case 'portfolio':
        return <Portfolio />
      default:
        return <Home />
    }
  }

  return (
    <div className="app">
      <nav className="nav">
        <div className="nav-container">
          <h1 className="nav-logo">Predix</h1>
          <ul className="nav-menu">
            <li>
              <button
                className={currentPage === 'home' ? 'nav-link active' : 'nav-link'}
                onClick={() => setCurrentPage('home')}
              >
                Home
              </button>
            </li>
            <li>
              <button
                className={currentPage === 'portfolio' ? 'nav-link active' : 'nav-link'}
                onClick={() => setCurrentPage('portfolio')}
              >
                Portfolio
              </button>
            </li>
            <li>
              <button
                className={currentPage === 'login' ? 'nav-link active' : 'nav-link'}
                onClick={() => setCurrentPage('login')}
              >
                Login
              </button>
            </li>
          </ul>
        </div>
      </nav>
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  )
}

export default App
