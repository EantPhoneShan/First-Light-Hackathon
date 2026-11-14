import { BrowserRouter, Route, Routes } from 'react-router-dom'
import SyncTestPanel from '@/dev/SyncTestPanel'
import { Layout } from '@/components/Layout'
import { Briefing } from '@/screens/Briefing'
import { Launch } from '@/screens/Launch'
import { Learn } from '@/screens/Learn'
import { Feasibility } from '@/screens/Feasibility'
import { Lobby } from '@/screens/Lobby'
import { NotFound } from '@/screens/Placeholders'
import { Review } from '@/screens/Review'
import { Report } from '@/screens/Report'
import { Simulation } from '@/screens/Simulation'
import { Title } from '@/screens/Title'
import { Workbench } from '@/screens/Workbench'

export default function App() {
  // Member 3's multiplayer test panel: open the app with ?synctest in the URL.
  if (new URLSearchParams(window.location.search).has('synctest')) return <SyncTestPanel />

  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Title />} />
        <Route element={<Layout />}>
          <Route path="/lobby" element={<Lobby />} />
          <Route path="/briefing" element={<Briefing />} />
          <Route path="/feasibility" element={<Feasibility />} />
          <Route path="/workbench" element={<Workbench />} />
          <Route path="/review" element={<Review />} />
          <Route path="/launch" element={<Launch />} />
          <Route path="/sim" element={<Simulation />} />
          <Route path="/report" element={<Report />} />
          <Route path="/learn" element={<Learn />} />
          <Route path="*" element={<NotFound />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
