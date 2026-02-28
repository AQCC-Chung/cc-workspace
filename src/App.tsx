import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'

// Lazy load route components for code splitting
const Home = lazy(() => import('./pages/Home/Home'))
const TasteMap = lazy(() => import('./pages/TasteMap/TasteMap'))
const Flights = lazy(() => import('./pages/Flights/Flights'))
const FitTracker = lazy(() => import('./pages/FitTracker/FitTracker'))
const MeetNote = lazy(() => import('./pages/MeetNote/MeetNote'))

function App() {
  return (
    <>
      <Navbar />
      <main>
        <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', padding: '2rem' }}>Loading...</div>}>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/tastemap" element={<TasteMap />} />
            <Route path="/flights" element={<Flights />} />
            <Route path="/gym" element={<FitTracker />} />
            <Route path="/meetnote" element={<MeetNote />} />
          </Routes>
        </Suspense>
      </main>
    </>
  )
}

export default App
