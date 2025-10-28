import { BrowserRouter as Router, Routes, Route, useLocation } from 'react-router-dom';
import { Home } from './pages/Home';
import { CourseList } from './pages/CourseList';
import { Learn } from './pages/Learn';
import Navbar from './components/layout/Navbar';

// 内部组件，用于根据路由决定是否显示导航栏
function AppContent() {
  const location = useLocation();
  
  // 在学习页面不显示导航栏，因为学习页面有自己的布局
  const showNavbar = !location.pathname.startsWith('/learn/');
  
  return (
    <div className="h-screen flex flex-col bg-gray-50">
      {showNavbar && <Navbar />}
      <main className={`flex-1 ${showNavbar ? 'min-h-0 overflow-y-auto' : 'overflow-hidden'}`}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/courses" element={<CourseList />} />
          <Route path="/learn/:courseId" element={<Learn />} />
        </Routes>
      </main>
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
