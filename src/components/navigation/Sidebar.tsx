import React, { useState } from 'react';
import {
  Crown,
  Home,
  Menu,
  Settings,
  ShieldCheck,
  User,
  Video,
  X,
  LogIn,
} from 'lucide-react';
import { NavTab } from '../../types/meeting';
import { useAuth } from '../../context/AuthContext';

interface SidebarProps {
  currentTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  userName: string;
  onOpenAuthModal: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentTab,
  onSelectTab,
  userName,
  onOpenAuthModal,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const { user, isFacilitator } = useAuth();

  const mainNav = [
    { id: 'home' as NavTab, label: 'Home', icon: Home },
    { id: 'majalis' as NavTab, label: 'Majalis', icon: Video },
  ];

  const bottomNav = [
    { id: 'profile' as NavTab, label: 'Profile', icon: User },
    { id: 'settings' as NavTab, label: 'Settings', icon: Settings },
  ];

  const handleNavClick = (tab: NavTab) => {
    onSelectTab(tab);
    setMobileMenuOpen(false);
  };

  const navContent = (
    <div className="flex flex-col justify-between h-full p-5 select-none">
      <div>
        {/* Top Branding */}
        <div className="pb-6 border-b border-[#E6DFD5]">
          <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#8E7E73] block">
            The Wisdom Lounge
          </span>
          <h1 className="text-xl font-bold text-[#3C230B] mt-0.5 tracking-tight">
            Majlis
          </h1>
        </div>

        {/* Primary Navigation */}
        <nav className="mt-6 space-y-1">
          <div className="px-3 py-1 text-[10px] font-semibold uppercase tracking-wider text-[#8E7E73]">
            Navigation
          </div>
          {mainNav.map((item) => {
            const Icon = item.icon;
            const isActive = currentTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-medium transition ${
                  isActive
                    ? 'bg-[#EFECE4] text-[#3C230B] font-semibold'
                    : 'text-[#68594E] hover:text-[#241710] hover:bg-[#F5F2EB]'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0 text-[#3C230B]" />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>
      </div>

      {/* Bottom Utilities & Profile / Facilitator Identity */}
      <div className="space-y-3 pt-4 border-t border-[#E6DFD5]">
        {bottomNav.map((item) => {
          const Icon = item.icon;
          const isActive = currentTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleNavClick(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-xs font-medium transition ${
                isActive
                  ? 'bg-[#EFECE4] text-[#3C230B] font-semibold'
                  : 'text-[#68594E] hover:text-[#241710] hover:bg-[#F5F2EB]'
              }`}
            >
              <Icon className="w-4 h-4 shrink-0 text-[#8E7E73]" />
              <span>{item.label}</span>
            </button>
          );
        })}

        {/* Facilitator Auth Card */}
        <div
          onClick={onOpenAuthModal}
          className="p-2.5 rounded-xl bg-[#F5F2EB] hover:bg-[#EFECE4] border border-[#E6DFD5] cursor-pointer transition flex items-center justify-between group"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-[#3C230B] text-[#E0C2A6] font-bold text-xs flex items-center justify-center shrink-0 relative">
              {(user?.email || userName || 'M').charAt(0).toUpperCase()}
              {isFacilitator && (
                <div className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-[#D4AF37] text-[#241710] rounded-full flex items-center justify-center border border-white">
                  <Crown className="w-2 h-2" />
                </div>
              )}
            </div>
            <div className="min-w-0">
              <div className="text-xs font-semibold text-[#241710] truncate">
                {user ? user.email : userName || 'Member'}
              </div>
              <div className="text-[10px] text-[#8E7E73] flex items-center gap-1">
                {isFacilitator ? (
                  <span className="text-[#A07000] font-bold flex items-center gap-0.5">
                    <ShieldCheck className="w-2.5 h-2.5" /> Facilitator
                  </span>
                ) : user ? (
                  <span>Seeker Account</span>
                ) : (
                  <span className="text-[#3C230B] underline font-medium">Sign in for Facilitator</span>
                )}
              </div>
            </div>
          </div>
          <LogIn className="w-3.5 h-3.5 text-[#8E7E73] group-hover:text-[#3C230B] transition shrink-0" />
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside className="hidden md:flex w-60 xl:w-64 bg-[#FFFCF5] border-r border-[#E6DFD5] flex-col h-screen shrink-0 z-20">
        {navContent}
      </aside>

      {/* Mobile Top Bar */}
      <header className="md:hidden bg-[#FFFCF5] border-b border-[#E6DFD5] px-4 py-3 flex items-center justify-between z-20 shrink-0 select-none">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setMobileMenuOpen(true)}
            className="p-1.5 text-[#3C230B] rounded-lg hover:bg-[#F5F2EB] transition"
            aria-label="Open menu"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <span className="text-[9px] font-bold uppercase tracking-widest text-[#8E7E73] block leading-none">
              The Wisdom Lounge
            </span>
            <span className="text-sm font-bold text-[#3C230B] leading-none">
              Majlis
            </span>
          </div>
        </div>

        <button
          onClick={onOpenAuthModal}
          className="flex items-center gap-1 px-2.5 py-1 bg-[#F5F2EB] border border-[#E6DFD5] rounded-lg text-xs font-semibold text-[#3C230B]"
        >
          {isFacilitator ? <Crown className="w-3 h-3 text-[#D4AF37]" /> : <LogIn className="w-3 h-3" />}
          <span className="text-[11px]">{isFacilitator ? 'Facilitator' : 'Auth'}</span>
        </button>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/40 backdrop-blur-xs"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div className="relative w-64 bg-[#FFFCF5] h-full shadow-2xl z-10 flex flex-col">
            <div className="absolute top-4 right-4 z-20">
              <button
                onClick={() => setMobileMenuOpen(false)}
                className="p-1 text-[#8E7E73] hover:text-[#3C230B]"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {navContent}
          </div>
        </div>
      )}
    </>
  );
};
