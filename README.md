# MLB Analytics — Advanced Statistics Platform

A full-stack web application for MLB advanced baseball statistics, featuring
Statcast data, FanGraphs metrics, player profiles with headshots, and the
custom **Park Favorability Index (PFI)**.

## Tech Stack

- **Frontend**: React 18 + TypeScript + Vite + Tailwind CSS + Recharts + React Query
- **Backend**: Python FastAPI + pybaseball + pandas + httpx
- **Data Sources**: FanGraphs (via pybaseball), Baseball Savant/Statcast (via pybaseball), MLB Stats API (free, no auth)

## Quick Start

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
cp .env.example .env
uvicorn app.main:app --reload --port 8000
```

The API will be available at `http://localhost:8000`. Interactive docs at `/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`. API calls are proxied to `localhost:8000`.

---

## Features

### Batting Statistics
| Stat | Description |
|------|-------------|
| WAR | Wins Above Replacement |
| wRC+ | Weighted Runs Created Plus (100 = league avg, park/era adjusted) |
| wOBA | Weighted On-Base Average |
| ISO | Isolated Power (SLG - AVG) |
| BABIP | Batting Avg on Balls In Play |
| OPS+ | OPS adjusted for park & era |
| WPA | Win Probability Added |
| xBA / xSLG / xwOBA | Statcast expected stats |
| Barrel% | Optimal contact rate (EV ≥ 98 mph, LA 8–32°) |
| Hard Hit% | Exit velocity ≥ 95 mph rate |
| Exit Velocity | Average EV on batted balls |
| Launch Angle | Average LA |
| Sprint Speed | ft/sec on competitive runs |
| K% / BB% | Strikeout and walk rates |
| O-Swing% / SwStr% | Chase rate / Swinging strike rate |
| Pull% / Cent% / Oppo% | Batted ball direction splits |
| L/R Splits | vs LHP and vs RHP |

### Pitching Statistics
| Stat | Description |
|------|-------------|
| FIP | Fielding Independent Pitching |
| xFIP | Expected FIP (normalizes HR/FB) |
| SIERA | Skill-Interactive ERA |
| ERA- / FIP- | Park/era adjusted (100 = avg) |
| K/9, BB/9, K/BB | Rate stats |
| CSW% | Called Strike + Whiff rate |
| Stuff+ | Pitch quality model (100 = avg) |
| Location+ | Command quality model |
| GB% / FB% / LD% | Batted ball profile |
| Pitch Arsenal | Velocity, spin rate, movement, usage% |
| L/R Splits | vs LHB and vs RHB |

### Park Favorability Index (PFI) — Custom Statistic

A composite 0–200 score quantifying ballpark effects on batters and pitchers.

**Scale**: 100 = perfectly neutral | >100 = favors that group | <100 = hurts that group

**Batter PFI formula**:
```
Batter PFI = 100 × (
  run_factor   × 0.30   +
  hr_factor    × 0.30   +
  babip_factor × 0.20   +
  (2 - k_factor) × 0.10 +  ← inverted: fewer Ks = hitter-friendly
  bb_factor    × 0.05   +
  ev_factor    × 0.05
)
```

**Pitcher PFI = 200 − Batter PFI** (perfect inverse on the same scale)

Each factor = (home rate) / (away rate) using 3-year rolling Statcast data.
Neutral park = all factors = 1.0 → PFI = 100.

Expected reference points:
- Coors Field (COL): Batter PFI ≈ 155–165, Pitcher PFI ≈ 35–45
- Petco Park (SD): Batter PFI ≈ 68–78, Pitcher PFI ≈ 122–132
- Neutral parks: PFI ≈ 95–105

---

## API Endpoints

```
GET  /api/v1/players/{id}                    Player profile + bio
GET  /api/v1/players/{id}/splits/{season}    L/R and Home/Away splits
GET  /api/v1/batting/{id}/stats/{season}     Full batting stats
GET  /api/v1/batting/{id}/trend/{stat}       Year-by-year trend data
POST /api/v1/batting/{id}/statcast           Trigger Statcast job
GET  /api/v1/batting/{id}/spray-chart/{s}   Spray chart data
GET  /api/v1/pitching/{id}/stats/{season}    Full pitching stats
GET  /api/v1/pitching/{id}/trend/{stat}      Year-by-year trend data
GET  /api/v1/pitching/{id}/pitch-movement/{s} Pitch movement data
GET  /api/v1/leaderboards/batting/{season}   Batting leaderboard
GET  /api/v1/leaderboards/pitching/{season}  Pitching leaderboard
GET  /api/v1/leaderboards/sprint-speed/{s}  Sprint speed leaderboard
GET  /api/v1/comparison/batting             Compare up to 4 batters
GET  /api/v1/comparison/percentiles         Percentile ranks for comparison
GET  /api/v1/park-factors/{season}          Park Favorability Index (all parks)
GET  /api/v1/search/players?q={name}        Player name search
GET  /api/v1/jobs/{job_id}                  Background job status
GET  /api/v1/jobs/{job_id}/result           Completed job results
```

## Current Season

`CURRENT_SEASON = 2025` — the completed 2025 MLB season is the default.
Historical data is available from 2015 onward via the season selector.

## Caching

- FanGraphs season stats: disk-cached as Parquet files, 24h TTL
- Park Factors: disk-cached, 7-day TTL (computed from 3-year Statcast window)
- Player data: in-memory, 5-minute TTL
- Statcast pitch-level data: disk-cached permanently (historical data doesn't change)
