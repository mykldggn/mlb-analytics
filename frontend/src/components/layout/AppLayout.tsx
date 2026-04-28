import { Outlet, useLocation } from 'react-router-dom'
import Navbar from './Navbar'
import ScoresTicker from './ScoresTicker'
import Footer from './Footer'
import BackToTop from '../ui/BackToTop'

export default function AppLayout() {
  const location = useLocation()
  return (
    <div className="min-h-screen flex flex-col" style={{ color: 'var(--text)' }}>
      <Navbar />
      <ScoresTicker />
      <main className="flex-1 container mx-auto px-4 pb-6 max-w-7xl" style={{ paddingTop: 0 }}>
        <div key={location.pathname} className="animate-page-enter" style={{ paddingTop: 20 }}>
          <Outlet />
        </div>
      </main>
      <Footer />
      <BackToTop />
    </div>
  )
}
