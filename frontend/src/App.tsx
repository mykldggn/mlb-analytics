import { BrowserRouter, Routes, Route } from 'react-router-dom'
import AppLayout from './components/layout/AppLayout'
import HomePage from './pages/HomePage'
import PlayerProfilePage from './pages/PlayerProfilePage'
import LeaderboardPage from './pages/LeaderboardPage'
import ComparisonPage from './pages/ComparisonPage'
import ParkFactorsPage from './pages/ParkFactorsPage'
import TeamAnalyticsPage from './pages/TeamAnalyticsPage'
import ContractValuePage from './pages/ContractValuePage'
import PitchZonePage from './pages/PitchZonePage'
import NotFoundPage from './pages/NotFoundPage'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppLayout />}>
          <Route path="/" element={<HomePage />} />
          <Route path="/players/:playerId" element={<PlayerProfilePage />} />
          <Route path="/leaderboards" element={<LeaderboardPage />} />
          <Route path="/compare" element={<ComparisonPage />} />
          <Route path="/park-factors" element={<ParkFactorsPage />} />
          <Route path="/team-analytics" element={<TeamAnalyticsPage />} />
          <Route path="/contract-value" element={<ContractValuePage />} />
          <Route path="/pitch-zones" element={<PitchZonePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
