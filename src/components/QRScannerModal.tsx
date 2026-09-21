import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { 
  Camera, 
  X, 
  AlertCircle, 
  RefreshCw, 
  CheckCircle2, 
  Upload, 
  Zap, 
  ZapOff, 
  SwitchCamera, 
  Volume2, 
  VolumeX, 
  Scan, 
  Sparkles,
  Barcode,
  QrCode,
  FileImage,
  Focus
} from 'lucide-react';

interface QRScannerModalProps {
  isOpen: boolean;
  onClose: () => void;
  onScanSuccess: (scannedText: string) => void;
  title?: string;
}

// All supported 1D and 2D Barcode Formats
const ALL_SUPPORTED_FORMATS = [
  Html5QrcodeSupportedFormats.QR_CODE,
  Html5QrcodeSupportedFormats.CODE_128,
  Html5QrcodeSupportedFormats.CODE_39,
  Html5QrcodeSupportedFormats.CODE_93,
  Html5QrcodeSupportedFormats.EAN_13,
  Html5QrcodeSupportedFormats.EAN_8,
  Html5QrcodeSupportedFormats.UPC_A,
  Html5QrcodeSupportedFormats.UPC_E,
  Html5QrcodeSupportedFormats.DATA_MATRIX,
  Html5QrcodeSupportedFormats.ITF,
  Html5QrcodeSupportedFormats.PDF_417,
  Html5QrcodeSupportedFormats.AZTEC,
  Html5QrcodeSupportedFormats.CODABAR,
];

// Play a subtle success audio beep via Web Audio API
const playSuccessBeep = () => {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime); // A5 note
    gain.gain.setValueAtTime(0.12, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.18);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start();
    osc.stop(ctx.currentTime + 0.18);
  } catch (err) {
    // Ignore audio play errors
  }
};

