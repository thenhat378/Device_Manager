import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Device } from '../types';
import { X, Printer, Download, QrCode, Building2, MapPin, Tag } from 'lucide-react';
import { DUELogo } from './DUELogo';

interface QRGeneratorModalProps {
  isOpen: boolean;
  onClose: () => void;
  device: Device | null;
}

export const QRGeneratorModal: React.FC<QRGeneratorModalProps> = ({
  isOpen,
  onClose,
  device
}) => {
  const printAreaRef = useRef<HTMLDivElement>(null);

  if (!isOpen || !device) return null;

  // Formatted QR value string (plain text serial number)
  const qrPayload = device.serialNumber;

  const handlePrint = () => {
    const printContent = printAreaRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=700,height=600');
    if (!printWindow) {
      alert('Trình duyệt chặn mở cửa sổ in. Vui lòng cho phép popup để in thẻ QR.');
      return;
    }

    // Access rendered outerHTML of the preview card
    const cardHtml = printContent.outerHTML;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>In Tem Thiết Bị - ${device.serialNumber}</title>
        </head>
        <body style="margin: 0; padding: 20px; background: #fff; display: flex; justify-content: center; align-items: flex-start; min-height: 100vh;">
          <div class="no-print" style="position: absolute; top: 0; left: 0; right: 0; padding: 12px; background: #e0f2fe; border-bottom: 1px solid #bae6fd; font-size: 13px; text-align: center; font-family: sans-serif; z-index: 9999;">
            📄 Khung xem trước in tem. Nhấn <strong>Ctrl+P</strong> hoặc nút in dưới đây.
            <button onclick="window.print()" style="margin-left: 12px; padding: 6px 16px; background: #2563eb; color: #fff; border: none; border-radius: 6px; font-weight: bold; cursor: pointer;">
              In Ngay (Print Tag)
            </button>
          </div>
          
          <div style="margin-top: 60px; width: 100%; display: flex; justify-content: center;">
            ${cardHtml}
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
        size: auto;
        margin: 10mm;
      }
      body { 
        background: #fff !important;
        color: #000 !important;
      }
      @media print {
        .no-print { display: none !important; }
        body { padding: 0 !important; margin: 0 !important; }
      }
    `;
    printWindow.document.head.appendChild(printStyle);

    printWindow.document.close();
  };

  const handleDownloadSVG = () => {
    const svgElement = printAreaRef.current?.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `QR_CODE_${device.serialNumber}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-3 sm:p-4 backdrop-blur-sm animate-fade-in">
      <div className="w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100 flex flex-col max-h-[92vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between bg-slate-900 px-4 sm:px-6 py-3.5 sm:py-4 text-white shrink-0">
          <div className="flex items-center gap-2">
            <QrCode className="h-5 w-5 text-blue-400 shrink-0" />
            <h3 className="font-semibold text-sm sm:text-base tracking-wide truncate">Mã QR Theo Dõi Thiết Bị Giảng Đường</h3>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition shrink-0"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Printable Card Preview */}
        <div className="p-4 sm:p-6 bg-slate-50 flex flex-col items-center overflow-y-auto">
          <div
            ref={printAreaRef}
            className="w-full max-w-md rounded-xl border-2 border-slate-900 bg-white p-4 sm:p-6 shadow-md relative overflow-hidden"
          >
            {/* Tag Header */}
            <div className="border-b-2 border-slate-900 pb-2 flex items-start px-1">
              <DUELogo size="sm" className="h-10 w-10 flex-shrink-0" />
              <div className="text-center flex-grow pl-3">
                <div className="text-[10px] font-extrabold uppercase tracking-widest text-slate-900 mb-0.5">
                  TEM THIẾT BỊ
                </div>
                <h4 className="text-xs font-extrabold text-slate-900 tracking-tight uppercase leading-tight">
                  TRƯỜNG ĐẠI HỌC KINH TẾ
                </h4>
                <p className="text-[10px] text-slate-600 font-semibold leading-tight mt-0.5">PHÒNG CƠ SỞ VẬT CHẤT</p>
              </div>
            </div>

            {/* Content Body */}
            <div className="mt-4 sm:mt-5 flex flex-col sm:flex-row items-center gap-4 sm:gap-5">
              <div className="flex flex-col items-center shrink-0 bg-slate-50 p-3 rounded-xl border border-slate-200">
                <QRCodeSVG
                  value={qrPayload}
                  size={130}
                  level="H"
                  includeMargin={true}
                />
                <span className="mt-2 rounded bg-slate-900 px-2.5 py-1 font-mono text-xs font-bold text-blue-300">
                  {device.serialNumber}
                </span>
              </div>

              <div className="flex-grow space-y-2 text-xs text-slate-700 w-full">
                <div>
                  <span className="text-slate-400 font-medium block text-[11px]">Tên thiết bị:</span>
                  <p className="font-bold text-slate-900 text-xs sm:text-sm">{device.name}</p>
                </div>
                {device.specs && (
                  <div>
                    <span className="text-slate-400 font-medium block text-[11px]">Thông số kỹ thuật:</span>
                    <p className="font-bold text-slate-800 bg-slate-100 border border-slate-200 px-3 py-1.5 rounded block w-full text-[11px] whitespace-pre-line leading-relaxed max-h-20 overflow-y-auto scrollbar-thin">{device.specs}</p>
                  </div>
                )}
                <div>
                  <span className="text-slate-400 font-medium block text-[11px]">Khoa / Đơn vị:</span>
                  <p className="font-semibold text-slate-800 flex items-center gap-1">
                    <Building2 className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    {device.location.faculty}
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block text-[11px]">Giảng đường - Phòng:</span>
                  <p className="font-semibold text-slate-800 flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    {device.location.lectureHall} - <strong className="text-emerald-700">{device.location.room}</strong>
                  </p>
                </div>
                <div>
                  <span className="text-slate-400 font-medium block text-[11px]">Loại / Đưa vào dùng:</span>
                  <p className="text-slate-600 flex items-center gap-1">
                    <Tag className="h-3.5 w-3.5 text-slate-400 shrink-0" />
                    {device.category} ({device.purchaseDate})
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 bg-white px-4 sm:px-6 py-3 sm:py-4 border-t border-slate-200 shrink-0">
          <button
            onClick={handleDownloadSVG}
            className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 bg-white px-3.5 py-2 text-xs font-medium text-slate-700 hover:bg-slate-50 transition active:scale-95"
          >
            <Download className="h-4 w-4 text-slate-500" />
            Tải mã QR (SVG)
          </button>
          
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              onClick={onClose}
              className="flex-1 sm:flex-initial rounded-lg border border-slate-300 px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 transition active:scale-95"
            >
              Đóng
            </button>
            <button
              onClick={handlePrint}
              className="flex-1 sm:flex-initial inline-flex items-center justify-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-xs font-bold text-white hover:bg-blue-700 transition shadow-sm active:scale-95"
            >
              <Printer className="h-4 w-4" />
              In Tem QR
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
