# MLB Advanced Analytics

A full-stack web application for MLB advanced baseball statistics. Features Statcast metrics, custom park factors, player comparison tools, contract value analysis, and more — live data for 2025 with historical records back to 2002.

**Live**: [frontend on Vercel] | **API**: [backend on Railway]

---

## Tech Stack

| Layer | Technologies |
|-------|-------------|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS, Recharts, React Query |
| Backend | Python 3.11, FastAPI, pandas, httpx, pybaseball |
| Deployment | Railway (backend, Docker), Vercel (frontend) |
| Caching | Parquet disk cache + in-memory TTLCache |

## Data Sources

| Source | Used For |
|--------|----------|
| MLB Stats API (`statsapi.mlb.com`) | Traditional stats, rosters, standings, splits, game logs |
| Baseball Savant (CSV leaderboards) | xBA, xSLG, xwOBA, Barrel%, Hard Hit%, Exit Velocity |
| Baseball Reference (WAR CSVs) | bWAR for batters and pitchers |
| pybaseball / Statcast | Per-player pitch-level data (spray charts, pitch zones) |

---

## Pages

### Leaderboards
Sortable, filterable stat tables for batters and pitchers. Minimum PA/IP filters. Stats include traditional counting stats plus WAR, wRC+, wOBA, FIP, xBA, xSLG, xwOBA, Barrel%, Hard Hit%, Exit Velocity, K%, BB%, and more.

### Player Profiles
Full individual player pages with:
- Bio, headshot, position, team, age
- Full season batting or pitching stat line
- Statcast metrics (Barrel%, Hard Hit%, xBA, xSLG, xwOBA, EV, LA)
- Year-by-year career stats with trend charts
- Platoon splits (vs LHP/RHP, Home/Away) — deduped for traded players
- Spray chart (batted ball locations colored by type)
- Pitch arsenal table (pitchers only)
- Pitch zone heatmaps (pitchers only)

### Player Comparison
Side-by-side comparison for up to 4 players. Radar chart percentile visualization across key offensive or pitching metrics.

### Park Favorability Index (PFI)
A custom 0–200 composite score quantifying ballpark effects on batters and pitchers.

**Scale**: 100 = perfectly neutral | >100 = favors that group | <100 = hurts that group

**Batter PFI formula:**
```
Batter PFI = 100 × (
  run_factor   × 0.30  +
  hr_factor    × 0.30  +
  babip_factor × 0.20  +
  (2 - k_factor) × 0.10 +   ← inverted: fewer Ks = hitter-friendly
  bb_factor    × 0.05  +
  ev_factor    × 0.05
)
```

**Pitcher PFI = 200 − Batter PFI**

Each factor = (home rate) / (away rate) using a 3-year rolling window of MLB API home/away splits. All 30 parks are ranked with reference values (Coors ≈ 155–165, Petco ≈ 68–78, neutral ≈ 95–105).

### Team Analytics
Team-level batting WAR, pitching WAR, wRC+, and win/loss records across seasons. Explore correlations between team stats and wins.

### Contract Value
WAR-per-dollar analysis showing which players delivered the most value relative to salary. Identifies overperformers and overpaid contracts. Uses MLB salary data combined with bWAR.

### Pitch Zone Charts
Pitcher location heatmaps — where pitchers throw by pitch type and batter handedness, built from Statcast pitch-level data.

---

## Local Development

### Backend

```bash
cd backend
python -m venv venv
source venv/bin/activate        # Windows: venv\Scripts\activate
pip install -r requirements.txt
uvicorn app.main:app --reload --port 8000
```

API available at `http://localhost:8000` — interactive docs at `/docs`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

App runs at `http://localhost:5173`. API calls proxy to `localhost:8000`.

---

## API Endpoints

```
GET  /health                                  Health check

GET  /api/v1/players/{id}                     Player profile + bio
GET  /api/v1/players/{id}/splits/{season}     Platoon + Home/Away splits
GET  /api/v1/players/{id}/game-log/{season}   Game-by-game log

GET  /api/v1/batting/{id}/stats/{season}      Full batting stat line
GET  /api/v1/batting/{id}/trend/{stat}        Year-by-year trend
GET  /api/v1/batting/{id}/spray-chart/{s}     Spray chart batted ball data

GET  /api/v1/pitching/{id}/stats/{season}     Full pitching stat line
GET  /api/v1/pitching/{id}/trend/{stat}       Year-by-year trend
GET  /api/v1/pitching/{id}/pitch-movement/{s} Pitch movement data
GET  /api/v1/pitching/{id}/pitch-zones/{s}    Zone heatmap data

GET  /api/v1/leaderboards/batting/{season}    Batting leaderboard
GET  /api/v1/leaderboards/pitching/{season}   Pitching leaderboard
GET  /api/v1/leaderboards/sprint-speed/{s}    Sprint speed leaderboard

GET  /api/v1/comparison/batting               Compare up to 4 batters
GET  /api/v1/comparison/pitching              Compare up to 4 pitchers
GET  /api/v1/comparison/percentiles           Percentile ranks

GET  /api/v1/teams                            All MLB teams
GET  /api/v1/teams/{id}/roster                Team roster
GET  /api/v1/teams/standings                  Division standings
GET  /api/v1/teams/analytics/{season}         Team batting/pitching/win totals

GET  /api/v1/park-factors/{season}            PFI scores for all 30 parks

GET  /api/v1/contract-value/{season}          WAR-per-dollar contract analysis

GET  /api/v1/search/players?q={name}          Player name search
```

## Caching Strategy

| Data | Storage | TTL |
|------|---------|-----|
| Season batting/pitching stats | Parquet (disk) | 24 hours |
| Baseball Savant leaderboards | Parquet (disk) | 24 hours |
| Baseball Reference WAR | Parquet (disk) | 72 hours |
| Chadwick player ID register | Parquet (disk) | 7 days |
| Team abbreviation map | Parquet (disk) | 7 days |
| Park Factors (PFI) | Parquet (disk) | 7 days |
| Player profiles / rosters | In-memory | 5 minutes |
| Statcast pitch-level data | Parquet (disk) | Permanent |

> Railway containers are ephemeral — all disk cache is rebuilt on each deploy. Startup work (Chadwick register download, cache warm) runs in a background thread so the health check passes immediately.