export const QRScannerModal: React.FC<QRScannerModalProps> = ({
  isOpen,
  onClose,
  onScanSuccess,
  title = 'Quét Mã Thiết Bị (Barcode / QR Code)'
}) => {
  const [manualSn, setManualSn] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [isScanning, setIsScanning] = useState(false);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>('');
  const [torchOn, setTorchOn] = useState(false);
  const [hasTorch, setHasTorch] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [scanMode, setScanMode] = useState<'camera' | 'file'>('camera');
  const [frameShape, setFrameShape] = useState<'auto' | 'wide' | 'square'>('auto');
  const [scannedResult, setScannedResult] = useState<string | null>(null);
  const [isProcessingFile, setIsProcessingFile] = useState(false);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const readerDivId = 'qr-code-reader-element';

  useEffect(() => {
    if (!isOpen) {
      stopScanner();
      setScannedResult(null);
      setErrorMsg(null);
      return;
    }

    const timer = setTimeout(() => {
      initCamerasAndStart();
    }, 200);

    // Setup browser permission change listeners for fluid mobile UX
    let permissionStatusCleanup: any = null;
    if (navigator.permissions && navigator.permissions.query) {
      navigator.permissions.query({ name: 'camera' as any })
        .then((status) => {
          const handleChange = () => {
            console.log('Camera permission updated dynamically:', status.state);
            if (status.state === 'granted') {
              initCamerasAndStart();
            } else if (status.state === 'denied') {
              stopScanner();
              setErrorMsg('Quyền truy cập camera đã bị từ chối. Vui lòng cấp lại quyền trong cài đặt trình duyệt.');
            }
          };
          status.addEventListener('change', handleChange);
          permissionStatusCleanup = () => {
            status.removeEventListener('change', handleChange);
          };
        })
        .catch((e) => console.warn('Permissions query error:', e));
    }

    return () => {
      clearTimeout(timer);
      stopScanner();
      if (permissionStatusCleanup) {
        permissionStatusCleanup();
      }
    };
  }, [isOpen]);

  // Wireless Bluetooth Barcode Scanner (HID Keyboard Wedge) Listener
  useEffect(() => {
    if (!isOpen) return;

    let barcodeBuffer = '';
    let lastKeyTime = Date.now();

    const handleWindowKeyDown = (e: KeyboardEvent) => {
      const currentTime = Date.now();
      const target = e.target as HTMLElement;

      // If user is typing in manual serial input field or textarea, let normal typing happen
      const isManualInput = target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') && target.id !== 'barcode-file-upload-input';
      if (isManualInput && currentTime - lastKeyTime > 80) {
        barcodeBuffer = '';
        return;
      }

      if (e.key === 'Enter') {
        if (barcodeBuffer.trim().length >= 2) {
          e.preventDefault();
          const scanned = barcodeBuffer.trim();
          barcodeBuffer = '';
          handleDecodedResult(scanned);
          return;
        }
        barcodeBuffer = '';
        return;
      }

      // Ignore modifier keys
      if (['Shift', 'Control', 'Alt', 'Meta', 'CapsLock', 'Tab', 'Escape'].includes(e.key)) {
        return;
      }

      // If time gap between keystrokes is large (> 100ms), reset buffer
      if (currentTime - lastKeyTime > 100) {
        barcodeBuffer = '';
      }

      lastKeyTime = currentTime;
      if (e.key.length === 1) {
        barcodeBuffer += e.key;
      }
    };

    window.addEventListener('keydown', handleWindowKeyDown);
    return () => {
      window.removeEventListener('keydown', handleWindowKeyDown);
    };
  }, [isOpen]);

  // Restart scanner if frame shape changes during active scanning
  useEffect(() => {
    if (isOpen && isScanning && scanMode === 'camera' && selectedCameraId) {
      restartScannerWithSelectedCamera(selectedCameraId);
    }
  }, [frameShape]);

  const initCamerasAndStart = async () => {
    setErrorMsg(null);
    let defaultCamId = selectedCameraId;

    // Step 1: Use Html5Qrcode.getCameras() to properly prompt permission & get devices with labels
    try {
      const devices = await Html5Qrcode.getCameras();
      if (devices && devices.length > 0) {
        const camList = devices.map((d, i) => ({
          id: d.id,
          label: d.label || (i === 0 ? 'Camera Mặc Định' : `Camera ${i + 1}`)
        }));
        setCameras(camList);

        // Smart Auto-Select: Prefer rear/back camera
        const rearCam = devices.find(d => 
          d.label && /back|rear|sau|environment|0/i.test(d.label)
        );
        if (rearCam && !defaultCamId) {
          defaultCamId = rearCam.id;
          setSelectedCameraId(defaultCamId);
        } else if (!defaultCamId && devices[0]) {
          defaultCamId = devices[0].id;
          setSelectedCameraId(defaultCamId);
        }
      }
    } catch (e) {
      console.warn('Html5Qrcode.getCameras() warning:', e);
    }

    // Step 2: Start scanner with environment camera fallback chain
    await startCameraScanner(defaultCamId);
  };

  const startCameraScanner = async (targetCamId?: string) => {
    setErrorMsg(null);
    
    // Ensure element is ready in DOM
    const readerElem = document.getElementById(readerDivId);
    if (!readerElem) {
      setTimeout(() => startCameraScanner(targetCamId), 150);
      return;
    }

    try {
      if (scannerRef.current) {
        await stopScanner();
      }

      const html5QrCode = new Html5Qrcode(readerDivId, {
        formatsToSupport: ALL_SUPPORTED_FORMATS,
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true
        }
      });
      scannerRef.current = html5QrCode;

      setIsScanning(true);

      const qrboxCalc = (viewfinderWidth: number, viewfinderHeight: number) => {
        if (frameShape === 'wide') {
          // Optimized for long horizontal 1D manufacturer barcodes (Code 128, Code 39, EAN)
          return {
            width: Math.min(Math.floor(viewfinderWidth * 0.95), 520),
            height: Math.min(Math.floor(viewfinderHeight * 0.42), 160)
          };
        }
        if (frameShape === 'square') {
          // Optimized for 2D codes (QR Code, DataMatrix, Aztec)
          const side = Math.min(Math.floor(viewfinderWidth * 0.8), Math.floor(viewfinderHeight * 0.8), 320);
          return { width: side, height: side };
        }
        // Balanced large area suitable for mixed/general-purpose code scanning
        return {
          width: Math.min(Math.floor(viewfinderWidth * 0.9), 480),
          height: Math.min(Math.floor(viewfinderHeight * 0.55), 260)
        };
      };

      const startWithConstraint = async (videoConstraint: any): Promise<boolean> => {
        try {
          await html5QrCode.start(
            videoConstraint,
            {
              fps: 60, // Ultra-fast 60 FPS scanning speed for instant recognition
              qrbox: qrboxCalc,
              disableFlip: false,
              experimentalFeatures: {
                useBarCodeDetectorIfSupported: true
              }
            } as any,
            (decodedText) => {
              handleDecodedResult(decodedText);
            },
            () => {}
          );
          return true;
        } catch (err) {
          console.warn('Constraint start failed:', videoConstraint, err);
          return false;
        }
      };

      // Try camera parameters in sequence
      let success = false;

      // 1. Try selected device ID if specified (with exact and non-exact variants)
      if (targetCamId && targetCamId.trim()) {
        success = await startWithConstraint({ deviceId: { exact: targetCamId } });
        if (!success) {
          success = await startWithConstraint({ deviceId: targetCamId });
        }
      }

      // 2. If no specific targetCamId or if it failed, try facingMode environment (back camera)
      if (!success && (!targetCamId || !targetCamId.trim())) {
        success = await startWithConstraint({ facingMode: 'environment' });
      }

      // 3. Try facingMode user (front camera fallback)
      if (!success && (!targetCamId || !targetCamId.trim())) {
        success = await startWithConstraint({ facingMode: 'user' });
      }

      // 4. Try generic media track constraints as final fallback
      if (!success) {
        success = await startWithConstraint({ video: true } as any);
      }

      if (success) {
        // Retrieve device capabilities (Flashlight / Torch) and configure Autofocus
        try {
          // Sync selected camera ID with what was actually started
          const currentSettings = html5QrCode.getRunningTrackSettings();
          if (currentSettings && currentSettings.deviceId) {
            setSelectedCameraId(currentSettings.deviceId);
          }

          // Dynamic cameras list refresh with full labels now that scanner is running successfully
          if (navigator.mediaDevices && navigator.mediaDevices.enumerateDevices) {
            const devices = await navigator.mediaDevices.enumerateDevices();
            const videoDevices = devices.filter(d => d.kind === 'videoinput');
            if (videoDevices.length > 0) {
              const camList = videoDevices.map((d, i) => ({
                id: d.deviceId || `cam-${i}`,
                label: d.label || (i === 0 ? 'Camera Mặc Định' : `Camera ${i + 1}`)
              }));
              setCameras(camList);
            }
          }

          const capabilities = html5QrCode.getRunningTrackCapabilities() as any;
          setHasTorch(!!(capabilities && capabilities.torch));

          // Enforce continuous autofocus if supported by the hardware track
          if (capabilities && capabilities.focusMode && capabilities.focusMode.includes('continuous')) {
            try {
              await html5QrCode.applyVideoConstraints({
                focusMode: 'continuous'
              } as any);
              console.log('Enforced continuous autofocus constraint successfully.');
            } catch (focusErr) {
              console.warn('Failed to apply continuous autofocus constraint:', focusErr);
            }
          }
        } catch (capabilitiesErr) {
          console.warn('Could not inspect running capabilities:', capabilitiesErr);
          setHasTorch(false);
        }
      } else {
        setIsScanning(false);
        setErrorMsg('Không thể kích hoạt camera. Vui lòng cấp quyền truy cập camera cho trình duyệt hoặc thử tải ảnh chứa mã.');
      }

    } catch (err: any) {
      console.warn('Start camera overall error:', err);
      setErrorMsg('Lỗi khởi tạo camera: ' + (err?.message || 'Không thể mở ống kính camera'));
      setIsScanning(false);
    }
  };

  const restartScannerWithSelectedCamera = async (camId: string) => {
    setSelectedCameraId(camId);
    await startCameraScanner(camId);
  };

  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !torchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState }]
      } as any);
      setTorchOn(nextState);
    } catch (err) {
      console.warn('Torch toggle error:', err);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.warn('Error stopping scanner:', err);
      }
      scannerRef.current = null;
    }
    setIsScanning(false);
    setTorchOn(false);
  };

  const handleDecodedResult = (rawText: string) => {
    let cleanSn = rawText.trim();

    // Parse JSON payloads inside QR codes if present
    try {
      const parsed = JSON.parse(rawText);
      if (parsed.sn || parsed.serialNumber || parsed.id || parsed.code) {
        cleanSn = parsed.sn || parsed.serialNumber || parsed.id || parsed.code;
      }
    } catch {
      // Plain text barcode/QR or formatted room template
      const bracketMatch = rawText.match(/\[([A-Z0-9\-]+)\]/i);
      if (bracketMatch && bracketMatch[1]) {
        cleanSn = bracketMatch[1];
      } else {
        const snMatch = rawText.match(/(?:SN:\s*|Mã Serial Number\s*:\s*|Mã SN\s*:\s*|Mã\s+SN\s*|Mã\s+Serial\s+Number\s*)([A-Z0-9\-]+)/i);
        if (snMatch && snMatch[1]) {
          cleanSn = snMatch[1];
        }
      }
    }

    // Audio & Haptic Feedback
    if (soundEnabled) {
      playSuccessBeep();
    }
    if (navigator.vibrate) {
      navigator.vibrate(120);
    }

    setScannedResult(cleanSn);
    stopScanner();
  };

  const handleConfirmResult = () => {
    if (!scannedResult) return;
    onScanSuccess(scannedResult);
    onClose();
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    setErrorMsg(null);

    try {
      const html5QrCode = new Html5Qrcode(readerDivId, {
        formatsToSupport: ALL_SUPPORTED_FORMATS,
        verbose: false
      });

      const decodedResult = await html5QrCode.scanFileV2(file, false);
      if (decodedResult && decodedResult.decodedText) {
        handleDecodedResult(decodedResult.decodedText);
      } else {
        setErrorMsg('Không nhận diện được mã Barcode/QR trong ảnh. Thử chụp lại rõ nét hơn.');
      }
    } catch (err) {
      console.warn('File scan error:', err);
      setErrorMsg('Không tìm thấy mã Barcode hoặc QR Code trong hình ảnh này.');
    } finally {
      setIsProcessingFile(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!manualSn.trim()) return;
    onScanSuccess(manualSn.trim());
    onClose();
    setManualSn('');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/80 p-3 sm:p-4 backdrop-blur-sm animate-fade-in">
      {/* Custom Styles to Override html5-qrcode Internal Elements */}
      <style>{`
        #qr-code-reader-element video {
          object-fit: cover !important;
          width: 100% !important;
          height: 100% !important;
          border-radius: 0.75rem !important;
        }
        #qr-code-reader-element canvas {
          display: none !important;
        }
        #qr-code-reader-element__header_message,
        #qr-code-reader-element__status_span,
        #qr-code-reader-element__dashboard_section_csr,
        #qr-code-reader-element__dashboard_section_swaplink {
          display: none !important;
        }
        #qr-code-reader-element__scan_region {
          background: transparent !important;
          border: none !important;
        }
        #qr-code-reader-element__scan_region img {
          opacity: 0.5;
        }
        @keyframes laser-scan {
          0% { top: 10%; opacity: 0.8; }
          50% { top: 85%; opacity: 1; }
          100% { top: 10%; opacity: 0.8; }
        }
        .animate-laser {
          animation: laser-scan 2.2s ease-in-out infinite;
        }
      `}</style>

      <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100 flex flex-col max-h-[92vh]">
        
        {/* Modal Header */}
        <div className="flex items-center justify-between bg-slate-900 px-5 py-3.5 text-white shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              <Camera className="h-4 w-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm sm:text-base tracking-wide leading-tight">{title}</h3>
              <p className="text-[10px] text-slate-400">Đọc Code 128, Code 39, QR Code, EAN-13, DataMatrix...</p>
            </div>
          </div>
          <button
            onClick={() => {
              stopScanner();
              onClose();
            }}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-800 hover:text-white transition"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-4 sm:p-5 space-y-4 overflow-y-auto">

          {/* Scanner Mode Switcher (Camera vs Image File) */}
          <div className="flex items-center justify-between gap-2 bg-slate-100 p-1 rounded-xl border border-slate-200 text-xs">
            <button
              onClick={() => {
                setScanMode('camera');
                setScannedResult(null);
                if (selectedCameraId) startCameraScanner(selectedCameraId);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-semibold transition ${
                scanMode === 'camera'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <Camera className="h-3.5 w-3.5 text-blue-600" />
              <span>Camera Trực Tiếp</span>
            </button>

            <button
              onClick={() => {
                stopScanner();
                setScanMode('file');
                setScannedResult(null);
              }}
              className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg font-semibold transition ${
                scanMode === 'file'
                  ? 'bg-white text-slate-900 shadow-sm'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FileImage className="h-3.5 w-3.5 text-emerald-600" />
              <span>Tải Ảnh Mã Barcode</span>
            </button>
          </div>

          {/* Scanned Result Banner (If Scanned) */}
          {scannedResult ? (
            <div className="rounded-xl bg-emerald-50 border-2 border-emerald-500 p-4 text-center space-y-3 animate-in fade-in zoom-in-95">
              <div className="flex items-center justify-center gap-2 text-emerald-700 font-bold text-xs uppercase tracking-wider">
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span>Nhận Diện Mã Thành Công!</span>
              </div>

              <div className="bg-white p-3 rounded-lg border border-emerald-200 shadow-inner font-mono text-base font-extrabold text-slate-900 break-all">
                {scannedResult}
              </div>

              <div className="flex items-center gap-2 pt-1">
                <button
                  onClick={() => {
                    setScannedResult(null);
                    if (scanMode === 'camera' && selectedCameraId) {
                      startCameraScanner(selectedCameraId);
                    }
                  }}
                  className="flex-1 py-2 px-3 rounded-lg bg-slate-200 text-slate-700 hover:bg-slate-300 font-medium text-xs transition"
                >
                  Quét Lại
                </button>
                <button
                  onClick={handleConfirmResult}
                  className="flex-1 py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs shadow-md transition flex items-center justify-center gap-1.5"
                >
                  <CheckCircle2 className="h-4 w-4" />
                  Sử Dụng Mã Này
                </button>
              </div>
            </div>
          ) : scanMode === 'camera' ? (
            /* Camera Scanner Container */
            <div className="space-y-3">
              {/* Controls Toolbar (Camera Selection, Torch, Sound, Frame Shape) */}
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                {cameras.length > 1 && (
                  <div className="flex items-center gap-1 bg-slate-100 px-2 py-1 rounded-lg border border-slate-200">
                    <SwitchCamera className="h-3.5 w-3.5 text-slate-500 shrink-0" />
                    <select
                      value={selectedCameraId}
                      onChange={(e) => restartScannerWithSelectedCamera(e.target.value)}
                      className="bg-transparent font-medium text-slate-700 focus:outline-none max-w-[130px] sm:max-w-[180px] truncate cursor-pointer"
                    >
                      {cameras.map((cam, idx) => (
                        <option key={cam.id} value={cam.id}>
                          {cam.label || `Camera ${idx + 1}`}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Frame Shape Toggle (Auto / Wide Barcode / Square QR) */}
                <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px]">
                  <button
                    onClick={() => setFrameShape('auto')}
                    className={`px-2 py-1 rounded ${frameShape === 'auto' ? 'bg-white font-bold shadow-xs text-blue-600' : 'text-slate-600'}`}
                    title="Khung linh hoạt tự động"
                  >
                    Tự Động
                  </button>
                  <button
                    onClick={() => setFrameShape('wide')}
                    className={`px-2 py-1 rounded flex items-center gap-1 ${frameShape === 'wide' ? 'bg-white font-bold shadow-xs text-blue-600' : 'text-slate-600'}`}
                    title="Khung rộng tối ưu cho Barcode dải dài (Code 128, EAN, Code 39)"
                  >
                    <Barcode className="h-3 w-3" />
                    Barcode
                  </button>
                  <button
                    onClick={() => setFrameShape('square')}
                    className={`px-2 py-1 rounded flex items-center gap-1 ${frameShape === 'square' ? 'bg-white font-bold shadow-xs text-blue-600' : 'text-slate-600'}`}
                    title="Khung vuông tối ưu cho QR Code & DataMatrix"
                  >
                    <QrCode className="h-3 w-3" />
                    QR
                  </button>
                </div>

                <div className="flex items-center gap-1.5">
                  {hasTorch && (
                    <button
                      onClick={toggleTorch}
                      className={`p-1.5 rounded-lg border transition ${
                        torchOn 
                          ? 'bg-amber-400 text-slate-900 border-amber-500 shadow-sm' 
                          : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200'
                      }`}
                      title={torchOn ? 'Tắt đèn Flash' : 'Bật đèn Flash'}
                    >
                      {torchOn ? <Zap className="h-3.5 w-3.5 fill-slate-900" /> : <ZapOff className="h-3.5 w-3.5" />}
                    </button>
                  )}

                  <button
                    onClick={() => setSoundEnabled(!soundEnabled)}
                    className={`p-1.5 rounded-lg border transition ${
                      soundEnabled 
                        ? 'bg-slate-100 text-slate-700 border-slate-200' 
                        : 'bg-slate-200 text-slate-400 border-slate-300'
                    }`}
                    title={soundEnabled ? 'Tắt âm thanh beep' : 'Bật âm thanh beep'}
                  >
                    {soundEnabled ? <Volume2 className="h-3.5 w-3.5" /> : <VolumeX className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Camera Video Frame Container */}
              <div className="relative overflow-hidden rounded-xl border-2 border-blue-500/80 bg-slate-950 p-1 text-center shadow-inner min-h-[260px] flex items-center justify-center">
                
                {/* Visual Scanning Laser Beam Line (Fixed Blue Laser) */}
                {isScanning && !errorMsg && (
                  <div className="absolute inset-x-4 pointer-events-none z-20 animate-laser">
                    <div className="h-0.5 w-full bg-gradient-to-r from-transparent via-cyan-400 to-transparent shadow-[0_0_16px_#22d3ee]" />
                  </div>
                )}

                <div id={readerDivId} className="w-full overflow-hidden rounded-lg min-h-[250px] flex items-center justify-center text-white" />
                
                {!isScanning && !errorMsg && (
                  <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900/90 text-white p-4">
                    <RefreshCw className="h-8 w-8 text-blue-400 animate-spin mb-2" />
                    <p className="text-sm font-medium">Đang kết nối camera...</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            /* Image File Upload Scanner Container */
            <div className="p-6 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 text-center space-y-4">
              <div className="h-12 w-12 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <Upload className="h-6 w-6" />
              </div>
              <div>
                <h4 className="font-bold text-slate-900 text-sm">Tải Ảnh Tem Nhãn / Barcode</h4>
                <p className="text-xs text-slate-500 mt-1 max-w-xs mx-auto">
                  Chọn bức ảnh chụp tem thiết bị, ảnh chứa mã vạch Barcode (Code 128, Code 39) hoặc mã QR để quét
                </p>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
                id="barcode-file-upload-input"
              />

              <label
                htmlFor="barcode-file-upload-input"
                className="inline-flex items-center gap-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white px-4 py-2.5 text-xs font-bold transition cursor-pointer shadow-sm active:scale-95"
              >
                {isProcessingFile ? (
                  <>
                    <RefreshCw className="h-4 w-4 animate-spin" />
                    <span>Đang Phân Tích Mã...</span>
                  </>
                ) : (
                  <>
                    <FileImage className="h-4 w-4" />
                    <span>Chọn Bức Ảnh Từ Máy</span>
                  </>
                )}
              </label>

              <div id={readerDivId} className="hidden" />
            </div>
          )}

          {/* Error Message Box */}
          {errorMsg && (
            <div className="rounded-xl bg-amber-50 p-3.5 border border-amber-200 space-y-2 text-amber-800 text-xs">
              <div className="flex items-start gap-2.5">
                <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold text-amber-900">Thông báo từ camera</p>
                  <p className="mt-0.5 text-amber-700 leading-relaxed">{errorMsg}</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1 border-t border-amber-200/60">
                <button
                  type="button"
                  onClick={() => {
                    setScanMode('camera');
                    startCameraScanner();
                  }}
                  className="px-2.5 py-1 rounded-md bg-amber-600 hover:bg-amber-700 text-white font-bold text-[11px] transition shadow-xs flex items-center gap-1"
                >
                  <RefreshCw className="h-3 w-3" />
                  Thử lại Camera
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setScanMode('camera');
                    startCameraScanner('user');
                  }}
                  className="px-2.5 py-1 rounded-md bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-semibold text-[11px] transition flex items-center gap-1"
                >
                  <SwitchCamera className="h-3 w-3 text-amber-700" />
                  Thử Camera trước
                </button>
                <a
                  href={window.location.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-2.5 py-1 rounded-md bg-white border border-amber-300 hover:bg-amber-100 text-amber-900 font-semibold text-[11px] transition flex items-center gap-1 ml-auto"
                >
                  Mở tab mới để cấp quyền ↗
                </a>
              </div>
            </div>
          )}

          {/* Format Badges Indicator */}
          <div className="pt-1 space-y-2">
            <div>
              <span className="text-[10px] font-semibold text-slate-400 block mb-1 uppercase tracking-wider">
                Hỗ trợ tự động tất cả định dạng mã:
              </span>
              <div className="flex flex-wrap gap-1">
                {['Code 128', 'Code 39', 'QR Code', 'EAN-13', 'EAN-8', 'DataMatrix', 'UPC-A', 'PDF417'].map((fmt) => (
                  <span key={fmt} className="text-[10px] font-mono bg-slate-100 text-slate-600 px-2 py-0.5 rounded border border-slate-200">
                    {fmt}
                  </span>
                ))}
              </div>
            </div>

            {/* Wireless Bluetooth Scanner Notice */}
            <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50/80 border border-blue-200 text-blue-800 text-[11px]">
              <span className="flex h-2 w-2 rounded-full bg-blue-500 animate-pulse shrink-0" />
              <span><strong>Máy quét Bluetooth không dây (HID):</strong> Tự động nhận diện khi bạn bóp cò quét mã vạch qua thiết bị cầm tay kết nối Bluetooth.</span>
            </div>
          </div>

          <div className="relative flex items-center pt-2">
            <div className="flex-grow border-t border-slate-200"></div>
            <span className="shrink-0 px-3 text-[11px] font-bold uppercase text-slate-400">Hoặc nhập thủ công Mã SN</span>
            <div className="flex-grow border-t border-slate-200"></div>
          </div>

          {/* Manual Input Form */}
          <form onSubmit={handleManualSubmit} className="flex gap-2">
            <input
              type="text"
              value={manualSn}
              onChange={(e) => setManualSn(e.target.value)}
              placeholder="Nhập mã SN (ví dụ: SN-PJ386-9921)"
              className="flex-grow rounded-lg border border-slate-300 px-3.5 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            />
            <button
              type="submit"
              disabled={!manualSn.trim()}
              className="rounded-lg bg-blue-600 px-4 py-2 font-bold text-white hover:bg-blue-700 disabled:opacity-50 transition text-xs flex items-center gap-1.5 shrink-0 shadow-sm"
            >
              <CheckCircle2 className="h-4 w-4" />
              Xác Nhận
            </button>
          </form>

        </div>
      </div>
    </div>
  );
};
