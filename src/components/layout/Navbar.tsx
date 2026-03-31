import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Home, BookOpen, Menu, X, CircleHelp, DatabaseZap } from 'lucide-react';
import { useTourStore } from '@/store/tourStore';
import { cn } from '@/lib/utils';
import { FaGithub } from 'react-icons/fa';
import LogoUrl from '/assets/logo.svg?url';
import EnvCheckButton from '@/components/business/EnvCheckButton';
import EnvCheckPanel from '@/components/business/EnvCheckPanel';
import UpgradeButton from '@/components/business/UpgradeButton';
import UpgradePanel from '@/components/business/UpgradePanel';
import { Theme } from '@/hooks/useTheme';
import ThemeToggle from './ThemeToggle';
import { navbarButtonStyles } from './navbarButtonStyles';

interface NavbarProps {
  theme: Theme;
  onToggleTheme: () => void;
}

const Navbar: React.FC<NavbarProps> = ({ theme, onToggleTheme }) => {
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
      if (target instanceof Element && target.closest('[role="dialog"]')) return;
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
    if (pathname === '/image-management') return 'image-management';
    if (pathname.startsWith('/learn/')) return 'learn';
    return null;
  };

  const pageName = getPageName(location.pathname);

  const closePanels = () => {
    setShowEnvPanel(false);
    setShowUpgradePanel(false);
  };

  const handleHelp = () => {
    if (pageName) {
      startTour(pageName);
      setIsMobileMenuOpen(false);
      closePanels();
    }
  };

  const handleMobileMenuToggle = () => {
    setIsMobileMenuOpen((prev) => {
      const next = !prev;
      if (!next) closePanels();
      return next;
    });
  };

  const navItems = [
    { path: '/', label: '首页', icon: Home },
    { path: '/courses', label: '课程', icon: BookOpen },
    { path: '/image-management', label: '镜像管理', icon: DatabaseZap },
  ];

  const isActive = (path: string) => location.pathname === path;
  const getNavItemClassName = (path: string, isMobile = false) =>
    cn(
      navbarButtonStyles.navItemBase,
      isMobile ? navbarButtonStyles.navItemMobile : navbarButtonStyles.navItemDesktop,
      isActive(path) ? navbarButtonStyles.navItemActive : navbarButtonStyles.navItemInactive
    );
  const isTourButtonActive = Boolean(pageName && isTourActive && tourCurrentPage === pageName);

  return (
    <nav className="sticky top-0 z-50 bg-[var(--color-bg-primary)] border-b border-[var(--color-border-light)]">
      <div className="w-full max-w-[90rem] mx-auto px-4 sm:px-6">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-3 sm:gap-4 md:gap-8 min-w-0">
            <Link to="/" className="flex min-w-0 items-center gap-2.5">
              <img 
                src={LogoUrl}
                alt="KWDB Logo"
                className="w-8 h-8 object-contain"
                loading="eager"
                fetchPriority="high"
              />
              <span className="hidden max-w-[12rem] truncate text-balance text-sm font-semibold text-[var(--color-text-primary)] sm:inline">
                KWDB Playground
              </span>
            </Link>

            <div className="hidden md:flex items-center gap-1">
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  className={getNavItemClassName(item.path)}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 md:gap-3 shrink-0">
            <button
              onClick={handleHelp}
              disabled={!pageName}
              className={cn(
                'hidden md:inline-flex',
                navbarButtonStyles.iconButtonBase,
                pageName
                  ? isTourButtonActive
                    ? navbarButtonStyles.iconButtonActive
                    : navbarButtonStyles.iconButtonDefault
                  : navbarButtonStyles.iconButtonDisabled
              )}
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
              className={cn('hidden md:inline-flex', navbarButtonStyles.iconButtonBase, navbarButtonStyles.iconButtonDefault)}
              aria-label="GitHub"
            >
              <FaGithub className="w-4 h-4" />
            </a>
            <div className="hidden md:block">
              <ThemeToggle theme={theme} onToggle={onToggleTheme} />
            </div>

            <div ref={upgradePanelRef} className="relative hidden md:block" data-tour-id="home-upgrade">
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

            <div ref={envPanelRef} className="relative hidden md:block" data-tour-id="home-env-check">
              <EnvCheckButton
                variant="navbar"
                onClick={() => {
                  setShowEnvPanel(!showEnvPanel);
                  setShowUpgradePanel(false);
                }}
              />
              {showEnvPanel && (
                <div className="absolute right-0 top-full mt-2 w-96 z-50">
                  <EnvCheckPanel alwaysExpanded={true} />
                </div>
              )}
            </div>

            <button
              onClick={handleMobileMenuToggle}
              className={cn(
                'md:hidden',
                navbarButtonStyles.iconButtonBase,
                navbarButtonStyles.iconButtonDefault
              )}
              aria-label="菜单"
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {isMobileMenuOpen && (
          <div className="md:hidden py-3 border-t border-[var(--color-border-light)]">
            <div className="flex flex-col gap-1">
              <ThemeToggle theme={theme} onToggle={onToggleTheme} className="w-full justify-start px-3 py-2.5 text-sm font-medium" />
              {navItems.map((item) => (
                <Link
                  key={item.path}
                  to={item.path}
                  onClick={() => setIsMobileMenuOpen(false)}
                  className={getNavItemClassName(item.path, true)}
                >
                  <item.icon className="w-4 h-4" />
                  {item.label}
                </Link>
              ))}
              <div className="h-px bg-[var(--color-border-light)] my-2" />
              <button 
                onClick={handleHelp}
                disabled={!pageName}
                className={cn(
                  navbarButtonStyles.navItemBase,
                  navbarButtonStyles.navItemMobile,
                  'w-full text-left',
                  pageName
                    ? isTourButtonActive
                      ? navbarButtonStyles.navItemActive
                      : navbarButtonStyles.navItemInactive
                    : navbarButtonStyles.iconButtonDisabled
                )}
              >
                <CircleHelp className="w-4 h-4" />
                使用指南
              </button>
              <div className="h-px bg-[var(--color-border-light)] my-2" />
              <a
                href="https://github.com/KWDB/KWDB"
                target="_blank"
                rel="noopener noreferrer"
                className={cn(
                  navbarButtonStyles.navItemBase,
                  navbarButtonStyles.navItemMobile,
                  navbarButtonStyles.navItemInactive
                )}
                onClick={() => setIsMobileMenuOpen(false)}
                aria-label="GitHub"
              >
                <FaGithub className="w-4 h-4" />
                GitHub
              </a>
              <div className="space-y-2" data-tour-id="home-upgrade">
                <div className="[&>button]:w-full [&>button]:justify-between">
                  <UpgradeButton
                    onClick={() => {
                      setShowUpgradePanel(!showUpgradePanel);
                      setShowEnvPanel(false);
                    }}
                  />
                </div>
                {showUpgradePanel && (
                  <div className="w-full">
                    <UpgradePanel alwaysExpanded={true} />
                  </div>
                )}
              </div>
              <div className="space-y-2" data-tour-id="home-env-check">
                <div className="[&>button]:w-full [&>button]:justify-between">
                  <EnvCheckButton
                    variant="navbar"
                    onClick={() => {
                      setShowEnvPanel(!showEnvPanel);
                      setShowUpgradePanel(false);
                    }}
                  />
                </div>
                {showEnvPanel && (
                  <div className="w-full">
                    <EnvCheckPanel alwaysExpanded={true} />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </nav>
  );
};

export default Navbar;
