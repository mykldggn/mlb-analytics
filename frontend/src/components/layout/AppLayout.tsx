import { Outlet } from 'react-router-dom'
import Navbar from './Navbar'
import Footer from './Footer'

export default function AppLayout() {
  return (
    <div className="min-h-screen flex flex-col bg-[#060a12] text-gray-100">
      <Navbar />
      <main className="flex-1 container mx-auto px-4 py-6 max-w-7xl">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
