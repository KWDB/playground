import { BrowserRouter as Router, Routes, Route, useLocation, type Location } from 'react-router-dom';
import { lazy, Suspense } from 'react';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import { ThemeProvider, useTheme } from './hooks/useTheme';
import { useSwitchTransition } from './hooks/useSwitchTransition';
import { ErrorBoundary } from './components/ui/ErrorBoundary';

const Home = lazy(() => import('./pages/Home'));
const CourseList = lazy(() => import('./pages/CourseList'));
const CourseImageManagement = lazy(() => import('./pages/CourseImageManagement').then(m => ({ default: m.CourseImageManagement })));
const Learn = lazy(() => import('./pages/Learn').then(m => ({ default: m.Learn })));

function PageLoader() {
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-[var(--color-border-default)] border-t-[var(--color-accent-primary)] rounded-full animate-spin" />
        <span className="text-sm text-[var(--color-text-tertiary)]">思考中...</span>
      </div>
    </div>
  );
}

function AppContent() {
  const location = useLocation();
  const isLearnPage = location.pathname.startsWith('/learn/');
  const { theme, toggleTheme } = useTheme();
  const routeKey = `${location.pathname}${location.search}${location.hash}`;
  const { renderedValue: displayLocation, stage: routeStage } = useSwitchTransition<Location>(routeKey, location, 160);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg-primary)]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-4 focus:left-4 focus:z-50 focus:px-4 focus:py-2 focus:bg-[var(--color-accent-primary)] focus:text-white focus:rounded-md focus:outline-none focus:ring-2 focus:ring-[var(--color-accent-primary)]"
      >
        跳过导航
      </a>
      {!isLearnPage && <Navbar theme={theme} onToggleTheme={toggleTheme} />}
      <main id="main-content" className="flex-1 flex flex-col min-h-0">
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <div className={`route-transition ${routeStage === 'enter' ? 'is-entering' : 'is-exiting'}`}>
              <Routes location={displayLocation}>
                <Route path="/" element={<Home />} />
                <Route path="/courses" element={<CourseList />} />
                <Route path="/image-management" element={<CourseImageManagement />} />
                <Route path="/learn/:courseId" element={<Learn />} />
              </Routes>
            </div>
          </Suspense>
        </ErrorBoundary>
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
