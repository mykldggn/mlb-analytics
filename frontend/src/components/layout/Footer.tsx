export default function Footer() {
  return (
    <footer className="border-t border-gray-800 py-6 mt-8">
      <div className="container mx-auto px-4 max-w-7xl text-center text-xs text-gray-600">
        <p>Data sourced from FanGraphs, Baseball Savant (Statcast), and the MLB Stats API.</p>
        <p className="mt-1">Park Favorability Index (PFI) is a proprietary composite statistic. Not affiliated with MLB.</p>
      </div>
    </footer>
  )
}
