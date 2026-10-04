import React, { useState } from 'react';
import {
  ChevronRight,
  Home,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Video,
  X,
} from 'lucide-react';
import { NavTab } from '../../types/meeting';
import { useAuth } from '../../context/AuthContext';
import { IslamicStarRosette, SidebarCornerOrnament } from '../common/IslamicStarRosette';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  userName: string;
  onOpenAuthModal: () => void;
  isCollapsed?: boolean;
  onToggleCollapse?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  userName,
  onOpenAuthModal,
  isCollapsed: externalIsCollapsed,
  onToggleCollapse: externalToggleCollapse,
}) => {
  const [internalIsCollapsed, setInternalIsCollapsed] = useState<boolean>(() => {
    try {
      return localStorage.getItem('majlis_sidebar_collapsed') === 'true';
    } catch {
      return false;
    }
  });
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isModerator } = useAuth();

  const isCollapsed = externalIsCollapsed !== undefined ? externalIsCollapsed : internalIsCollapsed;

  const handleToggleCollapse = () => {
    if (externalToggleCollapse) {
      externalToggleCollapse();
    } else {
      setInternalIsCollapsed((prev) => {
        const next = !prev;
        try {
          localStorage.setItem('majlis_sidebar_collapsed', String(next));
        } catch {}
        return next;
      });
    }
  };

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  const displayName = userName || (user?.email ? user.email.split('@')[0] : 'Araiz Hasan');
  const initials = displayName
    .split(' ')
    .map((n) => n[0])
    .join('')
    .substring(0, 2)
    .toUpperCase() || 'AH';

  // Desktop Navigation Content
  const desktopNavContent = (
    <div className={`flex flex-col justify-between h-full select-none bg-[#160E09] text-[#FFFCF5] relative overflow-hidden transition-all duration-300 ${
      isCollapsed ? 'px-2.5 py-4 items-center' : 'p-5'
    }`}>
      <div className="relative z-10 w-full flex flex-col items-stretch">
        {/* Top Brand Logo & Collapse Toggle */}
        <div className={`flex items-center mb-7 ${isCollapsed ? 'flex-col gap-3 justify-center' : 'justify-between'}`}>
          <div
            className={`flex items-center gap-3 cursor-pointer ${isCollapsed ? 'justify-center' : ''}`}
            onClick={() => handleNavClick('home')}
            title="The Wisdom Lounge · Majlis"
          >
            <IslamicStarRosette size={isCollapsed ? 30 : 34} variant="full" />
            {!isCollapsed && (
              <div className="flex flex-col min-w-0">
                <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#E9A83A] leading-none">
                  THE WISDOM LOUNGE
                </span>
                <span className="text-lg font-bold text-[#FFFCF5] tracking-tight leading-tight mt-1">
                  Majlis
                </span>
              </div>
            )}
          </div>

          {/* Collapse / Expand Toggle Button */}
          <button
            onClick={handleToggleCollapse}
            className={`p-1.5 text-[#8A7A6D] hover:text-[#FFFCF5] hover:bg-[#22160E] rounded-md transition-colors ${
              isCollapsed ? 'w-8 h-8 flex items-center justify-center' : ''
            }`}
            title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            aria-label={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {isCollapsed ? (
              <PanelLeftOpen className="w-4 h-4" />
            ) : (
              <PanelLeftClose className="w-4 h-4" />
            )}
          </button>
        </div>

        {/* Primary Navigation */}
        <nav className="space-y-1.5 w-full">
          <button
            onClick={() => handleNavClick('home')}
            className={`w-full flex items-center rounded-sm text-sm transition-colors ${
              isCollapsed
                ? 'justify-center p-2.5'
                : 'gap-3 px-3.5 py-2.5'
            } ${
              currentTab === 'home'
                ? 'bg-[#075E4A] text-[#FFFCF5] font-semibold border border-[#19A6A0]/40 shadow-xs'
                : 'text-[#C2B2A3] hover:bg-[#20150E] hover:text-[#FFFCF5] font-medium'
            }`}
            title={isCollapsed ? 'Home' : undefined}
          >
            <Home
              className={`w-4 h-4 shrink-0 ${currentTab === 'home' ? 'text-[#FFFCF5]' : 'text-[#8A7A6D]'}`}
              strokeWidth={2}
            />
            {!isCollapsed && <span>Home</span>}
          </button>

          <button
            onClick={() => handleNavClick('majalis')}
            className={`w-full flex items-center rounded-sm text-sm transition-colors ${
              isCollapsed
                ? 'justify-center p-2.5'
                : 'gap-3 px-3.5 py-2.5'
            } ${
              currentTab === 'majalis'
                ? 'bg-[#075E4A] text-[#FFFCF5] font-semibold border border-[#19A6A0]/40 shadow-xs'
                : 'text-[#C2B2A3] hover:bg-[#20150E] hover:text-[#FFFCF5] font-medium'
            }`}
            title={isCollapsed ? 'Majlis' : undefined}
          >
            <Video
              className={`w-4 h-4 shrink-0 ${currentTab === 'majalis' ? 'text-[#FFFCF5]' : 'text-[#8A7A6D]'}`}
              strokeWidth={2}
            />
            {!isCollapsed && <span>Majlis</span>}
          </button>
        </nav>
      </div>

      {/* Bottom Area: Settings, User Profile, and Corner Geometric Ornament */}
      <div className={`relative z-10 w-full pt-4 border-t border-[#2A1B12] ${isCollapsed ? 'space-y-3 flex flex-col items-center' : 'space-y-3'}`}>
        {/* Settings Item */}
        <button
          onClick={() => handleNavClick('settings')}
          className={`w-full flex items-center rounded-sm text-sm transition-colors ${
            isCollapsed
              ? 'justify-center p-2.5'
              : 'gap-3 px-3.5 py-2.5'
          } ${
            currentTab === 'settings'
              ? 'bg-[#075E4A] text-[#FFFCF5] font-semibold border border-[#19A6A0]/40 shadow-xs'
              : 'text-[#C2B2A3] hover:bg-[#20150E] hover:text-[#FFFCF5] font-medium'
          }`}
          title={isCollapsed ? 'Settings' : undefined}
        >
          <Settings className="w-4 h-4 text-[#8A7A6D] shrink-0" strokeWidth={2} />
          {!isCollapsed && <span>Settings</span>}
        </button>

        {/* User Profile Block */}
        <div
          onClick={onOpenAuthModal}
          className={`rounded-sm hover:bg-[#20150E] transition-colors cursor-pointer group ${
            isCollapsed
              ? 'p-1.5 flex items-center justify-center'
              : 'flex items-center justify-between p-2'
          }`}
          title={isCollapsed ? `${displayName} (${isModerator ? 'Moderator' : 'Member'}) · Account` : 'Account / Sign in'}
        >
          <div className={`flex items-center ${isCollapsed ? 'justify-center' : 'gap-3 min-w-0'}`}>
            <div className="w-8 h-8 rounded-full bg-[#20150F] text-[#FAF8F5] flex items-center justify-center font-bold text-xs shrink-0 tracking-wider shadow-xs relative border border-[#3A2619]">
              {initials}
              {isModerator && (
                <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-[#E9A83A] rounded-full border-2 border-[#160E09]" />
              )}
            </div>
            {!isCollapsed && (
              <div className="min-w-0">
                <div className="text-sm font-bold text-[#FFFCF5] truncate leading-snug">
                  {displayName}
                </div>
                <div className="text-xs text-[#E9A83A] leading-none mt-0.5">
                  {isModerator ? 'Moderator' : 'Member'}
                </div>
              </div>
            )}
          </div>
          {!isCollapsed && (
            <ChevronRight className="w-4 h-4 text-[#8A7A6D] group-hover:text-[#FFFCF5] transition-colors shrink-0" />
          )}
        </div>
      </div>

      {/* Islamic Geometric Tile Corner Ornament */}
      {!isCollapsed && (
        <SidebarCornerOrnament className="absolute -bottom-2 -left-2 z-0 opacity-20 pointer-events-none" />
      )}
    </div>
  );

  // Mobile Navigation Drawer Content
  const mobileNavContent = (
    <div className="flex flex-col justify-between h-full p-5 select-none bg-[#160E09] text-[#FFFCF5] relative overflow-hidden">
      <div className="relative z-10">
        {/* Top Brand Logo */}
        <div className="flex items-center gap-3 mb-8 cursor-pointer" onClick={() => handleNavClick('home')}>
          <IslamicStarRosette size={34} variant="full" />
          <div className="flex flex-col">
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#E9A83A] leading-none">
              THE WISDOM LOUNGE
            </span>
            <span className="text-lg font-bold text-[#FFFCF5] tracking-tight leading-tight mt-1">
              Majlis
            </span>
          </div>
        </div>

        {/* Primary Navigation */}
        <nav className="space-y-1.5">
          <button
            onClick={() => handleNavClick('home')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-sm text-sm transition-colors ${
              currentTab === 'home'
                ? 'bg-[#075E4A] text-[#FFFCF5] font-semibold border border-[#19A6A0]/40'
                : 'text-[#C2B2A3] hover:bg-[#20150E] hover:text-[#FFFCF5] font-medium'
            }`}
          >
            <Home className={`w-4 h-4 shrink-0 ${currentTab === 'home' ? 'text-[#FFFCF5]' : 'text-[#8A7A6D]'}`} strokeWidth={2} />
            <span>Home</span>
          </button>

          <button
            onClick={() => handleNavClick('majalis')}
            className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-sm text-sm transition-colors ${
              currentTab === 'majalis'
                ? 'bg-[#075E4A] text-[#FFFCF5] font-semibold border border-[#19A6A0]/40'
                : 'text-[#C2B2A3] hover:bg-[#20150E] hover:text-[#FFFCF5] font-medium'
            }`}
          >
            <Video className={`w-4 h-4 shrink-0 ${currentTab === 'majalis' ? 'text-[#FFFCF5]' : 'text-[#8A7A6D]'}`} strokeWidth={2} />
            <span>Majlis</span>
          </button>
        </nav>
      </div>

      {/* Bottom Area */}
      <div className="relative z-10 pt-4 border-t border-[#2A1B12] space-y-3">
        <button
          onClick={() => handleNavClick('settings')}
          className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-sm text-sm transition-colors ${
            currentTab === 'settings'
              ? 'bg-[#075E4A] text-[#FFFCF5] font-semibold border border-[#19A6A0]/40'
              : 'text-[#C2B2A3] hover:bg-[#20150E] hover:text-[#FFFCF5] font-medium'
          }`}
        >
          <Settings className="w-4 h-4 text-[#8A7A6D] shrink-0" strokeWidth={2} />
          <span>Settings</span>
        </button>

        <div
          onClick={onOpenAuthModal}
          className="flex items-center justify-between p-2 rounded-sm hover:bg-[#20150E] transition-colors cursor-pointer group"
          title="Account / Sign in"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-8 h-8 rounded-full bg-[#20150F] text-[#FAF8F5] flex items-center justify-center font-bold text-xs shrink-0 tracking-wider shadow-xs border border-[#3A2619]">
              {initials}
            </div>
            <div className="min-w-0">
              <div className="text-sm font-bold text-[#FFFCF5] truncate leading-snug">
                {displayName}
              </div>
              <div className="text-xs text-[#E9A83A] leading-none mt-0.5">
                {isModerator ? 'Moderator' : 'Member'}
              </div>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-[#8A7A6D] group-hover:text-[#FFFCF5] transition-colors shrink-0" />
        </div>
      </div>

      <SidebarCornerOrnament className="absolute -bottom-2 -left-2 z-0 opacity-20 pointer-events-none" />
    </div>
  );

  return (
    <>
      {/* Desktop Sidebar with Smooth Collapsing Width */}
      <aside className={`hidden md:flex ${
        isCollapsed ? 'w-18' : 'w-64'
      } bg-[#160E09] border-r border-[#2A1B12] flex-col h-screen shrink-0 z-20 transition-all duration-300 ease-in-out`}>
        {desktopNavContent}
      </aside>

      {/* Mobile Top Bar */}
      <header className="md:hidden bg-[#160E09] border-b border-[#2A1B12] px-4 py-2.5 flex items-center justify-between z-20 shrink-0 select-none text-[#FFFCF5]">
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1 text-[#C2B2A3] rounded-sm hover:bg-[#20150E] transition-colors"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div className="flex items-center gap-2">
            <IslamicStarRosette size={26} variant="full" />
            <span className="text-base font-bold text-[#FFFCF5] tracking-tight">Majlis</span>
          </div>
        </div>

        <button
          onClick={onOpenAuthModal}
          className="w-8 h-8 rounded-full bg-[#20150F] text-[#FAF8F5] flex items-center justify-center font-bold text-xs border border-[#3A2619]"
        >
          {initials}
        </button>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 bg-[#160E09] h-full z-10 flex flex-col border-r border-[#2A1B12]">
            <div className="absolute top-4 right-4 z-20">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-[#8A7A6D] hover:text-[#FFFCF5]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {mobileNavContent}
          </div>
        </div>
      )}
    </>
  );
};
