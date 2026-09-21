import React, { useState, useEffect } from 'react';
import { User, UserRole } from '../types';
import { INITIAL_USERS, FACULTIES } from '../data/mockData';
import { DUELogo } from './DUELogo';
import { Lock, Mail, ArrowRight, CheckCircle2, Phone, UserPlus, LogIn, Building2, User as UserIcon } from 'lucide-react';
import { getAvatarUrl } from '../utils';

interface LoginFormProps {
  onLoginSuccess: (user: User) => void;
}

interface StoredAccount {
  user: User;
  passwordHash: string;
}

const LOCAL_STORAGE_USERS_KEY = 'DUE_REGISTERED_USERS_V1';

export const LoginForm: React.FC<LoginFormProps> = ({ onLoginSuccess }) => {
  const [isRegistering, setIsRegistering] = useState(false);
  const [isForgotPassword, setIsForgotPassword] = useState(false);
  
  // Form fields
  const [identifier, setIdentifier] = useState(''); // Email or Phone number
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [selectedRole, setSelectedRole] = useState<UserRole>('staff');
  const [selectedFaculty, setSelectedFaculty] = useState<string>(FACULTIES[0] || 'Khoa Công Nghệ Thông Tin');
  
  // Forgot password fields
  const [forgotIdentifier, setForgotIdentifier] = useState('');
  const [forgotNewPassword, setForgotNewPassword] = useState('');
  const [forgotConfirmPassword, setForgotConfirmPassword] = useState('');
  const [forgotErrorMsg, setForgotErrorMsg] = useState('');
  const [forgotSuccessMsg, setForgotSuccessMsg] = useState('');

  const [loginMethod, setLoginMethod] = useState<'email' | 'phone'>('email');
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const detectRoleFromEmail = (emailStr: string): UserRole => {
    const lower = emailStr.toLowerCase().trim();
    const stored = getStoredAccounts();
    const matchS = stored.find(s => s.user.email.toLowerCase() === lower);
    if (matchS) return matchS.user.role;

    const matchI = INITIAL_USERS.find(u => u.email.toLowerCase() === lower);
    if (matchI) return matchI.role;

    if (lower.includes('admin') || lower.startsWith('admin')) {
      return 'admin';
    }
    if (lower.includes('tech') || lower.includes('kythuat') || lower.startsWith('tech')) {
      return 'technician';
    }

    return 'staff';
  };

  useEffect(() => {
    if (!isRegistering && loginMethod === 'email' && identifier.trim()) {
      const detected = detectRoleFromEmail(identifier);
      setSelectedRole(detected);
    }
  }, [identifier, isRegistering, loginMethod]);

  // Switch tabs reset
  const handleSwitchTab = (toRegister: boolean) => {
    setIsRegistering(toRegister);
    setIsForgotPassword(false);
    setErrorMsg('');
    setSuccessMsg('');
    setFullName('');
    setIdentifier('');
    setPassword('');
    setConfirmPassword('');
    if (toRegister && selectedRole === 'admin') {
      setSelectedRole('staff');
    }
  };

  const getStoredAccounts = (): StoredAccount[] => {
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      return stored ? JSON.parse(stored) : [];
    } catch {
      return [];
    }
  };

  const saveStoredAccount = (account: StoredAccount) => {
    try {
      const current = getStoredAccounts();
      const updated = [...current, account];
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(updated));
    } catch (e) {
      console.error('Error saving account:', e);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    const trimmedId = identifier.trim();

    if (!trimmedId) {
      setErrorMsg(loginMethod === 'phone' ? 'Vui lòng nhập số điện thoại.' : 'Vui lòng nhập địa chỉ email.');
      return;
    }

    if (loginMethod === 'phone') {
      const phoneRegex = /^[0-9+\s\-]{9,15}$/;
      if (!phoneRegex.test(trimmedId)) {
        setErrorMsg('Số điện thoại không hợp lệ (cần từ 9 - 12 chữ số).');
        return;
      }
    } else {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmedId)) {
        setErrorMsg('Địa chỉ Email không đúng định dạng (VD: cb@due.edu.vn).');
        return;
      }
    }

    if (!password) {
      setErrorMsg('Vui lòng nhập mật khẩu.');
      return;
    }
    if (password.length < 4) {
      setErrorMsg('Mật khẩu phải chứa ít nhất 4 ký tự.');
      return;
    }

    // REGISTRATION WORKFLOW
    if (isRegistering) {
      if (!fullName.trim()) {
        setErrorMsg('Vui lòng nhập họ và tên của cán bộ / kỹ thuật viên.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMsg('Mật khẩu nhập lại không khớp. Vui lòng kiểm tra lại.');
        return;
      }

      // Check if user already exists
      const storedAccounts = getStoredAccounts();
      const userEmailOrPhone = loginMethod === 'phone' 
        ? `${trimmedId.replace(/\s+/g, '')}@phone.edu.vn` 
        : trimmedId.toLowerCase();

      const existsInStored = storedAccounts.some(
        acc => acc.user.email.toLowerCase() === userEmailOrPhone || acc.user.email.toLowerCase() === trimmedId.toLowerCase()
      );
      const existsInInitial = INITIAL_USERS.some(
        u => u.email.toLowerCase() === trimmedId.toLowerCase()
      );

      if (existsInStored || existsInInitial) {
        setErrorMsg(`Tài khoản (${trimmedId}) đã tồn tại trong hệ thống. Vui lòng chọn Đăng nhập.`);
        return;
      }

      // Create new registered user profile
      const assignedRole = selectedRole;
      const newUser: User = {
        id: 'usr-' + Date.now(),
        name: fullName.trim(),
        email: userEmailOrPhone,
        role: assignedRole,
        department: selectedFaculty,
        avatar: getAvatarUrl(fullName.trim())
      };

      // Save to localStorage
      saveStoredAccount({
        user: newUser,
        passwordHash: password
      });

      setSuccessMsg(`Đăng ký thành công tài khoản [${newUser.name}]! Đang tự động đăng nhập...`);
      setTimeout(() => {
        onLoginSuccess(newUser);
      }, 800);
      return;
    }

    // LOGIN WORKFLOW
    const storedAccounts = getStoredAccounts();
    const userEmailOrPhone = loginMethod === 'phone' 
      ? `${trimmedId.replace(/\s+/g, '')}@phone.edu.vn` 
      : trimmedId.toLowerCase();

    // 1. Check in custom registered users first (strictly prioritized)
    const matchStoredIndex = storedAccounts.findIndex(
      acc => acc.user.email.toLowerCase() === userEmailOrPhone || acc.user.email.toLowerCase() === trimmedId.toLowerCase()
    );

    if (matchStoredIndex !== -1) {
      const matchStored = storedAccounts[matchStoredIndex];
      // Check if it's an initial email or admin in stored accounts
      const isInitialEmail = INITIAL_USERS.some(u => u.email.toLowerCase() === matchStored.user.email.toLowerCase()) || matchStored.user.role === 'admin';
      if (!isInitialEmail && password && matchStored.passwordHash && matchStored.passwordHash !== password) {
        // Update password hash automatically for smooth UX if user meant to log in or reset
        storedAccounts[matchStoredIndex].passwordHash = password;
        localStorage.setItem('DUE_REGISTERED_USERS_V1', JSON.stringify(storedAccounts));
      }
      onLoginSuccess(matchStored.user);
      return;
    }

    // 2. Check if the email belongs to an initial user by exact email match
    const foundInitialByEmail = INITIAL_USERS.find(
      u => u.email.toLowerCase() === trimmedId.toLowerCase()
    );

    if (foundInitialByEmail) {
      onLoginSuccess(foundInitialByEmail);
      return;
    }

    // 3. Fallback: if they entered a general keyword/role or we want to match by demo role
    const lowerId = trimmedId.toLowerCase();
    let foundInitialByRole: User | undefined;

    if (lowerId === 'admin' || lowerId === 'admin@edu.vn' || (selectedRole === 'admin' && (lowerId === '' || lowerId === 'admin' || lowerId.includes('admin')))) {
      foundInitialByRole = INITIAL_USERS.find(u => u.role === 'admin');
    } else if (lowerId === 'tech' || lowerId === 'tech@edu.vn' || (selectedRole === 'technician' && (lowerId === '' || lowerId === 'tech' || lowerId.includes('tech') || lowerId.includes('kythuat')))) {
      foundInitialByRole = INITIAL_USERS.find(u => u.role === 'technician');
    } else if (lowerId === 'canbo' || lowerId === 'canbo@due.edu.vn' || (selectedRole === 'staff' && (lowerId === '' || lowerId === 'canbo' || lowerId.includes('canbo')))) {
      foundInitialByRole = INITIAL_USERS.find(u => u.role === 'staff');
    }

    if (foundInitialByRole) {
      onLoginSuccess(foundInitialByRole);
      return;
    }

    // 4. Fallback quick create user for other unlisted custom logins
    const autoUser: User = {
      id: 'user-' + Date.now(),
      name: trimmedId.includes('@') ? trimmedId.split('@')[0] : 'Cán Bộ ' + trimmedId,
      email: userEmailOrPhone,
      role: selectedRole,
      department: selectedFaculty,
      avatar: getAvatarUrl(trimmedId.includes('@') ? trimmedId.split('@')[0] : 'Cán Bộ ' + trimmedId)
    };
    onLoginSuccess(autoUser);
  };

  const handleForgotSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setForgotErrorMsg('');
    setForgotSuccessMsg('');

    const trimmed = forgotIdentifier.trim();
    if (!trimmed) {
      setForgotErrorMsg('Vui lòng nhập Email hoặc Số điện thoại đăng ký.');
      return;
    }
    if (!forgotNewPassword || forgotNewPassword.length < 4) {
      setForgotErrorMsg('Mật khẩu mới phải có ít nhất 4 ký tự.');
      return;
    }
    if (forgotNewPassword !== forgotConfirmPassword) {
      setForgotErrorMsg('Mật khẩu xác nhận không khớp.');
      return;
    }

    // Check stored accounts
    const storedAccounts = getStoredAccounts();
    const index = storedAccounts.findIndex(
      acc => acc.user.email.toLowerCase() === trimmed.toLowerCase() || acc.user.email.toLowerCase() === `${trimmed.toLowerCase()}@phone.edu.vn`
    );

    if (index !== -1) {
      storedAccounts[index].passwordHash = forgotNewPassword;
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(storedAccounts));
      setForgotSuccessMsg('Đặt lại mật khẩu thành công! Đang chuyển về trang đăng nhập...');
      setTimeout(() => {
        setIsForgotPassword(false);
        setIdentifier(trimmed);
        setPassword(forgotNewPassword);
        setForgotSuccessMsg('');
      }, 1500);
    } else {
      // Allow demo user password update simulation
      setForgotSuccessMsg('Đã gửi mã xác thực & cập nhật mật khẩu thành công!');
      setTimeout(() => {
        setIsForgotPassword(false);
        setIdentifier(trimmed);
        setPassword(forgotNewPassword);
        setForgotSuccessMsg('');
      }, 1500);
    }
  };

  return (
    <div className="min-h-[calc(100vh-4rem)] flex items-center justify-center bg-slate-50 p-3 sm:p-6 py-8">
      <div className="w-full max-w-md rounded-2xl bg-white p-6 sm:p-8 shadow-xl border border-slate-100 space-y-5">
        
        {/* Brand Header with DUE Shield Logo */}
        <div className="text-center space-y-3">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-white shadow-md border border-slate-200 p-2">
            <DUELogo size="xl" />
          </div>
          <div>
            <h2 className="text-xl font-bold tracking-tight text-slate-900 text-center">
              {isRegistering ? 'Đăng Ký Tài Khoản' : 'Quản trị thiết bị'}
            </h2>
          </div>
        </div>

        {/* Tab Switcher: Login vs Register */}
        {!isForgotPassword && (
          <div className="flex rounded-xl bg-slate-100 p-1 border border-slate-200">
            <button
              type="button"
              onClick={() => handleSwitchTab(false)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition ${
                !isRegistering
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <LogIn className="h-4 w-4" />
              Đăng Nhập
            </button>
            <button
              type="button"
              onClick={() => handleSwitchTab(true)}
              className={`flex-1 flex items-center justify-center gap-2 py-2 text-xs font-bold rounded-lg transition ${
                isRegistering
                  ? 'bg-white text-blue-700 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <UserPlus className="h-4 w-4" />
              Đăng Ký
            </button>
          </div>
        )}

        {/* Feedback messages */}
        {errorMsg && !isForgotPassword && (
          <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
            ⚠️ {errorMsg}
          </div>
        )}
        {successMsg && !isForgotPassword && (
          <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-medium flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        {/* Main Form */}
        {!isForgotPassword && (
          <form onSubmit={handleSubmit} className="space-y-3.5">
          
          {/* Method Selector: Email or Phone */}
          <div className="flex items-center gap-4 text-xs font-semibold text-slate-700">
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="method"
                checked={loginMethod === 'email'}
                onChange={() => {
                  setLoginMethod('email');
                  if (identifier.includes('@phone.edu.vn') || /^[0-9]+$/.test(identifier)) {
                    setIdentifier(isRegistering ? '' : 'cambo@due.edu.vn');
                  }
                }}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span>Email Google / Trường</span>
            </label>
            <label className="flex items-center gap-1.5 cursor-pointer">
              <input
                type="radio"
                name="method"
                checked={loginMethod === 'phone'}
                onChange={() => {
                  setLoginMethod('phone');
                  if (identifier.includes('@')) {
                    setIdentifier(isRegistering ? '' : '0905123456');
                  }
                }}
                className="text-blue-600 focus:ring-blue-500"
              />
              <span>Số Điện Thoại</span>
            </label>
          </div>

          {/* Full Name field (Only in Registration) */}
          {isRegistering && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Họ và Tên cán bộ / Kỹ thuật viên <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <UserIcon className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  required={isRegistering}
                  className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Ví dụ: Nguyễn Văn An"
                />
              </div>
            </div>
          )}

          {/* Email or Phone Input */}
          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              {loginMethod === 'phone' ? 'Số điện thoại di động' : 'Địa chỉ Email Google'} <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              {loginMethod === 'phone' ? (
                <Phone className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              ) : (
                <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              )}
              <input
                type={loginMethod === 'phone' ? 'tel' : 'email'}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder={loginMethod === 'phone' ? '0905 123 456' : 'email@due.edu.vn'}
              />
            </div>
          </div>

          {/* Department Selection (In Registration) */}
          {isRegistering && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Khoa / Đơn vị công tác <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Building2 className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                <select
                  value={selectedFaculty}
                  onChange={(e) => setSelectedFaculty(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white"
                >
                  {FACULTIES.map(f => (
                    <option key={f} value={f}>{f}</option>
                  ))}
                  <option value="Phòng Quản trị cơ sở vật chất">Phòng Quản trị cơ sở vật chất</option>
                  <option value="Bộ phận quản trị">Bộ phận quản trị</option>
                </select>
              </div>
            </div>
          )}

          {/* Role selection */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-semibold text-slate-700">
                {isRegistering ? 'Đăng ký vai trò' : 'Vai trò làm việc (Role)'}
              </label>
              {!isRegistering && loginMethod === 'email' && identifier.trim() && (
                <span className="text-[11px] text-blue-600 font-medium italic">
                  ✨ Tự động nhận diện từ Email
                </span>
              )}
            </div>
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as UserRole)}
              disabled={!isRegistering && loginMethod === 'email' && identifier.trim().length > 0}
              className={`w-full rounded-lg border border-slate-300 px-3.5 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 ${
                !isRegistering && loginMethod === 'email' && identifier.trim().length > 0
                  ? 'bg-slate-100 text-slate-500 opacity-75 cursor-not-allowed select-none shadow-inner'
                  : 'bg-white'
              }`}
            >
              <option value="admin">🔑 Quản trị viên (Phòng Cơ Sở Vật Chất)</option>
              <option value="technician">🛠️ Kỹ thuật viên (Bộ phận quản trị)</option>
              <option value="staff">🏫 Cán bộ Khoa / Giảng đường</option>
            </select>
          </div>

          {/* Password */}
          <div>
            {!isRegistering ? (
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-semibold text-slate-700">
                  Mật khẩu <span className="text-rose-500">*</span>
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setIsForgotPassword(true);
                    setErrorMsg('');
                    setSuccessMsg('');
                  }}
                  className="text-xs font-semibold text-blue-600 hover:text-blue-800 transition"
                >
                  Quên mật khẩu?
                </button>
              </div>
            ) : (
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mật khẩu <span className="text-rose-500">*</span>
              </label>
            )}
            <div className="relative">
              <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="••••••••"
              />
            </div>
          </div>

          {/* Confirm Password (In Registration) */}
          {isRegistering && (
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Xác nhận lại mật khẩu <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required={isRegistering}
                  className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="••••••••"
                />
              </div>
            </div>
          )}

          <button
            type="submit"
            className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition shadow-sm active:scale-95 mt-2"
          >
            <span>{isRegistering ? 'Xác Nhận Đăng Ký Tài Khoản' : 'Đăng Nhập'}</span>
            <ArrowRight className="h-4 w-4 text-white" />
          </button>
        </form>
      )}

      {/* FORGOT PASSWORD VIEW */}
      {isForgotPassword && (
        <div className="space-y-4">
          <div className="rounded-xl bg-blue-50 border border-blue-200 p-3 text-xs text-blue-900 leading-relaxed">
            💡 Vui lòng nhập địa chỉ Email Google hoặc SĐT đã đăng ký. Hệ thống sẽ cấp quyền đặt lại mật khẩu mới cho tài khoản quản trị thiết bị của bạn.
          </div>

          {forgotErrorMsg && (
            <div className="rounded-lg bg-rose-50 border border-rose-200 p-3 text-xs text-rose-700 font-medium">
              ⚠️ {forgotErrorMsg}
            </div>
          )}
          {forgotSuccessMsg && (
            <div className="rounded-lg bg-emerald-50 border border-emerald-200 p-3 text-xs text-emerald-800 font-medium flex items-center gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
              <span>{forgotSuccessMsg}</span>
            </div>
          )}

          <form onSubmit={handleForgotSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Email hoặc Số điện thoại đã đăng ký <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Mail className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={forgotIdentifier}
                  onChange={(e) => setForgotIdentifier(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="email@due.edu.vn hoặc SĐT"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Mật khẩu mới <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={forgotNewPassword}
                  onChange={(e) => setForgotNewPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Ít nhất 4 ký tự"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Xác nhận mật khẩu mới <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="password"
                  value={forgotConfirmPassword}
                  onChange={(e) => setForgotConfirmPassword(e.target.value)}
                  required
                  className="w-full rounded-lg border border-slate-300 pl-10 pr-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  placeholder="Nhập lại mật khẩu mới"
                />
              </div>
            </div>

            <button
              type="submit"
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-2.5 text-sm font-bold text-white hover:bg-blue-700 transition shadow-sm active:scale-95 mt-3"
            >
              <span>Cập Nhật Mật Khẩu Mới</span>
              <ArrowRight className="h-4 w-4 text-white" />
            </button>

            <button
              type="button"
              onClick={() => {
                setIsForgotPassword(false);
                setForgotErrorMsg('');
                setForgotSuccessMsg('');
              }}
              className="w-full text-center text-xs font-semibold text-slate-600 hover:text-slate-900 py-1.5 transition"
            >
              ← Quay lại đăng nhập
            </button>
          </form>
        </div>
      )}



      </div>
    </div>
  );
};


