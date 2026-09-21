import React from 'react';
import { User, UserRole } from '../types';
import { DUELogo } from './DUELogo';
import { 
  Wrench, 
  BarChart3, 
  Workflow, 
  Camera, 
  UserCheck, 
  LogOut, 
  Layers, 
  Building, 
  Bell, 
  ArrowLeftRight, 
  Users, 
  Download, 
  ClipboardList, 
  Menu,
  Bot,
  Phone
} from 'lucide-react';

interface HeaderProps {
  currentUser: User | null;
  onLogout: () => void;
  onOpenQuickScan: () => void;
  toastCount?: number;
  onTriggerTestToast?: () => void;
  onOpenAdminProfile?: () => void;
  isInstallable?: boolean;
  onInstallApp?: () => void;
  isSidebarOpen?: boolean;
  onToggleSidebar?: () => void;
  onOpenChatbot?: () => void;
  telegramChatId?: string;
  onOpenTelegramConfig?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentUser,
  onLogout,
  onOpenQuickScan,
  toastCount = 0,
  onTriggerTestToast,
  onOpenAdminProfile,
  isInstallable,
  onInstallApp,
  isSidebarOpen = false,
  onToggleSidebar,
  onOpenChatbot,
  telegramChatId,
  onOpenTelegramConfig
}) => {
  return (
    <header className="sticky top-0 z-40 bg-slate-900 text-white shadow-lg border-b border-slate-800">
      <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8">
        <div className="flex h-14 sm:h-16 items-center justify-between gap-1 sm:gap-4">
          
          {/* Burger Menu Button (Mobile/Tablet only) and DUE Shield Logo & Brand Title */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {currentUser && onToggleSidebar && (
              <button
                onClick={onToggleSidebar}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white lg:hidden transition mr-0.5"
                title="Mở menu chức năng"
                id="mobile-sidebar-toggle"
              >
                <Menu className="h-5.5 w-5.5" />
              </button>
            )}

            <div className="flex items-center justify-center p-0.5 sm:p-1.5 rounded-lg sm:rounded-xl bg-white shadow-md shrink-0 border border-slate-700/80">
              <div className="sm:hidden">
                <DUELogo size="sm" />
              </div>
              <div className="hidden sm:block">
                <DUELogo size="md" />
              </div>
            </div>
            <div>
              <h1 className="text-xs sm:text-lg font-bold tracking-tight text-white flex items-center gap-2 leading-tight">
                <span className="text-white font-bold">Quản trị thiết bị</span>
                <span className="hidden xl:inline-block rounded-md bg-gradient-to-r from-blue-500/30 to-emerald-500/30 px-2 py-0.5 text-[10px] font-bold text-blue-200 border border-blue-400/40 uppercase tracking-wider">
                  Phòng Cơ Sở Vật Chất
                </span>
              </h1>
              <p className="text-[11px] text-slate-300 font-medium hidden sm:block">
                Đơn vị quản lý: <strong className="text-blue-200">Phòng Cơ sở vật chất</strong>
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1 sm:gap-3 shrink-0">
            {/* Install PWA Button */}
            {isInstallable && (
              <button
                onClick={onInstallApp}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-white transition shadow-sm active:scale-95 animate-pulse"
                title="Cài đặt ứng dụng vào màn hình chính"
              >
                <Download className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Cài Đặt</span>
              </button>
            )}

            {/* Quick Camera Scanner Button (Header Action) */}
            {currentUser?.role === 'admin' && (
              <button
                onClick={onOpenQuickScan}
                className="flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold text-white transition shadow-sm active:scale-95"
                title="Mở camera điện thoại quét nhanh SN/QR mã thiết bị"
              >
                <Camera className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                <span className="hidden sm:inline">Quét Camera</span>
              </button>
            )}

            {/* Notification Bell Badge Button */}
            {onTriggerTestToast && (
              <button
                onClick={onTriggerTestToast}
                className="relative flex items-center justify-center p-1.5 sm:p-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
                title="Thử nghiệm gửi Toast Notification cảnh báo"
              >
                <Bell className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
                {toastCount > 0 && (
                  <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[10px] font-bold text-white shadow-sm animate-pulse">
                    {toastCount}
                  </span>
                )}
              </button>
            )}

            {/* Quick Chatbot AI Assistant Button */}
            {currentUser && onOpenChatbot && (
              <button
                onClick={onOpenChatbot}
                className="flex items-center gap-1.5 rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 px-2.5 sm:px-3 py-1.5 sm:py-2 text-xs font-semibold text-white transition shadow-sm active:scale-95 border border-white/20"
                title="Mở Trợ lý Chatbot CSVC DUE (Chát nhanh & Báo hỏng)"
                id="header-open-chatbot-btn"
              >
                <Bot className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-300" />
                <span className="hidden sm:inline">Trợ Lý AI</span>
              </button>
            )}

            {/* Hotline Zalo Button */}
            {currentUser && (
              <a
                href="https://zalo.me/0987119665"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-bold text-white transition shadow-sm active:scale-95 border border-emerald-400/40"
                title="Hotline Kỹ thuật CSVC: 0987119665 (Mở Zalo trực tiếp)"
                id="header-zalo-btn"
              >
                <Phone className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-emerald-200 animate-pulse" />
                <span className="hidden xs:inline font-mono">Zalo 0987119665</span>
              </a>
            )}

            {/* Simple User Logout without Avatar */}
            {currentUser && (
              <button
                onClick={onLogout}
                className="flex items-center justify-center p-2 rounded-lg bg-slate-800 hover:bg-rose-950/40 text-slate-400 hover:text-rose-400 transition border border-slate-700 shrink-0"
                title="Đăng xuất tài khoản"
                id="header-logout-btn"
              >
                <LogOut className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};

