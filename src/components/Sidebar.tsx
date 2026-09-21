import React from 'react';
import { User, UserRole } from '../types';
import { 
  Wrench, 
  BarChart3, 
  Layers, 
  ArrowLeftRight, 
  Users, 
  ClipboardList,
  Menu,
  X,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  UserCheck,
  Settings
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { getAvatarUrl } from '../utils';

interface SidebarProps {
  activeTab: 'devices' | 'maintenance' | 'transfers' | 'analytics' | 'users' | 'inventory';
  setActiveTab: (tab: 'devices' | 'maintenance' | 'transfers' | 'analytics' | 'users' | 'inventory') => void;
  currentUser: User | null;
  isOpen: boolean;
  setIsOpen: (isOpen: boolean) => void;
  onOpenAdminProfile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeTab,
  setActiveTab,
  currentUser,
  isOpen,
  setIsOpen,
  onOpenAdminProfile
}) => {
  if (!currentUser) return null;

  const menuItems = [
    {
      id: 'devices' as const,
      label: 'Quản Lý Thiết Bị',
      icon: Layers,
      roles: ['admin', 'technician'] as UserRole[]
    },
    {
      id: 'maintenance' as const,
      label: currentUser.role === 'staff' ? 'Báo Cáo Sự Cố' : 'Kiểm Tra & Thay Vật Tư',
      icon: Wrench,
      roles: ['admin', 'technician', 'staff'] as UserRole[]
    },
    {
      id: 'transfers' as const,
      label: 'Điều Chuyển & Thu Hồi',
      icon: ArrowLeftRight,
      roles: ['admin', 'technician'] as UserRole[]
    },
    {
      id: 'inventory' as const,
      label: 'Kiểm Kê Thiết Bị',
      icon: ClipboardList,
      roles: ['admin', 'technician'] as UserRole[]
    },
    {
      id: 'analytics' as const,
      label: 'Thống Kê Báo Cáo',
      icon: BarChart3,
      roles: ['admin', 'technician'] as UserRole[]
    },
    {
      id: 'users' as const,
      label: 'Quản Lý Tài Khoản',
      icon: Users,
      roles: ['admin'] as UserRole[]
    }
  ];

  const filteredItems = menuItems.filter(item => item.roles.includes(currentUser.role));

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setIsOpen(false)}
            className="fixed inset-0 z-30 bg-slate-950/60 backdrop-blur-sm lg:hidden"
            id="sidebar-overlay"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Navigation Panel */}
      <motion.aside
        id="app-sidebar"
        className={`fixed inset-y-0 left-0 z-40 flex w-72 flex-col border-r border-slate-800 bg-slate-900 text-slate-100 transition-transform duration-300 ease-in-out lg:static lg:w-64 lg:translate-x-0 ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Sidebar Header for Mobile only / Branding reinforcement */}
        <div className="flex h-16 items-center justify-between border-b border-slate-800 px-4 lg:px-6 shrink-0 bg-slate-950/30">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-600 text-white">
              <ShieldCheck className="h-5 w-5" />
            </div>
            <div>
              <span className="text-sm font-bold text-white tracking-wide uppercase">Menu Chức Năng</span>
              <p className="text-[10px] text-slate-400 font-medium">Hệ Thống Thiết Bị</p>
            </div>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden transition"
            id="sidebar-close-btn"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* User context card inside sidebar */}
        <div className="border-b border-slate-800/80 px-4 py-4 lg:px-6 bg-slate-950/10">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-3 min-w-0">
              <img
                src={getAvatarUrl(currentUser.name)}
                alt={currentUser.name}
                className="h-10 w-10 rounded-full object-cover border border-emerald-400 shrink-0 shadow-sm"
              />
              <div className="min-w-0 flex-1">
                <h4 className="text-xs font-bold text-slate-200 truncate">{currentUser.name}</h4>
                <p className="text-[10px] text-slate-400 font-medium truncate flex items-center gap-1 mt-0.5">
                  <span className={`inline-block h-1.5 w-1.5 rounded-full ${
                    currentUser.role === 'admin' ? 'bg-purple-400' :
                    currentUser.role === 'technician' ? 'bg-amber-400' : 'bg-emerald-400'
                  }`} />
                  {currentUser.role === 'admin' ? 'Quản trị viên' :
                   currentUser.role === 'technician' ? 'Kỹ thuật viên' : 'Cán bộ Khoa'}
                </p>
              </div>
            </div>

            {currentUser.role === 'admin' && onOpenAdminProfile && (
              <button
                onClick={onOpenAdminProfile}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-purple-300 transition shrink-0"
                title="Thay đổi tên đăng nhập & mật khẩu quản lý"
                id="sidebar-admin-settings-btn"
              >
                <Settings className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>

        {/* Navigation items list */}
        <nav className="flex-1 space-y-1.5 px-3 py-4 lg:px-4 overflow-y-auto no-scrollbar">
          {filteredItems.map((item) => {
            const IconComponent = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                id={`sidebar-tab-${item.id}`}
                onClick={() => {
                  setActiveTab(item.id);
                  setIsOpen(false); // Close on mobile after click
                }}
                className={`group flex w-full items-center gap-3 rounded-xl px-4 py-3 text-xs font-semibold transition duration-150 ${
                  isActive
                    ? 'bg-gradient-to-r from-blue-600 to-blue-500 text-white shadow-md shadow-blue-900/20'
                    : 'text-slate-400 hover:bg-slate-850 hover:text-slate-200'
                }`}
              >
                <IconComponent className={`h-4 w-4 shrink-0 transition-transform group-hover:scale-105 ${
                  isActive ? 'text-white' : 'text-slate-400 group-hover:text-slate-200'
                }`} />
                <span className="truncate">{item.label}</span>
                {isActive && (
                  <span className="ml-auto h-1.5 w-1.5 rounded-full bg-white shadow-sm" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Sidebar Footer */}
        <div className="border-t border-slate-800 p-4 bg-slate-950/25 text-center shrink-0">
          <p className="text-[10px] text-slate-500 font-medium">© 2026 Đại học Kinh tế - ĐHĐN</p>
          <p className="text-[9px] text-slate-600 mt-0.5">Phòng Cơ Sở Vật Chất</p>
        </div>
      </motion.aside>
    </>
  );
};
