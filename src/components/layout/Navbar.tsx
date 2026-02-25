import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, Menu, X, CircleHelp } from 'lucide-react';
import { useTourStore } from '@/store/tourStore';
import { FaGithub } from 'react-icons/fa';
import LogoUrl from '/assets/logo.svg?url';
import EnvCheckButton from '@/components/business/EnvCheckButton';
import EnvCheckPanel from '@/components/business/EnvCheckPanel';
import UpgradeButton from '@/components/business/UpgradeButton';
import UpgradePanel from '@/components/business/UpgradePanel';

const Navbar: React.FC = () => {
  const location = useLocation();
  const { startTour, isActive: isTourActive, currentPage: tourCurrentPage } = useTourStore();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [showEnvPanel, setShowEnvPanel] = useState(false);
  const [showUpgradePanel, setShowUpgradePanel] = useState(false);
  const envPanelRef = useRef<HTMLDivElement>(null);
  const upgradePanelRef = useRef<HTMLDivElement>(null);

  // Click outside handler to close panel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      const target = event.target as Node;
      if (envPanelRef.current && envPanelRef.current.contains(target)) return;
      if (upgradePanelRef.current && upgradePanelRef.current.contains(target)) return;
      setShowEnvPanel(false);
      setShowUpgradePanel(false);
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getPageName = (pathname: string) => {
    if (pathname === '/') return 'home';
    if (pathname === '/courses') return 'courses';
    if (pathname.startsWith('/learn/')) return 'learn';
    return null;
  };

  const pageName = getPageName(location.pathname);

  const handleHelp = () => {
    if (pageName) {
      startTour(pageName);
      setIsMobileMenuOpen(false);
    }
  };

  const navItems = [
    { path: '/', label: '首页', icon: Home },
    { path: '/courses', label: '课程', icon: BookOpen },
  ];

  const isActive = (path: string) => location.pathname === path;

  return (
    <nav className="sticky top-0 z-50 bg-[var(--color-bg-primary)] border-b border-[var(--color-border-light)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-8">
            <Link to="/" className="flex items-center gap-2.5">
              <img 
                src={LogoUrl}
                alt="KWDB Logo"
                className="w-8 h-8 object-contain"
              />
              <span className="text-sm font-medium text-[var(--color-text-primary)]">
                KWDB Playground
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors duration-150 ${
                    isActive(item.path)
                      ? 'text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={handleHelp}
              disabled={!pageName}
              className={`hidden md:block p-2 rounded-md transition-colors ${
                pageName 
                  ? (isTourActive && tourCurrentPage === pageName ? 'text-[var(--color-primary)] bg-[var(--color-bg-secondary)]' : 'text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]')
                  : 'text-[var(--color-text-disabled)] cursor-not-allowed opacity-50'
              }`}
              aria-label="帮助"
              title="开启页面引导"
              data-tour-id="help-button"
              data-testid="help-button"
            >
              <CircleHelp className="w-4 h-4" />
            </button>

            <a
              href="https://github.com/KWDB/KWDB"
              target="_blank"
              rel="noopener noreferrer"
              className="p-2 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              aria-label="GitHub"
            >
              <FaGithub className="w-4 h-4" />
            </a>

            <div ref={upgradePanelRef} className="relative">
              <UpgradeButton
                onClick={() => {
                  setShowUpgradePanel(!showUpgradePanel);
                  setShowEnvPanel(false);
                }}
              />
              {showUpgradePanel && (
                <div className="absolute right-0 top-full mt-2 w-80 z-50">
                  <UpgradePanel alwaysExpanded={true} />
                </div>
              )}
            </div>

            <div ref={envPanelRef} className="relative" data-tour-id="home-env-check">
              <EnvCheckButton
                variant="navbar"
                onClick={() => {
                  setShowEnvPanel(!showEnvPanel);
                  setShowUpgradePanel(false);
                }}
              />
              {showEnvPanel && (
                <div className="absolute right-0 top-full mt-2 w-80 z-50">
                  <EnvCheckPanel alwaysExpanded={true} />
                </div>
              )}
            </div>

            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              className="md:hidden p-2 rounded-md text-[var(--color-text-tertiary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)] transition-colors"
              aria-label="菜单"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-[var(--color-border-light)]">
            <div className="flex flex-col gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors ${
                    isActive(item.path)
                      ? 'text-[var(--color-text-primary)] bg-[var(--color-bg-secondary)]'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
                  }`}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              ))}
              <div className="h-px bg-[var(--color-border-light)] my-2" />
              <button 
                onClick={handleHelp}
                disabled={!pageName}
                className={`flex w-full items-center gap-3 px-3 py-2.5 rounded-md text-sm font-medium transition-colors text-left ${
                  pageName
                    ? 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-bg-secondary)]'
                    : 'text-[var(--color-text-disabled)] cursor-not-allowed opacity-50'
                }`}
              >
                <CircleHelp className="w-4 h-4" />
                使用指南
              </button>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
