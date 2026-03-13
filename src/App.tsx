import { BrowserRouter as Router, Routes, Route, useLocation, type Location } from 'react-router-dom';
import { Home } from './pages/Home';
import { CourseList } from './pages/CourseList';
import { Learn } from './pages/Learn';
import { CourseImageManagement } from './pages/CourseImageManagement';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import { ThemeProvider, useTheme } from './hooks/useTheme';
import { useSwitchTransition } from './hooks/useSwitchTransition';

function AppContent() {
  const location = useLocation();
  const isLearnPage = location.pathname.startsWith('/learn/');
  const { theme, toggleTheme } = useTheme();
  const routeKey = `${location.pathname}${location.search}${location.hash}`;
  const { renderedValue: displayLocation, stage: routeStage } = useSwitchTransition<Location>(routeKey, location, 160);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg-primary)]">
      {!isLearnPage && <Navbar theme={theme} onToggleTheme={toggleTheme} />}
      <main className="flex-1 flex flex-col min-h-0">
        <div className={`route-transition ${routeStage === 'enter' ? 'is-entering' : 'is-exiting'}`}>
          <Routes location={displayLocation}>
            <Route path="/" element={<Home />} />
            <Route path="/courses" element={<CourseList />} />
            <Route path="/image-management" element={<CourseImageManagement />} />
            <Route path="/learn/:courseId" element={<Learn />} />
          </Routes>
        </div>
      </main>
      {!isLearnPage && <Footer />}
    </div>
  );
}

function App() {
  return (
    <ThemeProvider>
      <Router>
        <AppContent />
      </Router>
    </ThemeProvider>
  );
}

export default App;
