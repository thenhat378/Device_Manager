import React, { useState, useEffect } from 'react';
import { Device, DeviceTransferRecord, DeviceInventoryRecord, User, DeviceStatus, DeviceLocation } from '../types';
import { formatDate, exportToWord } from '../utils';
import { FACULTIES, LECTURE_HALLS } from '../data/mockData';
import { DUELogo } from './DUELogo';
import { 
  ClipboardList, 
  Search, 
  Camera, 
  MapPin, 
  Calendar, 
  UserCheck, 
  ShieldCheck, 
  Clock, 
  AlertCircle, 
  ArrowLeftRight, 
  Wrench, 
  CheckCircle, 
  Plus, 
  ChevronRight,
  FileText,
  AlertTriangle,
  History,
  Info,
  Check,
  Printer
} from 'lucide-react';

interface DeviceInventoryProps {
  devices: Device[];
  transfers: DeviceTransferRecord[];
  inventories: DeviceInventoryRecord[];
  currentUser: User | null;
  onAddInventory: (record: Omit<DeviceInventoryRecord, 'id' | 'createdAt'>) => Promise<void>;
  onUpdateDeviceStatus: (id: string, status: DeviceStatus, notes?: string) => Promise<void>;
  onOpenScanner: (callback: (sn: string) => void) => void;
  onAddToast: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error', deviceSn?: string) => void;
  selectedDeviceFromApp?: Device | null;
  onSelectDeviceFromApp?: (device: Device | null) => void;
}

