import { formatStat } from '../../utils/formatters'
import { STAT_DEFINITIONS } from '../../utils/constants'
import Tooltip from '../ui/Tooltip'

type Stats = Record<string, unknown>

interface Section { label: string; keys: string[] }

const SECTIONS: Section[] = [
  {
    label: 'Traditional',
    keys: ['g', 'pa', 'ab', 'h', 'hr', 'rbi', 'sb', 'bb', 'so', 'avg', 'obp', 'slg', 'ops'],
  },
  {
    label: 'Advanced',
    keys: ['war', 'wrc_plus', 'woba', 'iso', 'babip', 'ops_plus', 'wpa', 'clutch', 'bsr'],
  },
  {
    label: 'Plate Discipline',
    keys: ['k_pct', 'bb_pct', 'o_swing_pct', 'z_swing_pct', 'swstr_pct', 'contact_pct', 'csw_pct', 'zone_pct'],
  },
  {
    label: 'Batted Ball',
    keys: ['gb_pct', 'fb_pct', 'ld_pct', 'hr_fb_pct', 'pull_pct', 'cent_pct', 'oppo_pct', 'hard_pct'],
  },
  {
    label: 'Statcast',
    keys: ['xba', 'xslg', 'xwoba', 'barrel_pct', 'hard_hit_pct', 'avg_ev', 'avg_la', 'sprint_speed'],
  },
]

export default function BattingStatsTable({ stats }: { stats: Stats }) {
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
