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
      <div style={{ flexShrink: 0 }}><ScoresTicker /></div>
      <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
        <div key={location.pathname} className="animate-page-enter">
          <Outlet />
        </div>
      </main>
      <Footer />
      <BackToTop />
    </div>
  )
}
