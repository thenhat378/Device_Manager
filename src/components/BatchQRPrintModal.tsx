import React, { useState, useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Device } from '../types';
import { 
  X, 
  Printer, 
  CheckSquare, 
  Square, 
  Filter, 
  Grid, 
  SlidersHorizontal,
  Building2,
  MapPin,
  QrCode,
  Tag,
  CheckCircle2
} from 'lucide-react';
import { DUELogo } from './DUELogo';
import { FACULTIES, LECTURE_HALLS } from '../data/mockData';

interface BatchQRPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  devices: Device[];
}

export const BatchQRPrintModal: React.FC<BatchQRPrintModalProps> = ({
  isOpen,
  onClose,
  devices
}) => {
  const [selectedIds, setSelectedIds] = useState<string[]>(() => devices.map(d => d.id));
  const [gridDensity, setGridDensity] = useState<6 | 8 | 12>(8); // Labels per A4 page
  const [lectureHallFilter, setLectureHallFilter] = useState<string>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string>('ALL');

  const printRef = useRef<HTMLDivElement>(null);

  if (!isOpen) return null;

  // Filtered devices list for selection
  const filteredDevices = devices.filter(dev => {
    const matchLectureHall = lectureHallFilter === 'ALL' || dev.location.lectureHall === lectureHallFilter;
    const matchCategory = categoryFilter === 'ALL' || dev.category === categoryFilter;
    return matchLectureHall && matchCategory;
  });

  const selectedDevices = devices.filter(d => selectedIds.includes(d.id));

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredDevices.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredDevices.map(d => d.id));
    }
  };

  const toggleSelectDevice = (id: string) => {
    setSelectedIds(prev => 
      prev.includes(id) ? prev.filter(item => item !== id) : [...prev, id]
    );
  };

  const handlePrintA4 = () => {
    if (selectedDevices.length === 0) return;

    const printWindow = window.open('', '_blank', 'width=900,height=800');
    if (!printWindow) {
      alert('Trình duyệt chặn mở cửa sổ in. Vui lòng cho phép popup để in hàng loạt mã QR.');
      return;
    }

    // Determine grid columns based on density
    let cols = 2;
    if (gridDensity === 12) cols = 3;

    // Access rendered SVGs from DOM element preview for 100% exact print output
    const previewContainer = printRef.current;
    let renderedGridHtml = '';
    if (previewContainer) {
      renderedGridHtml = previewContainer.innerHTML;
    }

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>In Tem QR Hàng Loạt Khổ A4 - Trường Đại Học Kinh Tế</title>
        </head>
        <body style="margin: 0; padding: 0; background: #fff;">
          <div class="no-print" style="padding: 12px; background: #e0f2fe; border-bottom: 1px solid #bae6fd; font-size: 13px; text-align: center; margin-bottom: 16px; font-family: sans-serif;">
            📄 Khung xem trước trang in A4. Nhấn <strong>Ctrl+P</strong> hoặc nút in dưới đây.
            <button onclick="window.print()" style="margin-left: 12px; padding: 6px 16px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
              In Ngay (Print A4)
            </button>
          </div>
          
          <div class="a4-grid" style="padding: 0; margin: 0;">
            ${renderedGridHtml}
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 500);
            };
          </script>
        </body>
      </html>
    `);

    // Copy all style tags and link stylesheet tags from current window to the print window
    Array.from(window.document.querySelectorAll('style, link[rel="stylesheet"]')).forEach(el => {
      try {
        printWindow.document.head.appendChild(el.cloneNode(true));
      } catch (e) {
        console.error('Error copying stylesheet element:', e);
      }
    });

    // Add extra print-specific overrides
    const printStyle = printWindow.document.createElement('style');
    printStyle.innerHTML = `
      @page {
        size: A4 portrait;
        margin: 8mm 6mm 8mm 6mm;
      }
      * { box-sizing: border-box; }
      body { 
        background: #fff !important;
        color: #000 !important;
      }
      .a4-grid {
        display: grid !important;
        grid-template-columns: repeat(${cols}, minmax(0, 1fr)) !important;
        gap: 6mm !important;
        width: 100% !important;
      }
      .qr-card-item {
        page-break-inside: avoid !important;
        break-inside: avoid !important;
      }
      @media print {
        .no-print { display: none !important; }
        body { padding: 0 !important; margin: 0 !important; }
      }
    `;
    printWindow.document.head.appendChild(printStyle);

    printWindow.document.close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-2 sm:p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-5xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-200 flex flex-col max-h-[95vh]">
        
        {/* Header */}
        <div className="flex items-center justify-between bg-slate-900 px-4 sm:px-6 py-3.5 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 text-white font-bold shadow-sm shrink-0">
              <Printer className="h-5 w-5" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base tracking-wide leading-tight">In Hàng Loạt Tem Mã QR Thiết Bị (Khổ A4)</h3>
              <p className="text-[11px] text-slate-400">Tự động dàn trang A4 vừa vặn để in decal dán thiết bị</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Toolbar & Filter Bar */}
        <div className="bg-slate-100 p-3 sm:p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          
          {/* Left Selection Actions */}
          <div className="flex items-center gap-2">
            <button
              onClick={toggleSelectAll}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border border-slate-300 hover:bg-slate-50 text-slate-800 font-semibold shadow-xs transition"
            >
              {selectedIds.length === filteredDevices.length && filteredDevices.length > 0 ? (
                <CheckSquare className="h-4 w-4 text-blue-600" />
              ) : (
                <Square className="h-4 w-4 text-slate-400" />
              )}
              <span>Chọn Tất Cả ({selectedIds.length}/{filteredDevices.length})</span>
            </button>

            {/* Lecture Hall Filter */}
            <select
              value={lectureHallFilter}
              onChange={(e) => setLectureHallFilter(e.target.value)}
              className="rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500 max-w-[150px] sm:max-w-[200px]"
            >
              <option value="ALL">-- Tất cả Giảng đường / Khu Nhà --</option>
              {LECTURE_HALLS.map(hall => (
                <option key={hall} value={hall}>{hall}</option>
              ))}
            </select>
          </div>

          {/* Right Layout Density Controls */}
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600 hidden sm:inline">Mật độ tem / trang A4:</span>
            <div className="flex items-center bg-white p-0.5 rounded-lg border border-slate-300">
              <button
                onClick={() => setGridDensity(6)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  gridDensity === 6 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="6 tem lớn / 1 trang A4 (2x3)"
              >
                6 Tem / Trang
              </button>
              <button
                onClick={() => setGridDensity(8)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  gridDensity === 8 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="8 tem chuẩn / 1 trang A4 (2x4)"
              >
                8 Tem / Trang
              </button>
              <button
                onClick={() => setGridDensity(12)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold transition ${
                  gridDensity === 12 ? 'bg-blue-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="12 tem nhỏ / 1 trang A4 (3x4)"
              >
                12 Tem / Trang
              </button>
            </div>
          </div>
        </div>

        {/* Modal Main Content: Split View (Device Picker + A4 Preview) */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 grid grid-cols-1 lg:grid-cols-12 gap-5 bg-slate-50">
          
          {/* Left Panel: Device Selector Checklist */}
          <div className="lg:col-span-4 bg-white rounded-xl border border-slate-200 p-3.5 space-y-3 flex flex-col h-[380px] lg:h-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-2 shrink-0">
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Tag className="h-3.5 w-3.5 text-blue-600" />
                Danh Sách Thiết Bị Cần In
              </span>
              <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Đã chọn: {selectedIds.length}
              </span>
            </div>

            <div className="overflow-y-auto space-y-1.5 flex-1 pr-1">
              {filteredDevices.map(dev => {
                const isSelected = selectedIds.includes(dev.id);
                return (
                  <div
                    key={dev.id}
                    onClick={() => toggleSelectDevice(dev.id)}
                    className={`p-2.5 rounded-lg border text-xs cursor-pointer transition flex items-start gap-2.5 ${
                      isSelected 
                        ? 'bg-blue-50/70 border-blue-300 text-slate-900 font-medium' 
                        : 'bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // handled by parent onClick
                      className="mt-0.5 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="font-bold text-slate-900 truncate">{dev.name}</p>
                      <p className="text-[11px] font-mono text-blue-700">SN: {dev.serialNumber}</p>
                      <p className="text-[10px] text-slate-500 truncate mt-0.5">
                        {dev.location.faculty} • {dev.location.lectureHall} - {dev.location.room}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Right Panel: Live A4 Page Grid Layout Preview */}
          <div className="lg:col-span-8 flex flex-col">
            <div className="flex items-center justify-between mb-2">
              <span className="font-bold text-slate-800 text-xs uppercase tracking-wider flex items-center gap-1.5">
                <Grid className="h-3.5 w-3.5 text-blue-600" />
                Xem Trước Trang In A4 (Dàn Khổ Giấy Standard A4)
              </span>
              <span className="text-[11px] text-slate-500 font-medium">
                Kích thước: 210 x 297 mm
              </span>
            </div>

            {/* Visual A4 Sheet Container */}
            <div className="flex-1 overflow-auto bg-slate-200 p-2 sm:p-4 rounded-xl border border-slate-300 shadow-inner flex justify-start sm:justify-center">
              <div 
                className="bg-white shadow-xl rounded-md p-3 sm:p-6 border border-slate-300 w-full min-w-[620px] max-w-[650px] min-h-[750px] space-y-4 shrink-0"
                style={{ minHeight: '800px' }}
              >
                {/* A4 Sheet Header */}
                <div className="border-b border-slate-300 pb-2 text-center text-[10px] text-slate-400 uppercase tracking-widest font-mono">
                  --- TRANG IN A4 • TRƯỜNG ĐẠI HỌC KINH TẾ (KHỔ GIẤY DECAL THIẾT BỊ) ---
                </div>

                {/* Render Grid Preview */}
                {selectedDevices.length === 0 ? (
                  <div className="flex flex-col items-center justify-center py-20 text-slate-400 space-y-2">
                    <QrCode className="h-12 w-12 text-slate-300" />
                    <p className="text-xs font-semibold">Chưa chọn thiết bị nào để hiển thị tem QR</p>
                    <p className="text-[11px]">Vui lòng tích chọn danh sách thiết bị bên trái</p>
                  </div>
                ) : (
                  <div 
                    ref={printRef}
                    className={`grid gap-3 ${
                      gridDensity === 12 ? 'grid-cols-3' : 'grid-cols-2'
                    }`}
                  >
                    {selectedDevices.map((device) => {
                      const qrPayload = device.serialNumber;

                      return (
                        <div 
                          key={device.id}
                          className="qr-card-item border-2 border-slate-900 rounded-lg bg-white flex flex-col justify-between overflow-hidden relative box-border"
                          style={{
                            height: gridDensity === 6 ? '205px' : gridDensity === 8 ? '168px' : '145px',
                            padding: gridDensity === 12 ? '4px 6px' : '6px 8px'
                          }}
                        >
                          {/* Tag Header */}
                          <div 
                            className="header-bar flex items-center border-b border-slate-900 shrink-0"
                            style={{
                              paddingBottom: gridDensity === 12 ? '2px' : '4px',
                              marginBottom: gridDensity === 12 ? '2px' : '4px'
                            }}
                          >
                            <DUELogo 
                              size="sm" 
                              className="flex-shrink-0" 
                              style={{
                                width: gridDensity === 12 ? '20px' : gridDensity === 8 ? '26px' : '32px',
                                height: gridDensity === 12 ? '23px' : gridDensity === 8 ? '29.9px' : '36.8px'
                              }}
                            />
                            <div 
                              className="text-center flex-grow pl-2"
                              style={{}}
                            >
                              <div 
                                className="font-extrabold uppercase tracking-tight text-slate-500 mb-0.5"
                                style={{ fontSize: gridDensity === 12 ? '6px' : gridDensity === 8 ? '7px' : '8px' }}
                              >
                                TEM THIẾT BỊ
                              </div>
                              <div 
                                className="inst font-extrabold uppercase tracking-tight text-slate-900 leading-tight"
                                style={{ fontSize: gridDensity === 12 ? '7.8px' : gridDensity === 8 ? '9px' : '11px' }}
                              >
                                TRƯỜNG ĐẠI HỌC KINH TẾ
                              </div>
                              <div 
                                className="sub font-bold uppercase tracking-wider text-slate-600 leading-tight mt-0.5"
                                style={{ fontSize: gridDensity === 12 ? '6.5px' : gridDensity === 8 ? '7.5px' : '8.5px' }}
                              >
                                PHÒNG CƠ SỞ VẬT CHẤT
                              </div>
                            </div>
                          </div>

                          {/* Tag Body */}
                          <div 
                            className="card-content flex items-center flex-1 my-0.5 min-h-0 overflow-hidden"
                            style={{ gap: gridDensity === 12 ? '4px' : '6px' }}
                          >
                            <div className="qr-wrapper shrink-0 border border-slate-300 p-0.5 rounded bg-slate-50 flex items-center justify-center">
                              <QRCodeSVG
                                value={qrPayload}
                                size={gridDensity === 12 ? 46 : gridDensity === 8 ? 54 : 66}
                                level="M"
                              />
                            </div>
                            <div 
                              className="info-wrapper leading-tight font-medium text-slate-700 overflow-hidden flex-1 min-w-0 space-y-0.5"
                              style={{ fontSize: gridDensity === 6 ? '9.5px' : gridDensity === 8 ? '8px' : '7.2px' }}
                            >
                              <p 
                                className="dev-title font-extrabold text-slate-900 truncate leading-none"
                                style={{ fontSize: gridDensity === 6 ? '11.5px' : gridDensity === 8 ? '9.5px' : '8.5px' }}
                              >
                                {device.name}
                              </p>
                              <div className="flex flex-wrap gap-1 items-center">
                                <span 
                                  className="sn-code font-mono font-bold text-blue-800 bg-blue-50 px-1 py-0.5 rounded inline-block"
                                  style={{ fontSize: gridDensity === 6 ? '9px' : gridDensity === 8 ? '8px' : '7px' }}
                                >
                                  SN: {device.serialNumber}
                                </span>
                              </div>
                              {device.specs && (
                                <div 
                                  className="specs-info font-bold text-slate-900 bg-slate-100 px-1.5 py-0.5 rounded truncate max-w-full border-l-2 border-slate-500" 
                                  style={{ 
                                    fontSize: gridDensity === 6 ? '8px' : gridDensity === 8 ? '7px' : '6px',
                                    maxHeight: gridDensity === 6 ? '32px' : gridDensity === 8 ? '22px' : '15px'
                                  }}
                                  title={device.specs}
                                >
                                  ⚙️ {device.specs}
                                </div>
                              )}
                              <p className="loc truncate text-slate-800 font-semibold leading-tight">
                                📍 {device.location.faculty}
                              </p>
                              <p className="loc truncate text-slate-600 leading-tight">
                                🏫 {device.location.lectureHall} - <strong className="text-emerald-800">{device.location.room}</strong>
                              </p>
                              <p 
                                className="date text-slate-500 font-medium truncate leading-tight mt-0.5"
                                style={{ fontSize: gridDensity === 6 ? '8px' : gridDensity === 8 ? '7.5px' : '6.5px' }}
                              >
                                📅 NSĐ: {device.purchaseDate || '2026-01-01'}
                              </p>
                            </div>
                          </div>

                          {/* Tag Footer */}
                          <div 
                            className="footer-bar border-t border-dashed border-slate-300 pt-0.5 text-center text-slate-500 font-medium truncate shrink-0 mt-auto"
                            style={{ fontSize: gridDensity === 6 ? '8px' : gridDensity === 8 ? '7px' : '6px' }}
                          >
                            Quét QR để xem nhật ký bảo trì & báo sự cố
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          </div>

        </div>

        {/* Footer Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white px-5 py-3.5 border-t border-slate-200 shrink-0">
          <div className="text-xs text-slate-500 flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Đã chuẩn bị <strong>{selectedDevices.length} tem mã QR</strong> sẵn sàng xuất file in A4</span>
          </div>

          <div className="flex items-center gap-2.5">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial rounded-lg border border-slate-300 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-100 transition"
            >
              Hủy Bỏ
            </button>
            <button
              onClick={handlePrintA4}
              disabled={selectedDevices.length === 0}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold px-5 py-2 text-xs shadow-md transition active:scale-95"
            >
              <Printer className="h-4 w-4" />
              In Tất Cả Tem A4 ({selectedDevices.length})
            </button>
          </div>
        </div>

      </div>
    </div>
  );
};
