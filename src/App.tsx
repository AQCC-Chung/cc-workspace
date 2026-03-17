import { Routes, Route } from 'react-router-dom'
import Navbar from './components/Navbar'
import Home from './pages/Home/Home'
import TasteMap from './pages/TasteMap/TasteMap'
import Flights from './pages/Flights/Flights'
import FitTracker from './pages/FitTracker/FitTracker'
import MeetNote from './pages/MeetNote/MeetNote'
import StockMonitor from './pages/StockMonitor/StockMonitor'

function App() {
  return (
    <>
      <Navbar />
      <main>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/tastemap" element={<TasteMap />} />
          <Route path="/flights" element={<Flights />} />
          <Route path="/gym" element={<FitTracker />} />
          <Route path="/meetnote" element={<MeetNote />} />
          <Route path="/stock" element={<StockMonitor />} />
        </Routes>
      </main>
    </>
  )
}

export default App
