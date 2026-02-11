import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { CourseList } from './pages/CourseList';
import { Learn } from './pages/Learn';
import Navbar from './components/layout/Navbar';
import Footer from './components/layout/Footer';

function AppContent() {
  const location = useLocation();
  const isLearnPage = location.pathname.startsWith('/learn/');

  return (
    <div className="min-h-screen flex flex-col bg-[var(--color-bg-primary)]">
      {!isLearnPage && <Navbar />}
      <main className="flex-1 flex flex-col min-h-0">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/courses" element={<CourseList />} />
          <Route path="/learn/:courseId" element={<Learn />} />
        </Routes>
      </main>
      {!isLearnPage && <Footer />}
    </div>
  );
}

function App() {
  return (
    <Router>
      <AppContent />
    </Router>
  );
}

export default App;
