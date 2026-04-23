import { useState } from 'react'
import { useParkFactors } from '../hooks/useParkFactors'
import { CURRENT_SEASON, SEASONS } from '../utils/constants'
import { formatPFI } from '../utils/formatters'
import LoadingSpinner from '../components/ui/LoadingSpinner'
import { ParkFactorEntry } from '../api/parkFactors'
import { getParkInfo, ParkInfo } from '../utils/parkData'

// MLB color scale: maroon (extreme hitter) → red → neutral gray → blue → navy (extreme pitcher)
function pfiColor(value: number): string {
  if (value > 115) return '#7f0012'  // maroon — extreme hitter
  if (value > 105) return '#b8001a'  // MLB red — hitter-friendly
  if (value > 100) return '#d44a2a'  // red-orange — slightly hitter
  if (value < 85)  return '#001f5b'  // MLB navy — extreme pitcher
  if (value < 95)  return '#1d4ed8'  // blue — pitcher-friendly
  if (value < 100) return '#3b82f6'  // lighter blue — slightly pitcher
  return '#7a8fa8'                   // neutral gray
}

function PFIBar({ value, max = 200 }: { value: number; max?: number }) {
  const pct = (value / max) * 100
  const color = pfiColor(value)
  return (
    <div className="flex items-center gap-2">
      <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg3)' }}>
        <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="font-mono text-xs w-10 text-right" style={{ color }}>{formatPFI(value)}</span>
    </div>
  )
}

function interpretColor(text: string): string {
  if (text.includes('Extreme hitter')) return '#7f0012'
  if (text.includes('Hitter'))         return '#b8001a'
  if (text.includes('Slightly hitter')) return '#d44a2a'
  if (text.includes('Neutral'))        return '#7a8fa8'
  if (text.includes('Slightly pitcher')) return '#3b82f6'
  if (text.includes('Pitcher'))        return '#1d4ed8'
  return '#001f5b'
}

export default function ParkFactorsPage() {
  const [season, setSeason] = useState(CURRENT_SEASON)
  const { data, isLoading } = useParkFactors(season)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 style={{ fontFamily: "'Barlow Condensed', sans-serif", fontSize: '1.8rem', fontWeight: 700, color: 'var(--text)' }}>Park Favorability Index (PFI)</h1>
          <p className="text-gray-500 text-sm mt-1 max-w-2xl">
            A custom composite statistic (0–200 scale, 100 = neutral) measuring how much each ballpark
            helps batters or pitchers relative to league-average conditions. Uses a 3-year rolling Statcast window.
          </p>
        </div>
        <select
          value={season}
          onChange={e => setSeason(Number(e.target.value))}
          style={{ background: 'white', border: '1px solid var(--border2)', borderRadius: 8, padding: '6px 12px', fontSize: 13, color: 'var(--text)', outline: 'none' }}
        >
          {SEASONS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* Methodology card */}
      <div className="card" style={{ borderColor: 'rgba(0,31,91,0.18)', background: 'rgba(0,31,91,0.04)' }}>
        <h3 style={{ fontSize: 13, fontWeight: 600, color: 'var(--accent2)', marginBottom: 8 }}>PFI Methodology</h3>
        <p style={{ fontSize: 12, color: 'var(--text2)', lineHeight: 1.7 }}>
          The Batter PFI weights six factors from home vs. road Statcast splits across a 3-year window:{' '}
          <span className="text-gray-300">Run Factor (30%)</span>,{' '}
          <span className="text-gray-300">HR Factor (30%)</span>,{' '}
          <span className="text-gray-300">BABIP Factor (20%)</span>,{' '}
          <span className="text-gray-300">inverse K-rate Factor (10%)</span>,{' '}
          <span className="text-gray-300">BB Factor (5%)</span>, and{' '}
          <span className="text-gray-300">Exit Velocity Factor (5%)</span>.{' '}
          Pitcher PFI = 200 − Batter PFI (perfect inverse). Score of 165 = Coors Field tier; 68 = Petco Park tier.
        </p>
      </div>

      {isLoading ? (
        <LoadingSpinner label="Loading park factors..." />
      ) : data?.status === 'computing' ? (
        <div className="card text-center py-10">
          <div className="text-3xl mb-3">⏳</div>
          <p className="text-gray-400">{data.message}</p>
          <p className="text-gray-600 text-sm mt-1">Refresh the page in ~60 seconds.</p>
        </div>
      ) : data?.parks ? (
        <ParkTable parks={data.parks} seasonsUsed={data.seasons_used} />
      ) : (
        <div className="card text-center py-10 text-gray-500">
          No park factor data available for {season}. The backend will compute it on first request.
        </div>
      )}
    </div>
  )
}

