export default function Footer() {
  return (
    <footer className="border-t border-gray-800 py-6 mt-8">
      <div className="container mx-auto px-4 max-w-7xl text-center text-xs text-gray-600 space-y-1">
        <p>Data sourced from the MLB Stats API, Baseball Reference (WAR), and Baseball Savant (Statcast / expected stats).</p>
        <p>Park Favorability Index (PFI) is a proprietary composite statistic. Not affiliated with MLB.</p>
        <p className="mt-2">
          <a
            href="https://github.com/mykldggn/mlb-analytics"
            target="_blank"
            rel="noopener noreferrer"
            className="text-gray-500 hover:text-blue-400 transition-colors"
          >
            GitHub ↗
          </a>
        </p>
      </div>
    </footer>
  )
}
