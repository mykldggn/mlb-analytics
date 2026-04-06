import { formatStat } from '../../utils/formatters'
import { STAT_DEFINITIONS } from '../../utils/constants'
import Tooltip from '../ui/Tooltip'

type Stats = Record<string, unknown>

const SECTIONS = [
  {
    label: 'Traditional',
    keys: ['g', 'gs', 'ip', 'w', 'l', 'sv', 'hld', 'era', 'whip', 'avg_against', 'babip', 'lob_pct'],
  },
  {
    label: 'Advanced',
    keys: ['war', 'fip', 'xfip', 'siera', 'era_minus', 'fip_minus', 'wpa', 'clutch'],
  },
  {
    label: 'Rate Stats',
    keys: ['k_per_9', 'bb_per_9', 'k_bb_ratio', 'k_pct', 'bb_pct', 'k_minus_bb_pct'],
  },
  {
    label: 'Batted Ball',
    keys: ['gb_pct', 'fb_pct', 'ld_pct', 'hr_fb_pct'],
  },
  {
    label: 'Plate Discipline',
    keys: ['o_swing_pct', 'z_swing_pct', 'swstr_pct', 'csw_pct', 'f_strike_pct'],
  },
  {
    label: 'Stuff',
    keys: ['stuff_plus', 'location_plus', 'pitching_plus'],
  },
]

export default function PitchingStatsTable({ stats }: { stats: Stats }) {
  return (
    <div className="space-y-6">
      {SECTIONS.map(section => {
        const available = section.keys.filter(k => stats[k] != null)
        if (available.length === 0) return null
        return (
          <div key={section.label}>
            <h3 className="text-xs text-gray-500 uppercase tracking-wider mb-2">{section.label}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
              {available.map(k => {
                const def = STAT_DEFINITIONS[k]
                const val = stats[k]
                return (
                  <Tooltip key={k} content={def?.description}>
                    <div className="card-hover cursor-help">
                      <div className="text-xs text-gray-500 mb-1">{def?.label ?? k.toUpperCase()}</div>
                      <div className="font-mono font-semibold text-gray-100">
                        {formatStat(k, val as number)}
                      </div>
                    </div>
                  </Tooltip>
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
}
