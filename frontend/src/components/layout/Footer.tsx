export default function Footer() {
  return (
    <footer style={{ background: 'var(--bg2)', borderTop: '1px solid var(--border)', marginTop: 32, padding: '20px 28px', textAlign: 'center' }}>
      <div className="container mx-auto px-4 max-w-7xl space-y-1" style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 2 }}>
        <p>Data from MLB Stats API, Baseball Reference (WAR), and Baseball Savant (Statcast). Park Favorability Index is a proprietary composite — not affiliated with MLB.</p>
        <p>
          <a
            href="https://github.com/mykldggn/mlb-analytics"
            target="_blank"
            rel="noopener noreferrer"
            style={{ color: 'var(--text3)' }}
            onMouseEnter={e => (e.currentTarget.style.color = 'var(--accent2)')}
            onMouseLeave={e => (e.currentTarget.style.color = 'var(--text3)')}
          >
            GitHub ↗
          </a>
        </p>
      </div>
    </footer>
  )
}
