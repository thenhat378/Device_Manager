import React, { useState, useEffect } from 'react';
import { Device, DeviceTransferRecord, DeviceTransferType, User } from '../types';
import { FACULTIES, LECTURE_HALLS } from '../data/mockData';
import { formatDate, exportToWord } from '../utils';
import { DUELogo } from './DUELogo';
import { 
  ArrowLeftRight, 
  Archive, 
  Search, 
  Filter, 
  Plus, 
  Camera, 
  MapPin, 
  Calendar, 
  FileText, 
  User as UserIcon, 
  CheckCircle2, 
  Building2, 
  History, 
  Printer, 
  Sparkles, 
  HelpCircle,
  Clock,
  ChevronRight,
  ShieldCheck,
  Tag,
  X
} from 'lucide-react';

interface DeviceTransferManagementProps {
  devices: Device[];
  transfers: DeviceTransferRecord[];
  currentUser: User | null;
  onAddTransfer: (transfer: Omit<DeviceTransferRecord, 'id' | 'createdAt'>) => void;
  onOpenScanner: (callback: (sn: string) => void) => void;
  initialSelectedDeviceId?: string | null;
}

export const DeviceTransferManagement: React.FC<DeviceTransferManagementProps> = ({
  devices,
  transfers,
  currentUser,
  onAddTransfer,
  onOpenScanner,
  initialSelectedDeviceId
}) => {
  const [activeView, setActiveView] = useState<'history' | 'timeline'>('history');
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [filterLectureHall, setFilterLectureHall] = useState<string>('ALL');
  const [selectedDeviceForTimeline, setSelectedDeviceForTimeline] = useState<string>('ALL');

  // Modal State for New Transfer / Recall
  const [isModalOpen, setIsModalOpen] = useState(!!initialSelectedDeviceId);
  const [transferType, setTransferType] = useState<DeviceTransferType>('transfer');
  
  // Selected device IDs in form
  const [selectedDeviceIds, setSelectedDeviceIds] = useState<string[]>(
    initialSelectedDeviceId ? [initialSelectedDeviceId] : []
  );

  // Search filter for device selection inside the form modal
  const [deviceSearchText, setDeviceSearchText] = useState('');

  // Form Fields
  const [targetFaculty, setTargetFaculty] = useState<string>('Phòng Cơ Sở Vật Chất');
  const [targetLectureHall, setTargetLectureHall] = useState<string>(LECTURE_HALLS[0]);
  const [targetRoom, setTargetRoom] = useState<string>('Phòng A101');
  const [reason, setReason] = useState<string>('');
  const [transferDate, setTransferDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [performedBy, setPerformedBy] = useState<string>(currentUser?.name || 'Trần Kỹ Thuật');
  const [receiverName, setReceiverName] = useState<string>('Cán Bộ Tiếp Nhận Giảng Đường');
  const [documentNumber, setDocumentNumber] = useState<string>(`BB-DC-${new Date().getFullYear()}/${(new Date().getMonth() + 1).toString().padStart(2, '0')}-${Math.floor(100 + Math.random() * 900)}`);
  const [conditionAtTransfer, setConditionAtTransfer] = useState<string>('Thiết bị hoạt động bình thường');
  const [notes, setNotes] = useState<string>('');

  // Print Handover Document Modal
  const [printingTransfer, setPrintingTransfer] = useState<DeviceTransferRecord | null>(null);
  const [printFacultyFilter, setPrintFacultyFilter] = useState<string>('ALL');

  // Aggregated Print Modal State
  const [isAggregatedPrintOpen, setIsAggregatedPrintOpen] = useState(false);
  const [aggFaculty, setAggFaculty] = useState<string>(FACULTIES[0]);
  const [aggDate, setAggDate] = useState<string>(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  });
  const [aggFilterByDate, setAggFilterByDate] = useState<boolean>(false);
  const [aggType, setAggType] = useState<DeviceTransferType>('transfer');
  const [aggDocNumber, setAggDocNumber] = useState<string>('');
  const [aggPerformedBy, setAggPerformedBy] = useState<string>(currentUser?.name || 'Cán bộ phòng CSVC');
  const [aggReceiverName, setAggReceiverName] = useState<string>('Đại diện đơn vị');
  const [aggReason, setAggReason] = useState<string>('Điều chuyển thiết bị kỹ thuật phục vụ công tác giảng dạy');
  const [aggNotes, setAggNotes] = useState<string>('Bản giao nhận được lập thành 02 bản, có giá trị pháp lý như nhau.');
  const [aggSelectedTransferIds, setAggSelectedTransferIds] = useState<string[]>([]);
  const [lastFilterKey, setLastFilterKey] = useState<string>('');

  // Find matching transfers for aggregated print
  const matchingAggTransfers = transfers.filter(t => {
    const isSameDate = !aggFilterByDate || t.transferDate === aggDate;
    const isSameType = t.type === aggType;
    const isFacultyMatch = aggType === 'transfer' 
      ? t.toLocation.faculty === aggFaculty 
      : t.fromLocation.faculty === aggFaculty;
    return isSameDate && isSameType && isFacultyMatch;
  });

  // Automatically select matching transfers when filters change
  useEffect(() => {
    if (isAggregatedPrintOpen) {
      const currentFilterKey = `${aggFaculty}_${aggDate}_${aggFilterByDate}_${aggType}_${isAggregatedPrintOpen}_${matchingAggTransfers.map(t => t.id).join(',')}`;
      if (currentFilterKey !== lastFilterKey) {
        setLastFilterKey(currentFilterKey);
        const ids = matchingAggTransfers.map(t => t.id);
        setAggSelectedTransferIds(ids);
        
        // Attempt to inherit documentNumber, reason, receiverName, performedBy from first match
        if (matchingAggTransfers.length > 0) {
          const first = matchingAggTransfers[0];
          if (first.documentNumber) setAggDocNumber(first.documentNumber);
          if (first.reason) setAggReason(first.reason);
          if (first.receiverName) setAggReceiverName(first.receiverName);
          if (first.performedBy) setAggPerformedBy(first.performedBy);
        } else {
          // Fallback defaults
          const prefix = aggType === 'transfer' ? 'BB-DC' : 'BB-TH';
          const month = aggDate.split('-')[1] || '01';
          const rand = Math.floor(100 + Math.random() * 900);
          setAggDocNumber(`${prefix}-${aggDate.split('-')[0]}/${month}-${rand}`);
          setAggReason(aggType === 'transfer' ? 'Điều chuyển thiết bị kỹ thuật phục vụ công tác giảng dạy' : 'Thu hồi thiết bị về kho bảo dưỡng định kỳ');
          setAggReceiverName(aggType === 'transfer' ? 'Đại diện Đơn vị' : 'Đại diện Phòng CSVC');
        }
      }
    } else if (lastFilterKey !== '') {
      setLastFilterKey('');
    }
  }, [aggFaculty, aggDate, aggFilterByDate, aggType, isAggregatedPrintOpen, matchingAggTransfers, lastFilterKey]);

  useEffect(() => {
    if (printingTransfer) {
      setPrintFacultyFilter('ALL');
    }
  }, [printingTransfer]);

  // Synchronize when initialSelectedDeviceId changes (e.g. from single-device action in device management)
  useEffect(() => {
    if (initialSelectedDeviceId) {
      setSelectedDeviceIds([initialSelectedDeviceId]);
      setIsModalOpen(true);
    }
  }, [initialSelectedDeviceId]);

  // Selected Device object (for fallback or single item info representation)
  const currentSelectedDevice = devices.find(d => selectedDeviceIds.includes(d.id)) || devices[0];

  const handleScanDevice = () => {
    onOpenScanner((scannedSn) => {
      const match = devices.find(d => d.serialNumber.toLowerCase() === scannedSn.toLowerCase() || d.id === scannedSn);
      if (match) {
        if (!selectedDeviceIds.includes(match.id)) {
          setSelectedDeviceIds(prev => [...prev, match.id]);
        }
      } else {
        alert(`Không tìm thấy thiết bị nào có mã SN: "${scannedSn}" trong hệ thống.`);
      }
    });
  };

  const handleTypeSwitch = (type: DeviceTransferType) => {
    setTransferType(type);
    if (type === 'recall') {
      setTargetFaculty('Phòng Cơ sở vật chất');
      setTargetLectureHall('Kho Trung tâm CSVC');
      setTargetRoom('Kho Bật Kỹ thuật A00');
      if (!reason) setReason('Thu hồi về kho Phòng Cơ sở vật chất để phục vụ kiểm kê, bảo dưỡng và điều phối lại');
    } else {
      setTargetFaculty(FACULTIES[0]);
      setTargetLectureHall(LECTURE_HALLS[0]);
      setTargetRoom('Phòng A101');
      if (reason.includes('Thu hồi')) setReason('');
    }
  };

  const generateAutoDocNumber = () => {
    const prefix = transferType === 'transfer' ? 'BB-DC' : 'BB-TH';
    const month = (new Date().getMonth() + 1).toString().padStart(2, '0');
    const rand = Math.floor(100 + Math.random() * 900);
    setDocumentNumber(`${prefix}-${new Date().getFullYear()}/${month}-${rand}`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedDeviceIds.length === 0) {
      alert('Vui lòng chọn ít nhất một thiết bị cần điều chuyển / thu hồi');
      return;
    }
    if (!reason.trim()) {
      alert('Vui lòng nhập lý do điều chuyển / thu hồi thiết bị');
      return;
    }

    // Check if any selected device is already in the target faculty (unit)
    const alreadyThereDevices: string[] = [];
    for (const devId of selectedDeviceIds) {
      const dev = devices.find(d => d.id === devId);
      if (dev && dev.location.faculty === targetFaculty) {
        alreadyThereDevices.push(`${dev.name} (Mã SN: ${dev.serialNumber})`);
      }
    }

    if (alreadyThereDevices.length > 0) {
      const actionText = transferType === 'transfer' ? 'điều chuyển' : 'thu hồi';
      alert(
        `Không thể thực hiện! Thiết bị sau đã được ${actionText} / hiện đang ở đơn vị "${targetFaculty}" rồi:\n` +
        alreadyThereDevices.join('\n')
      );
      return;
    }

    // Process all selected device transfers sequentially
    for (const devId of selectedDeviceIds) {
      const dev = devices.find(d => d.id === devId);
      if (!dev) continue;

      onAddTransfer({
        deviceId: dev.id,
        deviceSn: dev.serialNumber,
        deviceName: dev.name,
        type: transferType,
        fromLocation: { ...dev.location },
        toLocation: {
          faculty: targetFaculty,
          lectureHall: targetLectureHall,
          room: targetRoom
        },
        reason: reason.trim(),
        transferDate,
        performedBy: performedBy.trim() || currentUser?.name || 'Kỹ thuật viên',
        receiverName: receiverName.trim(),
        documentNumber: documentNumber.trim(),
        conditionAtTransfer: conditionAtTransfer.trim(),
        notes: notes.trim()
      });
    }

    setIsModalOpen(false);
    // Reset defaults
    setSelectedDeviceIds([]);
    setReason('');
    setNotes('');
  };

  // Filtered History
  const filteredTransfers = transfers.filter(tr => {
    const query = searchQuery.toLowerCase().trim();
    const matchesSearch = 
      tr.deviceName.toLowerCase().includes(query) ||
      tr.deviceSn.toLowerCase().includes(query) ||
      (tr.documentNumber && tr.documentNumber.toLowerCase().includes(query)) ||
      tr.reason.toLowerCase().includes(query) ||
      tr.fromLocation.faculty.toLowerCase().includes(query) ||
      tr.fromLocation.room.toLowerCase().includes(query) ||
      tr.fromLocation.lectureHall.toLowerCase().includes(query) ||
      tr.toLocation.faculty.toLowerCase().includes(query) ||
      tr.toLocation.room.toLowerCase().includes(query) ||
      tr.toLocation.lectureHall.toLowerCase().includes(query) ||
      (tr.performedBy && tr.performedBy.toLowerCase().includes(query)) ||
      (tr.receiverName && tr.receiverName.toLowerCase().includes(query));
    
    const matchesType = filterType === 'ALL' || tr.type === filterType;
    const matchesLectureHall = filterLectureHall === 'ALL' || 
      tr.fromLocation.lectureHall === filterLectureHall || 
      tr.toLocation.lectureHall === filterLectureHall;

    return matchesSearch && matchesType && matchesLectureHall;
  });

  // Calculate statistics
  const totalTransfersCount = transfers.filter(t => t.type === 'transfer').length;
  const totalRecallsCount = transfers.filter(t => t.type === 'recall').length;
  const uniqueDevicesMoved = new Set(transfers.map(t => t.deviceId)).size;

  return (
    <div className="space-y-6 animate-fade-in pb-12">
      
      {/* Page Title & Stats Bar */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-5 rounded-2xl shadow-sm border border-slate-200/80">
        <div>
          <h2 className="text-xl font-bold text-slate-800 flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-blue-50 text-blue-600 border border-blue-100">
              <ArrowLeftRight className="h-6 w-6" />
            </div>
            <span>Quản Lý Điều Chuyển & Thu Hồi Thiết Bị</span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Theo dõi chi tiết hành trình luân chuyển, bàn giao và truy xuất nguồn gốc thiết bị giảng đường
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-wrap items-center gap-2.5">
          <button
            onClick={() => {
              handleTypeSwitch('transfer');
              setSelectedDeviceIds([]);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-blue-600 hover:bg-blue-700 px-4 py-2.5 text-xs font-bold text-white transition shadow-sm active:scale-95"
          >
            <Plus className="h-4 w-4" />
            <span>Lập Lệnh Điều Chuyển</span>
          </button>

          <button
            onClick={() => {
              handleTypeSwitch('recall');
              setSelectedDeviceIds([]);
              setIsModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl bg-amber-600 hover:bg-amber-700 px-4 py-2.5 text-xs font-bold text-white transition shadow-sm active:scale-95"
          >
            <Archive className="h-4 w-4" />
            <span>Thu Hồi Về Kho</span>
          </button>

          <button
            onClick={() => setIsAggregatedPrintOpen(true)}
            className="flex items-center gap-2 rounded-xl bg-indigo-600 hover:bg-indigo-700 px-4 py-2.5 text-xs font-bold text-white transition shadow-sm active:scale-95"
          >
            <Printer className="h-4 w-4" />
            <span>In Biên Bản Tổng Hợp</span>
          </button>
        </div>
      </div>

      {/* Metric Cards Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-gradient-to-br from-blue-50 to-indigo-50/60 p-4 rounded-xl border border-blue-100/80 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-blue-600 text-white shadow-xs">
            <ArrowLeftRight className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-blue-800 uppercase tracking-wider">Lượt Điều Chuyển</p>
            <p className="text-2xl font-black text-blue-950 mt-0.5">{totalTransfersCount} <span className="text-xs font-medium text-blue-600">lần</span></p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-amber-50 to-orange-50/60 p-4 rounded-xl border border-amber-100/80 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-amber-600 text-white shadow-xs">
            <Archive className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-amber-800 uppercase tracking-wider">Lượt Thu Hồi Về Kho</p>
            <p className="text-2xl font-black text-amber-950 mt-0.5">{totalRecallsCount} <span className="text-xs font-medium text-amber-600">lần</span></p>
          </div>
        </div>

        <div className="bg-gradient-to-br from-emerald-50 to-teal-50/60 p-4 rounded-xl border border-emerald-100/80 flex items-center gap-3.5">
          <div className="p-3 rounded-xl bg-emerald-600 text-white shadow-xs">
            <History className="h-5 w-5" />
          </div>
          <div>
            <p className="text-[11px] font-semibold text-emerald-800 uppercase tracking-wider">Thiết Bị Đã Luân Chuyển</p>
            <p className="text-2xl font-black text-emerald-950 mt-0.5">{uniqueDevicesMoved} <span className="text-xs font-medium text-emerald-600">mã SN</span></p>
          </div>
        </div>
      </div>

      {/* Main Tabs Navigation: History vs Provenance Timeline */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200/80 overflow-hidden">
        
        {/* Navigation & Search Filter Header */}
        <div className="p-4 bg-slate-50/80 border-b border-slate-200/80 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          
          {/* Sub Tab Switcher */}
          <div className="flex flex-nowrap bg-slate-200/70 p-1 rounded-xl w-fit overflow-x-auto no-scrollbar">
            <button
              onClick={() => setActiveView('history')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeView === 'history'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <History className="h-3.5 w-3.5" />
              <span>Lịch Sử Giao Dịch ({filteredTransfers.length})</span>
            </button>

            <button
              onClick={() => setActiveView('timeline')}
              className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold transition ${
                activeView === 'timeline'
                  ? 'bg-white text-blue-700 shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <MapPin className="h-3.5 w-3.5" />
              <span>Nguồn Gốc Thiết Bị</span>
            </button>
          </div>

          {/* Search & Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="relative min-w-[200px] flex-1 sm:flex-initial">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm mã SN, tên thiết bị, biên bản..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value)}
              className="bg-white border border-slate-300 text-slate-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="ALL">Tất cả loại giao dịch</option>
              <option value="transfer">🔄 Điều chuyển vị trí</option>
              <option value="recall">📥 Thu hồi về kho</option>
            </select>

            <select
              value={filterLectureHall}
              onChange={(e) => setFilterLectureHall(e.target.value)}
              className="bg-white border border-slate-300 text-slate-700 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer max-w-[180px] truncate"
            >
              <option value="ALL">Tất cả Giảng đường / Khu Nhà</option>
              {LECTURE_HALLS.map(hall => (
                <option key={hall} value={hall}>{hall}</option>
              ))}
            </select>
          </div>
        </div>

        {/* TAB 1: HISTORY LIST VIEW */}
        {activeView === 'history' && (
          <div className="p-4">
            {filteredTransfers.length === 0 ? (
              <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                <ArrowLeftRight className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                <p className="text-sm font-semibold text-slate-600">Chưa tìm thấy lịch sử điều chuyển nào</p>
                <p className="text-xs text-slate-400 mt-1">Hãy nhấn "Lập Lệnh Điều Chuyển" để bắt đầu bàn giao thiết bị</p>
              </div>
            ) : (
              <div className="space-y-3">
                {filteredTransfers.map((tr) => (
                  <div 
                    key={tr.id}
                    className="p-4 rounded-xl bg-white border border-slate-200/90 hover:border-blue-300 hover:shadow-md transition group"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
                      
                      {/* Device Info & Type Tag */}
                      <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={`px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1 ${
                            tr.type === 'transfer' 
                              ? 'bg-blue-100 text-blue-800 border border-blue-200' 
                              : 'bg-amber-100 text-amber-800 border border-amber-200'
                          }`}>
                            {tr.type === 'transfer' ? <ArrowLeftRight className="h-3 w-3" /> : <Archive className="h-3 w-3" />}
                            {tr.type === 'transfer' ? 'Điều Chuyển Vị Trí' : 'Thu Hồi Về Kho'}
                          </span>

                          <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-2 py-0.5 rounded border border-slate-200">
                            {tr.deviceSn}
                          </span>

                          {tr.documentNumber && (
                            <span className="text-[11px] font-semibold text-slate-500 bg-slate-50 px-2 py-0.5 rounded border border-slate-200/60 flex items-center gap-1">
                              <FileText className="h-3 w-3 text-slate-400" />
                              {tr.documentNumber}
                            </span>
                          )}
                        </div>

                        <h4 className="font-bold text-sm text-slate-900 group-hover:text-blue-600 transition">
                          {tr.deviceName}
                        </h4>
                      </div>

                      {/* Right Action Controls */}
                      <div className="flex items-center gap-2 shrink-0 self-start lg:self-center">
                        <button
                          onClick={() => setPrintingTransfer(tr)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 text-xs font-semibold transition"
                          title="Xem & In biên bản bàn giao thiết bị"
                        >
                          <Printer className="h-3.5 w-3.5" />
                          <span>Biên Bản Bàn Giao</span>
                        </button>
                      </div>
                    </div>

                    {/* From -> To Location Path */}
                    <div className="mt-3 pt-3 border-t border-slate-100 grid grid-cols-1 md:grid-cols-2 gap-3 bg-slate-50/60 p-3 rounded-lg text-xs">
                      
                      {/* From Location */}
                      <div className="flex items-start gap-2">
                        <div className="p-1.5 rounded bg-rose-100 text-rose-700 shrink-0 mt-0.5">
                          <MapPin className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-rose-800 uppercase tracking-wider">Vị Trí Cũ (Nguồn)</p>
                          <p className="font-semibold text-slate-800 mt-0.5">
                            {tr.fromLocation.faculty}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {tr.fromLocation.lectureHall} • <span className="font-medium text-slate-700">{tr.fromLocation.room}</span>
                          </p>
                        </div>
                      </div>

                      {/* To Location */}
                      <div className="flex items-start gap-2">
                        <div className="p-1.5 rounded bg-emerald-100 text-emerald-700 shrink-0 mt-0.5">
                          <MapPin className="h-3.5 w-3.5" />
                        </div>
                        <div>
                          <p className="text-[10px] font-bold text-emerald-800 uppercase tracking-wider">Vị Trí Mới (Đến)</p>
                          <p className="font-semibold text-slate-800 mt-0.5">
                            {tr.toLocation.faculty}
                          </p>
                          <p className="text-[11px] text-slate-500">
                            {tr.toLocation.lectureHall} • <span className="font-medium text-slate-700">{tr.toLocation.room}</span>
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Reasons & Metadata */}
                    <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-600">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-slate-700">Lý do:</span>
                        <span className="text-slate-800 italic bg-amber-50/80 px-2 py-0.5 rounded border border-amber-200/50">
                          "{tr.reason}"
                        </span>
                      </div>

                      <div className="flex items-center gap-3 text-[10px] text-slate-500">
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3 text-slate-400" />
                          Ngày: {formatDate(tr.transferDate)}
                        </span>
                        <span className="flex items-center gap-1">
                          <UserIcon className="h-3 w-3 text-slate-400" />
                          Bàn giao: {tr.performedBy}
                        </span>
                        {tr.receiverName && (
                          <span className="flex items-center gap-1">
                            <ShieldCheck className="h-3 w-3 text-slate-400" />
                            Tiếp nhận: {tr.receiverName}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* TAB 2: PROVENANCE TIMELINE VIEW */}
        {activeView === 'timeline' && (
          <div className="p-4 space-y-6">
            
            {/* Filter by Specific Device */}
            <div className="bg-blue-50/60 p-3.5 rounded-xl border border-blue-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-blue-600 shrink-0" />
                <p className="text-xs font-bold text-blue-900">
                  Truy Xuất Hành Trình Vị Trí (Device Provenance Tracking)
                </p>
              </div>

              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-700 shrink-0">Chọn thiết bị:</label>
                <select
                  value={selectedDeviceForTimeline}
                  onChange={(e) => setSelectedDeviceForTimeline(e.target.value)}
                  className="bg-white border border-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium max-w-[260px] truncate"
                >
                  <option value="ALL">Tất cả thiết bị có lịch sử luân chuyển</option>
                  {devices.map(d => (
                    <option key={d.id} value={d.id}>
                      [{d.serialNumber}] {d.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Render Timeline for Devices */}
            {(() => {
              const targetDevices = selectedDeviceForTimeline === 'ALL'
                ? devices.filter(d => transfers.some(t => t.deviceId === d.id || t.deviceSn === d.serialNumber))
                : devices.filter(d => d.id === selectedDeviceForTimeline);

              if (targetDevices.length === 0) {
                return (
                  <div className="text-center py-12 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <MapPin className="mx-auto h-10 w-10 text-slate-300 mb-2" />
                    <p className="text-sm font-semibold text-slate-600">Chưa có dữ liệu hành trình vị trí cho thiết bị này</p>
                  </div>
                );
              }

              return (
                <div className="space-y-6">
                  {targetDevices.map(device => {
                    const devTransfers = transfers
                      .filter(t => t.deviceId === device.id || t.deviceSn === device.serialNumber)
                      .sort((a, b) => new Date(a.transferDate).getTime() - new Date(b.transferDate).getTime());

                    return (
                      <div key={device.id} className="bg-white p-5 rounded-xl border border-slate-200/90 shadow-2xs space-y-4">
                        
                        {/* Device Header */}
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-slate-100">
                          <div>
                            <span className="font-mono text-xs font-bold text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded border border-blue-200">
                              {device.serialNumber}
                            </span>
                            <h3 className="font-bold text-base text-slate-900 mt-1">
                              {device.name}
                            </h3>
                          </div>
                          
                          <div className="text-xs text-slate-500 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200 flex items-center gap-1.5 self-start sm:self-center">
                            <Building2 className="h-3.5 w-3.5 text-slate-400" />
                            <span>Vị trí hiện tại: <strong className="text-slate-800">{device.location.faculty} - {device.location.room}</strong></span>
                          </div>
                        </div>

                        {/* Visual Chronological Horizontal/Vertical Trail */}
                        <div className="relative pl-6 space-y-6 before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-0.5 before:bg-slate-200">
                          
                          {/* Point 0: Initial Registry */}
                          <div className="relative group">
                            <div className="absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full bg-slate-400 border-2 border-white ring-2 ring-slate-200" />
                            <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 text-xs">
                              <div className="flex items-center justify-between font-bold text-slate-700">
                                <span>1. Nhập Kho / Tiếp Nhận Ban Đầu</span>
                                <span className="text-[10px] text-slate-400 font-normal">{formatDate(device.purchaseDate)}</span>
                              </div>
                              <p className="text-slate-600 mt-1">
                                Vị trí ban đầu: <strong>{device.location.faculty}</strong> ({device.location.room})
                              </p>
                              <p className="text-[11px] text-slate-400 mt-0.5">Nhà cung cấp: {device.supplier}</p>
                            </div>
                          </div>

                          {/* Subsequent Transfers */}
                          {devTransfers.map((tr, index) => (
                            <div key={tr.id} className="relative group">
                              <div className={`absolute -left-6 top-1.5 h-3.5 w-3.5 rounded-full border-2 border-white ring-2 ${
                                tr.type === 'transfer' ? 'bg-blue-600 ring-blue-200' : 'bg-amber-600 ring-amber-200'
                              }`} />
                              <div className="p-3.5 rounded-xl bg-white border border-slate-200/90 shadow-2xs space-y-2 text-xs">
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className={`px-2 py-0.5 rounded text-[10px] font-extrabold uppercase ${
                                    tr.type === 'transfer' ? 'bg-blue-100 text-blue-800' : 'bg-amber-100 text-amber-800'
                                  }`}>
                                    {index + 2}. {tr.type === 'transfer' ? 'Điều chuyển vị trí' : 'Thu hồi về kho'}
                                  </span>
                                  <span className="text-[11px] font-semibold text-slate-500">
                                    Ngày: {formatDate(tr.transferDate)}
                                  </span>
                                </div>

                                <div className="flex items-center gap-2 text-slate-800 font-medium">
                                  <span className="text-slate-500 line-through">{tr.fromLocation.room} ({tr.fromLocation.faculty})</span>
                                  <ChevronRight className="h-4 w-4 text-blue-500 shrink-0" />
                                  <span className="text-blue-700 font-bold bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                                    {tr.toLocation.room} ({tr.toLocation.faculty})
                                  </span>
                                </div>

                                <p className="text-slate-600 italic bg-slate-50 p-2 rounded border border-slate-100 text-[11px]">
                                  "{tr.reason}"
                                </p>

                                <div className="flex flex-wrap items-center justify-between text-[10px] text-slate-400 pt-1 border-t border-slate-100">
                                  <span>Bàn giao bởi: {tr.performedBy}</span>
                                  {tr.documentNumber && <span>Số BB: {tr.documentNumber}</span>}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              );
            })()}
          </div>
        )}
      </div>

      {/* CREATE TRANSFER / RECALL MODAL */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/70 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            
            {/* Modal Header */}
            <div className="p-4 sm:p-5 border-b border-slate-100 flex items-center justify-between sticky top-0 bg-white z-10">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-xl text-white ${transferType === 'transfer' ? 'bg-blue-600' : 'bg-amber-600'}`}>
                  {transferType === 'transfer' ? <ArrowLeftRight className="h-5 w-5" /> : <Archive className="h-5 w-5" />}
                </div>
                <div>
                  <h3 className="font-bold text-base sm:text-lg text-slate-900">
                    {transferType === 'transfer' ? 'Lập Lệnh Điều Chuyển Thiết Bị' : 'Thu Hồi Thiết Bị Về Kho'}
                  </h3>
                  <p className="text-xs text-slate-500">Ghi nhận thông tin bàn giao và tự động cập nhật vị trí thiết bị</p>
                </div>
              </div>

              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-5">
              
              {/* Type Switcher */}
              <div className="grid grid-cols-2 gap-3 p-1 bg-slate-100 rounded-xl">
                <button
                  type="button"
                  onClick={() => handleTypeSwitch('transfer')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                    transferType === 'transfer'
                      ? 'bg-white text-blue-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <ArrowLeftRight className="h-4 w-4" />
                  <span>Điều Chuyển Vị Trí Mới</span>
                </button>

                <button
                  type="button"
                  onClick={() => handleTypeSwitch('recall')}
                  className={`py-2 px-3 rounded-lg text-xs font-bold transition flex items-center justify-center gap-2 ${
                    transferType === 'recall'
                      ? 'bg-white text-amber-700 shadow-xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <Archive className="h-4 w-4" />
                  <span>Thu Hồi Về Kho Bảo Dưỡng</span>
                </button>
              </div>

              {/* Select Device Field with Camera Scan Button */}
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Tag className="h-3.5 w-3.5 text-blue-600" />
                    <span>Chọn Thiết Bị Bàn Giao / Điều Chuyển *</span>
                  </label>
                  
                  <button
                    type="button"
                    onClick={handleScanDevice}
                    className="text-[11px] font-bold text-blue-600 hover:text-blue-800 flex items-center gap-1 bg-blue-50 px-2 py-1 rounded border border-blue-200 transition"
                  >
                    <Camera className="h-3.5 w-3.5" />
                    <span>Quét mã Barcode / QR</span>
                  </button>
                </div>

                {/* Device search and multi-select checklist */}
                <div className="space-y-2 border border-slate-200 rounded-2xl p-3 bg-white shadow-xs">
                  <div className="relative">
                    <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-slate-400" />
                    <input
                      type="text"
                      placeholder="Tìm kiếm thiết bị theo tên hoặc mã SN..."
                      value={deviceSearchText}
                      onChange={(e) => setDeviceSearchText(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-300 rounded-lg text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                    />
                    {deviceSearchText && (
                      <button
                        type="button"
                        onClick={() => setDeviceSearchText('')}
                        className="absolute right-2.5 top-2.5 text-slate-400 hover:text-slate-600 text-xs font-bold font-mono"
                      >
                        &times;
                      </button>
                    )}
                  </div>

                  {/* Select / Deselect All Actions */}
                  {(() => {
                    const filteredFormDevices = devices.filter(dev => {
                      const q = deviceSearchText.toLowerCase();
                      return dev.name.toLowerCase().includes(q) || dev.serialNumber.toLowerCase().includes(q);
                    });

                    return (
                      <>
                        <div className="flex items-center justify-between text-[10px]">
                          <span className="text-slate-500 font-medium">Đã chọn: <strong className="text-blue-600 font-bold">{selectedDeviceIds.length}</strong> thiết bị</span>
                          <div className="flex gap-2 font-semibold">
                            <button
                              type="button"
                              onClick={() => {
                                const newIds = Array.from(new Set([...selectedDeviceIds, ...filteredFormDevices.map(d => d.id)]));
                                setSelectedDeviceIds(newIds);
                              }}
                              className="text-blue-600 hover:underline"
                            >
                              Chọn tất cả ({filteredFormDevices.length})
                            </button>
                            <span className="text-slate-300">|</span>
                            <button
                              type="button"
                              onClick={() => {
                                const filteredIds = filteredFormDevices.map(d => d.id);
                                setSelectedDeviceIds(selectedDeviceIds.filter(id => !filteredIds.includes(id)));
                              }}
                              className="text-slate-500 hover:underline"
                            >
                              Bỏ chọn kết quả
                            </button>
                          </div>
                        </div>

                        {/* Scrollable list */}
                        <div className="max-h-40 overflow-y-auto border border-slate-100 rounded-xl p-1.5 bg-slate-50/50 space-y-1">
                          {filteredFormDevices.length === 0 ? (
                            <p className="text-center py-6 text-xs text-slate-400 italic">Không tìm thấy thiết bị nào phù hợp</p>
                          ) : (
                            filteredFormDevices.map(dev => {
                              const isChecked = selectedDeviceIds.includes(dev.id);
                              return (
                                <label
                                  key={dev.id}
                                  className={`flex items-start gap-2.5 p-2 rounded-lg border text-xs cursor-pointer transition ${
                                    isChecked 
                                      ? 'bg-blue-50/70 border-blue-200 text-blue-900 shadow-3xs' 
                                      : 'bg-white border-slate-150 hover:border-slate-300 text-slate-700'
                                  }`}
                                >
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => {
                                      if (isChecked) {
                                        setSelectedDeviceIds(selectedDeviceIds.filter(id => id !== dev.id));
                                      } else {
                                        setSelectedDeviceIds([...selectedDeviceIds, dev.id]);
                                      }
                                    }}
                                    className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                                  />
                                  <div className="flex-1">
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="font-bold text-slate-900">{dev.name}</span>
                                      <span className="font-mono text-[10px] font-bold text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">{dev.serialNumber}</span>
                                    </div>
                                    <p className="text-[10px] text-slate-500 mt-0.5">
                                      Vị trí: {dev.location.faculty} - {dev.location.room} • Trạng thái: <span className="capitalize font-medium">{dev.status}</span>
                                    </p>
                                  </div>
                                </label>
                              );
                            })
                          )}
                        </div>
                      </>
                    );
                  })()}
                </div>
              </div>

              {/* Selected Devices Badge Area */}
              {selectedDeviceIds.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Danh sách thiết bị đã chọn ({selectedDeviceIds.length}):</p>
                  <div className="flex flex-wrap gap-1.5 p-2.5 bg-slate-50 rounded-xl border border-slate-200/80 max-h-24 overflow-y-auto">
                    {selectedDeviceIds.map(id => {
                      const dev = devices.find(d => d.id === id);
                      if (!dev) return null;
                      return (
                        <span key={id} className="inline-flex items-center gap-1.5 bg-white text-slate-800 text-[10px] font-bold px-2 py-1 rounded-lg border border-slate-200 shadow-3xs hover:border-red-200 hover:text-red-700 transition">
                          <span>{dev.name} ({dev.serialNumber})</span>
                          <button
                            type="button"
                            onClick={() => setSelectedDeviceIds(selectedDeviceIds.filter(x => x !== id))}
                            className="text-slate-400 hover:text-red-700 font-extrabold ml-1 cursor-pointer transition text-xs"
                            title="Xóa khỏi danh sách chọn"
                          >
                            &times;
                          </button>
                        </span>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Current Device Location Info Box */}
              {selectedDeviceIds.length > 0 && (
                <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5 text-xs">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">Vị Trí Hiện Tại (Nguồn)</p>
                  {(() => {
                    const uniqueLocations = Array.from(new Set(selectedDeviceIds.map(id => {
                      const dev = devices.find(d => d.id === id);
                      return dev ? `${dev.location.faculty} - ${dev.location.room}` : null;
                    }).filter(Boolean)));

                    if (uniqueLocations.length === 1) {
                      const dev = devices.find(d => d.id === selectedDeviceIds[0]);
                      return (
                        <>
                          <p className="font-bold text-slate-800">
                            {dev?.location.faculty} • {dev?.location.lectureHall} • <span className="text-blue-700">{dev?.location.room}</span>
                          </p>
                          <p className="text-[11px] text-slate-500">
                            Các thiết bị được chọn đều có cùng vị trí nguồn.
                          </p>
                        </>
                      );
                    } else {
                      return (
                        <>
                          <p className="font-bold text-amber-700">
                            Đa vị trí nguồn ({uniqueLocations.length} vị trí khác nhau)
                          </p>
                          <p className="text-[11px] text-slate-500 leading-normal">
                            Thiết bị được điều chuyển từ nhiều địa điểm nguồn khác nhau và sẽ được ghi nhận địa điểm đích mới đồng nhất.
                          </p>
                        </>
                      );
                    }
                  })()}
                </div>
              )}

              {/* Destination Location Inputs */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <h4 className="font-bold text-xs uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 text-emerald-600" />
                  <span>Vị Trí Đích Tiếp Nhận (Mới) *</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Khoa / Đơn Vị</label>
                    <input
                      type="text"
                      value={targetFaculty}
                      onChange={(e) => setTargetFaculty(e.target.value)}
                      placeholder="Tên Khoa / Đơn vị"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Giảng Đường / Tòa Nhà</label>
                    <input
                      type="text"
                      value={targetLectureHall}
                      onChange={(e) => setTargetLectureHall(e.target.value)}
                      placeholder="Ví dụ: Tòa A, Kho Trung tâm"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      required
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Phòng Học / Cụm Kho</label>
                    <input
                      type="text"
                      value={targetRoom}
                      onChange={(e) => setTargetRoom(e.target.value)}
                      placeholder="Ví dụ: Phòng A101, Kho A00"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500 font-medium"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Reasons & Document Numbers */}
              <div className="space-y-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="text-xs font-bold text-slate-700 mb-1 block">
                    Lý Do Điều Chuyển / Thu Hồi *
                  </label>
                  <textarea
                    rows={2}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="Mô tả cụ thể lý do (VD: Mượn phục vụ thi học kỳ, Thu hồi nâng cấp RAM, Chuyển sang giảng đường A2...)"
                    className="w-full bg-white border border-slate-300 rounded-xl p-2.5 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-[11px] font-semibold text-slate-600">Số Biên Bản / Quyết Định</label>
                      <button
                        type="button"
                        onClick={generateAutoDocNumber}
                        className="text-[10px] text-blue-600 hover:underline font-semibold"
                      >
                        Tạo số ngẫu nhiên
                      </button>
                    </div>
                    <input
                      type="text"
                      value={documentNumber}
                      onChange={(e) => setDocumentNumber(e.target.value)}
                      placeholder="BB-DC-2026/08-01"
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  <div>
                    <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Ngày Thực Hiện Bàn Giao</label>
                    <input
                      type="date"
                      value={transferDate}
                      onChange={(e) => setTransferDate(e.target.value)}
                      className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                      required
                    />
                  </div>
                </div>
              </div>

              {/* Handover Parties & Condition */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-100">
                <div>
                  <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Cán Bộ Thực Hiện / Bàn Giao</label>
                  <input
                    type="text"
                    value={performedBy}
                    onChange={(e) => setPerformedBy(e.target.value)}
                    placeholder="Tên kỹ thuật viên"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                  />
                </div>

                <div>
                  <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Đơn Vị / Người Tiếp Nhận</label>
                  <input
                    type="text"
                    value={receiverName}
                    onChange={(e) => setReceiverName(e.target.value)}
                    placeholder="Tên cán bộ tiếp nhận"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="text-[11px] font-semibold text-slate-600 mb-1 block">Tình Trạng Thiết Bị Khi Bàn Giao</label>
                <input
                  type="text"
                  value={conditionAtTransfer}
                  onChange={(e) => setConditionAtTransfer(e.target.value)}
                  placeholder="Hoạt động bình thường / Kèm phụ kiện..."
                  className="w-full bg-white border border-slate-300 rounded-lg p-2 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              {/* Submit / Cancel Buttons */}
              <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
                >
                  Hủy Bỏ
                </button>

                <button
                  type="submit"
                  className={`px-5 py-2.5 rounded-xl text-white text-xs font-bold transition shadow-md active:scale-95 ${
                    transferType === 'transfer' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-amber-600 hover:bg-amber-700'
                  }`}
                >
                  {transferType === 'transfer' ? 'Xác Nhận Điều Chuyển' : 'Xác Nhận Thu Hồi Về Kho'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PRINT HANDOVER DOCUMENT MODAL */}
      {printingTransfer && (() => {
        const groupedTransfers = transfers.filter(t => {
          if (!printingTransfer) return false;
          if (printingTransfer.documentNumber && t.documentNumber) {
            return t.documentNumber === printingTransfer.documentNumber && t.type === printingTransfer.type;
          }
          return t.transferDate === printingTransfer.transferDate &&
                 t.type === printingTransfer.type &&
                 t.toLocation.faculty === printingTransfer.toLocation.faculty &&
                 t.toLocation.room === printingTransfer.toLocation.room &&
                 t.performedBy === printingTransfer.performedBy;
        });

        const facultiesInGroup = Array.from(new Set(groupedTransfers.map(gt => gt.toLocation.faculty)));

        const rawDisplayedTransfers = printFacultyFilter === 'ALL'
          ? groupedTransfers
          : groupedTransfers.filter(gt => gt.toLocation.faculty === printFacultyFilter);

        // Filter out duplicate devices with same Serial Number (deviceSn) in the same document
        const printedDeviceSns = new Set<string>();
        const displayedTransfers = rawDisplayedTransfers.filter(t => {
          if (!t.deviceSn) return true;
          const cleanSn = t.deviceSn.trim().toLowerCase();
          if (printedDeviceSns.has(cleanSn)) {
            return false;
          }
          printedDeviceSns.add(cleanSn);
          return true;
        });

        // Nguồn chỉ lấy duy nhất 1 nguồn từ người giao (vật chất nguồn từ người giao)
        const singleSource = displayedTransfers[0]
          ? `${displayedTransfers[0].fromLocation.faculty} (${displayedTransfers[0].fromLocation.room})`
          : 'Phòng Cơ sở vật chất';

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 sm:p-4 animate-fade-in">
            <div id="individual-print-document" className="print-document bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[94vh] overflow-y-auto p-6 sm:p-10 space-y-6 print:shadow-none print:p-0 print:max-h-none print:m-0">
              
              {/* Unit print selection control - Hidden when printing */}
              {facultiesInGroup.length > 1 && (
                <div className="bg-blue-50/50 p-4 rounded-xl border border-blue-100 flex flex-col sm:flex-row items-center justify-between gap-3 print:hidden">
                  <div className="flex items-center gap-2">
                    <Filter className="h-4 w-4 text-blue-600" />
                    <div>
                      <span className="text-xs font-bold text-slate-700 block">Bộ lọc in theo đơn vị nhận:</span>
                      <span className="text-[11px] text-slate-500">Biên bản này có thiết bị điều chuyển đến {facultiesInGroup.length} đơn vị khác nhau.</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 w-full sm:w-auto">
                    <select
                      value={printFacultyFilter}
                      onChange={(e) => setPrintFacultyFilter(e.target.value)}
                      className="bg-white border border-slate-300 text-xs rounded-lg px-2.5 py-1.5 focus:outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-slate-800 cursor-pointer w-full sm:w-auto"
                    >
                      <option value="ALL">In tất cả các đơn vị trong biên bản</option>
                      {facultiesInGroup.map(faculty => (
                        <option key={faculty} value={faculty}>Chỉ in đơn vị: {faculty}</option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              {/* National Header & Institution Header brought close together */}
              <div className="flex flex-col sm:flex-row justify-center items-center sm:items-start text-center border-b border-slate-300 pb-5 gap-8 sm:gap-16">
                <div className="flex items-center gap-3">
                  <DUELogo size="lg" className="h-14 w-14 flex-shrink-0" />
                  <div className="text-center space-y-0.5">
                    <p className="text-xs font-bold uppercase tracking-wide text-slate-900">TRƯỜNG ĐẠI HỌC KINH TẾ</p>
                    <p className="text-xs font-bold text-slate-900 uppercase underline underline-offset-4">PHÒNG CƠ SỞ VẬT CHẤT</p>
                  </div>
                </div>

                <div className="text-center space-y-0.5">
                  <p className="text-xs font-bold uppercase text-slate-900 tracking-wider">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                  <p className="text-xs font-bold text-slate-900 underline underline-offset-4">Độc lập - Tự do - Hạnh phúc</p>
                  <p className="text-[10px] text-slate-500 italic pt-1">Đà Nẵng, ngày {new Date(printingTransfer.transferDate).getDate()} tháng {new Date(printingTransfer.transferDate).getMonth() + 1} năm {new Date(printingTransfer.transferDate).getFullYear()}</p>
                </div>
              </div>

              {/* Document Title */}
              <div className="text-center space-y-1.5 pt-2">
                <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
                  {printingTransfer.type === 'transfer' ? 'BIÊN BẢN BÀN GIAO - ĐIỀU CHUYỂN THIẾT BỊ' : 'BIÊN BẢN THU HỒI THIẾT BỊ GIẢNG ĐƯỜNG'}
                </h2>
                <p className="text-xs font-mono text-blue-700 font-bold">Số: {printingTransfer.documentNumber || 'BB-CSVC-2026/OFFICIAL'}</p>
                <div className="text-center">
                  <p className="text-xs italic text-slate-600 max-w-xl mx-auto pt-1 text-center">
                    (V/v bàn giao, luân chuyển và trang bị thiết bị kỹ thuật phục vụ công tác giảng dạy, học tập)
                  </p>
                </div>
              </div>

              {/* Legal Basis */}
              <div className="text-xs text-slate-800 space-y-1.5 bg-slate-50 p-4 rounded-xl border border-slate-200">
                <p className="font-bold text-slate-900">- Căn cứ Quy chế quản lý và sử dụng tài sản công tại Trường Đại học Kinh tế - ĐHĐN;</p>
                <p className="font-bold text-slate-900">- Căn cứ kế hoạch bảo dưỡng, điều chuyển và trang thiết bị năm {new Date(printingTransfer.transferDate).getFullYear()};</p>
                <p className="font-bold text-slate-900">- Căn cứ đề nghị và nhu cầu thực tế của các đơn vị giảng dạy.</p>
              </div>

              {/* Content Details: Participating Parties */}
              <div className="space-y-4 text-xs text-slate-800 leading-relaxed">
                <p className="italic text-slate-700">
                  Hôm nay, tại Phòng Cơ sở vật chất - Trường Đại học Kinh tế, chúng tôi gồm có các ông/bà đại diện sau đây:
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Bên A */}
                  <div className="p-4 rounded-xl bg-blue-50/50 border border-blue-200/80 space-y-1.5">
                    <p className="font-bold text-blue-900 uppercase tracking-wide border-b border-blue-200 pb-1">I. ĐẠI DIỆN BÊN GIAO (BÊN A):</p>
                    <p>Họ và tên: <strong className="text-slate-900">{printingTransfer.performedBy}</strong></p>
                    <p>Chức vụ / Đơn vị: <strong>Cán bộ kỹ thuật / Phòng Cơ sở vật chất</strong></p>
                    <p>Địa điểm giao (Nguồn): <strong className="text-blue-800">{singleSource}</strong></p>
                  </div>

                  {/* Bên B */}
                  <div className="p-4 rounded-xl bg-emerald-50/50 border border-emerald-200/80 space-y-1.5">
                    <p className="font-bold text-emerald-900 uppercase tracking-wide border-b border-emerald-200 pb-1">II. ĐẠI DIỆN BÊN NHẬN (BÊN B):</p>
                    <p>Họ và tên: <strong className="text-slate-900">{displayedTransfers[0]?.receiverName || printingTransfer.receiverName || 'Đại diện Đơn vị tiếp nhận'}</strong></p>
                    <p>Chức vụ / Đơn vị nhận: <strong className="text-emerald-800">
                      {printFacultyFilter === 'ALL'
                        ? facultiesInGroup.join(', ')
                        : (displayedTransfers[0]?.toLocation.faculty || printingTransfer.toLocation.faculty)}
                    </strong></p>
                    <p>Địa điểm nhận (Đích): <strong className="text-emerald-800">
                      {printFacultyFilter === 'ALL'
                        ? Array.from(new Set(displayedTransfers.map(gt => `${gt.toLocation.faculty} (${gt.toLocation.room})`))).join('; ')
                        : `${displayedTransfers[0]?.toLocation.faculty} - ${displayedTransfers[0]?.toLocation.room}`}
                    </strong></p>
                  </div>
                </div>

                {/* Table of Items */}
                <div className="space-y-2 pt-2">
                  <p className="font-bold text-slate-900 uppercase tracking-wide">III. DANH MỤC THIẾT BỊ BÀN GIAO / ĐIỀU CHUYỂN:</p>
                  <div className="overflow-x-auto rounded-xl border border-slate-300">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-100 font-bold text-slate-800 uppercase tracking-wider">
                        <tr>
                          <th className="p-3 border-b border-r border-slate-300 w-12 text-center">STT</th>
                          <th className="p-3 border-b border-r border-slate-300">Tên Thiết Bị & Quy Cách</th>
                          <th className="p-3 border-b border-r border-slate-300">Mã Serial Number (SN)</th>
                          <th className="p-3 border-b border-r border-slate-300 text-center">Số Lượng</th>
                          <th className="p-3 border-b border-slate-300">Tình Trạng Kỹ Thuật & Phụ Kiện</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300">
                        {displayedTransfers.map((gt, idx) => (
                          <tr key={gt.id || idx} className="hover:bg-slate-50">
                            <td className="p-3 border-r border-slate-300 text-center font-bold">{idx + 1}</td>
                            <td className="p-3 font-bold text-slate-900 border-r border-slate-300">{gt.deviceName}</td>
                            <td className="p-3 font-mono font-bold text-blue-700 border-r border-slate-300">{gt.deviceSn}</td>
                            <td className="p-3 text-center border-r border-slate-300 font-bold">01</td>
                            <td className="p-3 font-medium text-slate-700">{gt.conditionAtTransfer || 'Thiết bị hoạt động tốt, đầy đủ phụ kiện'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Reason & Notes */}
                <div className="space-y-3 pt-2">
                  <div>
                    <p className="font-bold text-slate-900 uppercase tracking-wide">IV. LÝ DO VÀ MỤC ĐÍCH {printingTransfer.type === 'transfer' ? 'ĐIỀU CHUYỂN' : 'THU HỒI'}:</p>
                    <div className="mt-1 bg-amber-50/80 p-3 rounded-xl border border-amber-200/80 text-amber-950 font-medium italic">
                      "{printingTransfer.reason}"
                    </div>
                  </div>

                  {printingTransfer.notes && (
                    <div>
                      <p className="font-bold text-slate-900 uppercase tracking-wide">V. GHI CHÚ VÀ CAM KẾT BẢO QUẢN:</p>
                      <p className="mt-1 bg-slate-50 p-3 rounded-xl border border-slate-200 text-slate-700">
                        {printingTransfer.notes}
                      </p>
                    </div>
                  )}
                </div>

                {/* Agreement Statement */}
                <p className="italic text-slate-600 pt-2 text-center">
                  Biên bản được lập thành 02 bản có giá trị pháp lý như nhau, Bên A giữ 01 bản, Bên B giữ 01 bản để thực hiện./.
                </p>
              </div>

              {/* Signature Blocks */}
              <div className="pt-8 border-t-2 border-slate-300 grid grid-cols-3 text-center text-xs gap-4">
                <div className="space-y-1">
                  <p className="font-bold text-slate-900 uppercase">ĐẠI DIỆN BÊN GIAO (BÊN A)</p>
                  <p className="text-[10px] text-slate-500 italic">(Ký, ghi rõ họ tên)</p>
                  <div className="h-20"></div>
                  <p className="font-bold text-slate-900">{printingTransfer.performedBy}</p>
                </div>

                <div className="space-y-1">
                  <p className="font-bold text-slate-900 uppercase">ĐẠI DIỆN BÊN NHẬN (BÊN B)</p>
                  <p className="text-[10px] text-slate-500 italic">(Ký, ghi rõ họ tên)</p>
                  <div className="h-20"></div>
                  <p className="font-bold text-slate-900">{displayedTransfers[0]?.receiverName || printingTransfer.receiverName || 'Đại diện Đơn vị'}</p>
                </div>

                <div className="space-y-1">
                  <p className="font-bold text-slate-900 uppercase">PHÒNG CƠ SỞ VẬT CHẤT</p>
                  <p className="text-[10px] text-slate-500 italic">(Ký, ghi rõ họ tên)</p>
                  <div className="h-20"></div>
                </div>
              </div>

              {/* Print & Close Controls */}
              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-200 print:hidden">
                <button
                  type="button"
                  onClick={() => setPrintingTransfer(null)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-bold transition"
                >
                  Đóng
                </button>

                <button
                  type="button"
                  onClick={() => exportToWord('individual-print-document', `Bien-ban-ban-giao-${printingTransfer.documentNumber || 'official'}`)}
                  className="px-5 py-2.5 rounded-xl border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100 text-xs font-bold transition flex items-center gap-2 shadow-xs active:scale-95"
                >
                  <FileText className="h-4 w-4" />
                  <span>Xuất File Word</span>
                </button>

                <button
                  type="button"
                  onClick={() => window.print()}
                  className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition flex items-center gap-2 shadow-md active:scale-95"
                >
                  <Printer className="h-4 w-4" />
                  <span>In Biên Bản Chính Thức</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Aggregated Handover Print Modal */}
      {isAggregatedPrintOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 backdrop-blur-xs p-3 sm:p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-6xl max-h-[96vh] flex flex-col md:flex-row overflow-hidden print:shadow-none print:border-none print:max-h-none print:w-full print:rounded-none">
            
            {/* Left Control Panel - Hidden when printing */}
            <div className="w-full md:w-[360px] border-r border-slate-200 bg-slate-50 flex flex-col max-h-[40vh] md:max-h-none overflow-y-auto p-4 sm:p-6 space-y-4 print:hidden">
              <div>
                <h3 className="text-sm font-bold text-slate-800 uppercase tracking-wide">Cấu hình in biên bản tổng hợp</h3>
                <p className="text-[11px] text-slate-500 mt-1">Lọc và tùy chỉnh thông tin trước khi in chính thức.</p>
              </div>

              {/* Filters */}
              <div className="space-y-3.5 pt-2">
                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Loại Biên Bản:</label>
                  <select
                    value={aggType}
                    onChange={(e) => setAggType(e.target.value as DeviceTransferType)}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    <option value="transfer">Điều Chuyển - Bàn Giao</option>
                    <option value="recall">Thu Hồi Về Kho</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Đơn Vị (Khoa/Phòng):</label>
                  <select
                    value={aggFaculty}
                    onChange={(e) => setAggFaculty(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  >
                    {FACULTIES.map(fac => (
                      <option key={fac} value={fac}>{fac}</option>
                    ))}
                    <option value="Phòng Cơ sở vật chất">Phòng Cơ sở vật chất</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="block text-[11px] font-bold text-slate-700 uppercase">Ngày thực hiện:</label>
                    <label className="flex items-center gap-1 text-[10px] font-bold text-slate-500 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={aggFilterByDate}
                        onChange={(e) => setAggFilterByDate(e.target.checked)}
                        className="rounded text-indigo-600 focus:ring-indigo-500 w-3.5 h-3.5 border-slate-300"
                      />
                      <span>Chỉ lọc ngày này</span>
                    </label>
                  </div>
                  <input
                    type="date"
                    value={aggDate}
                    onChange={(e) => setAggDate(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs bg-white font-semibold focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Số Biên Bản:</label>
                  <input
                    type="text"
                    value={aggDocNumber}
                    onChange={(e) => setAggDocNumber(e.target.value)}
                    placeholder="Nhập số biên bản..."
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs bg-white font-semibold focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Đại Diện Bên A (Phòng CSVC):</label>
                  <input
                    type="text"
                    value={aggPerformedBy}
                    onChange={(e) => setAggPerformedBy(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs bg-white font-semibold focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Đại Diện Bên B (Nhận):</label>
                  <input
                    type="text"
                    value={aggReceiverName}
                    onChange={(e) => setAggReceiverName(e.target.value)}
                    placeholder="Họ tên đại diện đơn vị..."
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs bg-white font-semibold focus:outline-none"
                  />
                </div>

                <div className="space-y-1">
                  <label className="block text-[11px] font-bold text-slate-700 uppercase">Lý do bàn giao / điều chuyển:</label>
                  <textarea
                    value={aggReason}
                    onChange={(e) => setAggReason(e.target.value)}
                    rows={2}
                    className="w-full border border-slate-200 rounded-xl p-2 text-xs bg-white font-semibold focus:outline-none"
                  />
                </div>
              </div>

              {/* Devices Selection Checklist */}
              <div className="flex-1 space-y-2 pt-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase">Danh sách thiết bị ({matchingAggTransfers.length}):</label>
                {matchingAggTransfers.length === 0 ? (
                  <p className="text-xs text-rose-500 italic font-medium p-3 bg-rose-50 rounded-xl border border-rose-100">
                    Không tìm thấy lượt {aggType === 'transfer' ? 'điều chuyển' : 'thu hồi'} nào trùng khớp cho đơn vị này{aggFilterByDate ? ' vào ngày đã chọn' : ''}.
                  </p>
                ) : (
                  <div className="border border-slate-200 rounded-xl bg-white max-h-[150px] overflow-y-auto p-2.5 space-y-2">
                    {matchingAggTransfers.map(t => {
                      const isChecked = aggSelectedTransferIds.includes(t.id);
                      return (
                        <label key={t.id} className="flex items-start gap-2 text-xs text-slate-700 cursor-pointer hover:bg-slate-50 p-1.5 rounded-lg transition">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => {
                              if (isChecked) {
                                setAggSelectedTransferIds(prev => prev.filter(id => id !== t.id));
                              } else {
                                setAggSelectedTransferIds(prev => [...prev, t.id]);
                              }
                            }}
                            className="mt-0.5 rounded text-indigo-600 focus:ring-indigo-500"
                          />
                          <div className="min-w-0 flex-1">
                            <span className="font-bold block text-slate-900 truncate">{t.deviceName}</span>
                            <span className="font-mono text-[10px] text-slate-500 block truncate">SN: {t.deviceSn}</span>
                            <span className="text-[10px] text-slate-400 block truncate">Từ {t.fromLocation.room} → Đến {t.toLocation.room}</span>
                          </div>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Footer buttons inside left panel */}
              <div className="pt-2 flex flex-col gap-2">
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setIsAggregatedPrintOpen(false)}
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold bg-white text-slate-700 border border-slate-200 hover:bg-slate-100 transition"
                  >
                    Đóng
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      if (aggSelectedTransferIds.length === 0) {
                        alert('Vui lòng chọn ít nhất một thiết bị để tiến hành in.');
                        return;
                      }
                      window.print();
                    }}
                    className="flex-1 px-4 py-2.5 rounded-xl text-xs font-bold bg-indigo-600 text-white hover:bg-indigo-500 transition shadow flex items-center justify-center gap-1.5"
                  >
                    <Printer className="h-4 w-4" />
                    <span>In Biên Bản</span>
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    if (aggSelectedTransferIds.length === 0) {
                      alert('Vui lòng chọn ít nhất một thiết bị để tiến hành xuất Word.');
                      return;
                    }
                    exportToWord('aggregated-print-document', `Bien-ban-tong-hop-${aggDocNumber || 'official'}`);
                  }}
                  className="w-full px-4 py-2.5 rounded-xl text-xs font-bold bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100 transition shadow-xs flex items-center justify-center gap-1.5"
                >
                  <FileText className="h-4 w-4" />
                  <span>Xuất File Word</span>
                </button>
              </div>
            </div>

            {/* Right Printable Document View - Matches exact A4 template */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-8 bg-slate-50/50 print:bg-white print:overflow-visible print:p-0">
              <div 
                id="aggregated-print-document"
                className="print-document bg-white p-8 rounded-xl border border-slate-200 shadow-sm mx-auto max-w-[210mm] min-h-[297mm] text-slate-900 space-y-6 print:border-none print:shadow-none print:p-0 print:m-0"
                style={{ fontFamily: '"Times New Roman", Times, serif' }}
              >
                {/* National Header & Institution Header */}
                <div className="flex flex-col sm:flex-row justify-center items-center sm:items-start text-center border-b border-slate-300 pb-4 gap-6 sm:gap-16">
                  <div className="flex items-center gap-3">
                    <DUELogo size="lg" className="h-14 w-14 flex-shrink-0" />
                    <div className="text-center space-y-0.5">
                      <p className="text-xs font-bold uppercase tracking-wide text-slate-900">TRƯỜNG ĐẠI HỌC KINH TẾ</p>
                      <p className="text-xs font-bold text-slate-900 uppercase underline underline-offset-4">PHÒNG CƠ SỞ VẬT CHẤT</p>
                    </div>
                  </div>

                  <div className="text-center space-y-0.5">
                    <p className="text-xs font-bold uppercase text-slate-900 tracking-wider">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</p>
                    <p className="text-xs font-bold text-slate-900 underline underline-offset-4">Độc lập - Tự do - Hạnh phúc</p>
                    {aggDate ? (
                      <p className="text-[10px] text-slate-500 italic pt-1">
                        Đà Nẵng, ngày {aggDate.split('-')[2] || '...'} tháng {aggDate.split('-')[1] || '...'} năm {aggDate.split('-')[0] || '...'}
                      </p>
                    ) : (
                      <p className="text-[10px] text-slate-500 italic pt-1">Đà Nẵng, ngày ... tháng ... năm ...</p>
                    )}
                  </div>
                </div>

                {/* Document Title */}
                <div className="text-center space-y-1.5 pt-2">
                  <h2 className="text-lg sm:text-xl font-black text-slate-900 uppercase tracking-tight">
                    {aggType === 'transfer' ? 'BIÊN BẢN BÀN GIAO - ĐIỀU CHUYỂN THIẾT BỊ' : 'BIÊN BẢN THU HỒI THIẾT BỊ'}
                  </h2>
                  <p className="text-xs font-mono text-blue-700 font-bold">Số: {aggDocNumber || 'BB-CSVC-2026/OFFICIAL'}</p>
                  <div className="text-center">
                    <p className="text-xs italic text-slate-600 max-w-xl mx-auto pt-1 text-center">
                      (V/v bàn giao, luân chuyển và trang bị thiết bị kỹ thuật phục vụ công tác giảng dạy, học tập)
                    </p>
                  </div>
                </div>

                {/* Legal basis block */}
                <div className="space-y-1 text-[11px] text-slate-800 leading-relaxed bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                  <p className="font-bold text-slate-900">- Căn cứ Quy định quản lý và sử dụng tài sản, thiết bị của Hiệu trưởng Trường Đại học Kinh tế;</p>
                  <p className="font-bold text-slate-900">- Căn cứ nhu cầu sử dụng thực tế của đơn vị sử dụng và kế hoạch điều phối cơ sở vật chất hiện hành;</p>
                  <p className="italic text-slate-600 mt-1">
                    Hôm nay, đại diện phòng Cơ sở vật chất phối hợp cùng đại diện đơn vị sử dụng tiến hành thực hiện giao nhận, lắp đặt bàn giao thiết bị giảng đường tại đơn vị: <strong>{aggFaculty}</strong>
                  </p>
                </div>

                {/* Representing parties */}
                <div className="text-xs space-y-3 pt-2">
                  <p className="font-bold text-slate-900 uppercase tracking-wide border-b border-slate-200 pb-1">I. THÀNH PHẦN THAM GIA BÀN GIAO:</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="p-3 bg-blue-50/50 border border-blue-100 rounded-xl space-y-1">
                      <p className="font-bold text-blue-900 uppercase tracking-wide text-[10px]">Đại diện Bên giao (Bên A) - Phòng CSVC:</p>
                      <p>Họ và tên: <strong className="text-slate-900">{aggPerformedBy}</strong></p>
                      <p className="text-slate-500">Chức vụ: Cán bộ Phòng Cơ sở vật chất</p>
                      <p className="text-slate-500">Địa chỉ: Phòng Cơ sở vật chất - Trường Đại học Kinh tế</p>
                    </div>

                    <div className="p-3 bg-emerald-50/50 border border-emerald-100 rounded-xl space-y-1">
                      <p className="font-bold text-emerald-900 uppercase tracking-wide text-[10px]">Đại diện Bên nhận (Bên B) - Đơn vị sử dụng:</p>
                      <p>Họ và tên: <strong className="text-slate-900">{aggReceiverName}</strong></p>
                      <p className="text-slate-500">Chức vụ: Đại diện quản lý đơn vị</p>
                      <p className="text-slate-500">Đơn vị tiếp nhận: {aggFaculty}</p>
                    </div>
                  </div>
                </div>

                {/* Main Table of Items */}
                <div className="space-y-2 pt-2">
                  <p className="font-bold text-slate-900 uppercase tracking-wide text-xs">II. DANH MỤC THIẾT BỊ BÀN GIAO CHI TIẾT:</p>
                  <div className="overflow-x-auto rounded-lg border border-slate-300">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead className="bg-slate-100 font-bold text-slate-800 uppercase tracking-wider text-[10px]">
                        <tr>
                          <th className="p-2 border-b border-r border-slate-300 w-10 text-center">STT</th>
                          <th className="p-2 border-b border-r border-slate-300">Tên Thiết Bị & Quy Cách</th>
                          <th className="p-2 border-b border-r border-slate-300">Mã Serial Number (SN)</th>
                          <th className="p-2 border-b border-r border-slate-300 text-center">Số Lượng</th>
                          <th className="p-2 border-b border-r border-slate-300">Nguồn Gốc (Phòng cũ)</th>
                          <th className="p-2 border-b border-r border-slate-300">Đích đến (Phòng mới)</th>
                          <th className="p-2 border-b border-slate-300">Trạng Thái Kỹ Thuật</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-300 text-[11px]">
                        {(() => {
                          const listToRender = matchingAggTransfers.filter(t => aggSelectedTransferIds.includes(t.id));
                          if (listToRender.length === 0) {
                            return (
                              <tr>
                                <td colSpan={7} className="p-6 text-center text-slate-400 italic font-semibold">
                                  Chưa chọn thiết bị nào từ danh sách cấu hình.
                                </td>
                              </tr>
                            );
                          }
                          return listToRender.map((t, idx) => (
                            <tr key={t.id || idx} className="hover:bg-slate-50/50">
                              <td className="p-2 border-r border-slate-300 text-center font-semibold">{idx + 1}</td>
                              <td className="p-2 border-r border-slate-300 font-bold text-slate-950">{t.deviceName}</td>
                              <td className="p-2 border-r border-slate-300 font-mono font-bold text-blue-700">{t.deviceSn}</td>
                              <td className="p-2 border-r border-slate-300 text-center font-bold">01</td>
                              <td className="p-2 border-r border-slate-300">{t.fromLocation.lectureHall} - {t.fromLocation.room}</td>
                              <td className="p-2 border-r border-slate-300 font-bold text-emerald-800">{t.toLocation.lectureHall} - {t.toLocation.room}</td>
                              <td className="p-2 font-medium text-slate-600">{t.conditionAtTransfer || 'Hoạt động tốt'}</td>
                            </tr>
                          ));
                        })()}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Reason */}
                <div className="space-y-1 pt-2">
                  <p className="font-bold text-slate-900 uppercase tracking-wide text-xs">III. LÝ DO ĐIỀU PHỐI / BÀN GIAO:</p>
                  <p className="italic text-slate-700 bg-slate-50 p-2.5 rounded-xl border border-slate-200">
                    "{aggReason || 'Điều chuyển lắp đặt thiết bị kỹ thuật giảng đường định kỳ.'}"
                  </p>
                </div>

                {/* Agreement notes */}
                <p className="italic text-slate-600 pt-1 text-center text-[11px]">
                  {aggNotes || 'Biên bản được lập thành 02 bản có giá trị pháp lý như nhau, Bên A giữ 01 bản, Bên B giữ 01 bản để thực hiện./.'}
                </p>

                {/* Sign-off signatures */}
                <div className="grid grid-cols-3 gap-4 text-center text-xs pt-8 pb-12">
                  <div className="space-y-1">
                    <p className="font-bold text-slate-900 uppercase text-[10px]">ĐẠI DIỆN BÊN GIAO (BÊN A)</p>
                    <p className="text-[10px] text-slate-500 italic">(Ký, ghi rõ họ tên)</p>
                    <div className="h-16"></div>
                    <p className="font-bold text-slate-900">{aggPerformedBy}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="font-bold text-slate-900 uppercase text-[10px]">ĐẠI DIỆN BÊN NHẬN (BÊN B)</p>
                    <p className="text-[10px] text-slate-500 italic">(Ký, ghi rõ họ tên)</p>
                    <div className="h-16"></div>
                    <p className="font-bold text-slate-900">{aggReceiverName}</p>
                  </div>

                  <div className="space-y-1">
                    <p className="font-bold text-slate-900 uppercase text-[10px]">KT. TRƯỞNG PHÒNG CSVC</p>
                    <p className="text-[10px] text-slate-500 italic">(Ký, đóng dấu)</p>
                    <div className="h-16"></div>
                  </div>
                </div>
              </div>
            </div>

          </div>
        </div>
      )}

    </div>
  );
};
