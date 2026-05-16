import { Routes, Route } from 'react-router-dom'
import SetupPage from './pages/SetupPage.jsx'
import DashboardPage from './pages/DashboardPage.jsx'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<SetupPage />} />
      <Route path="/grade/:assignment_id" element={<DashboardPage />} />
    </Routes>
  )
}
