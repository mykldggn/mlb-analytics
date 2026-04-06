import { Link } from 'react-router-dom'

export default function NotFoundPage() {
  return (
    <div className="text-center py-20">
      <div className="text-5xl mb-4">⚾</div>
      <h1 className="text-3xl font-bold text-white mb-2">404 — Not Found</h1>
      <p className="text-gray-500 mb-6">That pitch was way outside the zone.</p>
      <Link to="/" className="bg-blue-600 hover:bg-blue-700 text-white px-6 py-2 rounded-lg font-medium transition-colors">
        Back to Home
      </Link>
    </div>
  )
}