function ParkTable({ parks, seasonsUsed }: { parks: ParkFactorEntry[]; seasonsUsed?: number[] }) {
  const [sortKey, setSortKey] = useState<'batter_pfi' | 'pitcher_pfi'>('batter_pfi')
  const [selectedPark, setSelectedPark] = useState<(ParkFactorEntry & { info?: ParkInfo }) | null>(null)
  const sorted = [...parks].sort((a, b) => b[sortKey] - a[sortKey])

  return (
    <div>
      {seasonsUsed && (
        <p className="text-xs text-gray-600 mb-1">Data from seasons: {seasonsUsed.join(', ')}</p>
      )}
      <p className="text-xs text-gray-600 mb-3">Click any park row for dimensions, features, and details.</p>

      {/* Toggle */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => setSortKey('batter_pfi')}
          style={{
            padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            background: sortKey === 'batter_pfi' ? 'var(--accent)' : 'var(--surface)',
            color: sortKey === 'batter_pfi' ? 'white' : 'var(--text2)',
            border: sortKey === 'batter_pfi' ? 'none' : '1px solid var(--border)',
          }}
        >
          Batter PFI
        </button>
        <button
          onClick={() => setSortKey('pitcher_pfi')}
          style={{
            padding: '6px 16px', borderRadius: 8, fontSize: 13, fontWeight: 500, cursor: 'pointer',
            background: sortKey === 'pitcher_pfi' ? 'var(--accent2)' : 'var(--surface)',
            color: sortKey === 'pitcher_pfi' ? 'white' : 'var(--text2)',
            border: sortKey === 'pitcher_pfi' ? 'none' : '1px solid var(--border)',
          }}
        >
          Pitcher PFI
        </button>
      </div>

      {selectedPark && (
        <ParkDetailModal park={selectedPark} onClose={() => setSelectedPark(null)} />
      )}

      <div className="space-y-2">
        {sorted.map(park => (
          <div key={park.team_abbr} className="card-hover cursor-pointer"
            onClick={() => setSelectedPark({ ...park, info: getParkInfo(park.team_abbr) })}>
            <div className="flex items-start gap-4">
              {/* Park name & team */}
              <div className="w-48 shrink-0">
                <div className="font-medium text-gray-200 text-sm">{park.park_name}</div>
                <div className="text-xs text-gray-500">{park.team_abbr}</div>
                <div className="text-xs mt-0.5" style={{ color: interpretColor(park.interpretation) }}>{park.interpretation}</div>
              </div>

              {/* PFI bars */}
              <div className="flex-1 space-y-1.5">
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-20">Batter PFI</span>
                  <div className="flex-1"><PFIBar value={park.batter_pfi} /></div>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-gray-500 w-20">Pitcher PFI</span>
                  <div className="flex-1"><PFIBar value={park.pitcher_pfi} /></div>
                </div>
              </div>

              {/* Component breakdown */}
              <div className="hidden lg:grid grid-cols-3 gap-x-4 gap-y-0.5 text-xs text-gray-500 w-48">
                {[
                  ['Run ×', park.run_factor],
                  ['HR ×', park.hr_factor],
                  ['BABIP ×', park.babip_factor],
                  ['K ×', park.k_factor],
                  ['BB ×', park.bb_factor],
                  ['EV ×', park.ev_factor],
                ].map(([label, val]) => (
                  <span key={String(label)}>
                    {label} <span className={Number(val) > 1 ? 'text-orange-400' : 'text-sky-400'}>{Number(val).toFixed(3)}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function ParkDiagram({ info }: { info: ParkInfo }) {
  const dim = info.dimensions
  const cx = 200, homeY = 340
  // Scale so CF fits with ~280 SVG units of depth
  const scale = 280 / dim.cf

  const cfPt   = { x: cx,                                           y: homeY - dim.cf  * scale }
  const lfPt   = { x: cx - dim.lf  * Math.sin(Math.PI / 4) * scale, y: homeY - dim.lf  * Math.cos(Math.PI / 4) * scale }
  const rfPt   = { x: cx + dim.rf  * Math.sin(Math.PI / 4) * scale, y: homeY - dim.rf  * Math.cos(Math.PI / 4) * scale }
  const lcfPt  = { x: cx - dim.lcf * Math.sin(Math.PI / 8) * scale, y: homeY - dim.lcf * Math.cos(Math.PI / 8) * scale }
  const rcfPt  = { x: cx + dim.rcf * Math.sin(Math.PI / 8) * scale, y: homeY - dim.rcf * Math.cos(Math.PI / 8) * scale }

  // Infield (90 ft bases)
  const bs = 90 * scale
  const firstBase  = { x: cx + bs * Math.sin(Math.PI / 4), y: homeY - bs * Math.cos(Math.PI / 4) }
  const secondBase = { x: cx,                               y: homeY - bs * Math.SQRT2 }
  const thirdBase  = { x: cx - bs * Math.sin(Math.PI / 4), y: homeY - bs * Math.cos(Math.PI / 4) }

  const wallPath = `M ${lfPt.x},${lfPt.y} L ${lcfPt.x},${lcfPt.y} L ${cfPt.x},${cfPt.y} L ${rcfPt.x},${rcfPt.y} L ${rfPt.x},${rfPt.y}`
  const fairPath = `M ${cx},${homeY} L ${lfPt.x},${lfPt.y} L ${lcfPt.x},${lcfPt.y} L ${cfPt.x},${cfPt.y} L ${rcfPt.x},${rcfPt.y} L ${rfPt.x},${rfPt.y} Z`
  const infield  = `M ${cx},${homeY} L ${firstBase.x},${firstBase.y} L ${secondBase.x},${secondBase.y} L ${thirdBase.x},${thirdBase.y} Z`

  return (
    <svg viewBox="0 0 400 370" className="w-full h-auto max-w-xs mx-auto">
      <rect width="400" height="370" fill="#111827" rx="8" />
      {/* Fair territory grass */}
      <path d={fairPath} fill="#1e3a1e" />
      {/* Outfield wall */}
      <path d={wallPath} fill="none" stroke="#4b5563" strokeWidth="2.5" />
      {/* Foul lines */}
      <line x1={cx} y1={homeY} x2={lfPt.x} y2={lfPt.y} stroke="#6b7280" strokeWidth="1" strokeDasharray="5,4" />
      <line x1={cx} y1={homeY} x2={rfPt.x} y2={rfPt.y} stroke="#6b7280" strokeWidth="1" strokeDasharray="5,4" />
      {/* Infield dirt */}
      <path d={infield} fill="#3d2b1a" />
      {/* Mound */}
      <circle cx={cx} cy={homeY - 60.5 * scale} r={Math.max(4, 10 * scale)} fill="#5a3e22" />
      {/* Bases */}
      {[firstBase, secondBase, thirdBase].map((b, i) => (
        <rect key={i} x={b.x - 4} y={b.y - 4} width="8" height="8" fill="#e5e7eb" rx="1" />
      ))}
      {/* Home plate */}
      <polygon points={`${cx},${homeY - 7} ${cx - 5},${homeY - 2} ${cx - 5},${homeY + 3} ${cx + 5},${homeY + 3} ${cx + 5},${homeY - 2}`} fill="#e5e7eb" />
      {/* Dimension labels */}
      <text x={lfPt.x - 4}   y={lfPt.y - 6}  fill="#9ca3af" fontSize="10" textAnchor="end">{dim.lf}'</text>
      <text x={lcfPt.x - 4}  y={lcfPt.y - 6} fill="#9ca3af" fontSize="10" textAnchor="end">{dim.lcf}'</text>
      <text x={cfPt.x}        y={cfPt.y - 7}  fill="#9ca3af" fontSize="10" textAnchor="middle">{dim.cf}'</text>
      <text x={rcfPt.x + 4}  y={rcfPt.y - 6} fill="#9ca3af" fontSize="10">{dim.rcf}'</text>
      <text x={rfPt.x + 4}   y={rfPt.y - 6}  fill="#9ca3af" fontSize="10">{dim.rf}'</text>
    </svg>
  )
}

function ParkDetailModal({ park, onClose }: { park: ParkFactorEntry & { info?: ParkInfo }; onClose: () => void }) {
  const info = park.info

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}>
      <div className="bg-gray-900 border border-gray-700 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl"
        onClick={e => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-start justify-between p-6 border-b border-gray-800">
          <div>
            <h2 className="text-xl font-bold text-white">{info?.name ?? park.park_name}</h2>
            {info && <p className="text-sm text-gray-400 mt-0.5">{info.city} · Opened {info.opened}</p>}
          </div>
          <button onClick={onClose} className="text-gray-600 hover:text-gray-300 text-xl transition-colors ml-4">✕</button>
        </div>

        <div className="p-6 space-y-5">
          {/* PFI Summary */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-800 rounded-xl p-4 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Batter PFI</div>
              <div className="text-3xl font-bold" style={{ color: pfiColor(park.batter_pfi) }}>
                {formatPFI(park.batter_pfi)}
              </div>
              <div className="text-xs text-gray-500 mt-1">{park.interpretation}</div>
            </div>
            <div className="bg-gray-800 rounded-xl p-4 text-center">
              <div className="text-xs text-gray-500 uppercase tracking-wider mb-1">Pitcher PFI</div>
              <div className="text-3xl font-bold" style={{ color: pfiColor(park.pitcher_pfi) }}>
                {formatPFI(park.pitcher_pfi)}
              </div>
              <div className="text-xs text-gray-500 mt-1">Pitcher friendliness</div>
            </div>
          </div>

          {/* Park factors breakdown */}
          <div>
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">PFI Component Factors</h3>
            <div className="grid grid-cols-3 gap-2">
              {[
                ['Run Factor', park.run_factor, '30%'],
                ['HR Factor', park.hr_factor, '30%'],
                ['BABIP Factor', park.babip_factor, '20%'],
                ['K Factor', park.k_factor, '10%'],
                ['BB Factor', park.bb_factor, '5%'],
                ['EV Factor', park.ev_factor, '5%'],
              ].map(([label, val, weight]) => (
                <div key={String(label)} className="bg-gray-800/60 rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-500">{label}</div>
                  <div className={`text-sm font-mono font-semibold ${Number(val) > 1.05 ? 'text-orange-400' : Number(val) < 0.95 ? 'text-sky-400' : 'text-gray-300'}`}>
                    {Number(val).toFixed(3)}
                  </div>
                  <div className="text-xs text-gray-600">wt: {weight}</div>
                </div>
              ))}
            </div>
          </div>

          {info && (
            <>
              {/* Park diagram */}
              <div>
                <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Field Diagram</h3>
                <ParkDiagram info={info} />
              </div>

              {/* Dimensions */}
              <div>
                <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Dimensions & Walls</h3>
                <div className="bg-gray-800/60 rounded-xl p-4">
                  <div className="flex justify-between text-center text-xs mb-3">
                    {[
                      ['LF', info.dimensions.lf],
                      ['LCF', info.dimensions.lcf],
                      ['CF', info.dimensions.cf],
                      ['RCF', info.dimensions.rcf],
                      ['RF', info.dimensions.rf],
                    ].map(([label, dist]) => (
                      <div key={String(label)}>
                        <div className="text-gray-500">{label}</div>
                        <div className="text-gray-200 font-mono font-semibold">{dist} ft</div>
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between text-center text-xs border-t border-gray-700 pt-3">
                    {[
                      ['LF Wall', info.wallHeights.lf],
                      ['CF Wall', info.wallHeights.cf],
                      ['RF Wall', info.wallHeights.rf],
                    ].map(([label, h]) => (
                      <div key={String(label)}>
                        <div className="text-gray-500">{label} height</div>
                        <div className="text-gray-200 font-mono">{h} ft</div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Conditions */}
              <div className="grid grid-cols-3 gap-2 text-center text-xs">
                <div className="bg-gray-800/60 rounded-lg p-3">
                  <div className="text-gray-500 mb-1">Surface</div>
                  <div className={`font-medium ${info.surface === 'Turf' ? 'text-yellow-400' : 'text-emerald-400'}`}>{info.surface}</div>
                </div>
                <div className="bg-gray-800/60 rounded-lg p-3">
                  <div className="text-gray-500 mb-1">Roof</div>
                  <div className={`font-medium ${info.roof === 'Dome' ? 'text-blue-400' : info.roof === 'Retractable' ? 'text-sky-400' : 'text-gray-300'}`}>{info.roof}</div>
                </div>
                <div className="bg-gray-800/60 rounded-lg p-3">
                  <div className="text-gray-500 mb-1">Elevation</div>
                  <div className={`font-medium ${info.elevation > 3000 ? 'text-orange-400' : 'text-gray-300'}`}>{info.elevation.toLocaleString()} ft</div>
                </div>
              </div>

              {/* Wind notes */}
              <div>
                <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-1">Wind & Weather</h3>
                <p className="text-sm text-gray-400 leading-relaxed">{info.windNotes}</p>
              </div>

              {/* Special features */}
              {info.specialFeatures.length > 0 && (
                <div>
                  <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">Notable Features</h3>
                  <ul className="space-y-1">
                    {info.specialFeatures.map(f => (
                      <li key={f} className="flex items-start gap-2 text-sm text-gray-400">
                        <span className="text-blue-500 mt-0.5">•</span>
                        {f}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Capacity */}
              <div className="text-xs text-gray-600 text-right">
                Capacity: {info.capacity.toLocaleString()}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
