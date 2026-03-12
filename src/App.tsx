import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { CourseList } from './pages/CourseList';
import { Learn } from './pages/Learn';
import { CourseImageManagement } from './pages/CourseImageManagement';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';
import { ThemeProvider, useTheme } from './hooks/useTheme';

function AppContent() {
  const location = useLocation();
  const isLearnPage = location.pathname.startsWith('/learn/');
  const { theme, toggleTheme } = useTheme();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg-primary)]">
      {!isLearnPage && <Navbar theme={theme} onToggleTheme={toggleTheme} />}
      <main className="flex-1 flex flex-col min-h-0">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/courses" element={<CourseList />} />
          <Route path="/image-management" element={<CourseImageManagement />} />
          <Route path="/learn/:courseId" element={<Learn />} />
        </Routes>
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
