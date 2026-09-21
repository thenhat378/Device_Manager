import React from 'react';
import { Device, InspectionRecord, PartReplacementRecord, IncidentReport } from '../types';
import { 
  ResponsiveContainer, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell,
  CartesianGrid 
} from 'recharts';
import { 
  BarChart3, 
  PieChart as PieChartIcon, 
  Download, 
  CheckCircle2, 
  AlertTriangle, 
  Clock, 
  DollarSign, 
  Building2, 
  Layers, 
  Wrench,
  TrendingUp
} from 'lucide-react';

interface AnalyticsDashboardProps {
  devices: Device[];
  inspections: InspectionRecord[];
  replacements: PartReplacementRecord[];
  incidents: IncidentReport[];
}

export const AnalyticsDashboard: React.FC<AnalyticsDashboardProps> = ({
  devices,
  inspections,
  replacements,
  incidents
}) => {
  // Key Metrics
  const totalDevices = devices.length;
  const activeCount = devices.filter(d => d.status === 'active').length;
  const maintenanceCount = devices.filter(d => d.status === 'maintenance_needed').length;
  const damagedCount = devices.filter(d => d.status === 'damaged').length;
  const activeRate = totalDevices > 0 ? Math.round((activeCount / totalDevices) * 100) : 0;
  
  const totalCost = replacements.reduce((sum, r) => sum + r.cost, 0);

  // Chart Data 1: Device status by Lecture Hall / Khu Nhà
  const hallMap: { [hall: string]: { hall: string; active: number; maintenance: number; damaged: number } } = {};
  
  devices.forEach(dev => {
    const h = dev.location.lectureHall || 'Khu A';
    if (!hallMap[h]) {
      hallMap[h] = { hall: h, active: 0, maintenance: 0, damaged: 0 };
    }
    if (dev.status === 'active') hallMap[h].active++;
    else if (dev.status === 'maintenance_needed') hallMap[h].maintenance++;
    else if (dev.status === 'damaged') hallMap[h].damaged++;
  });

  const hallChartData = Object.values(hallMap);

  // Chart Data 2: Device category breakdown (Pie Chart)
  const categoryMap: { [cat: string]: number } = {};
  devices.forEach(dev => {
    categoryMap[dev.category] = (categoryMap[dev.category] || 0) + 1;
  });

  const pieColors = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#64748b'];
  const categoryChartData = Object.keys(categoryMap).map((cat, idx) => ({
    name: cat,
    value: categoryMap[cat],
    color: pieColors[idx % pieColors.length]
  }));

  // Chart Data 3: Cost breakdown by part type
  const partCostMap: { [part: string]: number } = {};
  replacements.forEach(r => {
    const shortName = r.partName.length > 25 ? r.partName.substring(0, 25) + '...' : r.partName;
    partCostMap[shortName] = (partCostMap[shortName] || 0) + r.cost;
  });

  const costChartData = Object.keys(partCostMap).map(p => ({
    part: p,
    cost: partCostMap[p]
  }));

  // CSV Exporter
  const exportToCSV = () => {
    const getVietnameseStatus = (status: string) => {
      switch (status) {
        case 'active': return 'Hoạt động tốt (Đang sử dụng ổn định)';
        case 'maintenance_needed': return 'Cần bảo trì (Đang lên lịch kiểm tra định kỳ)';
        case 'damaged': return 'Hư hỏng / Sự cố (Chờ kỹ thuật xử lý)';
        case 'decommissioned': return 'Đã thanh lý (Ngưng sử dụng)';
        case 'spare': return 'Thiết bị dự phòng (Sẵn sàng thay thế)';
        default: return status;
      }
    };

    const getDetailedNotes = (d: Device) => {
      const devInsps = inspections.filter(i => i.deviceId === d.id || i.deviceSn === d.serialNumber);

      const parts: string[] = [];

      // Khảo sát & kiểm tra bảo trì định kỳ
      devInsps.forEach(insp => {
        const checkSummary = [
          `Nguồn: ${insp.checkPower ? 'Đạt' : 'Kém'}`,
          `Hiển thị/Âm thanh: ${insp.checkDisplayAudio ? 'Đạt' : 'Kém'}`,
          `Cáp kết nối: ${insp.checkConnections ? 'Đạt' : 'Kém'}`,
          `Quạt/Vệ sinh: ${insp.checkCleaningFan ? 'Đạt' : 'Kém'}`
        ].join(', ');
        const inspText = `[Kiểm tra ngày ${insp.inspectionDate} - KTV: ${insp.inspectorName} - Kết quả: ${insp.result.toUpperCase()}]: Checklist: (${checkSummary})${insp.notes ? ' - Nhận xét: ' + insp.notes : ''}`;
        parts.push(inspText);
      });

      return parts.length > 0 ? parts.join(' | ') : 'Không có lịch sử kiểm tra';
    };

    const headers = ['Mã SN', 'Tên Thiết Bị', 'Loại Thiết Bị', 'Khoa', 'Giảng Đường', 'Phòng', 'Trạng Thái & Chi Tiết', 'Ngày Dùng', 'Hạn BH', 'Nhà Cung Cấp', 'Chi Tiết Ghi Chú Kiểm Tra'];
    const rows = devices.map(d => [
      d.serialNumber,
      `"${d.name.replace(/"/g, '""')}"`,
      `"${d.category.replace(/"/g, '""')}"`,
      `"${d.location.faculty}"`,
      `"${d.location.lectureHall}"`,
      d.location.room,
      `"${getVietnameseStatus(d.status)}"`,
      d.purchaseDate,
      d.warrantyUntil,
      `"${d.supplier}"`,
      `"${getDetailedNotes(d).replace(/"/g, '""')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,\uFEFF' 
      + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Bao_Cao_Thong_Ke_Thiet_Bi_${new Date().toISOString().split('T')[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      
      {/* Header & Export button */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-5 rounded-xl shadow-sm border border-slate-200">
        <div>
          <h2 className="text-base font-bold text-slate-900 flex items-center gap-2">
            <BarChart3 className="h-5 w-5 text-blue-600" />
            Bảng Tổng Hợp Thống Kê Tình Trạng & Thay Thế Vật Tư
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            Phân tích số liệu thiết bị, chi phí vật tư và thống kê sự cố hư hỏng giảng đường
          </p>
        </div>

        <button
          onClick={exportToCSV}
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 px-4 py-2 text-xs font-medium text-white transition shadow-sm shrink-0"
        >
          <Download className="h-4 w-4" />
          Xuất Báo Cáo CSV (Excel)
        </button>
      </div>

      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        
        {/* Total Devices */}
        <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Tổng Thiết Bị</span>
            <p className="text-2xl font-bold text-slate-900 mt-1">{totalDevices}</p>
            <p className="text-[11px] text-blue-600 font-medium mt-1">
              Tỷ lệ hoạt động: {activeRate}%
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-slate-100 text-slate-700">
            <Layers className="h-5 w-5" />
          </div>
        </div>

        {/* Active Devices */}
        <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Hoạt Động Tốt</span>
            <p className="text-2xl font-bold text-emerald-600 mt-1">{activeCount}</p>
            <p className="text-[11px] text-slate-500 mt-1">Sẵn sàng giảng dạy</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600 border border-emerald-200">
            <CheckCircle2 className="h-5 w-5" />
          </div>
        </div>

        {/* Maintenance / Damaged */}
        <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Bảo Trì / Hư Hỏng</span>
            <p className="text-2xl font-bold text-rose-600 mt-1">{maintenanceCount + damagedCount}</p>
            <p className="text-[11px] text-amber-600 font-medium mt-1">
              {maintenanceCount} cần bảo trì • {damagedCount} hư hỏng
            </p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-rose-50 text-rose-600 border border-rose-200">
            <AlertTriangle className="h-5 w-5" />
          </div>
        </div>

        {/* Total Replacement Cost */}
        <div className="rounded-xl bg-white p-4 shadow-sm border border-slate-200 flex items-center justify-between">
          <div>
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Tổng Chi Phí Vật Tư</span>
            <p className="text-xl font-bold text-slate-900 mt-1">{totalCost.toLocaleString('vi-VN')} đ</p>
            <p className="text-[11px] text-slate-500 mt-1">{replacements.length} đợt thay mới</p>
          </div>
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-amber-50 text-amber-600 border border-amber-200">
            <Wrench className="h-5 w-5" />
          </div>
        </div>

      </div>

      {/* Visual Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Chart 1: Device Status by Lecture Hall / Khu Nhà */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <Building2 className="h-4 w-4 text-emerald-600" />
              Thống Kê Trạng Thái Thiết Bị Theo Giảng Đường / Khu Nhà
            </h3>
          </div>
          <div className="h-[280px] w-full pt-2">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hallChartData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="hall" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                <Bar dataKey="active" name="Hoạt động tốt" fill="#10b981" radius={[4, 4, 0, 0]} />
                <Bar dataKey="maintenance" name="Cần bảo trì" fill="#f59e0b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="damaged" name="Hư hỏng" fill="#ef4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Chart 2: Category Breakdown */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <h3 className="font-bold text-sm text-slate-900 flex items-center gap-2">
              <PieChartIcon className="h-4 w-4 text-emerald-600" />
              Cơ Cấu Tỷ Lệ Loại Thiết Bị Giảng Đường
            </h3>
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-2 h-[280px] overflow-hidden">
            <div className="relative w-full sm:w-1/2 h-[200px] sm:h-full flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={categoryChartData}
                    cx="50%"
                    cy="50%"
                    innerRadius={65}
                    outerRadius={85}
                    paddingAngle={3}
                    dataKey="value"
                  >
                    {categoryChartData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip 
                    formatter={(value: any, name: any) => [`${value} thiết bị`, name]}
                    contentStyle={{ borderRadius: '8px', border: '1px solid #e2e8f0', fontSize: '12px' }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Centered Total Devices indicator */}
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Tổng số</span>
                <span className="text-2xl font-black text-slate-800">{totalDevices}</span>
                <span className="text-[10px] text-slate-500 font-medium">thiết bị</span>
              </div>
            </div>

            {/* Custom Side Legend with detailed breakdown */}
            <div className="flex-1 w-full max-h-[220px] overflow-y-auto pr-2 space-y-1.5 scrollbar-thin scrollbar-thumb-slate-200">
              {categoryChartData.map((entry, idx) => {
                const percentage = totalDevices > 0 ? ((entry.value / totalDevices) * 100).toFixed(1) : '0.0';
                return (
                  <div key={idx} className="flex items-center justify-between text-xs py-1 px-2.5 rounded-lg hover:bg-slate-50 transition border border-transparent hover:border-slate-100">
                    <div className="flex items-center gap-2 min-w-0">
                      <div 
                        className="h-2.5 w-2.5 rounded-full shrink-0" 
                        style={{ backgroundColor: entry.color }}
                      />
                      <span className="font-semibold text-slate-700 truncate">{entry.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="font-bold text-slate-900">{entry.value}</span>
                      <span className="text-slate-400 font-medium text-[11px]">({percentage}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

      </div>

      {/* Summary Tables for Replacements & Incidents */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Table 1: Top Part Replacements */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <Wrench className="h-4 w-4 text-emerald-600" />
            Bảng Tổng Hợp Thay Thế Vật Tư Gần Đưa Vào Sử Dụng
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">Mã SN</th>
                  <th className="py-2.5 px-3">Vật Tư Thay Thế</th>
                  <th className="py-2.5 px-3">Kỹ Thuật Viên</th>
                  <th className="py-2.5 px-3 text-right">Chi Phí (VNĐ)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {replacements.map((r) => (
                  <tr key={r.id}>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{r.deviceSn}</td>
                    <td className="py-2.5 px-3 font-semibold">{r.partName}</td>
                    <td className="py-2.5 px-3 text-slate-500">{r.replacedBy}</td>
                    <td className="py-2.5 px-3 text-right font-bold text-emerald-700">{r.cost.toLocaleString('vi-VN')} đ</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Table 2: Incident Frequency & Status */}
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
          <h3 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3 flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-600" />
            Bảng Thống Kê Sự Cố Hư Hỏng & Tần Suất Lỗi
          </h3>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-50 text-slate-600 font-bold border-b border-slate-200">
                  <th className="py-2.5 px-3">Mã SN</th>
                  <th className="py-2.5 px-3">Nội Dung Sự Cố</th>
                  <th className="py-2.5 px-3">Mức Độ</th>
                  <th className="py-2.5 px-3 text-right">Trạng Thái</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {incidents.map((inc) => (
                  <tr key={inc.id}>
                    <td className="py-2.5 px-3 font-mono font-bold text-slate-900">{inc.deviceSn}</td>
                    <td className="py-2.5 px-3 max-w-[180px] truncate">{inc.description}</td>
                    <td className="py-2.5 px-3">
                      <span className={`px-2 py-0.5 rounded font-bold text-[10px] ${
                        inc.severity === 'urgent' ? 'bg-rose-100 text-rose-800' : 'bg-slate-100 text-slate-700'
                      }`}>
                        {inc.severity.toUpperCase()}
                      </span>
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold">
                      {inc.status === 'resolved' ? (
                        <span className="text-emerald-600">Xong</span>
                      ) : (
                        <span className="text-amber-600">Đang xử lý</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>

    </div>
  );
};
