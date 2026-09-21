import React, { useState } from 'react';
import { Device, InspectionRecord, IncidentReport } from '../types';
import { LECTURE_HALLS } from '../data/mockData';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Clock, 
  Wrench, 
  CheckCircle2, 
  AlertTriangle, 
  XCircle, 
  Search, 
  Filter, 
  ShieldAlert, 
  List, 
  Grid, 
  ArrowRight, 
  MapPin, 
  Building,
  Plus,
  Info,
  X
} from 'lucide-react';

interface MaintenanceCalendarProps {
  devices: Device[];
  inspections: InspectionRecord[];
  incidents: IncidentReport[];
  onSelectDeviceForInspection: (deviceSn: string) => void;
}

export type CalendarEventType = 'schedule' | 'inspection' | 'incident' | 'warranty';

export interface CalendarEvent {
  id: string;
  date: string; // YYYY-MM-DD
  type: CalendarEventType;
  title: string;
  deviceSn: string;
  deviceName: string;
  room: string;
  lectureHall: string;
  status?: string;
  details?: string;
}

export const MaintenanceCalendar: React.FC<MaintenanceCalendarProps> = ({
  devices,
  inspections,
  incidents,
  onSelectDeviceForInspection,
}) => {
  // Calendar month state (defaults to August 2026 or current date)
  const [currentDate, setCurrentDate] = useState(() => {
    const today = new Date();
    // If year < 2026, set default to Aug 2026 for rich mock data visibility
    if (today.getFullYear() < 2026) return new Date(2026, 7, 1);
    return new Date();
  });

  const [viewMode, setViewMode] = useState<'calendar' | 'list'>('calendar');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);
  const [selectedLectureHall, setSelectedLectureHall] = useState<string>('all');
  const [eventTypeFilter, setEventTypeFilter] = useState<'all' | CalendarEventType>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Month & Year derived
  const year = currentDate.getFullYear();
  const month = currentDate.getMonth(); // 0-indexed (0 = Jan, 7 = Aug)

  const monthNames = [
    'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
    'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
  ];

  const handlePrevMonth = () => {
    setCurrentDate(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentDate(new Date(year, month + 1, 1));
  };

  const handleToday = () => {
    setCurrentDate(new Date(2026, 7, 1)); // Set to 01/08/2026 default mock focus
  };

  // Helper format YYYY-MM-DD
  const formatDateString = (y: number, m: number, d: number) => {
    const mm = String(m + 1).padStart(2, '0');
    const dd = String(d).padStart(2, '0');
    return `${y}-${mm}-${dd}`;
  };

  // Collect all calendar events from devices, inspections, incidents
  const allEvents: CalendarEvent[] = [];

  // 1. Next Maintenance Scheduled Dates from devices
  devices.forEach(dev => {
    if (dev.nextMaintenanceDate) {
      allEvents.push({
        id: `sched-${dev.id}`,
        date: dev.nextMaintenanceDate,
        type: 'schedule',
        title: `Lịch bảo trì: ${dev.name}`,
        deviceSn: dev.serialNumber,
        deviceName: dev.name,
        room: dev.location.room,
        lectureHall: dev.location.lectureHall,
        status: dev.status,
        details: `Cần kiểm tra định kỳ tại ${dev.location.room} (${dev.location.lectureHall})`
      });
    }

    // Warranty expiry dates
    if (dev.warrantyUntil) {
      allEvents.push({
        id: `warr-${dev.id}`,
        date: dev.warrantyUntil,
        type: 'warranty',
        title: `Hết hạn bảo hành: ${dev.name}`,
        deviceSn: dev.serialNumber,
        deviceName: dev.name,
        room: dev.location.room,
        lectureHall: dev.location.lectureHall,
        details: `Hạn bảo hành nhà cung cấp: ${dev.supplier}`
      });
    }
  });

  // 2. Completed Inspection Records
  inspections.forEach(insp => {
    allEvents.push({
      id: `insp-${insp.id}`,
      date: insp.inspectionDate,
      type: 'inspection',
      title: `Đã kiểm tra (${insp.result === 'passed' ? 'Đạt' : insp.result === 'warning' ? 'Cần bảo trì' : 'Lỗi'})`,
      deviceSn: insp.deviceSn,
      deviceName: insp.deviceName,
      room: 'Giảng đường',
      lectureHall: 'Tòa nhà',
      status: insp.result,
      details: insp.notes
    });
  });

  // 3. Incidents Reported
  incidents.forEach(inc => {
    const dateStr = inc.reportedAt ? inc.reportedAt.split('T')[0] : '';
    if (dateStr) {
      allEvents.push({
        id: `inc-${inc.id}`,
        date: dateStr,
        type: 'incident',
        title: `Báo sự cố [${inc.severity.toUpperCase()}]: ${inc.deviceName}`,
        deviceSn: inc.deviceSn,
        deviceName: inc.deviceName,
        room: inc.room,
        lectureHall: inc.lectureHall || '',
        status: inc.status,
        details: inc.description
      });
    }
  });

  // Filter events
  const filteredEvents = allEvents.filter(ev => {
    if (selectedLectureHall !== 'all' && !ev.lectureHall.includes(selectedLectureHall)) return false;
    if (eventTypeFilter !== 'all' && ev.type !== eventTypeFilter) return false;
    if (searchQuery.trim() !== '') {
      const q = searchQuery.toLowerCase();
      return (
        ev.deviceName.toLowerCase().includes(q) ||
        ev.deviceSn.toLowerCase().includes(q) ||
        ev.room.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // Generate Calendar Days Grid
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0 = Sun, 1 = Mon ...
  // Convert Sun=0 to Mon=0 indexed for Vietnamese calendar layout (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
  const startPadding = (firstDayOfWeek + 6) % 7; 

  const totalCells = Math.ceil((startPadding + daysInMonth) / 7) * 7;

  // Month Statistics
  const monthString = `${year}-${String(month + 1).padStart(2, '0')}`;
  const monthScheduledEvents = filteredEvents.filter(e => e.date.startsWith(monthString) && e.type === 'schedule');
  const monthCompletedInspections = filteredEvents.filter(e => e.date.startsWith(monthString) && e.type === 'inspection');
  const monthIncidents = filteredEvents.filter(e => e.date.startsWith(monthString) && e.type === 'incident');

  // Days array builder
  const calendarCells = [];
  for (let i = 0; i < totalCells; i++) {
    const dayNumber = i - startPadding + 1;
    const isCurrentMonth = dayNumber > 0 && dayNumber <= daysInMonth;

    let dateStr = '';
    if (isCurrentMonth) {
      dateStr = formatDateString(year, month, dayNumber);
    } else if (dayNumber <= 0) {
      // Prev month
      const prevM = new Date(year, month, 0);
      dateStr = formatDateString(prevM.getFullYear(), prevM.getMonth(), prevM.getDate() + dayNumber);
    } else {
      // Next month
      const nextM = new Date(year, month + 1, 1);
      dateStr = formatDateString(nextM.getFullYear(), nextM.getMonth(), dayNumber - daysInMonth);
    }

    const dayEvents = filteredEvents.filter(e => e.date === dateStr);
    const isToday = dateStr === '2026-08-01'; // Mock today date reference

    calendarCells.push({
      cellIndex: i,
      dayNumber: isCurrentMonth ? dayNumber : new Date(dateStr).getDate(),
      isCurrentMonth,
      dateStr,
      events: dayEvents,
      isToday
    });
  }

  // Selected Day's events
  const selectedDayEvents = selectedDay ? filteredEvents.filter(e => e.date === selectedDay) : [];

  return (
    <div className="space-y-6">
      
      {/* Top Banner & Header Controls */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-slate-200 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <CalendarIcon className="h-5 w-5 text-blue-600" />
            Lịch Bảo Trì & Kiểm Tra Định Kỳ
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Theo dõi các mốc thời gian kiểm tra, lịch bảo trì dự kiến và sự cố thiết bị theo từng tháng
          </p>
        </div>

        <div className="flex items-center gap-2 self-stretch sm:self-auto justify-between sm:justify-end">
          {/* View Mode Toggle */}
          <div className="flex items-center bg-slate-100 p-1 rounded-lg border border-slate-200 text-xs">
            <button
              onClick={() => setViewMode('calendar')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                viewMode === 'calendar'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Grid className="h-3.5 w-3.5" />
              <span>Khung Nhìn Lịch</span>
            </button>
            <button
              onClick={() => setViewMode('list')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md font-medium transition ${
                viewMode === 'list'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <List className="h-3.5 w-3.5" />
              <span>Danh Sách Sắp Tới</span>
            </button>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards for Current Month */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Lịch Bảo Trì Tháng</span>
            <p className="text-xl font-bold text-blue-600 mt-0.5">{monthScheduledEvents.length}</p>
            <span className="text-[10px] text-slate-400">Đợt dự kiến cần kiểm tra</span>
          </div>
          <div className="h-9 w-9 rounded-lg bg-blue-50 border border-blue-200 text-blue-600 flex items-center justify-center shrink-0">
            <Clock className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Đã Kiểm Tra Tháng</span>
            <p className="text-xl font-bold text-emerald-600 mt-0.5">{monthCompletedInspections.length}</p>
            <span className="text-[10px] text-slate-400">Đã hoàn thành</span>
          </div>
          <div className="h-9 w-9 rounded-lg bg-emerald-50 border border-emerald-200 text-emerald-600 flex items-center justify-center shrink-0">
            <CheckCircle2 className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Sự Cố Phát Sinh</span>
            <p className="text-xl font-bold text-rose-600 mt-0.5">{monthIncidents.length}</p>
            <span className="text-[10px] text-slate-400">Cần xử lý sửa chữa</span>
          </div>
          <div className="h-9 w-9 rounded-lg bg-rose-50 border border-rose-200 text-rose-600 flex items-center justify-center shrink-0">
            <AlertTriangle className="h-4 w-4" />
          </div>
        </div>

        <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider block">Tổng Số Thiết Bị</span>
            <p className="text-xl font-bold text-slate-800 mt-0.5">{devices.length}</p>
            <span className="text-[10px] text-slate-400">Đang được quản lý lịch</span>
          </div>
          <div className="h-9 w-9 rounded-lg bg-slate-100 border border-slate-200 text-slate-600 flex items-center justify-center shrink-0">
            <Wrench className="h-4 w-4" />
          </div>
        </div>
      </div>

      {/* Filter & Month Navigation Bar */}
      <div className="bg-white p-4 rounded-xl shadow-sm border border-slate-200 space-y-3">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          
          {/* Month Navigator */}
          <div className="flex items-center gap-2">
            <button
              onClick={handlePrevMonth}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 transition text-slate-700"
              title="Tháng trước"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            
            <h3 className="text-sm font-bold text-slate-900 min-w-[130px] text-center">
              {monthNames[month]} / {year}
            </h3>

            <button
              onClick={handleNextMonth}
              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-100 transition text-slate-700"
              title="Tháng sau"
            >
              <ChevronRight className="h-4 w-4" />
            </button>

            <button
              onClick={handleToday}
              className="ml-2 rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-200 transition border border-slate-200"
            >
              Hôm nay
            </button>
          </div>

          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            {/* Lecture Hall Filter */}
            <select
              value={selectedLectureHall}
              onChange={(e) => setSelectedLectureHall(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Tất cả khu vực</option>
              {LECTURE_HALLS.map(hall => (
                <option key={hall} value={hall}>{hall}</option>
              ))}
            </select>

            {/* Event Type Filter */}
            <select
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value as any)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:border-blue-500"
            >
              <option value="all">Tất cả loại sự kiện</option>
              <option value="schedule">📅 Lịch bảo trì sắp tới</option>
              <option value="inspection">📋 Nhật ký đã kiểm tra</option>
              <option value="incident">⚠️ Sự cố báo về</option>
              <option value="warranty">🛡️ Hạn bảo hành</option>
            </select>

            {/* Search Input */}
            <div className="relative flex-grow sm:flex-grow-0 sm:w-44">
              <Search className="absolute left-2.5 top-2 h-3.5 w-3.5 text-slate-400" />
              <input
                type="text"
                placeholder="Tìm thiết bị / phòng..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full rounded-lg border border-slate-300 bg-white pl-8 pr-2.5 py-1 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      {/* Main Calendar View */}
      {viewMode === 'calendar' ? (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
          
          {/* Day Headers (Mon - Sun) */}
          <div className="grid grid-cols-7 bg-slate-50 border-b border-slate-200 text-center text-[10px] sm:text-xs font-semibold text-slate-600 py-2 sm:py-2.5">
            <div><span className="sm:hidden">T2</span><span className="hidden sm:inline">Thứ 2</span></div>
            <div><span className="sm:hidden">T3</span><span className="hidden sm:inline">Thứ 3</span></div>
            <div><span className="sm:hidden">T4</span><span className="hidden sm:inline">Thứ 4</span></div>
            <div><span className="sm:hidden">T5</span><span className="hidden sm:inline">Thứ 5</span></div>
            <div><span className="sm:hidden">T6</span><span className="hidden sm:inline">Thứ 6</span></div>
            <div className="text-blue-600"><span className="sm:hidden">T7</span><span className="hidden sm:inline">Thứ 7</span></div>
            <div className="text-rose-600"><span className="sm:hidden">CN</span><span className="hidden sm:inline">Chủ Nhật</span></div>
          </div>

          {/* Calendar Grid Cells */}
          <div className="grid grid-cols-7 divide-x divide-y divide-slate-100 bg-slate-100/50">
            {calendarCells.map((cell) => {
              const isSelected = selectedDay === cell.dateStr;

              return (
                <div
                  key={cell.cellIndex}
                  onClick={() => setSelectedDay(cell.dateStr)}
                  className={`min-h-[65px] sm:min-h-[110px] p-0.5 sm:p-1.5 bg-white transition cursor-pointer flex flex-col justify-between hover:bg-blue-50/40 relative ${
                    !cell.isCurrentMonth ? 'bg-slate-50/60 text-slate-400' : 'text-slate-800'
                  } ${isSelected ? 'ring-2 ring-blue-500 bg-blue-50/30 z-10' : ''}`}
                >
                  {/* Day Header */}
                  <div className="flex items-center justify-between mb-0.5 sm:mb-1">
                    <span
                      className={`inline-flex items-center justify-center h-5 w-5 sm:h-6 sm:w-6 text-[10px] sm:text-xs font-bold rounded-full ${
                        cell.isToday
                          ? 'bg-blue-600 text-white shadow-sm ring-1 sm:ring-2 ring-blue-200'
                          : isSelected
                          ? 'bg-slate-900 text-white'
                          : 'text-slate-700'
                      }`}
                    >
                      {cell.dayNumber}
                    </span>

                    {cell.events.length > 0 && (
                      <span className="text-[9px] sm:text-[10px] font-bold text-slate-500 bg-slate-100 px-1 sm:px-1.5 py-0.2 rounded border border-slate-200">
                        {cell.events.length}
                      </span>
                    )}
                  </div>

                  {/* Day Event Pills */}
                  <div className="space-y-1 flex-1 overflow-hidden">
                    {/* Desktop/Tablet text pills */}
                    <div className="hidden sm:block space-y-1">
                      {cell.events.slice(0, 3).map((ev) => {
                        let badgeStyle = 'bg-blue-50 text-blue-700 border-blue-200';
                        let icon = '📅';

                        if (ev.type === 'inspection') {
                          if (ev.status === 'passed') {
                            badgeStyle = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                            icon = '✅';
                          } else {
                            badgeStyle = 'bg-amber-50 text-amber-700 border-amber-200';
                            icon = '⚠️';
                          }
                        } else if (ev.type === 'incident') {
                          badgeStyle = 'bg-rose-50 text-rose-700 border-rose-200';
                          icon = '🚨';
                        } else if (ev.type === 'warranty') {
                          badgeStyle = 'bg-slate-100 text-slate-600 border-slate-200';
                          icon = '🛡️';
                        }

                        return (
                          <div
                            key={ev.id}
                            className={`text-[10px] p-1 rounded border truncate font-medium flex items-center gap-1 ${badgeStyle}`}
                            title={`${ev.title} (${ev.room})`}
                          >
                            <span className="shrink-0">{icon}</span>
                            <span className="truncate">{ev.deviceName}</span>
                          </div>
                        );
                      })}

                      {cell.events.length > 3 && (
                        <div className="text-[10px] text-blue-600 font-semibold pl-1">
                          + {cell.events.length - 3} sự kiện...
                        </div>
                      )}
                    </div>

                    {/* Mobile Dot/Pill Summary View */}
                    <div className="sm:hidden flex flex-wrap gap-0.5 justify-center mt-0.5">
                      {cell.events.slice(0, 4).map((ev) => {
                        let dotColor = 'bg-blue-500';
                        if (ev.type === 'inspection') dotColor = 'bg-emerald-500';
                        if (ev.type === 'incident') dotColor = 'bg-rose-500';
                        if (ev.type === 'warranty') dotColor = 'bg-slate-400';

                        return (
                          <span
                            key={ev.id}
                            className={`h-1.5 w-1.5 rounded-full ${dotColor}`}
                            title={ev.title}
                          />
                        );
                      })}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* Upcoming List View */
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 space-y-3">
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider mb-2">
            Danh Sách Lịch Kiểm Tra & Sự Cố Cần Xử Lý ({filteredEvents.length} sự kiện)
          </h3>

          <div className="divide-y divide-slate-100">
            {filteredEvents.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-500">
                Không tìm thấy sự kiện bảo trì nào phù hợp với bộ lọc.
              </div>
            ) : (
              filteredEvents
                .sort((a, b) => a.date.localeCompare(b.date))
                .map((ev) => (
                  <div key={ev.id} className="py-3 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 hover:bg-slate-50 px-2 rounded-lg transition">
                    <div className="flex items-start gap-3">
                      <div className="text-center min-w-[60px] bg-slate-100 p-2 rounded-lg border border-slate-200 shrink-0">
                        <span className="text-[10px] font-bold uppercase text-slate-500 block">
                          {new Date(ev.date).toLocaleDateString('vi-VN', { month: 'short' })}
                        </span>
                        <span className="text-base font-bold text-slate-900">
                          {new Date(ev.date).getDate()}
                        </span>
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded border ${
                            ev.type === 'schedule' ? 'bg-blue-50 text-blue-700 border-blue-200' :
                            ev.type === 'inspection' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                            ev.type === 'incident' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                            'bg-slate-100 text-slate-700 border-slate-200'
                          }`}>
                            {ev.type === 'schedule' ? 'Lịch Bảo Trì' :
                             ev.type === 'inspection' ? 'Nhật Ký Kiểm Tra' :
                             ev.type === 'incident' ? 'Báo Sự Cố' : 'Bảo Hành'}
                          </span>

                          <span className="text-xs font-bold text-slate-900">{ev.deviceName}</span>
                          <span className="text-xs font-mono text-slate-500">({ev.deviceSn})</span>
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-slate-400" />
                            {ev.room} - {ev.lectureHall}
                          </span>
                          {ev.details && <span>• {ev.details}</span>}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => onSelectDeviceForInspection(ev.deviceSn)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 px-3 py-1.5 text-xs font-medium text-white transition shadow-sm shrink-0 self-end sm:self-center"
                    >
                      <Wrench className="h-3.5 w-3.5" />
                      Thực Hiện Kiểm Tra
                    </button>
                  </div>
                ))
            )}
          </div>
        </div>
      )}

      {/* Selected Day Inspector Side Drawer / Modal */}
      {selectedDay && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-md h-full shadow-2xl p-6 overflow-y-auto flex flex-col justify-between border-l border-slate-200 animate-in slide-in-from-right-4 duration-200">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-slate-200">
                <div>
                  <span className="text-[10px] font-bold text-blue-600 uppercase tracking-widest block">
                    CHI TIẾT LỊCH BẢO TRÌ
                  </span>
                  <h3 className="text-base font-bold text-slate-900 mt-0.5">
                    Ngày {new Date(selectedDay).toLocaleDateString('vi-VN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </h3>
                </div>
                <button
                  onClick={() => setSelectedDay(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <div className="py-4 space-y-4">
                {selectedDayEvents.length === 0 ? (
                  <div className="text-center py-8 text-xs text-slate-500 space-y-2">
                    <Info className="h-8 w-8 mx-auto text-slate-300" />
                    <p>Không có lịch bảo trì hay sự cố nào được ghi nhận trong ngày này.</p>
                  </div>
                ) : (
                  selectedDayEvents.map((ev) => (
                    <div key={ev.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded border uppercase ${
                          ev.type === 'schedule' ? 'bg-blue-100 text-blue-800 border-blue-300' :
                          ev.type === 'inspection' ? 'bg-emerald-100 text-emerald-800 border-emerald-300' :
                          ev.type === 'incident' ? 'bg-rose-100 text-rose-800 border-rose-300' :
                          'bg-slate-200 text-slate-700 border-slate-300'
                        }`}>
                          {ev.type === 'schedule' ? 'Lịch Bảo Trì Dự Kiến' :
                           ev.type === 'inspection' ? 'Nhật Ký Kiểm Tra' :
                           ev.type === 'incident' ? 'Sự Cố Hư Hỏng' : 'Hạn Bảo Hành'}
                        </span>
                        <span className="text-xs font-mono text-slate-500">{ev.deviceSn}</span>
                      </div>

                      <h4 className="text-sm font-bold text-slate-900">{ev.deviceName}</h4>
                      
                      <div className="text-xs text-slate-600 space-y-1">
                        <p className="flex items-center gap-1.5">
                          <Building className="h-3.5 w-3.5 text-slate-400" />
                          <span>Vị trí: <strong>{ev.room}</strong> - {ev.lectureHall}</span>
                        </p>
                        {ev.details && (
                          <p className="text-slate-500 italic bg-white p-2 rounded border border-slate-200">
                            "{ev.details}"
                          </p>
                        )}
                      </div>

                      <div className="pt-2">
                        <button
                          onClick={() => {
                            setSelectedDay(null);
                            onSelectDeviceForInspection(ev.deviceSn);
                          }}
                          className="w-full flex items-center justify-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-medium py-2 transition shadow-sm"
                        >
                          <Wrench className="h-3.5 w-3.5" />
                          Lập Biên Bản Kiểm Tra Ngay
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            <div className="pt-4 border-t border-slate-200">
              <button
                onClick={() => setSelectedDay(null)}
                className="w-full py-2.5 rounded-lg border border-slate-300 text-xs font-medium text-slate-700 hover:bg-slate-100 transition"
              >
                Đóng
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
