import React, { useState, useRef } from 'react';
import { Device, DeviceCategory, DeviceStatus, User } from '../types';
import { FACULTIES, LECTURE_HALLS, DEVICE_CATEGORIES } from '../data/mockData';
import { formatDate } from '../utils';
import { 
  Plus, 
  Search, 
  Filter, 
  QrCode, 
  Camera, 
  Edit3, 
  Trash2, 
  Building2, 
  MapPin, 
  Tag, 
  Calendar, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Clock, 
  RotateCcw,
  Sparkles,
  Printer,
  ArrowLeftRight,
  Archive,
  Download,
  Upload
} from 'lucide-react';

interface DeviceManagementProps {
  devices: Device[];
  currentUser: User | null;
  onAddDevice: (device: Omit<Device, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateDevice: (id: string, updates: Partial<Device>) => void;
  onDeleteDevice: (id: string) => void;
  onDeleteMultipleDevices?: (ids: string[]) => void;
  onOpenScanner: (callback: (sn: string) => void) => void;
  onOpenQRGenerator: (device: Device) => void;
  onOpenBatchQRPrint?: () => void;
  onReportIncidentForDevice?: (device: Device) => void;
  onTransferDevice?: (device: Device) => void;
  onImportDevices?: (devices: Device[]) => void;
}

export const DeviceManagement: React.FC<DeviceManagementProps> = ({
  devices,
  currentUser,
  onAddDevice,
  onUpdateDevice,
  onDeleteDevice,
  onDeleteMultipleDevices,
  onOpenScanner,
  onOpenQRGenerator,
  onOpenBatchQRPrint,
  onReportIncidentForDevice,
  onTransferDevice,
  onImportDevices
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedLectureHall, setSelectedLectureHall] = useState<string>('ALL');
  const [selectedStatus, setSelectedStatus] = useState<string>('ALL');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>([]);

  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExportCSV = () => {
    const headers = ['Mã SN', 'Tên thiết bị', 'Loại', 'Khoa / Đơn vị', 'Giảng đường / Khu nhà', 'Phòng', 'Trạng thái', 'Ngày mua', 'Hạn bảo hành', 'Nhà cung cấp', 'Ghi chú', 'Thông số kỹ thuật'];
    const rows = filteredDevices.map(d => [
      `"${d.serialNumber}"`,
      `"${d.name.replace(/"/g, '""')}"`,
      `"${d.category}"`,
      `"${d.location.faculty}"`,
      `"${d.location.lectureHall}"`,
      `"${d.location.room}"`,
      `"${d.status}"`,
      `"${d.purchaseDate}"`,
      `"${d.warrantyUntil}"`,
      `"${d.supplier.replace(/"/g, '""')}"`,
      `"${(d.notes || '').replace(/"/g, '""')}"`,
      `"${(d.specs || '').replace(/"/g, '""')}"`
    ]);

    const csvContent = '\uFEFF' + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `danh_sach_thiet_bi_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    const jsonContent = JSON.stringify(devices, null, 2);
    const blob = new Blob([jsonContent], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', `danh_sach_thiet_bi_backup_${new Date().toISOString().split('T')[0]}.json`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileImportChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const content = event.target?.result as string;
        if (file.name.endsWith('.json')) {
          const parsed = JSON.parse(content);
          if (Array.isArray(parsed)) {
            if (onImportDevices) {
              onImportDevices(parsed);
            } else {
              alert(`Đã đọc thành công ${parsed.length} thiết bị.`);
            }
          } else {
            alert('File JSON không đúng định dạng danh sách thiết bị.');
          }
        } else if (file.name.endsWith('.csv')) {
          const lines = content.split('\n').filter(l => l.trim().length > 0);
          if (lines.length < 2) {
            alert('File CSV không có dữ liệu hợp lệ.');
            return;
          }
          const newDevices: Device[] = [];
          for (let i = 1; i < lines.length; i++) {
            const cols = lines[i].split(',').map(c => c.replace(/^"|"$/g, '').trim());
            if (cols.length >= 2 && cols[0]) {
              newDevices.push({
                id: 'imp-' + Math.random().toString(36).substring(2, 9),
                serialNumber: cols[0],
                name: cols[1] || 'Thiết bị nhập',
                category: (cols[2] as DeviceCategory) || 'Khác',
                location: {
                  faculty: cols[3] || 'Phòng Cơ sở vật chất',
                  lectureHall: cols[4] || 'Giảng đường A',
                  room: cols[5] || 'Phòng học'
                },
                status: (cols[6] as DeviceStatus) || 'active',
                purchaseDate: cols[7] || new Date().toISOString().split('T')[0],
                warrantyUntil: cols[8] || new Date().toISOString().split('T')[0],
                supplier: cols[9] || 'Nhà cung cấp',
                notes: cols[10] || '',
                specs: cols[11] || '',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
              });
            }
          }
          if (newDevices.length > 0 && onImportDevices) {
            onImportDevices(newDevices);
          } else {
            alert(`Đã phân tích ${newDevices.length} thiết bị từ CSV.`);
          }
        } else {
          alert('Vui lòng chọn file .json hoặc .csv hợp lệ.');
        }
      } catch (err) {
        console.error('Import parse error:', err);
        alert('Lỗi đọc file. Vui lòng kiểm tra lại định dạng file.');
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Form State for Create / Edit
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const formContainerRef = useRef<HTMLDivElement>(null);

  const [isAddingNewCategory, setIsAddingNewCategory] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');

  const [isAddingNewFaculty, setIsAddingNewFaculty] = useState(false);
  const [newFacultyName, setNewFacultyName] = useState('');

  const [isAddingNewLectureHall, setIsAddingNewLectureHall] = useState(false);
  const [newLectureHallName, setNewLectureHallName] = useState('');

  // Get all unique categories (predefined + any custom categories in devices)
  const availableCategories = React.useMemo(() => {
    const customCats = devices.map(d => d.category);
    const combined = [...DEVICE_CATEGORIES, ...customCats];
    return Array.from(new Set(combined.map(c => c.trim()))).filter(Boolean);
  }, [devices]);

  // Get all unique faculties (predefined + any custom faculties in devices)
  const availableFaculties = React.useMemo(() => {
    const customFacs = devices.map(d => d.location.faculty);
    const combined = [...FACULTIES, ...customFacs];
    return Array.from(new Set(combined.map(c => c.trim()))).filter(Boolean);
  }, [devices]);

  // Get all unique lecture halls (predefined + any custom lecture halls in devices)
  const availableLectureHalls = React.useMemo(() => {
    const customHalls = devices.map(d => d.location.lectureHall);
    const combined = [...LECTURE_HALLS, ...customHalls];
    return Array.from(new Set(combined.map(c => c.trim()))).filter(Boolean);
  }, [devices]);

  const [viewMode, setViewMode] = useState<'table' | 'lecture_halls'>('table');

  const lectureHallStats = React.useMemo(() => {
    const map = new Map<string, {
      hall: string;
      total: number;
      active: number;
      maintenance: number;
      damaged: number;
      spare: number;
      decommissioned: number;
      roomsMap: Map<string, Device[]>;
    }>();

    availableLectureHalls.forEach(hall => {
      map.set(hall, {
        hall,
        total: 0,
        active: 0,
        maintenance: 0,
        damaged: 0,
        spare: 0,
        decommissioned: 0,
        roomsMap: new Map()
      });
    });

    devices.forEach(dev => {
      const hall = dev.location.lectureHall || 'Khác';
      if (!map.has(hall)) {
        map.set(hall, {
          hall,
          total: 0,
          active: 0,
          maintenance: 0,
          damaged: 0,
          spare: 0,
          decommissioned: 0,
          roomsMap: new Map()
        });
      }
      const stat = map.get(hall)!;
      stat.total++;
      if (dev.status === 'active') stat.active++;
      else if (dev.status === 'maintenance_needed') stat.maintenance++;
      else if (dev.status === 'damaged') stat.damaged++;
      else if (dev.status === 'spare') stat.spare++;
      else if (dev.status === 'decommissioned') stat.decommissioned++;

      const room = dev.location.room || 'Phòng chung';
      if (!stat.roomsMap.has(room)) {
        stat.roomsMap.set(room, []);
      }
      stat.roomsMap.get(room)!.push(dev);
    });

    return Array.from(map.values()).filter(s => s.total > 0 || availableLectureHalls.includes(s.hall));
  }, [devices, availableLectureHalls]);

  const [formData, setFormData] = useState({
    serialNumber: '',
    name: '',
    category: 'Máy chiếu' as DeviceCategory,
    faculty: FACULTIES[0],
    lectureHall: LECTURE_HALLS[0],
    room: 'Phòng A101',
    status: 'active' as DeviceStatus,
    purchaseDate: new Date().toISOString().split('T')[0],
    warrantyUntil: new Date(Date.now() + 365 * 86400000 * 2).toISOString().split('T')[0],
    supplier: '',
    notes: '',
    specs: ''
  });

  const resetForm = () => {
    setFormData({
      serialNumber: '',
      name: '',
      category: 'Máy chiếu',
      faculty: FACULTIES[0],
      lectureHall: LECTURE_HALLS[0],
      room: 'Phòng A101',
      status: 'active',
      purchaseDate: new Date().toISOString().split('T')[0],
      warrantyUntil: new Date(Date.now() + 365 * 86400000 * 2).toISOString().split('T')[0],
      supplier: '',
      notes: '',
      specs: ''
    });
    setEditingDeviceId(null);
    setIsAddingNewCategory(false);
    setNewCategoryName('');
    setIsAddingNewFaculty(false);
    setNewFacultyName('');
    setIsAddingNewLectureHall(false);
    setNewLectureHallName('');
  };

  const handleOpenEdit = (dev: Device) => {
    setEditingDeviceId(dev.id);
    setFormData({
      serialNumber: dev.serialNumber,
      name: dev.name,
      category: dev.category,
      faculty: dev.location.faculty,
      lectureHall: dev.location.lectureHall,
      room: dev.location.room,
      status: dev.status,
      purchaseDate: dev.purchaseDate,
      warrantyUntil: dev.warrantyUntil,
      supplier: dev.supplier,
      notes: dev.notes || '',
      specs: dev.specs || ''
    });
    setIsAddingNewCategory(false);
    setNewCategoryName('');
    setIsAddingNewFaculty(false);
    setNewFacultyName('');
    setIsAddingNewLectureHall(false);
    setNewLectureHallName('');
    setIsFormOpen(true);
    setTimeout(() => {
      formContainerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 100);
  };

  const handleScanForFormSN = () => {
    onOpenScanner((scannedValue) => {
      let sn = scannedValue.trim();

      // Try parsing as URL first in case QR contains full link
      if (sn.startsWith('http://') || sn.startsWith('https://')) {
        try {
          const url = new URL(sn);
          const snParam = url.searchParams.get('sn') || url.searchParams.get('serialNumber');
          if (snParam) {
            sn = snParam;
          }
        } catch (urlErr) {
          console.warn('Failed to parse scanned URL:', urlErr);
        }
      }

      setFormData(prev => ({ ...prev, serialNumber: sn }));
    });
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.serialNumber.trim() || !formData.name.trim()) return;

    const inputSn = formData.serialNumber.trim();
    const duplicateDevice = devices.find(dev => 
      dev.serialNumber.trim().toLowerCase() === inputSn.toLowerCase() && 
      dev.id !== editingDeviceId
    );

    if (duplicateDevice) {
      alert(`Cảnh báo trùng lặp: Số sê-ri (SN) "${inputSn}" đã tồn tại trên hệ thống cho thiết bị "${duplicateDevice.name}" tại ${duplicateDevice.location.faculty} - ${duplicateDevice.location.room}. Vui lòng nhập số sê-ri khác!`);
      return;
    }

    let finalCategory = formData.category;
    if (isAddingNewCategory) {
      if (!newCategoryName.trim()) return;
      finalCategory = newCategoryName.trim();
    }

    let finalFaculty = formData.faculty;
    if (isAddingNewFaculty) {
      if (!newFacultyName.trim()) return;
      finalFaculty = newFacultyName.trim();
    }

    let finalLectureHall = formData.lectureHall;
    if (isAddingNewLectureHall) {
      if (!newLectureHallName.trim()) return;
      finalLectureHall = newLectureHallName.trim();
    }

    const payload = {
      serialNumber: formData.serialNumber.trim(),
      name: formData.name.trim(),
      category: finalCategory,
      location: {
        faculty: finalFaculty,
        lectureHall: finalLectureHall,
        room: formData.room
      },
      status: formData.status,
      purchaseDate: formData.purchaseDate,
      warrantyUntil: formData.warrantyUntil,
      supplier: formData.supplier,
      notes: formData.notes,
      specs: formData.specs
    };

    if (editingDeviceId) {
      onUpdateDevice(editingDeviceId, payload);
    } else {
      onAddDevice(payload);
    }

    setIsFormOpen(false);
    resetForm();
  };

  // Generate unique random SN format
  const generateRandomSN = () => {
    const prefixes = ['SN-PJ', 'SN-AMP', 'SN-PC', 'SN-AC', 'SN-MIC', 'SN-IFP'];
    const randomPref = prefixes[Math.floor(Math.random() * prefixes.length)];
    const randomNum = Math.floor(1000 + Math.random() * 9000);
    setFormData(prev => ({ ...prev, serialNumber: `${randomPref}-${randomNum}` }));
  };

  // Filtered devices list
  const filteredDevices = devices.filter(dev => {
    const matchesSearch = 
      dev.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dev.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dev.location.room.toLowerCase().includes(searchQuery.toLowerCase()) ||
      dev.supplier.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesLectureHall = selectedLectureHall === 'ALL' || dev.location.lectureHall === selectedLectureHall;
    const matchesStatus = selectedStatus === 'ALL' || dev.status === selectedStatus;
    const matchesCategory = selectedCategory === 'ALL' || dev.category === selectedCategory;

    return matchesSearch && matchesLectureHall && matchesStatus && matchesCategory;
  });

  const getStatusBadge = (status: DeviceStatus) => {
    switch (status) {
      case 'active':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50 px-2 py-0.5 text-[11px] font-medium text-emerald-700 border border-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            Hoạt động tốt
          </span>
        );
      case 'maintenance_needed':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200">
            <Clock className="h-3.5 w-3.5 text-amber-600" />
            Cần bảo trì
          </span>
        );
      case 'damaged':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700 border border-rose-200">
            <AlertTriangle className="h-3.5 w-3.5 text-rose-600" />
            Hư hỏng / Sự cố
          </span>
        );
      case 'decommissioned':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600 border border-slate-200">
            <XCircle className="h-3.5 w-3.5 text-slate-500" />
            Đã thanh lý
          </span>
        );
      case 'spare':
        return (
          <span className="inline-flex items-center gap-1.5 rounded-md bg-indigo-50 px-2 py-0.5 text-[11px] font-medium text-indigo-700 border border-indigo-200">
            <Archive className="h-3.5 w-3.5 text-indigo-500" />
            Thiết bị dự phòng
          </span>
        );
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Top Banner Actions */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 bg-white p-4 sm:p-5 rounded-xl shadow-sm border border-slate-200">
        <div className="w-full sm:w-auto space-y-1">
          <div className="flex items-center justify-between sm:justify-start gap-2">
            <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
              Danh mục thiết bị
            </h2>
            <span className="shrink-0 rounded-md bg-slate-100 px-2 py-0.5 text-[11px] sm:text-xs font-semibold text-slate-600 border border-slate-200 whitespace-nowrap">
              {filteredDevices.length} / {devices.length} thiết bị
            </span>
          </div>
          <p className="text-[11px] sm:text-xs text-slate-500">
            Hệ thống theo dõi mã SN, vị trí giảng đường, phòng học và tạo mã QR code
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto shrink-0">
          <input
            type="file"
            ref={fileInputRef}
            onChange={handleFileImportChange}
            accept=".json,.csv"
            className="hidden"
          />

          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 transition shadow-xs active:scale-95"
            title="Nhập danh sách thiết bị từ file CSV hoặc JSON"
          >
            <Upload className="h-4 w-4 text-emerald-600" />
            <span>Nhập File</span>
          </button>

          {onDeleteMultipleDevices && currentUser?.role === 'admin' && (
            <button
              type="button"
              disabled={selectedDeviceIds.length === 0}
              onClick={() => {
                if (window.confirm(`Bạn có chắc chắn muốn xóa ${selectedDeviceIds.length} thiết bị đã chọn?`)) {
                  onDeleteMultipleDevices(selectedDeviceIds);
                  setSelectedDeviceIds([]);
                }
              }}
              className={`flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg border px-3 py-2 text-xs font-bold transition shadow-xs active:scale-95 ${
                selectedDeviceIds.length > 0 
                  ? "border-red-200 bg-red-50 hover:bg-red-100 text-red-700 cursor-pointer" 
                  : "border-slate-200 bg-slate-50 text-slate-400 cursor-not-allowed"
              }`}
              title={selectedDeviceIds.length > 0 ? "Xóa các thiết bị đã chọn" : "Chọn các thiết bị bên dưới để xóa hàng loạt"}
            >
              <Trash2 className="h-4 w-4" />
              <span>Xóa hàng loạt {selectedDeviceIds.length > 0 ? `(${selectedDeviceIds.length})` : ''}</span>
            </button>
          )}

          <div className="relative group">
            <button
              type="button"
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3 py-2 text-xs font-bold text-slate-800 transition shadow-xs active:scale-95"
              title="Xuất dữ liệu thiết bị"
            >
              <Download className="h-4 w-4 text-blue-600" />
              <span>Xuất File</span>
            </button>
            <div className="absolute right-0 mt-1 hidden group-hover:block bg-white border border-slate-200 rounded-xl shadow-lg p-1.5 z-20 w-44">
              <button
                onClick={handleExportCSV}
                className="w-full text-left px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Xuất file CSV (Excel)
              </button>
              <button
                onClick={handleExportJSON}
                className="w-full text-left px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg"
              >
                Xuất file JSON (Backup)
              </button>
            </div>
          </div>

          {onOpenBatchQRPrint && (
            <button
              onClick={onOpenBatchQRPrint}
              className="flex-1 sm:flex-none inline-flex items-center justify-center gap-1.5 rounded-lg border border-slate-300 bg-white hover:bg-slate-50 px-3.5 py-2 text-xs font-bold text-slate-800 transition shadow-xs active:scale-95"
              title="In hàng loạt mã QR theo khổ giấy A4"
            >
              <Printer className="h-4 w-4 text-blue-600" />
              <span>In Hàng Loạt QR (Khổ A4)</span>
            </button>
          )}

          <button
            onClick={() => {
              resetForm();
              setIsFormOpen(true);
            }}
            className="flex-1 sm:flex-none inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2.5 sm:py-2 text-xs font-bold text-white transition shadow-sm active:scale-95"
          >
            <Plus className="h-4 w-4" />
            Thêm Thiết Bị Mới
          </button>
        </div>
      </div>

      {/* Form Drawer / Modal for Add / Edit */}
      <div ref={formContainerRef}>
        {isFormOpen && (
          <div className="rounded-2xl bg-white p-6 shadow-xl border-2 border-slate-900 space-y-5 animate-fade-in">
          <div className="flex items-center justify-between border-b border-slate-200 pb-4">
            <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
              <Tag className="h-5 w-5 text-emerald-600" />
              {editingDeviceId ? 'Cập Nhật Thông Tin Thiết Bị' : 'Khai Báo Thiết Bị Mới'}
            </h3>
            <button
              onClick={() => {
                setIsFormOpen(false);
                resetForm();
              }}
              className="text-xs text-slate-400 hover:text-slate-600"
            >
              Hủy bỏ [X]
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              
              {/* SN Code Field with Camera Scan Button */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Mã Seri (SN - Serial Number) *
                </label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    required
                    value={formData.serialNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, serialNumber: e.target.value }))}
                    placeholder="ví dụ: SN-PJ386-9921"
                    className={`flex-grow rounded-xl border px-3.5 py-2 text-sm focus:outline-none focus:ring-2 font-mono ${
                      formData.serialNumber.trim() !== '' && devices.some(dev => dev.serialNumber.trim().toLowerCase() === formData.serialNumber.trim().toLowerCase() && dev.id !== editingDeviceId)
                        ? 'border-red-500 focus:border-red-500 focus:ring-red-200 bg-red-50/20'
                        : 'border-slate-300 focus:border-emerald-500 focus:ring-emerald-200'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={handleScanForFormSN}
                    className="rounded-xl bg-slate-900 px-3 py-2 text-white hover:bg-slate-800 transition text-xs flex items-center gap-1 shrink-0"
                    title="Quét mã QR/Barcode sẵn có trên thân thiết bị"
                  >
                    <Camera className="h-3.5 w-3.5 text-emerald-400" />
                    Quét
                  </button>
                  <button
                    type="button"
                    onClick={generateRandomSN}
                    className="rounded-xl bg-slate-100 px-2.5 py-2 text-slate-600 hover:bg-slate-200 transition text-xs shrink-0"
                    title="Tạo mã SN ngẫu nhiên"
                  >
                    <Sparkles className="h-3.5 w-3.5 text-slate-500" />
                  </button>
                </div>
                {formData.serialNumber.trim() !== '' && devices.some(dev => dev.serialNumber.trim().toLowerCase() === formData.serialNumber.trim().toLowerCase() && dev.id !== editingDeviceId) && (
                  <p className="mt-1.5 text-[11px] text-red-600 font-bold flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3 shrink-0 text-red-500" />
                    Số sê-ri này đã tồn tại trên hệ thống!
                  </p>
                )}
              </div>

              {/* Device Name */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Tên Thiết Bị *
                </label>
                <input
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  placeholder="ví dụ: Máy chiếu Panasonic PT-LB386"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              {/* Category */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Loại Thiết Bị
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNewCategory(!isAddingNewCategory);
                      setNewCategoryName('');
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 transition"
                  >
                    {isAddingNewCategory ? '← Chọn từ danh sách' : '+ Thêm loại mới'}
                  </button>
                </div>

                {isAddingNewCategory ? (
                  <input
                    type="text"
                    required
                    value={newCategoryName}
                    onChange={(e) => setNewCategoryName(e.target.value)}
                    placeholder="Nhập loại thiết bị mới..."
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                ) : (
                  <select
                    value={formData.category}
                    onChange={(e) => setFormData(prev => ({ ...prev, category: e.target.value as DeviceCategory }))}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
                  >
                    {availableCategories.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Faculty */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Khoa / Đơn vị Quản lý
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNewFaculty(!isAddingNewFaculty);
                      setNewFacultyName('');
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 transition"
                  >
                    {isAddingNewFaculty ? '← Chọn từ danh sách' : '+ Thêm đơn vị mới'}
                  </button>
                </div>

                {isAddingNewFaculty ? (
                  <input
                    type="text"
                    required
                    value={newFacultyName}
                    onChange={(e) => setNewFacultyName(e.target.value)}
                    placeholder="Nhập tên đơn vị mới..."
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                ) : (
                  <select
                    value={formData.faculty}
                    onChange={(e) => setFormData(prev => ({ ...prev, faculty: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
                  >
                    {availableFaculties.map((fac) => (
                      <option key={fac} value={fac}>{fac}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Lecture Hall */}
              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Giảng Đường (Khu Nhà)
                  </label>
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddingNewLectureHall(!isAddingNewLectureHall);
                      setNewLectureHallName('');
                    }}
                    className="text-xs font-bold text-blue-600 hover:text-blue-700 transition"
                  >
                    {isAddingNewLectureHall ? '← Chọn từ danh sách' : '+ Thêm vị trí mới'}
                  </button>
                </div>

                {isAddingNewLectureHall ? (
                  <input
                    type="text"
                    required
                    value={newLectureHallName}
                    onChange={(e) => setNewLectureHallName(e.target.value)}
                    placeholder="Nhập tên giảng đường / khu nhà mới..."
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                  />
                ) : (
                  <select
                    value={formData.lectureHall}
                    onChange={(e) => setFormData(prev => ({ ...prev, lectureHall: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
                  >
                    {availableLectureHalls.map((hall) => (
                      <option key={hall} value={hall}>{hall}</option>
                    ))}
                  </select>
                )}
              </div>

              {/* Room */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phòng Học / Lab *
                </label>
                <input
                  type="text"
                  required
                  value={formData.room}
                  onChange={(e) => setFormData(prev => ({ ...prev, room: e.target.value }))}
                  placeholder="ví dụ: Phòng A101"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              {/* Status */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Trạng Thái Hiện Tại
                </label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as DeviceStatus }))}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
                >
                  <option value="active">🟢 Hoạt động tốt</option>
                  <option value="maintenance_needed">🟡 Cần bảo trì</option>
                  <option value="damaged">🔴 Hư hỏng / Sự cố</option>
                  <option value="decommissioned">⚪ Đã thanh lý</option>
                  <option value="spare">🟣 Thiết bị dự phòng</option>
                </select>
              </div>

              {/* Purchase Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ngày Đưa Vào Sử Dụng
                </label>
                <input
                  type="date"
                  value={formData.purchaseDate}
                  onChange={(e) => setFormData(prev => ({ ...prev, purchaseDate: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              {/* Warranty Date */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Hạn Bảo Hành
                </label>
                <input
                  type="date"
                  value={formData.warrantyUntil}
                  onChange={(e) => setFormData(prev => ({ ...prev, warrantyUntil: e.target.value }))}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              {/* Supplier */}
              <div className="sm:col-span-2">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Nhà Cung Cấp / Đơn Vị Cung Cấp
                </label>
                <input
                  type="text"
                  value={formData.supplier}
                  onChange={(e) => setFormData(prev => ({ ...prev, supplier: e.target.value }))}
                  placeholder="ví dụ: Công ty TNHH Thiết bị Giáo dục Đất Việt"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              {/* Specifications */}
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Thông Số Kỹ Thuật (Hiển thị trên tem & QR - Hỗ trợ nhấn Enter xuống dòng)
                </label>
                <textarea
                  value={formData.specs}
                  onChange={(e) => setFormData(prev => ({ ...prev, specs: e.target.value }))}
                  placeholder="ví dụ:&#13;&#10;• 3800 ANSI Lumens&#13;&#10;• Độ phân giải XGA&#13;&#10;• Cổng kết nối HDMI"
                  rows={4}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

              {/* Notes */}
              <div className="sm:col-span-3">
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ghi Chú Chi Tiết Khung Treo / Lắp Đặt
                </label>
                <input
                  type="text"
                  value={formData.notes}
                  onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Mô tả vị trí khung treo, loại cáp kết nối..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200"
                />
              </div>

            </div>

            <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200">
              <button
                type="button"
                onClick={() => {
                  setIsFormOpen(false);
                  resetForm();
                }}
                className="rounded-xl border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-50 transition"
              >
                Hủy bỏ
              </button>
              <button
                type="submit"
                className="rounded-xl bg-slate-900 px-6 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition shadow-sm"
              >
                {editingDeviceId ? 'Cập Nhật Thiết Bị' : 'Lưu Khai Báo Mới'}
              </button>
            </div>
          </form>
        </div>
      )}
      </div>

      {/* View Mode Selector Tabs */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white p-3 sm:p-4 rounded-2xl border border-slate-200 shadow-sm">
        <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-xl w-full sm:w-auto">
          <button
            type="button"
            onClick={() => setViewMode('table')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition ${
              viewMode === 'table' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <span>📋 Bảng danh sách chi tiết</span>
          </button>
          <button
            type="button"
            onClick={() => setViewMode('lecture_halls')}
            className={`flex-1 sm:flex-none flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition ${
              viewMode === 'lecture_halls' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            <Building2 className="h-4 w-4 text-emerald-600" />
            <span>🏢 Sơ đồ & Vị trí Giảng đường</span>
          </button>
        </div>

        <div className="text-xs text-slate-500 font-medium px-2">
          Tổng số: <strong className="text-slate-900">{devices.length}</strong> thiết bị phân bố tại <strong className="text-emerald-700">{lectureHallStats.filter(s => s.total > 0).length}</strong> khu vực giảng đường
        </div>
      </div>

      {viewMode === 'lecture_halls' ? (
        <div className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {lectureHallStats.map((stat) => {
              const roomsList = Array.from(stat.roomsMap.entries());
              return (
                <div key={stat.hall} className="bg-white rounded-2xl p-5 shadow-sm border border-slate-200 flex flex-col justify-between space-y-4 hover:border-emerald-300 transition group">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2.5">
                        <div className="h-10 w-10 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-center text-emerald-700 font-bold">
                          <Building2 className="h-5 w-5" />
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm group-hover:text-emerald-700 transition">{stat.hall}</h3>
                          <p className="text-[11px] text-slate-500">{stat.total} thiết bị đang quản lý</p>
                        </div>
                      </div>
                      <span className="rounded-full bg-slate-100 text-slate-800 font-bold px-2.5 py-1 text-xs">
                        {stat.total}
                      </span>
                    </div>

                    {/* Status breakdown mini pill bar */}
                    <div className="grid grid-cols-3 gap-1.5 pt-1 text-center text-[10px]">
                      <div className="bg-emerald-50 text-emerald-800 rounded-lg p-1.5 border border-emerald-100 font-semibold">
                        🟢 Hoạt động: {stat.active}
                      </div>
                      <div className="bg-amber-50 text-amber-800 rounded-lg p-1.5 border border-amber-100 font-semibold">
                        🟡 Bảo trì: {stat.maintenance}
                      </div>
                      <div className="bg-rose-50 text-rose-800 rounded-lg p-1.5 border border-rose-100 font-semibold">
                        🔴 Hư hỏng: {stat.damaged}
                      </div>
                    </div>

                    {/* Rooms breakdown list */}
                    <div className="space-y-1.5 pt-2 border-t border-slate-100">
                      <p className="text-[11px] font-bold text-slate-700">Các phòng học / khu vực ({roomsList.length}):</p>
                      {roomsList.length === 0 ? (
                        <p className="text-[11px] text-slate-400 italic">Chưa có thiết bị nào trong giảng đường này</p>
                      ) : (
                        <div className="max-h-36 overflow-y-auto space-y-1 pr-1">
                          {roomsList.map(([roomName, roomDevs]) => (
                            <div key={roomName} className="flex items-center justify-between bg-slate-50 hover:bg-slate-100/80 px-2.5 py-1.5 rounded-lg text-xs transition">
                              <span className="font-semibold text-slate-800 flex items-center gap-1.5">
                                <MapPin className="h-3 w-3 text-emerald-600" />
                                {roomName}
                              </span>
                              <span className="text-[11px] font-bold text-slate-600 bg-white px-2 py-0.5 rounded border border-slate-200">
                                {roomDevs.length} TB
                              </span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-100">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedLectureHall(stat.hall);
                        setViewMode('table');
                      }}
                      className="w-full inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white px-3 py-2 text-xs font-semibold transition active:scale-95"
                    >
                      <span>Xem chi tiết danh sách thiết bị</span>
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <>
          {/* Filter Bar */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-sm">
        
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo Tên, SN, Phòng..."
            className="w-full rounded-xl border border-slate-200 pl-9 pr-4 py-2 text-xs focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-100"
          />
        </div>

        {/* Filter Lecture Hall */}
        <div>
          <select
            value={selectedLectureHall}
            onChange={(e) => setSelectedLectureHall(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none bg-white text-slate-700 font-medium"
          >
            <option value="ALL">-- Tất cả Giảng đường / Khu Nhà --</option>
            {availableLectureHalls.map(hall => (
              <option key={hall} value={hall}>{hall}</option>
            ))}
          </select>
        </div>

        {/* Filter Category */}
        <div>
          <select
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none bg-white text-slate-700"
          >
            <option value="ALL">-- Tất cả Loại thiết bị --</option>
            {availableCategories.map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Filter Status */}
        <div>
          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs focus:border-emerald-500 focus:outline-none bg-white text-slate-700"
          >
            <option value="ALL">-- Tất cả Trạng thái --</option>
            <option value="active">🟢 Hoạt động tốt</option>
            <option value="maintenance_needed">🟡 Cần bảo trì</option>
            <option value="damaged">🔴 Hư hỏng / Sự cố</option>
            <option value="decommissioned">⚪ Đã thanh lý</option>
            <option value="spare">🟣 Thiết bị dự phòng</option>
          </select>
        </div>

      </div>

      {/* Bulk Select Bar */}
      {filteredDevices.length > 0 && currentUser?.role === 'admin' && (
        <div className="flex md:hidden items-center justify-between bg-slate-50 px-4 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-600 mb-2">
          <label className="flex items-center gap-2 cursor-pointer font-medium text-slate-700">
            <input
              type="checkbox"
              className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
              checked={filteredDevices.length > 0 && filteredDevices.every(d => selectedDeviceIds.includes(d.id))}
              onChange={(e) => {
                if (e.target.checked) {
                  const allFilteredIds = filteredDevices.map(d => d.id);
                  setSelectedDeviceIds(prev => {
                    const newIds = [...prev];
                    allFilteredIds.forEach(id => {
                      if (!newIds.includes(id)) newIds.push(id);
                    });
                    return newIds;
                  });
                } else {
                  const allFilteredIds = filteredDevices.map(d => d.id);
                  setSelectedDeviceIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
                }
              }}
            />
            <span>Chọn tất cả ({filteredDevices.length} thiết bị)</span>
          </label>
          {selectedDeviceIds.length > 0 && (
            <span className="font-bold text-red-700 bg-red-50 border border-red-100 px-2.5 py-0.5 rounded-full">
              Đã chọn: {selectedDeviceIds.length}
            </span>
          )}
        </div>
      )}

      {/* Device List: Mobile Cards (< md) & Desktop Table (>= md) */}
      <div className="overflow-hidden rounded-xl bg-white shadow-sm border border-slate-200">
        
        {/* Mobile View: Cards */}
        <div className="md:hidden divide-y divide-slate-100">
          {filteredDevices.length === 0 ? (
            <div className="py-12 text-center text-slate-400 p-4">
              <p className="text-sm font-medium">Không tìm thấy thiết bị nào phù hợp</p>
              <p className="text-xs mt-1">Thử thay đổi từ khóa tìm kiếm hoặc chọn lại bộ lọc</p>
            </div>
          ) : (
            filteredDevices.map((dev) => (
              <div key={dev.id} className="p-4 space-y-3 hover:bg-slate-50/50 transition">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-start gap-2.5">
                    {currentUser?.role === 'admin' && (
                      <input
                        type="checkbox"
                        className="mt-1.5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer shrink-0"
                        checked={selectedDeviceIds.includes(dev.id)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedDeviceIds(prev => [...prev, dev.id]);
                          } else {
                            setSelectedDeviceIds(prev => prev.filter(id => id !== dev.id));
                          }
                        }}
                      />
                    )}
                    <div>
                      <span className="inline-block rounded-md bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 mb-1">
                        {dev.category}
                      </span>
                      <h3 className="font-bold text-slate-900 text-sm leading-snug">{dev.name}</h3>
                      {dev.specs && (
                        <p className="text-[11px] text-slate-500 font-medium italic mt-0.5 whitespace-pre-line leading-relaxed">
                          Thông số:
                          <span className="block mt-0.5 pl-2 border-l border-slate-200 not-italic text-slate-600 font-semibold">{dev.specs}</span>
                        </p>
                      )}
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className="font-mono text-[11px] font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {dev.serialNumber}
                        </span>
                        <span className="text-[10px] text-slate-400 truncate max-w-[130px]">{dev.supplier}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    {getStatusBadge(dev.status)}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 block font-medium">Vị trí</span>
                    <p className="font-medium text-slate-800 text-[11px] truncate">{dev.location.faculty}</p>
                    <p className="text-[11px] text-emerald-700 font-bold">{dev.location.lectureHall} - {dev.location.room}</p>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 block font-medium">Thời hạn bảo hành</span>
                    <p className="text-[11px] text-slate-600">Dùng: {formatDate(dev.purchaseDate)}</p>
                    <p className="text-[11px] text-slate-800 font-bold">Hạn: {formatDate(dev.warrantyUntil)}</p>
                  </div>
                </div>

                {/* Mobile Touch Action Bar */}
                <div className="flex items-center justify-between pt-1 gap-2">
                  <button
                    onClick={() => onOpenQRGenerator(dev)}
                    className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-blue-50 px-2 py-1.5 text-[11px] font-semibold text-blue-700 border border-blue-200 hover:bg-blue-100 transition active:scale-95"
                  >
                    <QrCode className="h-3.5 w-3.5 text-blue-600" />
                    Tem QR
                  </button>

                  {currentUser?.role !== 'staff' && onTransferDevice && (
                    <button
                      onClick={() => onTransferDevice(dev)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-emerald-50 px-2 py-1.5 text-[11px] font-semibold text-emerald-700 border border-emerald-200 hover:bg-emerald-100 transition active:scale-95"
                    >
                      <ArrowLeftRight className="h-3.5 w-3.5 text-emerald-600" />
                      Điều Chuyển
                    </button>
                  )}

                  {currentUser?.role !== 'staff' && onReportIncidentForDevice && (
                    <button
                      onClick={() => onReportIncidentForDevice(dev)}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-amber-50 px-2 py-1.5 text-[11px] font-semibold text-amber-700 border border-amber-200 hover:bg-amber-100 transition active:scale-95"
                    >
                      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
                      Sự Cố
                    </button>
                  )}

                  <div className="flex items-center gap-1 shrink-0">
                    {currentUser?.role !== 'staff' && (
                      <button
                        onClick={() => handleOpenEdit(dev)}
                        className="rounded-lg p-2 text-slate-600 bg-slate-100 hover:bg-slate-200 transition"
                        title="Chỉnh sửa thông tin"
                      >
                        <Edit3 className="h-4 w-4" />
                      </button>
                    )}
                    
                    {currentUser?.role === 'admin' && (
                      <button
                        onClick={() => {
                          if (confirm(`Bạn có chắc muốn xóa thiết bị ${dev.name} (${dev.serialNumber})?`)) {
                            onDeleteDevice(dev.id);
                          }
                        }}
                        className="rounded-lg p-2 text-rose-600 bg-rose-50 hover:bg-rose-100 transition"
                        title="Xóa thiết bị"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Desktop View: Table (>= md) */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-slate-500 text-[11px] font-semibold uppercase tracking-wider border-b border-slate-200">
                {currentUser?.role === 'admin' && (
                  <th className="py-3 px-4 w-10 text-center">
                    <input
                      type="checkbox"
                      className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                      checked={filteredDevices.length > 0 && filteredDevices.every(d => selectedDeviceIds.includes(d.id))}
                      onChange={(e) => {
                        if (e.target.checked) {
                          const allFilteredIds = filteredDevices.map(d => d.id);
                          setSelectedDeviceIds(prev => {
                            const newIds = [...prev];
                            allFilteredIds.forEach(id => {
                              if (!newIds.includes(id)) newIds.push(id);
                            });
                            return newIds;
                          });
                        } else {
                          const allFilteredIds = filteredDevices.map(d => d.id);
                          setSelectedDeviceIds(prev => prev.filter(id => !allFilteredIds.includes(id)));
                        }
                      }}
                    />
                  </th>
                )}
                <th className="py-3 px-4">Mã SN & Tên Thiết Bị</th>
                <th className="py-3 px-4">Vị Trí Giảng Đường</th>
                <th className="py-3 px-4">Loại Thiết Bị</th>
                <th className="py-3 px-4">Trạng Thái</th>
                <th className="py-3 px-4">Bảo Hành</th>
                <th className="py-3 px-4 text-center">In Mã QR</th>
                <th className="py-3 px-4 text-right">Thao Tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-xs text-slate-700">
              {filteredDevices.length === 0 ? (
                <tr>
                  <td colSpan={currentUser?.role === 'admin' ? 8 : 7} className="py-12 text-center text-slate-400">
                    <p className="text-sm font-medium">Không tìm thấy thiết bị nào phù hợp</p>
                    <p className="text-xs mt-1">Thử thay đổi từ khóa tìm kiếm hoặc chọn lại bộ lọc</p>
                  </td>
                </tr>
              ) : (
                filteredDevices.map((dev) => (
                  <tr key={dev.id} className={`hover:bg-slate-50/80 transition ${selectedDeviceIds.includes(dev.id) ? 'bg-emerald-50/20' : ''}`}>
                    
                    {/* Checkbox column */}
                    {currentUser?.role === 'admin' && (
                      <td className="py-3.5 px-4 text-center">
                        <input
                          type="checkbox"
                          className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-4 w-4 cursor-pointer"
                          checked={selectedDeviceIds.includes(dev.id)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedDeviceIds(prev => [...prev, dev.id]);
                            } else {
                              setSelectedDeviceIds(prev => prev.filter(id => id !== dev.id));
                            }
                          }}
                        />
                      </td>
                    )}
                    
                    {/* Device Name & SN */}
                    <td className="py-3.5 px-4">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        {dev.name}
                      </div>
                      {dev.specs && (
                        <div className="text-[11px] text-slate-500 font-medium italic mt-0.5 max-w-[280px] truncate">
                          Thông số: {dev.specs}
                        </div>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="font-mono text-[11px] font-bold text-slate-900 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                          {dev.serialNumber}
                        </span>
                        <span className="text-[11px] text-slate-400">Nguồn: {dev.supplier}</span>
                      </div>
                    </td>

                    {/* Location */}
                    <td className="py-3.5 px-4">
                      <div className="font-semibold text-slate-800 flex items-center gap-1">
                        <Building2 className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                        {dev.location.faculty}
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                        {dev.location.lectureHall} - <strong className="text-emerald-700">{dev.location.room}</strong>
                      </div>
                    </td>

                    {/* Category */}
                    <td className="py-3.5 px-4">
                      <span className="inline-block rounded-md bg-slate-100 px-2 py-1 text-[11px] font-medium text-slate-700">
                        {dev.category}
                      </span>
                    </td>

                    {/* Status Badge */}
                    <td className="py-3.5 px-4">
                      {getStatusBadge(dev.status)}
                    </td>

                    {/* Warranty */}
                    <td className="py-3.5 px-4 text-[11px] text-slate-500">
                      <div>Dùng: {formatDate(dev.purchaseDate)}</div>
                      <div>Hạn BH: <strong className="text-slate-700">{formatDate(dev.warrantyUntil)}</strong></div>
                    </td>

                    {/* QR Code Trigger Button */}
                    <td className="py-3.5 px-4 text-center">
                      <button
                        onClick={() => onOpenQRGenerator(dev)}
                        className="inline-flex items-center gap-1 rounded-lg bg-blue-50 px-2.5 py-1 text-xs font-medium text-blue-700 border border-blue-200 hover:bg-blue-100 transition"
                        title="Tạo mã QR code và in tem dán lên thiết bị"
                      >
                        <QrCode className="h-3.5 w-3.5 text-blue-600" />
                        Tem QR
                      </button>
                    </td>

                    {/* Action buttons */}
                    <td className="py-3.5 px-4 text-right">
                      <div className="flex items-center justify-end gap-1.5">
                        {currentUser?.role !== 'staff' && onTransferDevice && (
                          <button
                            onClick={() => onTransferDevice(dev)}
                            className="rounded-lg px-2 py-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition flex items-center gap-1"
                            title="Điều chuyển hoặc thu hồi thiết bị này"
                          >
                            <ArrowLeftRight className="h-3.5 w-3.5 text-emerald-600" />
                            <span>Điều chuyển</span>
                          </button>
                        )}

                        {currentUser?.role !== 'staff' && (
                          <button
                            onClick={() => handleOpenEdit(dev)}
                            className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 transition"
                            title="Chỉnh sửa thông tin"
                          >
                            <Edit3 className="h-4 w-4" />
                          </button>
                        )}
                        
                        {currentUser?.role === 'admin' && (
                          <button
                            onClick={() => {
                              if (confirm(`Bạn có chắc muốn xóa thiết bị ${dev.name} (${dev.serialNumber})?`)) {
                                onDeleteDevice(dev.id);
                              }
                            }}
                            className="rounded-lg p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600 transition"
                            title="Xóa thiết bị"
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
      </>
      )}

    </div>
  );
};
