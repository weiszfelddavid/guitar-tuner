import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MainLayout } from './layouts/MainLayout';
import { TuningPage } from './pages/TuningPage';
import TechnicalOverview from './pages/TechnicalOverview';
import { ScrollToTop } from './components/ScrollToTop';
import './App.css';

function App() {
  return (
    <Router>
      <ScrollToTop />
      <Routes>
          {/* Static Pages */}
          <Route path="/technical-overview" element={<TechnicalOverview />} />

          {/* Root Redirect to Default Language */}
          <Route path="/" element={<Navigate to="/en/guitar/standard" replace />} />

          <Route path="/:lang" element={<MainLayout />}>
            {/* Default tuning for language index */}
            <Route index element={<Navigate to="guitar/standard" replace />} />
            
            {/* Specific Tuning Page */}
            <Route path=":instrument/:tuning" element={<TuningPage />} />
          </Route>

          {/* Catch-all Redirect */}
          <Route path="*" element={<Navigate to="/en/guitar/standard" replace />} />
        </Routes>
      </Router>
  );
}

export default App;
