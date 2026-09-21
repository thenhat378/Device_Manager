import React, { useState, useEffect } from 'react';
import { User, UserRole, ToastType } from '../types';
import { INITIAL_USERS, FACULTIES } from '../data/mockData';
import { Users, UserPlus, Edit2, Trash2, Shield, Wrench, GraduationCap, Key, Search, Check, X, Building2, User as UserIcon } from 'lucide-react';
import { getAvatarUrl } from '../utils';

interface UserManagementProps {
  currentUser: User;
  onAddToast: (title: string, message: string, type: ToastType) => void;
}

interface StoredAccount {
  user: User;
  passwordHash: string;
}

const LOCAL_STORAGE_USERS_KEY = 'DUE_REGISTERED_USERS_V1';

export const UserManagement: React.FC<UserManagementProps> = ({ currentUser, onAddToast }) => {
  const [usersList, setUsersList] = useState<Array<{ user: User; password: string }>>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterRole, setFilterRole] = useState<string>('all');

  // Modal states
  const [isAddEditModalOpen, setIsAddEditModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<{ user: User; password: string } | null>(null);

  // Form fields
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<UserRole>('staff');
  const [department, setDepartment] = useState(FACULTIES[0] || 'Phòng Cơ sở vật chất');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    loadAllUsers();
  }, []);

  const loadAllUsers = () => {
    // Collect initial users with default password '123456'
    let accountsMap = new Map<string, { user: User; password: string }>();

    INITIAL_USERS.forEach(u => {
      accountsMap.set(u.email.toLowerCase(), {
        user: u,
        password: '123456' // Default password for initial users
      });
    });

    // Load registered accounts from localStorage
    try {
      const stored = localStorage.getItem(LOCAL_STORAGE_USERS_KEY);
      if (stored) {
        const parsed: StoredAccount[] = JSON.parse(stored);
        parsed.forEach(acc => {
          accountsMap.set(acc.user.email.toLowerCase(), {
            user: acc.user,
            password: acc.passwordHash || '123456'
          });
        });
      }
    } catch (e) {
      console.error('Error loading stored accounts:', e);
    }

    setUsersList(Array.from(accountsMap.values()));
  };

  const persistToLocalStorage = (newList: Array<{ user: User; password: string }>) => {
    try {
      const storedAccounts: StoredAccount[] = newList.map(item => ({
        user: item.user,
        passwordHash: item.password
      }));
      localStorage.setItem(LOCAL_STORAGE_USERS_KEY, JSON.stringify(storedAccounts));
    } catch (e) {
      console.error('Error persisting users:', e);
    }
  };

  const handleOpenAddModal = () => {
    setEditingUser(null);
    setName('');
    setEmail('');
    setPassword('123456');
    setRole('staff');
    setDepartment(FACULTIES[0] || 'Phòng Cơ sở vật chất');
    setErrorMsg('');
    setIsAddEditModalOpen(true);
  };

  const handleOpenEditModal = (item: { user: User; password: string }) => {
    setEditingUser(item);
    setName(item.user.name);
    setEmail(item.user.email);
    setPassword(item.password);
    setRole(item.user.role);
    setDepartment(item.user.department);
    setErrorMsg('');
    setIsAddEditModalOpen(true);
  };

  const handleSaveUser = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!name.trim() || !email.trim()) {
      setErrorMsg('Vui lòng nhập đầy đủ Tên và Email / Tên đăng nhập.');
      return;
    }

    if (!password || password.length < 4) {
      setErrorMsg('Mật khẩu phải có ít nhất 4 ký tự.');
      return;
    }

    const trimmedEmail = email.trim().toLowerCase();

    // Check email uniqueness if adding or changing email
    if (!editingUser && usersList.some(u => u.user.email.toLowerCase() === trimmedEmail)) {
      setErrorMsg('Email hoặc tên đăng nhập này đã tồn tại trong hệ thống.');
      return;
    }

    let updatedList = [...usersList];

    if (editingUser) {
      updatedList = updatedList.map(item => {
        if (item.user.email.toLowerCase() === editingUser.user.email.toLowerCase()) {
          return {
            user: {
              ...item.user,
              name: name.trim(),
              email: trimmedEmail,
              role: role,
              department: department.trim()
            },
            password: password
          };
        }
        return item;
      });
      onAddToast('Cập Nhật Tài Khoản Thành Công', `Đã cập nhật thông tin cho ${name.trim()}`, 'success');
    } else {
      const newUser: User = {
        id: 'usr-' + Date.now(),
        name: name.trim(),
        email: trimmedEmail,
        role: role,
        department: department.trim(),
        avatar: getAvatarUrl(name.trim())
      };
      updatedList.push({ user: newUser, password });
      onAddToast('Thêm Tài Khoản Thành Công', `Đã tạo tài khoản mới cho ${name.trim()}`, 'success');
    }

    setUsersList(updatedList);
    persistToLocalStorage(updatedList);
    setIsAddEditModalOpen(false);
  };

  const handleDeleteUser = (emailToDelete: string, userName: string) => {
    if (emailToDelete === currentUser.email) {
      onAddToast('Không Thể Xóa', 'Bạn không thể xóa tài khoản quản trị viên đang đăng nhập.', 'warning');
      return;
    }

    if (window.confirm(`Bạn có chắc chắn muốn xóa tài khoản "${userName}" (${emailToDelete})?`)) {
      const updatedList = usersList.filter(item => item.user.email.toLowerCase() !== emailToDelete.toLowerCase());
      setUsersList(updatedList);
      persistToLocalStorage(updatedList);
      onAddToast('Đã Xóa Tài Khoản', `Tài khoản ${userName} đã bị xóa khỏi hệ thống.`, 'info');
    }
  };

  const filteredUsers = usersList.filter(item => {
    const matchesSearch = 
      item.user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.user.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.user.department.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesRole = filterRole === 'all' || item.user.role === filterRole;

    return matchesSearch && matchesRole;
  });

  const getRoleBadge = (r: UserRole) => {
    switch (r) {
      case 'admin':
        return (
          <span className="inline-flex items-center gap-1 bg-purple-100 text-purple-800 border border-purple-300 px-2.5 py-1 rounded-full text-xs font-bold">
            <Shield className="h-3.5 w-3.5 text-purple-600" /> Quản Trị Viên
          </span>
        );
      case 'technician':
        return (
          <span className="inline-flex items-center gap-1 bg-amber-100 text-amber-800 border border-amber-300 px-2.5 py-1 rounded-full text-xs font-bold">
            <Wrench className="h-3.5 w-3.5 text-amber-600" /> Kỹ Thuật Viên
          </span>
        );
      case 'staff':
      default:
        return (
          <span className="inline-flex items-center gap-1 bg-blue-100 text-blue-800 border border-blue-300 px-2.5 py-1 rounded-full text-xs font-bold">
            <GraduationCap className="h-3.5 w-3.5 text-blue-600" /> Cán Bộ Khoa
          </span>
        );
    }
  };

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-300">
      
      {/* Top Banner & Actions */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 bg-purple-600/10 rounded-xl text-purple-700">
              <Users className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-extrabold text-slate-900 tracking-tight">Quản Lý Tài Khoản Hệ Thống</h1>
              <p className="text-xs text-slate-500 font-medium">Xem danh sách, chỉnh sửa mật khẩu, thay đổi vai trò và phân quyền người dùng DUE</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleOpenAddModal}
          className="flex items-center justify-center gap-2 rounded-xl bg-purple-600 hover:bg-purple-700 px-5 py-2.5 text-xs font-bold text-white shadow-md transition transform active:scale-95 shrink-0"
        >
          <UserPlus className="h-4 w-4" />
          Thêm Tài Khoản Mới
        </button>
      </div>

      {/* Filter & Search Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-4 rounded-2xl shadow-sm border border-slate-200">
        <div className="relative w-full sm:w-80">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchTerm}
            onChange={e => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm theo tên, email, đơn vị..."
            className="w-full rounded-xl border border-slate-300 pl-10 pr-4 py-2 text-xs font-medium text-slate-900 focus:border-purple-600 focus:outline-hidden focus:ring-2 focus:ring-purple-600/20"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar">
          <span className="text-xs font-bold text-slate-500 shrink-0">Lọc vai trò:</span>
          {[
            { id: 'all', label: 'Tất cả' },
            { id: 'admin', label: 'Quản trị' },
            { id: 'technician', label: 'Kỹ thuật' },
            { id: 'staff', label: 'Cán bộ Khoa' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setFilterRole(tab.id)}
              className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition shrink-0 ${
                filterRole === tab.id
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[11px] font-extrabold uppercase tracking-wider text-slate-600 border-b border-slate-200">
                <th className="py-3.5 px-4">Người Dùng / Họ Tên</th>
                <th className="py-3.5 px-4">Tên Đăng Nhập (Email)</th>
                <th className="py-3.5 px-4">Mật Khẩu (Password)</th>
                <th className="py-3.5 px-4">Vai Trò (Role)</th>
                <th className="py-3.5 px-4">Đơn Vị / Khoa</th>
                <th className="py-3.5 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs font-medium text-slate-700">
              {filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-slate-400 font-semibold">
                    Không tìm thấy tài khoản người dùng phù hợp.
                  </td>
                </tr>
              ) : (
                filteredUsers.map((item, idx) => (
                  <tr key={item.user.email} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-3">
                        <img
                          src={getAvatarUrl(item.user.name)}
                          alt={item.user.name}
                          className="h-9 w-9 rounded-full object-cover border border-slate-200 shrink-0 shadow-xs"
                        />
                        <div>
                          <p className="font-bold text-slate-900">{item.user.name}</p>
                          <p className="text-[10px] text-slate-400 font-mono">ID: {item.user.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-800 font-semibold">
                      {item.user.email}
                    </td>
                    <td className="py-3.5 px-4 font-mono text-slate-600">
                      <span className="inline-flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded text-[11px] border border-slate-200">
                        <Key className="h-3 w-3 text-slate-400" />
                        {item.password}
                      </span>
                    </td>
                    <td className="py-3.5 px-4">
                      {getRoleBadge(item.user.role)}
                    </td>
                    <td className="py-3.5 px-4 text-slate-600">
                      <span className="flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        {item.user.department}
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => handleOpenEditModal(item)}
                          className="p-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 transition"
                          title="Chỉnh sửa / Đổi mật khẩu / Nâng cấp vai trò"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        {item.user.email !== currentUser.email && (
                          <button
                            onClick={() => handleDeleteUser(item.user.email, item.user.name)}
                            className="p-1.5 rounded-lg bg-rose-50 text-rose-600 hover:bg-rose-100 transition"
                            title="Xóa tài khoản"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add / Edit User Modal */}
      {isAddEditModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in duration-200">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-purple-600/30 rounded-lg text-purple-300">
                  <Users className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold">
                    {editingUser ? 'Chỉnh Sửa / Nâng Cấp Tài Khoản' : 'Thêm Tài Khoản Người Dùng Mới'}
                  </h3>
                  <p className="text-xs text-slate-300">Cấu hình tên, mật khẩu và vai trò làm việc</p>
                </div>
              </div>
              <button
                onClick={() => setIsAddEditModalOpen(false)}
                className="text-slate-400 hover:text-white p-1 rounded-lg transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveUser} className="p-6 space-y-4">
              {errorMsg && (
                <div className="rounded-xl bg-rose-50 border border-rose-200 p-3 text-xs font-semibold text-rose-700">
                  {errorMsg}
                </div>
              )}

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  Họ và tên người dùng
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={e => setName(e.target.value)}
                  placeholder="VD: Nguyễn Văn A"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-900 focus:border-purple-600 focus:outline-hidden focus:ring-2 focus:ring-purple-600/20"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  Tên đăng nhập / Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  placeholder="VD: username@due.edu.vn"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-900 focus:border-purple-600 focus:outline-hidden focus:ring-2 focus:ring-purple-600/20 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  Mật khẩu đăng nhập
                </label>
                <input
                  type="text"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  placeholder="Ít nhất 4 ký tự..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-900 focus:border-purple-600 focus:outline-hidden focus:ring-2 focus:ring-purple-600/20 font-mono"
                  required
                />
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  Vai trò hệ thống (Role)
                </label>
                <select
                  value={role}
                  onChange={e => setRole(e.target.value as UserRole)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-900 focus:border-purple-600 focus:outline-hidden focus:ring-2 focus:ring-purple-600/20 bg-white"
                >
                  <option value="staff">🏫 Cán bộ Khoa / Giảng đường (Staff)</option>
                  <option value="technician">🛠️ Kỹ thuật viên (Maintenance Technician)</option>
                  <option value="admin">🔑 Quản trị viên (Admin)</option>
                </select>
              </div>

              <div>
                <label className="text-xs font-bold text-slate-700 mb-1 block">
                  Đơn vị / Khoa trực thuộc
                </label>
                <select
                  value={department}
                  onChange={e => setDepartment(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-medium text-slate-900 focus:border-purple-600 focus:outline-hidden focus:ring-2 focus:ring-purple-600/20 bg-white"
                >
                  {FACULTIES.map(fac => (
                    <option key={fac} value={fac}>{fac}</option>
                  ))}
                </select>
              </div>

              {/* Footer */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsAddEditModalOpen(false)}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-purple-600 hover:bg-purple-700 px-5 py-2 text-xs font-bold text-white transition shadow-sm"
                >
                  {editingUser ? 'Lưu Thay Đổi' : 'Tạo Tài Khoản'}
                </button>
              </div>
            </form>

          </div>
        </div>
      )}

    </div>
  );
};