export const DeviceInventory: React.FC<DeviceInventoryProps> = ({
  devices,
  transfers,
  inventories,
  currentUser,
  onAddInventory,
  onUpdateDeviceStatus,
  onOpenScanner,
  onAddToast,
  selectedDeviceFromApp,
  onSelectDeviceFromApp
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedDevice, setSelectedDevice] = useState<Device | null>(selectedDeviceFromApp || null);
  
  // Inventory form states
  const [inventoryDate, setInventoryDate] = useState(new Date().toISOString().split('T')[0]);
  const [auditorName, setAuditorName] = useState(currentUser?.name || '');
  const [auditStatus, setAuditStatus] = useState<DeviceStatus>('active');
  const [locationStatus, setLocationStatus] = useState<'matched' | 'mismatched'>('matched');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Print Inventory Report states
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [printFaculty, setPrintFaculty] = useState<string>(FACULTIES[0] || 'Khoa CNTT');
  const [printYear, setPrintYear] = useState<number>(new Date().getFullYear());
  const [printFilterType, setPrintFilterType] = useState<'all' | 'checked' | 'unchecked'>('all');
  const [printAuditorName, setPrintAuditorName] = useState<string>(currentUser?.name || '');
  const [printFacilitiesRep, setPrintFacilitiesRep] = useState<string>('Phan Thế Nhật');
  const [printFacultyRep, setPrintFacultyRep] = useState<string>('Trưởng Đơn vị');

  // Stats
  const totalCount = devices.length;
  // Let's count checked if there exists an inventory record in the current year
  const currentYear = new Date().getFullYear();
  const checkedDeviceIds = new Set(
    inventories
      .filter(inv => new Date(inv.inventoryDate).getFullYear() === currentYear)
      .map(inv => inv.deviceId)
  );
  const checkedCount = checkedDeviceIds.size;
  const uncheckedCount = totalCount - checkedCount;
  
  const locationMismatches = inventories.filter(
    inv => inv.locationStatus === 'mismatched' && 
    // only count latest audit per device
    inv.id === inventories.filter(i => i.deviceId === inv.deviceId).sort((a,b) => b.inventoryDate.localeCompare(a.inventoryDate))[0]?.id
  ).length;

  // Selected device's lifecycle
  const deviceTransfers = transfers
    .filter(t => t.deviceId === selectedDevice?.id)
    .sort((a, b) => b.transferDate.localeCompare(a.transferDate));

  const deviceInventories = inventories
    .filter(i => i.deviceId === selectedDevice?.id)
    .sort((a, b) => b.inventoryDate.localeCompare(a.inventoryDate));

  // Sync selected device from App prop changes
  useEffect(() => {
    if (selectedDeviceFromApp) {
      setSelectedDevice(selectedDeviceFromApp);
    }
  }, [selectedDeviceFromApp]);

  // Initialize form when device is selected
  useEffect(() => {
    if (selectedDevice) {
      setAuditStatus(selectedDevice.status);
      setLocationStatus('matched');
      setNotes('');
      setAuditorName(currentUser?.name || '');
    }
  }, [selectedDevice, currentUser]);

  const handleDeviceSelect = (device: Device) => {
    setSelectedDevice(device);
    setSearchQuery('');
    if (onSelectDeviceFromApp) {
      onSelectDeviceFromApp(device);
    }
  };

  const handleScanQR = () => {
    onOpenScanner((scannedValue) => {
      let sn = scannedValue.trim();
      try {
        const parsed = JSON.parse(scannedValue);
        if (parsed && parsed.sn) {
          sn = parsed.sn;
        }
      } catch (e) {
        // Raw string
      }

      const found = devices.find(
        d => d.serialNumber.toLowerCase() === sn.toLowerCase() || d.id === sn
      );

      if (found) {
        handleDeviceSelect(found);
        onAddToast(
          'Đã nhận diện thiết bị',
          `Quét thành công: ${found.name} (SN: ${found.serialNumber})`,
          'success',
          found.serialNumber
        );
      } else {
        onAddToast(
          'Không tìm thấy thiết bị',
          `Mã sê-ri "${sn}" không khớp với thiết bị nào trên hệ thống.`,
          'warning',
          sn
        );
      }
    });
  };

  const handleSubmitAudit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDevice) return;
    if (!auditorName.trim()) {
      alert('Vui lòng nhập tên người kiểm kê');
      return;
    }

    setIsSubmitting(true);
    try {
      // 1. Add audit log
      await onAddInventory({
        deviceId: selectedDevice.id,
        deviceSn: selectedDevice.serialNumber,
        deviceName: selectedDevice.name,
        inventoryDate,
        auditorName,
        status: auditStatus,
        locationStatus,
        notes: notes.trim()
      });

      // 2. Update device status if changed
      if (auditStatus !== selectedDevice.status) {
        await onUpdateDeviceStatus(
          selectedDevice.id,
          auditStatus,
          notes.trim() ? `[Kiểm kê ${formatDate(inventoryDate)}] ${notes.trim()}` : undefined
        );
      }

      onAddToast(
        'Ghi nhận kiểm kê thành công',
        `Đã lưu biên bản kiểm kê thiết bị ${selectedDevice.name} (SN: ${selectedDevice.serialNumber})`,
        'success',
        selectedDevice.serialNumber
      );

      // Refresh selection to see updated status
      const updatedDev = devices.find(d => d.id === selectedDevice.id);
      if (updatedDev) {
        setSelectedDevice({
          ...updatedDev,
          status: auditStatus
        });
      }
      
      setNotes('');
    } catch (err) {
      console.error(err);
      onAddToast('Lỗi ghi dữ liệu', 'Không thể lưu kết quả kiểm kê. Vui lòng thử lại.', 'error');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Search filter
  const filteredDevices = searchQuery.trim() === ''
    ? []
    : devices.filter(d => 
        d.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.serialNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
        d.location.room.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 5);

  const uncheckedList = devices
    .filter(d => !checkedDeviceIds.has(d.id))
    .slice(0, 6);

  return (
    <div id="inventory-module" className="space-y-6">
      {/* Page Title Header */}
      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200/80 shadow-sm">
        <div>
          <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-blue-600" />
            Kiểm Kê & Truy Xuất Hành Trình Thiết Bị
          </h2>
          <p className="text-slate-500 text-sm mt-1">
            Quét mã QR để tự động truy xuất nguồn gốc bàn giao, hành trình luân chuyển và thực hiện kiểm kê tại chỗ.
          </p>
        </div>
        
        <div className="flex flex-wrap items-center gap-3 print:hidden">
          <button
            onClick={() => {
              setIsPrintModalOpen(true);
              setPrintAuditorName(currentUser?.name || '');
            }}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-slate-800 text-white rounded-xl font-semibold hover:bg-slate-700 active:scale-95 transition shadow-md shadow-slate-200"
          >
            <FileText className="h-4 w-4 text-emerald-400" />
            In Báo Cáo Kiểm Kê
          </button>

          <button
            onClick={handleScanQR}
            className="flex items-center justify-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-500 active:scale-95 transition shadow-md shadow-blue-200"
          >
            <Camera className="h-4 w-4" />
            Quét QR Kiểm Kê
          </button>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-blue-50 text-blue-600 rounded-lg">
            <ClipboardList className="h-6 w-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Tổng Thiết Bị</p>
            <h3 className="text-2xl font-black text-slate-800 mt-1">{totalCount}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg">
            <CheckCircle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Đã Kiểm Kê ({currentYear})</p>
            <h3 className="text-2xl font-black text-emerald-600 mt-1">
              {checkedCount} 
              <span className="text-xs text-slate-400 font-medium ml-1.5">
                ({totalCount > 0 ? Math.round((checkedCount/totalCount)*100) : 0}%)
              </span>
            </h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-amber-50 text-amber-600 rounded-lg">
            <Clock className="h-6 w-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Chưa Kiểm Kê</p>
            <h3 className="text-2xl font-black text-amber-600 mt-1">{uncheckedCount}</h3>
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm flex items-center gap-4">
          <div className="p-3 bg-rose-50 text-rose-600 rounded-lg">
            <AlertTriangle className="h-6 w-6" />
          </div>
          <div>
            <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Lệch Vị Trí Thực Tế</p>
            <h3 className="text-2xl font-black text-rose-600 mt-1">{locationMismatches}</h3>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Left Column: Search & Device Selection */}
        <div className="space-y-6 lg:col-span-1">
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-base">Tìm kiếm nhanh thiết bị</h3>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 h-4 w-4" />
              <input
                type="text"
                placeholder="Nhập S/N, tên thiết bị hoặc phòng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            {/* Auto-suggest results */}
            {filteredDevices.length > 0 && (
              <div className="border border-slate-100 rounded-lg overflow-hidden divide-y divide-slate-100 shadow-inner bg-slate-50/50">
                {filteredDevices.map(dev => (
                  <button
                    key={dev.id}
                    onClick={() => handleDeviceSelect(dev)}
                    className="w-full text-left p-3 hover:bg-slate-100 flex items-center justify-between text-xs transition"
                  >
                    <div>
                      <p className="font-bold text-slate-800">{dev.name}</p>
                      <p className="text-blue-600 font-mono mt-0.5 font-semibold">SN: {dev.serialNumber}</p>
                    </div>
                    <span className="bg-slate-200/80 px-2 py-1 rounded text-[10px] text-slate-600 font-semibold font-sans">
                      {dev.location.lectureHall} - {dev.location.room}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {searchQuery && filteredDevices.length === 0 && (
              <div className="p-3 text-center text-xs text-slate-400 bg-slate-50 rounded-lg">
                Không tìm thấy kết quả phù hợp cho "{searchQuery}"
              </div>
            )}
          </div>

          {/* List of Unchecked Devices */}
          <div className="bg-white p-5 rounded-xl border border-slate-200/80 shadow-sm space-y-4">
            <h3 className="font-bold text-slate-800 text-sm flex items-center justify-between">
              <span>Cần kiểm kê gấp ({currentYear})</span>
              <span className="text-[11px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded font-bold">{uncheckedCount} còn lại</span>
            </h3>
            
            <div className="space-y-3 max-h-[360px] overflow-y-auto no-scrollbar">
              {uncheckedList.length === 0 ? (
                <div className="text-center py-6 text-slate-400 text-xs">
                  🎉 Toàn bộ thiết bị đã hoàn thành kiểm kê trong năm!
                </div>
              ) : (
                uncheckedList.map(dev => (
                  <div 
                    key={dev.id}
                    onClick={() => handleDeviceSelect(dev)}
                    className={`p-3 rounded-lg border text-xs cursor-pointer hover:border-blue-500 hover:bg-blue-50/20 transition flex items-start gap-2.5 ${
                      selectedDevice?.id === dev.id ? 'border-blue-500 bg-blue-50/40' : 'border-slate-100 bg-slate-50/30'
                    }`}
                  >
                    <div className="p-1.5 bg-amber-50 text-amber-600 rounded">
                      <Clock className="h-4.5 w-4.5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-800 truncate">{dev.name}</p>
                      <p className="text-[10px] text-blue-600 font-mono mt-0.5">SN: {dev.serialNumber}</p>
                      <div className="flex items-center gap-1 mt-1.5 text-slate-500 text-[10px]">
                        <MapPin className="h-3 w-3 shrink-0" />
                        <span className="truncate">{dev.location.lectureHall} - room {dev.location.room}</span>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Right Column: Detailed Timeline & Actions */}
        <div className="lg:col-span-2">
          {!selectedDevice ? (
            <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm p-12 text-center h-full flex flex-col items-center justify-center">
              <ClipboardList className="h-14 w-14 text-slate-300 mb-4 stroke-[1.5]" />
              <h4 className="font-bold text-slate-800 text-lg">Chưa có thiết bị nào được chọn</h4>
              <p className="text-slate-400 text-sm mt-1 max-w-sm mx-auto">
                Hãy sử dụng hộp tìm kiếm nhanh hoặc bấm nút <strong>Quét QR Kiểm Kê</strong> để xem nguồn gốc bàn giao và hành trình luân chuyển thiết bị.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              
              {/* Selected Device Information Cover */}
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="bg-slate-900 text-white p-5">
                  <div className="flex flex-wrap justify-between items-start gap-4">
                    <div className="flex-1 min-w-0">
                      <span className="text-[10px] font-bold text-blue-300 uppercase tracking-wider bg-blue-900/50 border border-blue-800 px-2 py-0.5 rounded">
                        {selectedDevice.category}
                      </span>
                      <h3 className="text-lg font-bold mt-1.5 truncate">{selectedDevice.name}</h3>
                      <p className="text-xs text-slate-400 font-mono mt-0.5">S/N: {selectedDevice.serialNumber}</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <div className="text-right hidden sm:block">
                        <p className="text-xs text-slate-400">Trạng thái hiện tại</p>
                        <span className={`inline-block mt-1 px-2.5 py-1 rounded text-xs font-bold capitalize ${
                          selectedDevice.status === 'active' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' :
                          selectedDevice.status === 'maintenance_needed' ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' :
                          selectedDevice.status === 'damaged' ? 'bg-rose-500/20 text-rose-400 border border-rose-500/30' :
                          'bg-slate-500/20 text-slate-400 border border-slate-500/30'
                        }`}>
                          {selectedDevice.status === 'active' ? 'Hoạt động tốt' :
                           selectedDevice.status === 'maintenance_needed' ? 'Cần bảo trì' :
                           selectedDevice.status === 'damaged' ? 'Hỏng hóc' :
                           selectedDevice.status === 'spare' ? 'Dự phòng' : 'Thanh lý'}
                        </span>
                      </div>
                      
                      <button
                        type="button"
                        onClick={() => {
                          setSelectedDevice(null);
                          if (onSelectDeviceFromApp) {
                            onSelectDeviceFromApp(null);
                          }
                        }}
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 hover:text-white transition border border-slate-700"
                        title="Đóng / Hủy chọn"
                      >
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>
                </div>

                <div className="p-5 grid grid-cols-2 md:grid-cols-4 gap-4 text-xs border-b border-slate-100">
                  <div>
                    <span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[9px] font-semibold">Đơn vị quản lý gốc</span>
                    <span className="font-bold text-slate-800">{selectedDevice.location.faculty}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[9px] font-semibold">Vị trí lắp đặt hiện tại</span>
                    <span className="font-bold text-slate-800 flex items-center gap-1">
                      <MapPin className="h-3 w-3 text-emerald-600 shrink-0" />
                      {selectedDevice.location.lectureHall} - room {selectedDevice.location.room}
                    </span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[9px] font-semibold">Ngày Đưa Vào SD</span>
                    <span className="font-bold text-slate-800">{formatDate(selectedDevice.purchaseDate)}</span>
                  </div>
                  <div>
                    <span className="text-slate-400 block mb-0.5 uppercase tracking-wider text-[9px] font-semibold">Nhà Cung Cấp</span>
                    <span className="font-bold text-slate-800 truncate block" title={selectedDevice.supplier}>{selectedDevice.supplier}</span>
                  </div>
                </div>

                {selectedDevice.specs && (
                  <div className="p-4 bg-slate-50 text-xs border-b border-slate-100">
                    <p className="font-semibold text-slate-700 flex items-center gap-1 mb-1">
                      <Info className="h-3.5 w-3.5 text-slate-500" />
                      Thông số kỹ thuật kỹ thuật gốc:
                    </p>
                    <p className="text-slate-600 font-medium whitespace-pre-line leading-relaxed pl-4.5">{selectedDevice.specs}</p>
                  </div>
                )}

                {/* Checked Status for current year */}
                <div className="p-4 bg-blue-50/50 text-xs flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <ShieldCheck className={`h-5 w-5 ${checkedDeviceIds.has(selectedDevice.id) ? 'text-emerald-600' : 'text-amber-500'}`} />
                    <div>
                      <p className="font-bold text-slate-800">
                        {checkedDeviceIds.has(selectedDevice.id) 
                          ? `Đã hoàn thành kiểm kê năm ${currentYear}`
                          : `Chưa kiểm kê trong năm ${currentYear}`}
                      </p>
                      {checkedDeviceIds.has(selectedDevice.id) && deviceInventories[0] && (
                        <p className="text-[10px] text-slate-500 mt-0.5">
                          Lần cuối: {formatDate(deviceInventories[0].inventoryDate)} bởi {deviceInventories[0].auditorName}
                        </p>
                      )}
                    </div>
                  </div>
                  
                  <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                    checkedDeviceIds.has(selectedDevice.id) ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800'
                  }`}>
                    {checkedDeviceIds.has(selectedDevice.id) ? 'Đã duyệt' : 'Chờ kiểm'}
                  </span>
                </div>
              </div>

              {/* TABS: Lifecycle timeline vs Perform Audit Form */}
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 bg-slate-50/50 p-2 flex gap-1">
                  <span className="text-xs font-bold text-slate-700 px-3 py-1.5 flex items-center gap-1.5">
                    <History className="h-4 w-4 text-blue-600" />
                    Hồ Sơ & Hành Trình Thiết Bị (Device Journey Timeline)
                  </span>
                </div>

                <div className="p-5">
                  <div className="relative border-l border-slate-200 pl-6 ml-3 space-y-8">
                    
                    {/* 1. Lịch sử kiểm kê gần nhất */}
                    {deviceInventories.map((inv, idx) => (
                      <div key={inv.id} className="relative">
                        {/* Bullet Icon */}
                        <span className="absolute -left-9.5 top-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 border border-emerald-200">
                          <Check className="h-4 w-4" />
                        </span>
                        
                        <div className="text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">Biên Bản Kiểm Kê Định Kỳ</span>
                            <span className="text-[10px] bg-slate-100 text-slate-500 font-mono px-1.5 py-0.5 rounded">
                              {formatDate(inv.inventoryDate)}
                            </span>
                          </div>
                          <p className="text-slate-500 mt-1">
                            Người kiểm kê: <strong className="text-slate-700">{inv.auditorName}</strong>
                          </p>
                          
                          <div className="mt-2 grid grid-cols-2 gap-2 p-2 bg-slate-50 rounded border border-slate-100">
                            <div>
                              <span className="text-[10px] text-slate-400 block">Tình trạng thực tế</span>
                              <span className="font-semibold text-slate-700 capitalize">
                                {inv.status === 'active' ? 'Hoạt động tốt' :
                                 inv.status === 'maintenance_needed' ? 'Cần bảo trì' :
                                 inv.status === 'damaged' ? 'Hỏng hóc' : 'Thất lạc/Hủy'}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-slate-400 block">Trạng thái vị trí</span>
                              <span className={`font-semibold ${inv.locationStatus === 'matched' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {inv.locationStatus === 'matched' ? '✓ Khớp vị trí' : '⚠ Lệch vị trí'}
                              </span>
                            </div>
                          </div>

                          {inv.notes && (
                            <p className="text-slate-600 mt-1.5 bg-yellow-50/50 p-2 rounded border border-yellow-100 italic">
                              "{inv.notes}"
                            </p>
                          )}
                        </div>
                      </div>
                    ))}

                    {/* 2. Lịch sử điều chuyển / thu hồi (Hành trình điều chuyển) */}
                    {deviceTransfers.map((trans) => (
                      <div key={trans.id} className="relative">
                        {/* Bullet Icon */}
                        <span className={`absolute -left-9.5 top-0.5 flex h-7 w-7 items-center justify-center rounded-full ${
                          trans.type === 'transfer' ? 'bg-blue-50 text-blue-600 border border-blue-200' : 'bg-amber-50 text-amber-600 border border-amber-200'
                        }`}>
                          {trans.type === 'transfer' ? <ArrowLeftRight className="h-3.5 w-3.5" /> : <Wrench className="h-3.5 w-3.5" />}
                        </span>

                        <div className="text-xs">
                          <div className="flex items-center justify-between">
                            <span className="font-bold text-slate-800">
                              {trans.type === 'transfer' ? 'Lệnh Điều Chuyển Thiết Bị' : 'Yêu Cầu Thu Hồi / Hoàn Kho'}
                            </span>
                            <span className="text-[10px] bg-slate-100 text-slate-500 font-mono px-1.5 py-0.5 rounded">
                              {formatDate(trans.transferDate)}
                            </span>
                          </div>
                          
                          <p className="text-slate-500 mt-1">
                            Biên bản số: <span className="font-mono font-bold text-slate-700">{trans.documentNumber || 'N/A'}</span>
                          </p>

                          {/* Route path */}
                          <div className="mt-2 p-2.5 bg-slate-50 rounded-lg border border-slate-100 flex items-center justify-between gap-1.5 text-center">
                            <div className="flex-1 text-left min-w-0">
                              <span className="text-[9px] text-slate-400 block uppercase font-bold">Nơi đi</span>
                              <span className="font-bold text-slate-700 truncate block">
                                {trans.fromLocation.lectureHall} - room {trans.fromLocation.room}
                              </span>
                            </div>
                            <ChevronRight className="h-4 w-4 text-slate-300 shrink-0 mt-2" />
                            <div className="flex-1 text-right min-w-0">
                              <span className="text-[9px] text-slate-400 block uppercase font-bold">Nơi đến</span>
                              <span className="font-bold text-blue-700 truncate block">
                                {trans.toLocation.lectureHall} - room {trans.toLocation.room}
                              </span>
                            </div>
                          </div>

                          <div className="mt-2 space-y-1 text-slate-600">
                            <p>
                              Lý do: <span className="font-medium text-slate-700">{trans.reason}</span>
                            </p>
                            <p>
                              Bàn giao bởi: <span className="font-semibold text-slate-700">{trans.performedBy}</span>
                              {trans.receiverName && <> ➔ Tiếp nhận: <span className="font-semibold text-slate-700">{trans.receiverName}</span></>}
                            </p>
                            {trans.conditionAtTransfer && (
                              <p className="text-[10px] text-slate-500">
                                Tình trạng lúc bàn giao: <span className="italic">{trans.conditionAtTransfer}</span>
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}

                    {/* 3. Điểm khởi nguồn - Cấp bàn giao ban đầu */}
                    <div className="relative">
                      {/* Bullet Icon */}
                      <span className="absolute -left-9.5 top-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-blue-800 border border-blue-300 shadow-sm">
                        <FileText className="h-3.5 w-3.5" />
                      </span>

                      <div className="text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-blue-900 uppercase tracking-wide">Cấp bàn giao & Đưa vào sử dụng</span>
                          <span className="text-[10px] bg-blue-50 text-blue-700 font-mono font-bold px-1.5 py-0.5 rounded">
                            Khởi Tạo
                          </span>
                        </div>
                        <p className="text-slate-500 mt-1">
                          Ngày tiếp nhận: <strong className="text-slate-700">{formatDate(selectedDevice.purchaseDate)}</strong>
                        </p>
                        <p className="text-slate-600 mt-1 leading-relaxed">
                          Nhập kho và bàn giao ban đầu bởi phòng Cơ sở vật chất cho đơn vị khoa <strong className="text-slate-800">{selectedDevice.location.faculty}</strong>. Thiết bị chính hãng, phân phối bởi <strong className="text-slate-800">{selectedDevice.supplier}</strong>, bảo hành chính hãng đến hết {formatDate(selectedDevice.warrantyUntil)}.
                        </p>
                      </div>
                    </div>

                  </div>
                </div>
              </div>

              {/* ACTION FORM: Lập biên bản kiểm kê tại chỗ */}
              <div className="bg-white rounded-xl border border-slate-200/80 shadow-sm overflow-hidden">
                <div className="border-b border-slate-100 bg-blue-50/20 p-4">
                  <h3 className="font-bold text-blue-950 text-sm flex items-center gap-1.5">
                    <UserCheck className="h-5 w-5 text-blue-600" />
                    Lập Phiếu Kiểm Kê Thực Tế Tại Chỗ
                  </h3>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Ghi nhận trực tiếp tình trạng hiện tại của thiết bị để đồng bộ hệ thống.
                  </p>
                </div>

                <form onSubmit={handleSubmitAudit} className="p-5 space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Ngày kiểm kê */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                        Ngày kiểm kê thực tế
                      </label>
                      <input
                        type="date"
                        value={inventoryDate}
                        onChange={(e) => setInventoryDate(e.target.value)}
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        required
                      />
                    </div>

                    {/* Người kiểm kê */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                        Cán bộ thực hiện kiểm kê
                      </label>
                      <input
                        type="text"
                        value={auditorName}
                        onChange={(e) => setAuditorName(e.target.value)}
                        placeholder="Nhập tên người kiểm kê..."
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
                        required
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    
                    {/* Tình trạng thực tế */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                        Đánh giá tình trạng kỹ thuật thực tế
                      </label>
                      <select
                        value={auditStatus}
                        onChange={(e) => setAuditStatus(e.target.value as DeviceStatus)}
                        className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                      >
                        <option value="active">✓ Hoạt động bình thường (Sẵn sàng SD)</option>
                        <option value="maintenance_needed">⚠ Cần bảo dưỡng / bảo trì định kỳ</option>
                        <option value="damaged">🚨 Hỏng hóc cần sửa chữa gấp</option>
                        <option value="spare">📦 Dự phòng trong kho</option>
                        <option value="decommissioned">❌ Đã thanh lý / hỏng hoàn toàn</option>
                      </select>
                    </div>

                    {/* Vị trí lắp đặt khớp không */}
                    <div>
                      <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                        Xác nhận vị trí lắp đặt
                      </label>
                      <div className="flex gap-4 mt-1">
                        <label className="flex items-center gap-1.5 text-xs text-slate-700 cursor-pointer">
                          <input
                            type="radio"
                            name="locationStatus"
                            checked={locationStatus === 'matched'}
                            onChange={() => setLocationStatus('matched')}
                            className="text-blue-600 focus:ring-blue-500"
                          />
                          <span>Khớp với hệ thống</span>
                        </label>
                        <label className="flex items-center gap-1.5 text-xs text-rose-700 cursor-pointer">
                          <input
                            type="radio"
                            name="locationStatus"
                            checked={locationStatus === 'mismatched'}
                            onChange={() => setLocationStatus('mismatched')}
                            className="text-rose-600 focus:ring-rose-500"
                          />
                          <span className="font-semibold">Bị lệch vị trí thực tế!</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  {locationStatus === 'mismatched' && (
                    <div className="p-3 bg-rose-50 text-rose-800 text-xs rounded-lg border border-rose-100 flex items-start gap-2 animate-fadeIn">
                      <AlertTriangle className="h-4.5 w-4.5 shrink-0 text-rose-600 mt-0.5" />
                      <div>
                        <p className="font-bold">Cảnh báo: Thiết bị đang không ở đúng phòng giảng đường!</p>
                        <p className="text-[11px] mt-0.5 leading-relaxed">
                          Hệ thống ghi nhận vị trí lắp đặt ở phòng <strong>{selectedDevice.location.room} ({selectedDevice.location.lectureHall})</strong>. Hãy ghi chi tiết vị trí hiện tại thực tế ở ô ghi chú phía dưới để phòng CSVC tiến hành làm thủ tục cập nhật hoặc trả thiết bị về đúng chỗ.
                        </p>
                      </div>
                    </div>
                  )}

                  {/* Ghi chú */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-500 mb-1.5">
                      Ghi chú chi tiết kết quả kiểm kê
                    </label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder={locationStatus === 'mismatched' ? "Ghi rõ vị trí tìm thấy thực tế của thiết bị... Ví dụ: Thiết bị được chuyển sang phòng B302 để sử dụng tạm thời." : "Ghi nhận hiện trạng, số sê-ri bóng đèn, chất lượng hiển thị/âm thanh, phụ kiện đi kèm..."}
                      className="w-full text-xs px-3 py-2 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500 h-20"
                    />
                  </div>

                  {/* Cancel & Submit Button */}
                  <div className="flex justify-end gap-3 pt-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedDevice(null);
                        if (onSelectDeviceFromApp) {
                          onSelectDeviceFromApp(null);
                        }
                      }}
                      className="px-5 py-2.5 rounded-xl text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 active:scale-95 transition border border-slate-200"
                    >
                      Hủy chọn thiết bị
                    </button>
                    
                    <button
                      type="submit"
                      disabled={isSubmitting}
                      className={`px-5 py-2.5 rounded-xl text-xs font-bold text-white transition shadow active:scale-95 flex items-center gap-2 ${
                        isSubmitting ? 'bg-slate-400' : 'bg-blue-600 hover:bg-blue-500'
                      }`}
                    >
                      {isSubmitting ? 'Đang lưu...' : 'Lưu kết quả kiểm kê'}
                    </button>
                  </div>
                </form>
              </div>

            </div>
          )}
        </div>

      </div>

      {/* Print Inventory Report Modal */}
      {isPrintModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 sm:p-4 animate-fade-in print:p-0 print:bg-white print:relative print:inset-auto">
          <div className="bg-white w-full max-w-4xl rounded-2xl border border-slate-200 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden print:border-none print:shadow-none print:max-h-none print:overflow-visible">
            
            {/* Modal Controls - Hidden when printing */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 print:hidden">
              <div>
                <h3 className="font-bold text-slate-900 text-base">In Báo Cáo Kiểm Kê Định Kỳ</h3>
                <p className="text-xs text-slate-500 mt-0.5">Tải phiếu hoặc in biên bản kiểm kê thiết bị bàn giao theo từng đơn vị.</p>
              </div>
              <button
                onClick={() => setIsPrintModalOpen(false)}
                className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-500 hover:text-slate-800 transition"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Config controls - Hidden when printing */}
            <div className="p-5 border-b border-slate-100 bg-slate-50/20 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs print:hidden">
              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">Chọn Đơn vị (Khoa):</label>
                <select
                  value={printFaculty}
                  onChange={(e) => setPrintFaculty(e.target.value)}
                  className="w-full border border-slate-200 rounded-lg p-2 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  {FACULTIES.map(fac => (
                    <option key={fac} value={fac}>{fac}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">Bộ lọc danh sách thiết bị:</label>
                <select
                  value={printFilterType}
                  onChange={(e) => setPrintFilterType(e.target.value as any)}
                  className="w-full border border-slate-200 rounded-lg p-2 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                >
                  <option value="all">In tất cả thiết bị của đơn vị</option>
                  <option value="checked">Chỉ các thiết bị đã kiểm kê</option>
                  <option value="unchecked">Chỉ các thiết bị chưa kiểm kê</option>
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">Năm kiểm kê:</label>
                <input
                  type="number"
                  value={printYear}
                  onChange={(e) => setPrintYear(parseInt(e.target.value) || new Date().getFullYear())}
                  className="w-full border border-slate-200 rounded-lg p-2 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">Cán bộ thực hiện kiểm kê:</label>
                <input
                  type="text"
                  value={printAuditorName}
                  onChange={(e) => setPrintAuditorName(e.target.value)}
                  placeholder="Họ tên cán bộ..."
                  className="w-full border border-slate-200 rounded-lg p-2 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">Đại diện Phòng CSVC:</label>
                <input
                  type="text"
                  value={printFacilitiesRep}
                  onChange={(e) => setPrintFacilitiesRep(e.target.value)}
                  placeholder="Đại diện phòng CSVC..."
                  className="w-full border border-slate-200 rounded-lg p-2 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>

              <div className="space-y-1.5">
                <label className="block font-bold text-slate-700">Đại diện Đơn vị được kiểm kê:</label>
                <input
                  type="text"
                  value={printFacultyRep}
                  onChange={(e) => setPrintFacultyRep(e.target.value)}
                  placeholder="Trưởng đơn vị..."
                  className="w-full border border-slate-200 rounded-lg p-2 bg-white font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20"
                />
              </div>
            </div>

            {/* Printable Document Area */}
            <div className="flex-1 overflow-y-auto p-8 bg-slate-50 print:bg-white print:overflow-visible print:p-0">
              <div 
                id="inventory-print-document"
                className="print-document bg-white p-8 rounded-xl border border-slate-200 shadow-sm mx-auto max-w-[210mm] min-h-[297mm] text-slate-900 space-y-6 print:border-none print:shadow-none print:p-0 print:m-0"
                style={{ fontFamily: '"Times New Roman", Times, serif' }}
              >
                
                {/* National Header & Institution Header identical to handover document */}
                <div className="flex flex-col sm:flex-row justify-center items-center sm:items-start text-center border-b border-slate-300 pb-5 gap-8 sm:gap-16">
                  <div className="flex items-center gap-3">
                    <DUELogo size="lg" className="h-14 w-14 flex-shrink-0" />
                    <div className="text-center space-y-0.5">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-900">TRƯỜNG ĐẠI HỌC KINH TẾ</p>
                      <p className="text-xs font-bold text-slate-900 uppercase underline underline-offset-4">PHÒNG CƠ SỞ VẬT CHẤT</p>
                      <p className="text-[10px] text-slate-500 font-bold mt-1">Số: .../BBKK-CSVC</p>
                    </div>
                  </div>

                  <div className="text-center space-y-0.5">
                    <p className="text-xs font-bold uppercase text-slate-900 tracking-wider">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                    <p className="text-xs font-bold text-slate-900 underline underline-offset-4">Độc lập - Tự do - Hạnh phúc</p>
                    <p className="text-[10px] text-slate-500 italic pt-1">Đà Nẵng, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}</p>
                  </div>
                </div>

                {/* Document Title */}
                <div className="text-center space-y-1">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
                    BIÊN BẢN KIỂM KÊ THIẾT BỊ
                  </h2>
                  <p className="text-sm font-bold text-slate-700">Năm {printYear}</p>
                  <p className="text-xs italic text-slate-500">
                    (V/v: Kiểm tra hiện trạng, vị trí lắp đặt và tình trạng kỹ thuật thực tế của trang thiết bị)
                  </p>
                </div>

                {/* Info block */}
                <div className="space-y-2 text-xs text-slate-800 leading-relaxed bg-slate-50 p-4 rounded-xl border border-slate-200">
                  <p className="font-bold text-slate-900">- Căn cứ Quy chế quản lý tài sản công Trường Đại học Kinh tế - ĐHĐN;</p>
                  <p className="font-bold text-slate-900">- Thực hiện kế hoạch kiểm kê tài sản, trang thiết bị định kỳ năm {printYear};</p>
                  <p className="italic text-slate-600 mt-2">
                    Hôm nay, Ban kiểm kê tài sản gồm đại diện phòng Cơ sở vật chất phối hợp cùng đại diện đơn vị sử dụng tiến hành kiểm kê thực tế trang thiết bị được giao quản lý tại đơn vị: <strong>{printFaculty}</strong>
                  </p>
                </div>

                {/* Participating parties section */}
                <div className="text-xs space-y-3">
                  <p className="font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1">I. THÀNH PHẦN THAM GIA KIỂM KÊ:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-lg">
                      <p className="font-semibold text-blue-900">1. Đại diện Cán bộ kiểm kê:</p>
                      <p className="mt-1">Ông/Bà: <strong>{printAuditorName || '................................'}</strong></p>
                      <p className="text-slate-500">Chức vụ: Cán bộ kiểm kê</p>
                    </div>
                    <div className="p-3 bg-purple-50/50 border border-purple-100 rounded-lg">
                      <p className="font-semibold text-purple-900">2. Đại diện Phòng CSVC:</p>
                      <p className="mt-1">Ông/Bà: <strong>{printFacilitiesRep || '................................'}</strong></p>
                      <p className="text-slate-500">Chức vụ: Phó Trưởng Phòng CSVC</p>
                    </div>
                    <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-lg">
                      <p className="font-semibold text-emerald-900">3. Đại diện Đơn vị được kiểm kê:</p>
                      <p className="mt-1">Ông/Bà: <strong>{printFacultyRep || '................................'}</strong></p>
                      <p className="text-slate-500">Chức vụ: Đại diện {printFaculty}</p>
                    </div>
                  </div>
                </div>

                {/* Table of Inventory Devices */}
                <div className="space-y-3 pt-2">
                  <p className="font-bold text-slate-900 uppercase tracking-wide">II. KẾT QUẢ KIỂM KÊ CHI TIẾT:</p>
                  <div className="overflow-x-auto rounded-lg border border-slate-300">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="p-2 border-b border-r border-slate-300 w-10 text-center">STT</th>
                          <th className="p-2 border-b border-r border-slate-300 min-w-[140px]">Tên thiết bị & Nhãn hiệu</th>
                          <th className="p-2 border-b border-r border-slate-300">Mã Serial (S/N)</th>
                          <th className="p-2 border-b border-r border-slate-300">Vị trí phòng hệ thống</th>
                          <th className="p-2 border-b border-r border-slate-300 text-center">Tình trạng kỹ thuật thực tế</th>
                          <th className="p-2 border-b border-r border-slate-300 text-center">Xác nhận vị trí</th>
                          <th className="p-2 border-b border-slate-300">Ghi chú kiểm kê</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300 text-[11px]">
                        {(() => {
                          const facultyDevices = devices.filter(d => d.location.faculty === printFaculty);
                          
                          const list = facultyDevices.map((dev, idx) => {
                            // Find matching inventory record in selected year
                            const inv = inventories
                              .filter(i => i.deviceId === dev.id && new Date(i.inventoryDate).getFullYear() === printYear)
                              .sort((a, b) => b.inventoryDate.localeCompare(a.inventoryDate))[0];

                            return { dev, inv };
                          }).filter(item => {
                            if (printFilterType === 'checked') return !!item.inv;
                            if (printFilterType === 'unchecked') return !item.inv;
                            return true;
                          });

                          if (list.length === 0) {
                            return (
                              <tr>
                                <td colSpan={7} className="p-6 text-center text-slate-400 italic">
                                  Không tìm thấy thiết bị nào khớp với bộ lọc kiểm kê.
                                </td>
                              </tr>
                            );
                          }

                          return list.map((item, idx) => {
                            const { dev, inv } = item;
                            return (
                              <tr key={dev.id} className="hover:bg-slate-50/50">
                                <td className="p-2 border-r border-slate-300 text-center font-semibold">{idx + 1}</td>
                                <td className="p-2 border-r border-slate-300 font-bold text-slate-900">{dev.name}</td>
                                <td className="p-2 border-r border-slate-300 font-bold text-blue-700">{dev.serialNumber}</td>
                                <td className="p-2 border-r border-slate-300">{dev.location.lectureHall} - {dev.location.room}</td>
                                <td className="p-2 border-r border-slate-300 text-center">
                                  {inv ? (
                                    <span className={`font-semibold ${
                                      inv.status === 'active' ? 'text-emerald-700' :
                                      inv.status === 'maintenance_needed' ? 'text-amber-700' :
                                      'text-rose-700'
                                    }`}>
                                      {inv.status === 'active' ? 'Hoạt động bình thường' :
                                       inv.status === 'maintenance_needed' ? 'Cần bảo trì' :
                                       inv.status === 'damaged' ? 'Hỏng hóc' :
                                       inv.status === 'spare' ? 'Dự phòng' : 'Đã thanh lý'}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 italic">Chưa kiểm kê</span>
                                  )}
                                </td>
                                <td className="p-2 border-r border-slate-300 text-center">
                                  {inv ? (
                                    <span className={`font-bold ${inv.locationStatus === 'matched' ? 'text-emerald-600' : 'text-rose-600'}`}>
                                      {inv.locationStatus === 'matched' ? '✓ Khớp' : '⚠ Lệch'}
                                    </span>
                                  ) : (
                                    <span className="text-slate-400">-</span>
                                  )}
                                </td>
                                <td className="p-2 text-slate-600">
                                  {inv ? (
                                    inv.notes || 'Bình thường'
                                  ) : (
                                    <span className="text-slate-400">Đợi cán bộ kiểm tra...</span>
                                  )}
                                </td>
                              </tr>
                            );
                          });
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Final Notes */}
                <div className="text-xs text-slate-800 space-y-1 pt-2 leading-relaxed">
                  <p className="font-bold uppercase text-slate-900">III. KẾT LUẬN & KIẾN NGHỊ BAN KIỂM KÊ:</p>
                  <p className="italic">- Ban kiểm kê đã đối chiếu thực tế số lượng, chất lượng và mã Serial Number trùng khớp với hồ sơ lưu giữ.</p>
                  <p className="italic">- Đề xuất sửa chữa, bảo dưỡng kịp thời các thiết bị báo hỏng để chuẩn bị tốt nhất cho năm học mới.</p>
                  <p className="italic">- Biên bản được lập thành 03 bản có giá trị pháp lý như nhau, mỗi bên giữ 01 bản để theo dõi quản lý.</p>
                </div>

                {/* Sign-off Footers */}
                <div className="grid grid-cols-3 gap-4 text-center text-xs pt-10 pb-16">
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900 uppercase">CÁN BỘ KIỂM KÊ</p>
                    <p className="text-[10px] text-slate-500 italic">(Ký, ghi rõ họ tên)</p>
                    <div className="h-16"></div>
                    <p className="font-bold text-slate-900">{printAuditorName || '................................'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="font-bold text-slate-900 uppercase">KT. TRƯỞNG PHÒNG CSVC</p>
                    <p className="text-[10px] text-slate-500 italic">(Ký, ghi rõ họ tên)</p>
                    <div className="h-16"></div>
                    <p className="font-bold text-slate-900">{printFacilitiesRep || '................................'}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="font-bold text-slate-900 uppercase">ĐẠI DIỆN ĐƠN VỊ ĐƯỢC KIỂM KÊ</p>
                    <p className="text-[10px] text-slate-500 italic">(Ký, ghi rõ họ tên)</p>
                    <div className="h-16"></div>
                    <p className="font-bold text-slate-900">{printFacultyRep || '................................'}</p>
                  </div>
                </div>

              </div>
            </div>

            {/* Modal Actions Footer - Hidden when printing */}
            <div className="p-5 border-t border-slate-100 bg-slate-50 flex justify-end gap-3 print:hidden">
              <button
                type="button"
                onClick={() => setIsPrintModalOpen(false)}
                className="px-5 py-2.5 rounded-xl text-xs font-semibold text-slate-700 bg-white hover:bg-slate-100 border border-slate-200 transition"
              >
                Đóng lại
              </button>
              <button
                type="button"
                onClick={() => exportToWord('inventory-print-document', `Bien-ban-kiem-ke-${printFaculty}-${printYear}`)}
                className="px-5 py-2.5 rounded-xl text-xs font-bold border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 transition shadow-xs flex items-center gap-2"
              >
                <FileText className="h-4 w-4" />
                Xuất File Word
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-blue-600 hover:bg-blue-500 transition shadow flex items-center gap-2"
              >
                <Printer className="h-4 w-4" />
                Tiến hành in biên bản
              </button>
            </div>

          </div>
        </div>
      )}
    </div>
  );
};
