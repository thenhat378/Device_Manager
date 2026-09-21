import React, { useState } from 'react';
import { User, ToastType } from '../types';
import { X, UserCog, Lock, Save, ShieldCheck, Mail, User as UserIcon } from 'lucide-react';

interface AdminProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentUser: User;
  onUpdateUser: (updatedUser: User) => void;
  onAddToast: (title: string, message: string, type: ToastType) => void;
}

export const AdminProfileModal: React.FC<AdminProfileModalProps> = ({
  isOpen,
  onClose,
  currentUser,
  onUpdateUser,
  onAddToast
}) => {
  const [name, setName] = useState(currentUser.name);
  const [email, setEmail] = useState(currentUser.email);
  const [department, setDepartment] = useState(currentUser.department);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim()) {
      setErrorMsg('Vui lòng nhập tên người dùng / quản trị viên.');
      return;
    }

    if (!email.trim()) {
      setErrorMsg('Vui lòng nhập email đăng nhập.');
      return;
    }

    if (newPassword) {
      if (newPassword.length < 4) {
        setErrorMsg('Mật khẩu mới phải có ít nhất 4 ký tự.');
        return;
      }
      if (newPassword !== confirmPassword) {
        setErrorMsg('Mật khẩu xác nhận không khớp.');
        return;
      }
    }

    // Update user object
    const updatedUser: User = {
      ...currentUser,
      name: name.trim(),
      email: email.trim().toLowerCase(),
      department: department.trim()
    };

    // Update stored accounts if applicable
    try {
      const stored = localStorage.getItem('DUE_REGISTERED_USERS_V1');
      if (stored) {
        const accounts = JSON.parse(stored);
        const idx = accounts.findIndex((acc: any) => acc.user.id === currentUser.id || acc.user.email === currentUser.email);
        if (idx !== -1) {
          if (newPassword) {
            accounts[idx].passwordHash = newPassword;
          }
          accounts[idx].user = updatedUser;
          localStorage.setItem('DUE_REGISTERED_USERS_V1', JSON.stringify(accounts));
        } else if (newPassword) {
          // Add admin account to stored accounts with new password
          accounts.push({
            user: updatedUser,
            passwordHash: newPassword
          });
          localStorage.setItem('DUE_REGISTERED_USERS_V1', JSON.stringify(accounts));
        }
      } else if (newPassword) {
        localStorage.setItem('DUE_REGISTERED_USERS_V1', JSON.stringify([
          {
            user: updatedUser,
            passwordHash: newPassword
          }
        ]));
      }
    } catch (err) {
      console.error('Error saving admin update:', err);
    }

    onUpdateUser(updatedUser);
    onAddToast('Cập Nhật Tài Khoản Thành Công', 'Thông tin username và mật khẩu quản trị viên đã được lưu lại.', 'success');
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
      <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-purple-600/30 rounded-lg border border-purple-400/30 text-purple-300">
              <UserCog className="h-5 w-5" />
            </div>
            <div>
              <h3 className="text-base font-bold tracking-tight">Cài Đặt Tài Khoản Quản Trị Viên</h3>
              <p className="text-xs text-slate-300">Quản lý tên đăng nhập, thông tin và bảo mật</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-lg transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSave} className="p-6 space-y-4">
          {errorMsg && (
            <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
              {errorMsg}
            </div>
          )}

          <div>
            <label className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <UserIcon className="h-3.5 w-3.5 text-blue-600" />
              Họ và tên Quản Trị Viên (Username Name)
            </label>
            <input
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 mb-1 flex items-center gap-1.5">
              <Mail className="h-3.5 w-3.5 text-blue-600" />
              Email / Tên Đăng Nhập (Username Email)
            </label>
            <input
              type="email"
              value={email}
              onChange={e => setEmail(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20 font-mono"
              required
            />
          </div>

          <div>
            <label className="text-xs font-bold text-slate-700 mb-1 block">
              Đơn vị / Phòng ban quản lý
            </label>
            <input
              type="text"
              value={department}
              onChange={e => setDepartment(e.target.value)}
              className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm font-medium text-slate-900 focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20"
              required
            />
          </div>

          <div className="border-t border-slate-200 pt-4 mt-4 space-y-3">
            <h4 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Lock className="h-3.5 w-3.5 text-purple-600" />
              Đổi Mật Khẩu (Tùy chọn)
            </h4>
            
            <div>
              <label className="text-xs font-semibold text-slate-600 mb-1 block">
                Mật khẩu mới (Bỏ trống nếu không muốn đổi)
              </label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Nhập mật khẩu mới..."
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20"
              />
            </div>

            {newPassword && (
              <div>
                <label className="text-xs font-semibold text-slate-600 mb-1 block">
                  Xác nhận mật khẩu mới
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Nhập lại mật khẩu mới..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm text-slate-900 focus:border-blue-600 focus:outline-hidden focus:ring-2 focus:ring-blue-600/20"
                />
              </div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
            >
              Hủy bỏ
            </button>
            <button
              type="submit"
              className="flex items-center gap-1.5 rounded-xl bg-purple-600 hover:bg-purple-700 px-5 py-2 text-xs font-semibold text-white transition shadow-sm"
            >
              <Save className="h-4 w-4" />
              Lưu Cập Nhật
            </button>
          </div>
        </form>

      </div>
    </div>
  );
};
