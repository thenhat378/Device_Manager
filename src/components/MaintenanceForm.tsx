import React, { useState, useRef, useEffect } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import * as XLSX from 'xlsx';
import { Device, InspectionRecord, PartReplacementRecord, IncidentReport, User } from '../types';
import { MaintenanceCalendar } from './MaintenanceCalendar';
import { db } from '../lib/firebase';
import { doc, setDoc, onSnapshot } from 'firebase/firestore';
import { formatDate } from '../utils';
import { 
  Wrench, 
  ClipboardCheck, 
  PackageCheck, 
  AlertTriangle, 
  Camera, 
  Search, 
  Plus, 
  DollarSign, 
  CheckCircle2, 
  Clock, 
  Calendar, 
  User as UserIcon, 
  ShieldCheck, 
  FileText,
  Activity,
  Zap,
  Download,
  Upload,
  X
} from 'lucide-react';

interface MaintenanceFormProps {
  devices: Device[];
  inspections: InspectionRecord[];
  replacements: PartReplacementRecord[];
  incidents: IncidentReport[];
  currentUser: User | null;
  onAddInspection: (
    record: Omit<InspectionRecord, 'id'>,
    damageReport?: { severity: 'low' | 'medium' | 'high' | 'urgent'; description: string }
  ) => void;
  onAddReplacement: (record: Omit<PartReplacementRecord, 'id'>) => void;
  onAddIncident: (report: Omit<IncidentReport, 'id' | 'reportedAt' | 'status'>) => void;
  onResolveIncident: (incidentId: string, resolutionNotes: string) => void;
  onAcceptIncident: (incidentId: string) => void;
  onOpenScanner: (callback: (sn: string) => void) => void;
  onReturnToDevices?: () => void;
}

const normalizeRoom = (roomName: string): string => {
  if (!roomName) return '';
  return roomName
    .toLowerCase()
    .replace(/^(phòng|phong|p\.|p)\s*/g, '')
    .trim();
};

export const MaintenanceForm: React.FC<MaintenanceFormProps> = ({
  devices,
  inspections,
  replacements,
  incidents,
  currentUser,
  onAddInspection,
  onAddReplacement,
  onAddIncident,
  onResolveIncident,
  onAcceptIncident,
  onOpenScanner,
  onReturnToDevices
}) => {
  const [activeSubTab, setActiveSubTab] = useState<'calendar' | 'inspection' | 'replacement' | 'incidents' | 'history'>(() => {
    return currentUser?.role === 'staff' ? 'incidents' : 'calendar';
  });
  const [selectedDeviceSn, setSelectedDeviceSn] = useState<string>('');

  useEffect(() => {
    if (currentUser?.role === 'staff') {
      setActiveSubTab('incidents');
    }
  }, [currentUser]);

  const handleSelectDeviceFromCalendar = (sn: string) => {
    const found = devices.find(d => d.serialNumber.toLowerCase() === sn.toLowerCase());
    if (found) {
      setInspectionForm(prev => ({
        ...prev,
        deviceId: found.id,
        deviceSn: found.serialNumber,
        deviceName: found.name
      }));
    }
    setActiveSubTab('inspection');
  };
  
  // Inspection Form State
  const [inspectionForm, setInspectionForm] = useState({
    deviceId: '',
    deviceSn: '',
    deviceName: '',
    inspectorName: currentUser?.name || 'Kỹ Thuật Viên (Bộ phận quản trị)',
    inspectionDate: new Date().toISOString().split('T')[0],
    result: 'passed' as 'passed' | 'warning' | 'failed',
    checkPower: true,
    checkDisplayAudio: true,
    checkConnections: true,
    checkCleaningFan: true,
    notes: '',
    actionRequired: ''
  });
  const [includeDamageReport, setIncludeDamageReport] = useState(false);
  const [damageSeverity, setDamageSeverity] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [damageDescription, setDamageDescription] = useState('');
  const [deviceSearchQuery, setDeviceSearchQuery] = useState('');
  const [replacementDeviceSearchQuery, setReplacementDeviceSearchQuery] = useState('');
  const [incidentDeviceSearchQuery, setIncidentDeviceSearchQuery] = useState('');

  // Replacement Form State
  const [replacementForm, setReplacementForm] = useState({
    deviceId: '',
    deviceSn: '',
    deviceName: '',
    partName: '',
    partCondition: 'new' as 'new' | 'refurbished',
    cost: 0,
    quantity: 1,
    replacedBy: currentUser?.name || 'Trần Kỹ Thuật',
    replacementDate: new Date().toISOString().split('T')[0],
     reason: '',
     warrantyMonths: 12
   });
 
   // Live Time Clock for Real-time Incident Reports
   const [liveTime, setLiveTime] = useState(new Date());
   const [showManualSelect, setShowManualSelect] = useState(false);
  const [scannedRoom, setScannedRoom] = useState<string | null>(null);
  const [selectedAdminRoom, setSelectedAdminRoom] = useState<string>('');

  useEffect(() => {
    if (devices && devices.length > 0 && !selectedAdminRoom) {
      const roomsList = Array.from(new Set(devices.map(d => d.location.room).filter(Boolean)));
      if (roomsList.length > 0) {
        setSelectedAdminRoom(roomsList[0]);
      }
    }
  }, [devices, selectedAdminRoom]);
   useEffect(() => {
     const timer = setInterval(() => {
       setLiveTime(new Date());
     }, 1000);
     return () => clearInterval(timer);
   }, []);
 
   // Incident Form State
   const [incidentForm, setIncidentForm] = useState({
     deviceId: '',
     deviceSn: '',
     deviceName: '',
     reporterName: currentUser?.name || 'Cán Bộ Giảng Đường',
     faculty: 'Khoa Công nghệ Thông tin',
     room: 'Phòng A101',
     severity: 'medium' as 'low' | 'medium' | 'high' | 'urgent',
     description: ''
   });
 
   useEffect(() => {
     if (currentUser) {
       setIncidentForm(prev => ({
         ...prev,
         reporterName: currentUser.name
       }));
     }
   }, [currentUser]);

  // n8n Webhook & Telegram Integration State
  const [n8nWebhookUrl, setN8nWebhookUrl] = useState<string>(
    localStorage.getItem('DUE_N8N_WEBHOOK_URL') || ''
  );
  const [n8nTesting, setN8nTesting] = useState(false);
  const [n8nTestResult, setN8nTestResult] = useState<string | null>(null);

  // Telegram Bot (@japancsvcbot) Integration State
  const [telegramBotToken, setTelegramBotToken] = useState<string>(
    localStorage.getItem('DUE_TELEGRAM_BOT_TOKEN') || '8715568190:AAEKFL-s06KAuNDVldDB0eyVLhrEcrSVgV8'
  );
  const [telegramChatId, setTelegramChatId] = useState<string>(
    localStorage.getItem('DUE_TELEGRAM_CHAT_ID') || ''
  );
  const [telegramTesting, setTelegramTesting] = useState(false);
  const [telegramScanning, setTelegramScanning] = useState(false);
  const [resettingWebhook, setResettingWebhook] = useState(false);
  const [scannedChats, setScannedChats] = useState<Array<{ id: string; name: string; type: string }>>([]);
  const [telegramTestResult, setTelegramTestResult] = useState<string | null>(null);

  const [configTab, setConfigTab] = useState<'telegram' | 'n8n' | 'device'>('telegram');
  const [customCategory, setCustomCategory] = useState<string>('');

  useEffect(() => {
    if (!currentUser) return;
    const unsub = onSnapshot(doc(db, 'settings', 'app_config'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data && data.telegramBotToken) {
          setTelegramBotToken(data.telegramBotToken);
          localStorage.setItem('DUE_TELEGRAM_BOT_TOKEN', data.telegramBotToken);
        }
        if (data && data.telegramChatId) {
          setTelegramChatId(data.telegramChatId);
          localStorage.setItem('DUE_TELEGRAM_CHAT_ID', data.telegramChatId);
        }
      }
    });
    return () => unsub();
  }, [currentUser]);

  // Device notification states
  const [devicePermission, setDevicePermission] = useState<NotificationPermission>(
    typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'default'
  );
  const [enableDeviceNotif, setEnableDeviceNotif] = useState(
    localStorage.getItem('DUE_ENABLE_DEVICE_NOTIFICATIONS') !== 'false'
  );

  const requestDevicePermission = async () => {
    if (!('Notification' in window)) {
      alert('Trình duyệt của bạn không hỗ trợ thông báo hệ thống.');
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      setDevicePermission(permission);
      if (permission === 'granted') {
        // Send a welcoming PWA notification
        triggerLocalTestNotification('🔔 Đã Bật Thông Báo Hệ Thống DUE', 'Bạn sẽ nhận được thông báo tức thì trên thiết bị di động khi có sự cố mới hoặc cập nhật!');
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
    }
  };

  const handleToggleDeviceNotif = (checked: boolean) => {
    setEnableDeviceNotif(checked);
    localStorage.setItem('DUE_ENABLE_DEVICE_NOTIFICATIONS', checked ? 'true' : 'false');
  };

  const triggerLocalTestNotification = (title: string, body: string) => {
    if (!('Notification' in window) || Notification.permission !== 'granted') return;
    const options = {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      vibrate: [100, 50, 100]
    };
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.showNotification(title, options);
      }).catch(() => {
        new Notification(title, options);
      });
    } else {
      new Notification(title, options);
    }
  };

  // Custom inline resolution modal state
  const [resolvingIncidentId, setResolvingIncidentId] = useState<string | null>(null);
  const [resolutionNoteText, setResolutionNoteText] = useState('');



  const handleTestN8nWebhook = async () => {
    setN8nTesting(true);
    setN8nTestResult(null);
    try {
      localStorage.setItem('DUE_N8N_WEBHOOK_URL', n8nWebhookUrl);
      const res = await fetch('/api/n8n/trigger-telegram', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ webhookUrl: n8nWebhookUrl })
      });
      const data = await res.json();
      if (res.ok) {
        setN8nTestResult('✅ Đã kích hoạt n8n workflow & gửi Telegram thành công!');
      } else {
        setN8nTestResult(`⚠️ Lỗi: ${data.error || 'Không thể kết nối n8n webhook'}`);
      }
    } catch (err: any) {
      setN8nTestResult(`❌ Lỗi kết nối: ${err.message}`);
    } finally {
      setN8nTesting(false);
    }
  };

  const handleTestTelegram = async () => {
    if (!telegramBotToken.trim() || !telegramChatId.trim()) {
      setTelegramTestResult('❌ Vui lòng nhập đầy đủ Bot Token và Chat ID.');
      return;
    }

    setTelegramTesting(true);
    setTelegramTestResult(null);
    try {
      localStorage.setItem('DUE_TELEGRAM_BOT_TOKEN', telegramBotToken);
      localStorage.setItem('DUE_TELEGRAM_CHAT_ID', telegramChatId);

      const res = await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: telegramBotToken,
          chatId: telegramChatId,
          message: '🚨<b>KIỂM TRA KẾT NỐI TELEGRAM BOT (@japancsvcbot)</b>\nHệ thống Quản lý Thiết bị DUE đã kết nối thành công tới bot thông báo sự cố!'
        })
      });
      const data = await res.json();
      if (res.ok) {
        setTelegramTestResult('✅ Đã gửi tin nhắn thử nghiệm đến Telegram bot @japancsvcbot thành công!');
      } else {
        setTelegramTestResult(`⚠️ Lỗi: ${data.error || 'Không thể gửi tin nhắn qua Telegram'}`);
      }
    } catch (err: any) {
      setTelegramTestResult(`❌ Lỗi kết nối: ${err.message}`);
    } finally {
      setTelegramTesting(false);
    }
  };

  const handleResetWebhook = async () => {
    if (!telegramBotToken.trim()) return;
    setResettingWebhook(true);
    setTelegramTestResult(null);
    try {
      const res = await fetch('/api/telegram/reset-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: telegramBotToken.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setTelegramTestResult('✅ <b>Đã xóa Webhook Telegram thành công!</b> Bạn hãy gửi tin nhắn cho bot @japancsvcbot rồi nhấn nút <b>"🔍 Tự động quét Chat ID"</b>.');
      } else {
        setTelegramTestResult(`⚠️ Không thể xóa webhook: ${data.error}`);
      }
    } catch (err: any) {
      setTelegramTestResult(`❌ Lỗi kết nối: ${err.message}`);
    } finally {
      setResettingWebhook(false);
    }
  };

  const handleScanTelegramChats = async () => {
    if (!telegramBotToken.trim()) {
      setTelegramTestResult('❌ Vui lòng nhập Bot Token trước.');
      return;
    }
    setTelegramScanning(true);
    setTelegramTestResult(null);
    try {
      const res = await fetch('/api/telegram/get-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: telegramBotToken.trim() })
      });
      
      const rawText = await res.text();
      let data: any = {};
      try {
        data = JSON.parse(rawText);
      } catch (parseErr) {
        throw new Error('Máy chủ đang khởi động lại hoặc không phản hồi dữ liệu hợp lệ. Vui lòng thử lại sau giây lát.');
      }

      if (res.ok && data.chats && data.chats.length > 0) {
        setScannedChats(data.chats);
        const firstChat = data.chats[0];
        setTelegramChatId(firstChat.id);
        localStorage.setItem('DUE_TELEGRAM_CHAT_ID', firstChat.id);

        // Auto save to Firestore settings/app_config so it persists globally across all sessions
        try {
          await setDoc(doc(db, 'settings', 'app_config'), {
            telegramBotToken: telegramBotToken.trim(),
            telegramChatId: firstChat.id
          }, { merge: true });
        } catch (dbErr) {
          console.warn('Auto save to db error:', dbErr);
        }

        setTelegramTestResult(`✅ <b>Đã quét & tự động lưu Chat ID [${firstChat.id}] (${firstChat.name || firstChat.type})!</b> Hệ thống đã kết nối trực tiếp với @japancsvcbot.`);
      } else {
        const msg = data.error || '⚠️ Không tìm thấy tin nhắn mới. Hãy chắc chắn bạn đã gửi ít nhất 1 tin nhắn (ví dụ: /start) tới bot @japancsvcbot trên Telegram rồi nhấn lại nút quét.';
        setTelegramTestResult(msg);
      }
    } catch (err: any) {
      setTelegramTestResult(`❌ ${err.message || 'Lỗi kết nối tới Telegram'}`);
    } finally {
      setTelegramScanning(false);
    }
  };

  // Camera QR Auto Select Device Helper
  const handleScanDeviceForTab = (tab: 'inspection' | 'replacement' | 'incident') => {
    onOpenScanner((scannedValue) => {
      let val = scannedValue.trim();
      
      // Try parsing as URL first in case QR contains full link
      if (val.startsWith('http://') || val.startsWith('https://')) {
        try {
          const url = new URL(val);
          const snParam = url.searchParams.get('sn') || url.searchParams.get('serialNumber');
          const roomParam = url.searchParams.get('room') || url.searchParams.get('roomName');
          const idParam = url.searchParams.get('id') || url.searchParams.get('deviceId');
          if (snParam) {
            val = snParam;
          } else if (roomParam) {
            val = `ROOM:${roomParam}`;
          } else if (idParam) {
            val = idParam;
          }
        } catch (urlErr) {
          console.warn('Failed to parse scanned URL:', urlErr);
        }
      }

      // Try parsing JSON payload if any
      try {
        const parsed = JSON.parse(scannedValue);
        if (parsed) {
          if (parsed.type === 'room' && parsed.room) {
            val = `ROOM:${parsed.room}`;
          } else if (parsed.room) {
            val = `ROOM:${parsed.room}`;
          } else if (parsed.sn) {
            val = parsed.sn;
          }
        }
      } catch (e) {
        // Not a JSON payload, treat as plain text
      }

      // 1. Direct SN/ID match prioritization
      const foundDevice = devices.find(d => d.serialNumber.toLowerCase() === val.toLowerCase() || d.id === val);
      if (foundDevice) {
        if (tab === 'inspection') {
          setInspectionForm(prev => ({
            ...prev,
            deviceId: foundDevice.id,
            deviceSn: foundDevice.serialNumber,
            deviceName: foundDevice.name
          }));
        } else if (tab === 'replacement') {
          setReplacementForm(prev => ({
            ...prev,
            deviceId: foundDevice.id,
            deviceSn: foundDevice.serialNumber,
            deviceName: foundDevice.name
          }));
        } else if (tab === 'incident') {
          setScannedRoom(null);
          setIncidentForm(prev => ({
            ...prev,
            deviceId: foundDevice.id,
            deviceSn: foundDevice.serialNumber,
            deviceName: foundDevice.name,
            faculty: foundDevice.location.faculty,
            room: foundDevice.location.room
          }));
        }
        return;
      }

      // 2. Room match fallback (mainly for incident tab)
      const isRoomPrefix = val.toUpperCase().startsWith('ROOM:');
      const matchedRoom = isRoomPrefix ? val.substring(5).trim() : val;
      const normalizedQueryRoom = normalizeRoom(matchedRoom);

      const isRoomCode = isRoomPrefix || devices.some(d => d.location.room && normalizeRoom(d.location.room) === normalizedQueryRoom);

      if (tab === 'incident' && isRoomCode) {
        const devicesInRoom = devices.filter(d => d.location.room && normalizeRoom(d.location.room) === normalizedQueryRoom);
        if (devicesInRoom.length > 0) {
          // Use the exact room name stored in devices to maintain consistency
          const canonicalRoomName = devicesInRoom[0].location.room;
          setScannedRoom(canonicalRoomName);
          setIncidentForm(prev => ({
            ...prev,
            deviceId: '',
            deviceSn: '',
            deviceName: '',
            room: canonicalRoomName,
            faculty: devicesInRoom[0].location.faculty
          }));
          return;
        } else {
          // If no devices are in this room, set the scannedRoom to matchedRoom anyway, so the user knows they scanned a room!
          setScannedRoom(matchedRoom);
          setIncidentForm(prev => ({
            ...prev,
            deviceId: '',
            deviceSn: '',
            deviceName: '',
            room: matchedRoom,
            faculty: ''
          }));
          return;
        }
      }

      // If nothing is matched
      alert(`Không tìm thấy thiết bị hay phòng nào tương ứng với mã: "${val}". Vui lòng kiểm tra lại.`);
    });
  };

  const handleSelectDeviceForInspection = (devId: string) => {
    const dev = devices.find(d => d.id === devId);
    if (dev) {
      setInspectionForm(prev => ({
        ...prev,
        deviceId: dev.id,
        deviceSn: dev.serialNumber,
        deviceName: dev.name
      }));
    }
  };

  const handleSelectDeviceForReplacement = (devId: string) => {
    const dev = devices.find(d => d.id === devId);
    if (dev) {
      setReplacementForm(prev => ({
        ...prev,
        deviceId: dev.id,
        deviceSn: dev.serialNumber,
        deviceName: dev.name
      }));
    }
  };

  const handleSelectDeviceForIncident = (devId: string) => {
    const dev = devices.find(d => d.id === devId);
    if (dev) {
      setIncidentForm(prev => ({
        ...prev,
        deviceId: dev.id,
        deviceSn: dev.serialNumber,
        deviceName: dev.name,
        faculty: dev.location.faculty,
        room: dev.location.room
      }));
    }
  };

  const fileInputRef = useRef<HTMLInputElement>(null);
  const incidentQrPrintRef = useRef<HTMLDivElement>(null);
  const roomQrPrintRef = useRef<HTMLDivElement>(null);

  const handlePrintRoomQR = () => {
    if (!selectedAdminRoom) return;
    const printContent = roomQrPrintRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=700,height=600');
    if (!printWindow) {
      alert('Trình duyệt chặn mở cửa sổ in. Vui lòng cho phép popup để in mã QR.');
      return;
    }

    const svgMarkup = printContent.querySelector('svg')?.outerHTML || '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Mã QR Báo Sự Cố - Phòng ${selectedAdminRoom}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 35px; margin: 0; background: #fff; text-align: center; }
            .room-card {
              border: 4px solid #1e3a8a;
              border-radius: 16px;
              padding: 28px;
              max-width: 500px;
              margin: 0 auto;
              background: #fff;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            }
            .header { border-bottom: 3px solid #3b82f6; padding-bottom: 12px; margin-bottom: 20px; }
            .header h2 { margin: 0; font-size: 20px; text-transform: uppercase; color: #1e3a8a; font-weight: 800; }
            .header p { margin: 6px 0 0; font-size: 13px; color: #4b5563; font-weight: 600; }
            .qr-container { display: flex; flex-direction: column; align-items: center; justify-content: center; margin: 20px 0; }
            .qr-box { padding: 15px; border: 2px solid #93c5fd; border-radius: 12px; background: #f0f7ff; display: inline-block; }
            .room-badge { display: inline-block; background: #1e3a8a; color: #fff; padding: 6px 16px; border-radius: 8px; font-family: system-ui, sans-serif; font-size: 16px; font-weight: bold; margin-top: 12px; letter-spacing: 0.5px; }
            .instructions { font-size: 12px; color: #4b5563; line-height: 1.6; margin-top: 15px; background: #f9fafb; padding: 12px; border-radius: 8px; border: 1px solid #e5e7eb; text-align: left; }
            @media print {
              body { padding: 0; }
              .room-card { box-shadow: none; border: 4px solid #000; }
              .header { border-bottom: 3px solid #000; }
              .room-badge { background: #000; color: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
              .instructions { border: 1px solid #000; }
            }
          </style>
        </head>
        <body>
          <div class="room-card">
            <div class="header">
              <h2>QUÉT QR BÁO HỎNG NHANH</h2>
              <p>Hệ Thống Quản Lý Thiết Bị & Phòng Lab - DUE</p>
            </div>
            <div class="qr-container">
              <div class="qr-box">
                \${svgMarkup}
              </div>
              <div class="room-badge">PHÒNG: \${selectedAdminRoom}</div>
            </div>
            <div class="instructions">
              <strong>Hướng dẫn & Danh mục thiết bị phòng học:</strong><br/>
              1. Quét mã QR tại phòng <strong>\${selectedAdminRoom}</strong> để báo hỏng nhanh.<br/>
              2. Các loại thiết bị hỗ trợ: <strong>Máy chiếu, Dây cáp HDMI, Dây VGA, Thiết bị điện, Điều hoà, Âm thanh, Bàn ghế</strong>.<br/>
              3. Chọn thiết bị/loại thiết bị gặp sự cố, nhập mô tả và gửi báo cáo.<br/>
              4. Bộ phận kỹ thuật sẽ nhận được thông báo tức thì qua Telegram Bot (@japancsvcbot)!
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadRoomSVG = () => {
    if (!selectedAdminRoom) return;
    const svgElement = roomQrPrintRef.current?.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `ROOM_QR_\${selectedAdminRoom.replace(/[^a-zA-Z0-9]/g, '_')}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const selectedIncidentDevice = devices.find(d => d.id === incidentForm.deviceId);

  const handlePrintIncidentQR = () => {
    if (!selectedIncidentDevice) return;
    const printContent = incidentQrPrintRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank', 'width=700,height=600');
    if (!printWindow) {
      alert('Trình duyệt chặn mở cửa sổ in. Vui lòng cho phép popup để in mã QR.');
      return;
    }

    const svgMarkup = printContent.querySelector('svg')?.outerHTML || '';

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
        <head>
          <title>Mã QR Báo Cáo Sự Cố - ${selectedIncidentDevice.serialNumber}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 30px; margin: 0; background: #fff; }
            .tag-card {
              border: 3px solid #be123c;
              border-radius: 12px;
              padding: 24px;
              max-width: 480px;
              margin: 0 auto;
              background: #fff;
              box-shadow: 0 4px 6px -1px rgb(0 0 0 / 0.1);
            }
            .header { text-align: center; border-bottom: 2px solid #fecdd3; padding-bottom: 12px; margin-bottom: 16px; }
            .header h2 { margin: 0; font-size: 18px; text-transform: uppercase; color: #be123c; }
            .header p { margin: 4px 0 0; font-size: 12px; color: #64748b; }
            .body-grid { display: flex; align-items: flex-start; gap: 20px; margin-top: 16px; }
            .info { flex: 1; font-size: 13px; line-height: 1.6; }
            .qr-box { padding: 10px; border: 1px solid #fca5a5; border-radius: 8px; text-align: center; background: #fff5f5; }
            .sn-badge { display: inline-block; background: #be123c; color: #fff; padding: 4px 10px; border-radius: 4px; font-family: monospace; font-size: 14px; font-weight: bold; margin-top: 8px; }
            @media print {
              body { padding: 0; }
              .tag-card { box-shadow: none; border: 3px solid #000; }
              .header { border-bottom: 2px solid #000; }
              .sn-badge { background: #000; color: #fff; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
            }
          </style>
        </head>
        <body>
          <div class="tag-card">
            <div class="header">
              <h2>BÁO CÁO SỰ CỐ KHẨN CẤP</h2>
              <p>Mẫu Thẻ QR Báo Cáo Sự Cố Thiết Bị Giảng Đường</p>
            </div>
            <div class="body-grid">
              <div class="qr-box">
                ${svgMarkup}
                <div class="sn-badge">${selectedIncidentDevice.serialNumber}</div>
              </div>
              <div class="info">
                <div style="font-weight: bold; font-size: 11px; color: #be123c; margin-bottom: 2px;">🖥️ Tên thiết bị và số sê-ri (SN):</div>
                <div style="font-size: 13px; font-weight: bold; margin-bottom: 8px; color: #0f172a;">${selectedIncidentDevice.name} [SN: ${selectedIncidentDevice.serialNumber}]</div>
                
                <div style="font-weight: bold; font-size: 11px; color: #1e3a8a; margin-bottom: 2px;">📍 Vị trí Phòng & Giảng viên:</div>
                <div style="font-size: 13px; font-weight: bold; margin-bottom: 8px; color: #1e293b;">Phòng ${selectedIncidentDevice.location.room} (${selectedIncidentDevice.location.faculty})</div>
                
                <div style="font-weight: bold; font-size: 11px; color: #b45309; margin-bottom: 2px;">⚠️ Mức độ nghiêm trọng của sự cố:</div>
                <div style="font-size: 13px; margin-bottom: 8px; color: #451a03; font-weight: bold;">Thấp / Bình thường / Nguy hiểm</div>
                
                <div style="font-weight: bold; font-size: 11px; color: #475569; margin-bottom: 2px;">👤 Trường Người báo cáo & Dấu thời gian:</div>
                <div style="font-size: 13px; margin-bottom: 8px; color: #334155; font-weight: bold;">${incidentForm.reporterName || '................'} - ${new Date().toLocaleString('vi-VN')}</div>
                
                <div style="font-weight: bold; font-size: 11px; color: #475569; margin-bottom: 2px;">📝 Mô tả trường hư hỏng:</div>
                <div style="font-size: 13px; color: #334155; font-style: italic; font-weight: bold;">${incidentForm.description || '................'}</div>
              </div>
            </div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleDownloadIncidentSVG = () => {
    if (!selectedIncidentDevice) return;
    const svgElement = incidentQrPrintRef.current?.querySelector('svg');
    if (!svgElement) return;

    const svgData = new XMLSerializer().serializeToString(svgElement);
    const svgBlob = new Blob([svgData], { type: 'image/svg+xml;charset=utf-8' });
    const svgUrl = URL.createObjectURL(svgBlob);

    const downloadLink = document.createElement('a');
    downloadLink.href = svgUrl;
    downloadLink.download = `INCIDENT_QR_${selectedIncidentDevice.serialNumber}.svg`;
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
  };

  const handleFileImportMaintenance = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const data = new Uint8Array(event.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData: any[] = XLSX.utils.sheet_to_json(sheet);
        
        let importedCount = 0;
        
        jsonData.forEach(row => {
          const type = row['Loại'];
          const sn = row['Mã thiết bị'];
          const device = devices.find(d => d.serialNumber === sn);
          
          if (!device) {
             console.warn(`Device not found for SN: ${sn}`);
             return;
          }

          if (type === 'Kiểm tra định kỳ') {
            onAddInspection({
              deviceId: device.id,
              deviceSn: sn,
              deviceName: device.name,
              inspectorName: currentUser?.name || 'Imported',
              inspectionDate: row['Ngày'] || new Date().toISOString().split('T')[0],
              result: row['Kết quả'] === 'Đạt' ? 'passed' : row['Kết quả'] === 'Cần Bảo Trì' ? 'warning' : 'failed',
              checkPower: true,
              checkDisplayAudio: true,
              checkConnections: true,
              checkCleaningFan: true,
              notes: row['Ghi chú'] || '',
            });
            importedCount++;
          } else if (type === 'Thay vật tư') {
            onAddReplacement({
              deviceId: device.id,
              deviceSn: sn,
              deviceName: device.name,
              partName: row['Vật tư'] || 'Unknown',
              partCondition: 'new',
              cost: Number(row['Chi phí']) || 0,
              quantity: 1,
              replacedBy: currentUser?.name || 'Imported',
              replacementDate: row['Ngày'] || new Date().toISOString().split('T')[0],
              reason: 'Imported',
              warrantyMonths: 12
            });
            importedCount++;
          } else if (type === 'Sự cố') {
            onAddIncident({
              deviceId: device.id,
              deviceSn: sn,
              deviceName: device.name,
              reporterName: currentUser?.name || 'Imported',
              faculty: device.location.faculty,
              room: device.location.room,
              severity: 'medium',
              description: row['Mô tả'] || 'Imported incident'
            });
            importedCount++;
          }
        });
        
        alert(`Đã import thành công ${importedCount} dòng dữ liệu.`);
      } catch (err) {
        console.error('Import parse error:', err);
        alert('Lỗi đọc file. Vui lòng kiểm tra lại định dạng file.');
      } finally {
        if (e.target) e.target.value = '';
      }
    };
    reader.readAsArrayBuffer(file);
  };

  // Submit Handlers
  const handleInspectionSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inspectionForm.deviceId) {
      alert('Vui lòng chọn thiết bị cần kiểm tra định kỳ.');
      return;
    }
    const damageData = (includeDamageReport || inspectionForm.result === 'failed' || inspectionForm.result === 'warning') && damageDescription.trim()
      ? { severity: damageSeverity, description: damageDescription }
      : undefined;

    onAddInspection(inspectionForm, damageData);
    alert('Đã ghi nhận kết quả kiểm tra định kỳ & báo cáo hư hỏng thành công!');
    setInspectionForm(prev => ({ ...prev, notes: '', actionRequired: '' }));
    setIncludeDamageReport(false);
    setDamageDescription('');
    if (onReturnToDevices) {
      onReturnToDevices();
    }
  };

  const handleReplacementSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!replacementForm.deviceId || !replacementForm.partName.trim()) {
      alert('Vui lòng chọn thiết bị và nhập tên vật tư thay thế.');
      return;
    }
    onAddReplacement(replacementForm);
    alert('Đã ghi nhận thay thế vật tư sửa chữa thành công!');
    setReplacementForm(prev => ({ ...prev, partName: '', reason: '' }));
  };

  const handleIncidentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const isCustomDevice = incidentForm.deviceId === 'custom';
    
    if (!isCustomDevice && !incidentForm.deviceId) {
      alert('Vui lòng chọn thiết bị gặp sự cố.');
      return;
    }
    
    if (isCustomDevice && !incidentForm.deviceName.trim()) {
      alert('Vui lòng nhập loại/tên thiết bị.');
      return;
    }
    
    if (isCustomDevice && !incidentForm.room.trim()) {
      alert('Vui lòng nhập phòng học / phòng Lab.');
      return;
    }

    if (!incidentForm.description.trim()) {
      alert('Vui lòng mô tả chi tiết sự cố.');
      return;
    }
    
    // Find selected device details if it's a registered device, otherwise use user input
    const selectedDevice = !isCustomDevice ? devices.find(d => d.id === incidentForm.deviceId) : null;
    const incidentData = {
      ...incidentForm,
      deviceId: isCustomDevice ? 'custom' : (selectedDevice ? selectedDevice.id : ''),
      deviceName: isCustomDevice ? incidentForm.deviceName.trim() : (selectedDevice ? selectedDevice.name : 'Thiết bị không rõ'),
      deviceSn: isCustomDevice ? (incidentForm.deviceSn.trim() || 'N/A') : (selectedDevice ? selectedDevice.serialNumber : 'Không rõ SN'),
      room: isCustomDevice ? incidentForm.room.trim() : (selectedDevice ? (selectedDevice.location.room || 'Phòng chung') : 'Không rõ phòng'),
      faculty: isCustomDevice ? (incidentForm.faculty.trim() || 'Cơ sở vật chất') : (selectedDevice ? (selectedDevice.location.faculty || 'Phòng chung') : 'Không rõ khoa'),
      reporterName: currentUser?.name || incidentForm.reporterName || 'Cán Bộ Kỹ Thuật'
    };
    
    // 1. Save incident locally/Firestore via callback
    onAddIncident(incidentData as any);
    
    let isNotified = false;

    // 2. Trigger n8n webhook if configured
    if (n8nWebhookUrl.trim()) {
      try {
        localStorage.setItem('DUE_N8N_WEBHOOK_URL', n8nWebhookUrl);
        const res = await fetch('/api/n8n/trigger-telegram', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            webhookUrl: n8nWebhookUrl,
            incident: incidentData
          })
        });
        if (res.ok) {
          isNotified = true;
        }
      } catch (n8nErr) {
        console.error('Error triggering n8n webhook:', n8nErr);
      }
    }

    // 3. Trigger direct Telegram Bot (@japancsvcbot) notification if chat id configured
    if (telegramChatId.trim()) {
      try {
        localStorage.setItem('DUE_TELEGRAM_BOT_TOKEN', telegramBotToken);
        localStorage.setItem('DUE_TELEGRAM_CHAT_ID', telegramChatId);

        const res = await fetch('/api/telegram/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            token: telegramBotToken,
            chatId: telegramChatId,
            incident: incidentData
          })
        });
        if (res.ok) {
          isNotified = true;
        }
      } catch (tgErr) {
        console.error('Error triggering Telegram notification:', tgErr);
      }
    }

    if (isNotified) {
      alert('Báo cáo sự cố hư hỏng đã được tạo và hệ thống đã gửi thông báo thành công qua Telegram Bot (@japancsvcbot)!');
    } else {
      alert('Báo cáo sự cố hư hỏng đã được tạo thành công!');
    }
    setIncidentForm(prev => ({ ...prev, description: '' }));
  };

  const handleExportExcel = () => {
    const getLocation = (sn: string) => {
      const device = devices.find(d => d.serialNumber === sn);
      return device ? `${device.location.lectureHall} - ${device.location.room}` : 'N/A';
    };

    const inspData = inspections
      .filter(i => !selectedDeviceSn || i.deviceSn === selectedDeviceSn)
      .map(i => ({
      Loại: 'Kiểm tra định kỳ',
      'Mã thiết bị': i.deviceSn,
      'Tên thiết bị': i.deviceName,
      'Classroom / Lab *': getLocation(i.deviceSn),
      'Ngày': i.inspectionDate,
      'Kết quả': i.result,
      'Ghi chú': i.notes
    }));

    const replData = replacements
      .filter(r => !selectedDeviceSn || r.deviceSn === selectedDeviceSn)
      .map(r => ({
      Loại: 'Thay vật tư',
      'Mã thiết bị': r.deviceSn,
      'Tên thiết bị': r.deviceName,
      'Classroom / Lab *': getLocation(r.deviceSn),
      'Ngày': r.replacementDate,
      'Vật tư': r.partName,
      'Chi phí': r.cost
    }));

    const incData = incidents
      .filter(i => !selectedDeviceSn || i.deviceSn === selectedDeviceSn)
      .map(i => ({
      Loại: 'Sự cố',
      'Mã thiết bị': i.deviceSn,
      'Tên thiết bị': i.deviceName,
      'Classroom / Lab *': i.room || getLocation(i.deviceSn),
      'Ngày': i.reportedAt.split('T')[0],
      'Mô tả': i.description,
      'Trạng thái': i.status
    }));

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet([...inspData, ...replData, ...incData]);
    XLSX.utils.book_append_sheet(wb, ws, 'Nhật Ký Bảo Trì');
    XLSX.writeFile(wb, 'nhat_ky_bao_tri.xlsx');
  };

  const renderDeviceNotificationSettings = () => {
    return (
      <div className="space-y-4 animate-fade-in">
        <div className="bg-slate-100/80 p-4 rounded-xl border border-slate-200/60 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="space-y-0.5">
              <span className="block text-[10px] font-bold text-slate-500 uppercase tracking-wider">Trạng thái thông báo</span>
              <div className="flex items-center gap-2">
                <span className={`h-2.5 w-2.5 rounded-full ${
                  devicePermission === 'granted' ? 'bg-emerald-500 animate-pulse' :
                  devicePermission === 'denied' ? 'bg-rose-500' : 'bg-amber-500'
                }`} />
                <span className="text-xs font-bold text-slate-800">
                  {devicePermission === 'granted' ? 'Đã kích hoạt (Cho phép)' :
                   devicePermission === 'denied' ? 'Bị chặn (Vui lòng bật trong cài đặt trình duyệt)' :
                   'Chưa thiết lập (Yêu cầu cấp quyền)'}
                </span>
              </div>
            </div>

            <button
              type="button"
              onClick={requestDevicePermission}
              disabled={devicePermission === 'granted'}
              className={`rounded-xl px-4 py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm shrink-0 ${
                devicePermission === 'granted'
                  ? 'bg-slate-200 text-slate-500 cursor-not-allowed border border-slate-300'
                  : 'bg-indigo-600 hover:bg-indigo-700 text-white font-bold'
              }`}
            >
              🔔 {devicePermission === 'granted' ? 'Đã cho phép' : 'Bật thông báo thiết bị'}
            </button>
          </div>

          <div className="border-t border-slate-200/60 pt-3 flex items-center justify-between">
            <div className="space-y-0.5">
              <span className="block text-xs font-bold text-slate-800">Nhận thông báo trên thiết bị này</span>
              <p className="text-[10px] text-slate-500">Tắt nếu bạn không muốn nhận cảnh báo trên máy này nữa</p>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enableDeviceNotif}
                onChange={(e) => handleToggleDeviceNotif(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-9 h-5 bg-slate-200 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:bg-emerald-600"></div>
            </label>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-xl border border-slate-200 p-3.5 space-y-2">
            <h5 className="text-xs font-bold text-indigo-700 flex items-center gap-1.5">
              📱 Hướng dẫn cài trên Điện thoại di động (PWA)
            </h5>
            <ul className="text-[11px] text-slate-600 space-y-1.5 list-disc pl-4 leading-relaxed">
              <li>
                <strong className="text-slate-800">Trên iOS (iPhone/iPad)</strong>: Nhấn nút <b>Chia sẻ (Share)</b> ở thanh dưới Safari ➔ Chọn <b>"Thêm vào MH chính" (Add to Home Screen)</b> ➔ Mở ứng dụng từ MH chính để bắt đầu nhận thông báo.
              </li>
              <li>
                <strong className="text-slate-800">Trên Android</strong>: Nhấn dấu 3 chấm ➔ Chọn <b>"Cài đặt ứng dụng"</b> hoặc <b>"Thêm vào MH chính"</b> ➔ Đồng ý và mở ứng dụng lên để nhận thông báo tức thì.
              </li>
            </ul>
          </div>

          <div className="bg-white rounded-xl border border-slate-200 p-3.5 flex flex-col justify-between">
            <div className="space-y-1.5">
              <h5 className="text-xs font-bold text-emerald-700 flex items-center gap-1.5">
                🧪 Kiểm tra hoạt động
              </h5>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                Sau khi bấm <b>Cho phép nhận thông báo</b>, hãy thử click nút bên dưới để kiểm tra xem hệ thống có gửi được thông báo nổi lên màn hình thiết bị của bạn hay không.
              </p>
            </div>
            <button
              type="button"
              onClick={() => triggerLocalTestNotification('🧪 TEST THÔNG BÁO THÀNH CÔNG', 'Hệ thống Quản lý Thiết bị DUE đã kết nối và hiển thị thành công thông báo trên thiết bị của bạn! 🎉')}
              disabled={devicePermission !== 'granted'}
              className="mt-3 w-full rounded-xl bg-slate-950 hover:bg-slate-800 disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed border border-slate-200 hover:border-slate-300 text-white text-xs font-bold py-2 transition flex items-center justify-center gap-1.5 shadow-sm"
            >
              🚀 Chạy thử thông báo
            </button>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-6">
      
      {/* Sub navigation bar */}
      {currentUser?.role !== 'staff' && (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4 bg-white p-3 sm:p-4 rounded-xl shadow-sm border border-slate-200">
          <div className="flex flex-nowrap space-x-1.5 sm:space-x-2 overflow-x-auto w-full sm:w-auto pb-1 sm:pb-0 no-scrollbar">
            <button
              onClick={() => setActiveSubTab('calendar')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold transition shrink-0 ${
                activeSubTab === 'calendar'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Calendar className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>
                <span className="sm:hidden">Lịch</span>
                <span className="hidden sm:inline">Lịch Bảo Trì</span>
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('inspection')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold transition shrink-0 ${
                activeSubTab === 'inspection'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <ClipboardCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>
                <span className="sm:hidden">Kiểm Tra</span>
                <span className="hidden sm:inline">Kiểm Tra Định Kỳ</span>
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('replacement')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold transition shrink-0 ${
                activeSubTab === 'replacement'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <PackageCheck className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>
                <span className="sm:hidden">Thay Vật Tư</span>
                <span className="hidden sm:inline">Thay Thế Vật Tư</span>
              </span>
            </button>

            <button
              onClick={() => setActiveSubTab('incidents')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold transition shrink-0 ${
                activeSubTab === 'incidents'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <AlertTriangle className="h-3.5 w-3.5 sm:h-4 sm:w-4 text-amber-500" />
              <span>Sự Cố ({incidents.filter(i => i.status !== 'resolved').length})</span>
            </button>

            <button
              onClick={() => setActiveSubTab('history')}
              className={`flex items-center gap-1.5 rounded-lg px-2.5 sm:px-3.5 py-1.5 sm:py-2 text-xs font-semibold transition shrink-0 ${
                activeSubTab === 'history'
                  ? 'bg-blue-600 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              <Activity className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              <span>
                <span className="sm:hidden">Nhật Ký</span>
                <span className="hidden sm:inline">Nhật Ký Bảo Trì</span>
              </span>
            </button>
          </div>

          <div className="text-xs text-slate-500 hidden lg:block">
            Quản lý lịch bảo trì, vật tư linh kiện và sự cố thiết bị
          </div>
        </div>
      )}

      {/* 0. Calendar View Subtab */}
      {activeSubTab === 'calendar' && (
        <MaintenanceCalendar
          devices={devices}
          inspections={inspections}
          incidents={incidents}
          onSelectDeviceForInspection={handleSelectDeviceFromCalendar}
        />
      )}

      {/* 1. Periodic Inspection Form */}
      {activeSubTab === 'inspection' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl bg-white p-6 shadow-sm border border-slate-200 space-y-5">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <ClipboardCheck className="h-5 w-5 text-emerald-600" />
                  Ghi Nhận Kiểm Tra Định Kỳ Thiết Bị
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Đánh giá tình trạng hoạt động và ghi nhận nhật ký kiểm định định kỳ
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleScanDeviceForTab('inspection')}
                className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
                title="Quét camera mã SN để tự chọn thiết bị"
              >
                <Camera className="h-4 w-4 text-emerald-400" />
                Quét Camera SN
              </button>
            </div>

            <form onSubmit={handleInspectionSubmit} className="space-y-4">
              
              {/* Select device with search filter */}
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Chọn Thiết Bị Kiểm Tra *
                  </label>
                  {deviceSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setDeviceSearchQuery('')}
                      className="text-[11px] text-emerald-600 hover:underline font-medium"
                    >
                      Xóa tìm kiếm
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="🔍 Nhập tên thiết bị, mã SN, khoa hoặc phòng để tìm nhanh..."
                  value={deviceSearchQuery}
                  onChange={(e) => setDeviceSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:border-emerald-500 focus:outline-none mb-2 bg-slate-50/50 text-slate-800"
                />
                <select
                  required
                  value={inspectionForm.deviceId}
                  onChange={(e) => handleSelectDeviceForInspection(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none focus:ring-2 focus:ring-emerald-200 bg-white"
                >
                  <option value="">
                    {deviceSearchQuery.trim() 
                      ? `-- Kết quả tìm kiếm (${devices.filter(d => d.name.toLowerCase().includes(deviceSearchQuery.toLowerCase()) || d.serialNumber.toLowerCase().includes(deviceSearchQuery.toLowerCase()) || d.location.faculty.toLowerCase().includes(deviceSearchQuery.toLowerCase()) || d.location.room.toLowerCase().includes(deviceSearchQuery.toLowerCase())).length}) --` 
                      : `-- Chọn thiết bị trong danh sách (${devices.length}) --`}
                  </option>
                  {devices
                    .filter(dev => {
                      if (!deviceSearchQuery.trim()) return true;
                      const q = deviceSearchQuery.toLowerCase();
                      return (
                        dev.name.toLowerCase().includes(q) ||
                        dev.serialNumber.toLowerCase().includes(q) ||
                        dev.location.faculty.toLowerCase().includes(q) ||
                        dev.location.room.toLowerCase().includes(q)
                      );
                    })
                    .map(dev => (
                      <option key={dev.id} value={dev.id}>
                        [{dev.serialNumber}] {dev.name} ({dev.location.faculty} - {dev.location.room})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Cán Bộ / Kỹ Thuật Viên Kiểm Tra
                  </label>
                  <input
                    type="text"
                    required
                    value={inspectionForm.inspectorName}
                    onChange={(e) => setInspectionForm(prev => ({ ...prev, inspectorName: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ngày Kiểm Tra
                  </label>
                  <input
                    type="date"
                    required
                    value={inspectionForm.inspectionDate}
                    onChange={(e) => setInspectionForm(prev => ({ ...prev, inspectionDate: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* Inspection Checklist */}
              <div className="rounded-xl bg-slate-50 p-4 border border-slate-200 space-y-3">
                <span className="block text-xs font-bold text-slate-800 uppercase tracking-wide">
                  Danh Mục Kiểm Tra Kỹ Thuật (Checklist)
                </span>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                  <label className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inspectionForm.checkPower}
                      onChange={(e) => setInspectionForm(prev => ({ ...prev, checkPower: e.target.checked }))}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    <span className="font-medium text-slate-700">1. Nguồn điện & Cầu chì an toàn</span>
                  </label>

                  <label className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inspectionForm.checkDisplayAudio}
                      onChange={(e) => setInspectionForm(prev => ({ ...prev, checkDisplayAudio: e.target.checked }))}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    <span className="font-medium text-slate-700">2. Chất lượng Hiển thị / Âm thanh</span>
                  </label>

                  <label className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inspectionForm.checkConnections}
                      onChange={(e) => setInspectionForm(prev => ({ ...prev, checkConnections: e.target.checked }))}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    <span className="font-medium text-slate-700">3. Cáp kết nối (HDMI/VGA/Audio)</span>
                  </label>

                  <label className="flex items-center gap-2 bg-white p-2.5 rounded-lg border border-slate-200 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={inspectionForm.checkCleaningFan}
                      onChange={(e) => setInspectionForm(prev => ({ ...prev, checkCleaningFan: e.target.checked }))}
                      className="rounded text-emerald-600 focus:ring-emerald-500 h-4 w-4"
                    />
                    <span className="font-medium text-slate-700">4. Quạt tản nhiệt & Vệ sinh bụi</span>
                  </label>
                </div>
              </div>

              {/* Result Select */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Kết Quả Đánh Giá Tổng Thể
                </label>
                <div className="grid grid-cols-3 gap-3">
                  <button
                    type="button"
                    onClick={() => setInspectionForm(prev => ({ ...prev, result: 'passed' }))}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition ${
                      inspectionForm.result === 'passed'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    🟢 Đạt (Tốt)
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectionForm(prev => ({ ...prev, result: 'warning' }))}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition ${
                      inspectionForm.result === 'warning'
                        ? 'bg-amber-500 text-white border-amber-500 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    🟡 Cần Bảo Trì
                  </button>
                  <button
                    type="button"
                    onClick={() => setInspectionForm(prev => ({ ...prev, result: 'failed' }))}
                    className={`p-3 rounded-xl border text-xs font-bold text-center transition ${
                      inspectionForm.result === 'failed'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-sm'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    🔴 Hư Hỏng Nặng
                  </button>
                </div>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Ghi Chú & Chi Tiết Khảo Sát
                </label>
                <textarea
                  rows={2}
                  value={inspectionForm.notes}
                  onChange={(e) => setInspectionForm(prev => ({ ...prev, notes: e.target.value }))}
                  placeholder="Ghi lại nhận xét chi tiết..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              {/* Damage / Incident Report Section during Inspection */}
              <div className="rounded-xl bg-amber-50/60 p-4 border border-amber-200 space-y-3">
                <div className="flex items-center justify-between">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={includeDamageReport || inspectionForm.result === 'failed' || inspectionForm.result === 'warning'}
                      onChange={(e) => setIncludeDamageReport(e.target.checked)}
                      className="rounded text-amber-600 focus:ring-amber-500 h-4 w-4"
                    />
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      <AlertTriangle className="h-4 w-4 text-amber-600" />
                      Lập Phiếu Báo Cáo Hư Hỏng / Sự Cố Kèm Theo Biên Bản
                    </span>
                  </label>
                  <span className="text-[11px] text-amber-700 font-medium">
                    {inspectionForm.result !== 'passed' ? 'Khuyên dùng khi thiết bị gặp lỗi' : 'Tùy chọn'}
                  </span>
                </div>

                {(includeDamageReport || inspectionForm.result === 'failed' || inspectionForm.result === 'warning') && (
                  <div className="space-y-3 pt-2 border-t border-amber-200/60">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                          Mức Độ Hư Hỏng
                        </label>
                        <select
                          value={damageSeverity}
                          onChange={(e) => setDamageSeverity(e.target.value as any)}
                          className="w-full rounded-lg border border-amber-300 px-3 py-1.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-200"
                        >
                          <option value="low">Thấp (Lỗi nhẹ, vẫn vận hành)</option>
                          <option value="medium">Trung bình (Hạn chế tính năng)</option>
                          <option value="high">Cao (Ngừng hoạt động một phần)</option>
                          <option value="urgent">Khẩn cấp (Hỏng hoàn toàn / Nguy hiểm)</option>
                        </select>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                          Vị Trí / Phòng (Tự động theo thiết bị)
                        </label>
                        <input
                          type="text"
                          readOnly
                          value={
                            inspectionForm.deviceId 
                              ? `${devices.find(d => d.id === inspectionForm.deviceId)?.location.faculty || ''} - ${devices.find(d => d.id === inspectionForm.deviceId)?.location.room || ''}` 
                              : 'Chưa chọn thiết bị'
                          }
                          className="w-full rounded-lg border border-amber-300 px-3 py-1.5 text-xs bg-amber-100/50 text-slate-700 font-mono"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] font-semibold text-amber-900 mb-1">
                        Mô Tả Chi Tiết Hư Hỏng / Linh Kiện Lỗi *
                      </label>
                      <textarea
                        rows={2}
                        value={damageDescription}
                        onChange={(e) => setDamageDescription(e.target.value)}
                        placeholder="Mô tả cụ thể linh kiện hỏng, hiện tượng lỗi để kỹ thuật viên sửa chữa..."
                        className="w-full rounded-lg border border-amber-300 px-3 py-1.5 text-xs bg-white text-slate-800 focus:outline-none focus:ring-2 focus:ring-amber-200"
                      />
                    </div>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-medium text-white hover:bg-blue-700 transition shadow-sm"
              >
                Lưu Kết Quả Kiểm Tra Định Kỳ
              </button>
            </form>
          </div>

          {/* Inspection Recent History Sidebar */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
            <h4 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
              <span>Lịch Sử Kiểm Định Gần Đây</span>
              <span className="text-xs font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                {inspections.length} lượt
              </span>
            </h4>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {inspections.map(item => (
                <div key={item.id} className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-mono font-bold text-slate-900">{item.deviceSn}</span>
                    <span className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                      item.result === 'passed' ? 'bg-emerald-100 text-emerald-800' :
                      item.result === 'warning' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'
                    }`}>
                      {item.result === 'passed' ? 'ĐẠT' : item.result === 'warning' ? 'CẦN BẢO TRÌ' : 'HƯ HỎNG'}
                    </span>
                  </div>
                  <p className="font-semibold text-slate-800 line-clamp-1">{item.deviceName}</p>
                  <p className="text-[11px] text-slate-500">
                    Bởi: {item.inspectorName} ({formatDate(item.inspectionDate)})
                  </p>
                  {item.notes && (
                    <p className="text-[11px] text-slate-600 italic bg-white p-2 rounded border border-slate-200">
                      "{item.notes}"
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 2. Parts Replacement Form */}
      {activeSubTab === 'replacement' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl bg-white p-6 shadow-sm border border-slate-200 space-y-5">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <PackageCheck className="h-5 w-5 text-emerald-600" />
                  Ghi Nhận Thay Thế Vật Tư & Linh Kiện Sửa Chữa
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Theo dõi linh kiện thay mới, chi phí sửa chữa và thời hạn bảo hành vật tư
                </p>
              </div>

              <button
                type="button"
                onClick={() => handleScanDeviceForTab('replacement')}
                className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
              >
                <Camera className="h-4 w-4 text-emerald-400" />
                Quét Camera SN
              </button>
            </div>

            <form onSubmit={handleReplacementSubmit} className="space-y-4">
              
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="block text-xs font-semibold text-slate-700">
                    Chọn Thiết Bị Thay Vật Tư *
                  </label>
                  {replacementDeviceSearchQuery && (
                    <button
                      type="button"
                      onClick={() => setReplacementDeviceSearchQuery('')}
                      className="text-[11px] text-emerald-600 hover:underline font-medium"
                    >
                      Xóa tìm kiếm
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  placeholder="🔍 Nhập tên thiết bị, mã SN, khoa hoặc phòng để tìm nhanh..."
                  value={replacementDeviceSearchQuery}
                  onChange={(e) => setReplacementDeviceSearchQuery(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-xs focus:border-emerald-500 focus:outline-none mb-2 bg-slate-50/50 text-slate-800"
                />
                <select
                  required
                  value={replacementForm.deviceId}
                  onChange={(e) => handleSelectDeviceForReplacement(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:border-emerald-500 focus:outline-none bg-white font-medium text-slate-800"
                >
                  <option value="">
                    {replacementDeviceSearchQuery.trim() 
                      ? `-- Kết quả tìm kiếm (${devices.filter(d => d.name.toLowerCase().includes(replacementDeviceSearchQuery.toLowerCase()) || d.serialNumber.toLowerCase().includes(replacementDeviceSearchQuery.toLowerCase()) || d.location.faculty.toLowerCase().includes(replacementDeviceSearchQuery.toLowerCase()) || d.location.room.toLowerCase().includes(replacementDeviceSearchQuery.toLowerCase())).length}) --` 
                      : `-- Chọn thiết bị trong danh sách (${devices.length}) --`}
                  </option>
                  {devices
                    .filter(dev => {
                      if (!replacementDeviceSearchQuery.trim()) return true;
                      const q = replacementDeviceSearchQuery.toLowerCase();
                      return (
                        dev.name.toLowerCase().includes(q) ||
                        dev.serialNumber.toLowerCase().includes(q) ||
                        dev.location.faculty.toLowerCase().includes(q) ||
                        dev.location.room.toLowerCase().includes(q)
                      );
                    })
                    .map(dev => (
                      <option key={dev.id} value={dev.id}>
                        [{dev.serialNumber}] {dev.name} ({dev.location.faculty} - {dev.location.room})
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tên Vật Tư / Linh Kiện Thay Thế *
                  </label>
                  <input
                    type="text"
                    required
                    value={replacementForm.partName}
                    onChange={(e) => setReplacementForm(prev => ({ ...prev, partName: e.target.value }))}
                    placeholder="ví dụ: Bóng đèn máy chiếu 230W, Cáp HDMI 15m..."
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Tình Trạng Linh Kiện
                  </label>
                  <select
                    value={replacementForm.partCondition}
                    onChange={(e) => {
                      const selectedVal = e.target.value as any;
                      setReplacementForm(prev => ({
                        ...prev,
                        partCondition: selectedVal
                      }));
                    }}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none bg-white font-medium"
                  >
                    <option value="new">✨ Mới 100% chính hãng</option>
                    <option value="refurbished">♻️ Linh kiện tái chế / sửa chữa</option>
                    <option value="spare">📦 Linh kiện dự phòng</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Bảo Hành Linh Kiện (Tháng)
                  </label>
                  <input
                    type="number"
                    min="0"
                    max="60"
                    value={replacementForm.warrantyMonths}
                    onChange={(e) => setReplacementForm(prev => ({ ...prev, warrantyMonths: Number(e.target.value) }))}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Kỹ Thuật Viên Thực Hiện
                  </label>
                  <input
                    type="text"
                    required
                    value={replacementForm.replacedBy}
                    onChange={(e) => setReplacementForm(prev => ({ ...prev, replacedBy: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>

                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Ngày Thay Thế
                  </label>
                  <input
                    type="date"
                    required
                    value={replacementForm.replacementDate}
                    onChange={(e) => setReplacementForm(prev => ({ ...prev, replacementDate: e.target.value }))}
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Lý Do Thay Thế & Ghi Chú
                </label>
                <textarea
                  rows={2}
                  value={replacementForm.reason}
                  onChange={(e) => setReplacementForm(prev => ({ ...prev, reason: e.target.value }))}
                  placeholder="Lý do hỏng linh kiện cũ, hóa đơn chứng từ..."
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm focus:border-emerald-500 focus:outline-none"
                />
              </div>

              <button
                type="submit"
                className="w-full rounded-lg bg-blue-600 py-2.5 text-xs font-medium text-white hover:bg-blue-700 transition shadow-sm"
              >
                Ghi Nhận Thay Thế Vật Tư Sửa Chữa
              </button>
            </form>
          </div>

          {/* Replacement List */}
          <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
            <h4 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
              <span>Lịch Sử Thay Vật Tư</span>
              <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                {replacements.reduce((sum, r) => sum + r.cost, 0).toLocaleString('vi-VN')} đ
              </span>
            </h4>

            <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
              {replacements.map(item => (
                <div key={item.id} className="p-3.5 rounded-xl border border-slate-200 bg-slate-50/60 space-y-1.5 text-xs">
                  <div className="flex items-center justify-between font-bold text-slate-900">
                    <span className="font-mono text-emerald-800">{item.deviceSn}</span>
                    <div className="flex items-center gap-1.5">
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                        item.partCondition === 'new' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                        item.partCondition === 'spare' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                        'bg-blue-50 text-blue-700 border border-blue-200'
                      }`}>
                        {item.partCondition === 'new' ? 'Mới 100%' : item.partCondition === 'spare' ? 'Linh kiện dự phòng' : 'Tái chế'}
                      </span>
                      <span className="text-emerald-700 font-extrabold">{item.cost.toLocaleString('vi-VN')} đ</span>
                    </div>
                  </div>
                  <p className="font-bold text-slate-900 text-xs">{item.partName}</p>
                  <p className="text-[11px] text-slate-500">Thiết bị: {item.deviceName}</p>
                  <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-200">
                    <span>KT: {item.replacedBy}</span>
                    <span>{formatDate(item.replacementDate)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 3. Incidents Form */}
      {activeSubTab === 'incidents' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 rounded-2xl bg-white p-6 shadow-sm border border-slate-200 space-y-5">
            <div className="border-b border-slate-100 pb-4 flex items-center justify-between">
              <div>
                <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                  <AlertTriangle className="h-5 w-5 text-rose-600" />
                  Báo Cáo Sự Cố Hư Hỏng Thiết Bị Đột Xuất
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Tạo báo cáo hỏng hóc để kích hoạt thông báo Telegram tới nhóm kỹ thuật viên quản lý thiết bị
                </p>
              </div>

              {currentUser && (
                <button
                  type="button"
                  onClick={() => handleScanDeviceForTab('incident')}
                  className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-3 py-2 text-xs font-semibold text-white hover:bg-slate-800 transition"
                >
                  <Camera className="h-4 w-4 text-emerald-400" />
                  Quét Camera SN
                </button>
              )}
            </div>

            {/* Telegram, Webhook & Device PWA Notification Integration Dashboard Card */}
            {(currentUser?.role === 'admin' || currentUser?.role === 'manager' || currentUser?.role === 'technician') ? (
              <div className="rounded-2xl bg-slate-50 border border-slate-200 p-5 space-y-4 shadow-inner">
                <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-3 border-b border-slate-200">
                  <div className="flex items-center gap-2.5">
                    <div className="h-9 w-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-extrabold text-sm shadow-md">
                      🔔
                    </div>
                    <div>
                      <h4 className="font-bold text-slate-900 text-xs">Cấu hình Hệ thống Thông báo DUE</h4>
                      <p className="text-[11px] text-slate-500">Nhận cảnh báo thời gian thực trên Telegram, Webhook hoặc trực tiếp trên Thiết bị Di động</p>
                    </div>
                  </div>

                  <div className="flex bg-slate-200/80 p-0.5 rounded-xl text-[11px] overflow-x-auto max-w-full shrink-0">
                    <button
                      type="button"
                      onClick={() => setConfigTab('telegram')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap ${
                        configTab === 'telegram' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      🤖 Telegram Bot (@japancsvcbot)
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfigTab('n8n')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap ${
                        configTab === 'n8n' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      🔗 n8n Webhook
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfigTab('device')}
                      className={`px-3 py-1.5 rounded-lg font-bold transition whitespace-nowrap ${
                        configTab === 'device' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      📱 Thông báo Thiết bị
                    </button>
                  </div>
                </div>

                {configTab === 'telegram' ? (
                  <div className="space-y-3.5">
                    <div className="bg-sky-50/70 text-sky-900 p-3 rounded-xl border border-sky-200 text-[11px] leading-relaxed space-y-1.5">
                      <div className="flex items-center justify-between">
                        <p className="font-bold">💡 Hướng dẫn cấu hình Telegram Bot (@japancsvcbot):</p>
                        <a 
                          href="https://t.me/japancsvcbot" 
                          target="_blank" 
                          rel="noopener noreferrer" 
                          className="inline-flex items-center gap-1 text-sky-700 hover:text-sky-900 font-bold underline text-[11px]"
                        >
                          Mở bot @japancsvcbot ↗
                        </a>
                      </div>
                      <p className="text-[10px] text-sky-800 leading-relaxed">
                        1. Nhấn vào liên kết trên hoặc tìm <b>@japancsvcbot</b> trong Telegram, gửi lệnh <code>/start</code> hoặc <code>hello</code>.<br/>
                        2. Nhấn nút <b>"🔍 Tự động quét Chat ID"</b> để hệ thống nhận diện và tự động lưu vào cơ sở dữ liệu chung.<br/>
                        3. Bấm <b>"🚀 Gửi thử"</b> để kiểm tra tin nhắn cảnh báo đến Telegram ngay lập tức!
                      </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-700">Telegram Bot Token:</label>
                        <input
                          type="text"
                          value={telegramBotToken}
                          onChange={(e) => setTelegramBotToken(e.target.value)}
                          placeholder="8715568190:AAEKFL-..."
                          className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white text-slate-800 focus:outline-none focus:border-sky-500 font-mono shadow-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="block text-[11px] font-bold text-slate-700">Telegram Chat ID / Group ID:</label>
                        <div className="flex gap-2">
                          <input
                            type="text"
                            value={telegramChatId}
                            onChange={(e) => setTelegramChatId(e.target.value)}
                            placeholder="Ví dụ: -100123456789 hoặc 12345678"
                            className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white text-slate-800 focus:outline-none focus:border-sky-500 font-mono shadow-sm"
                          />
                          <button
                            type="button"
                            onClick={async () => {
                              if (!telegramBotToken.trim() || !telegramChatId.trim()) {
                                alert('Vui lòng nhập đầy đủ Bot Token và Chat ID.');
                                return;
                              }
                              try {
                                await setDoc(doc(db, 'settings', 'app_config'), { 
                                  telegramBotToken: telegramBotToken.trim(),
                                  telegramChatId: telegramChatId.trim()
                                }, { merge: true });
                                localStorage.setItem('DUE_TELEGRAM_BOT_TOKEN', telegramBotToken.trim());
                                localStorage.setItem('DUE_TELEGRAM_CHAT_ID', telegramChatId.trim());
                                alert('Đã lưu và đồng bộ cấu hình Telegram Bot (@japancsvcbot) thành công!');
                              } catch (err) {
                                console.error('Error saving telegram config:', err);
                                alert('Lỗi: Không thể lưu cấu hình lên cơ sở dữ liệu.');
                              }
                            }}
                            className="rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white px-3 py-2 text-xs font-bold transition shadow-sm whitespace-nowrap"
                          >
                            Lưu
                          </button>
                        </div>
                      </div>
                    </div>

                    {scannedChats.length > 1 && (
                      <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl space-y-2">
                        <label className="text-[11px] font-bold text-indigo-900">Chọn nhóm/chat phát hiện được:</label>
                        <div className="flex flex-wrap gap-2">
                          {scannedChats.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={async () => {
                                setTelegramChatId(c.id);
                                localStorage.setItem('DUE_TELEGRAM_CHAT_ID', c.id);
                                try {
                                  await setDoc(doc(db, 'settings', 'app_config'), {
                                    telegramBotToken: telegramBotToken.trim(),
                                    telegramChatId: c.id
                                  }, { merge: true });
                                } catch (e) {
                                  console.warn(e);
                                }
                                setTelegramTestResult(`✅ Đã chọn Chat ID: <b>${c.id}</b> (${c.name || c.type})!`);
                              }}
                              className={`px-2.5 py-1.5 rounded-lg text-xs font-medium border transition ${
                                telegramChatId === c.id 
                                  ? 'bg-indigo-600 text-white border-indigo-600 shadow-sm' 
                                  : 'bg-white text-slate-800 border-slate-300 hover:bg-slate-100'
                              }`}
                            >
                              {c.name || c.id} ({c.type})
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          type="button"
                          onClick={handleScanTelegramChats}
                          disabled={telegramScanning || !telegramBotToken.trim()}
                          className="rounded-xl bg-amber-600 hover:bg-amber-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-3 py-2 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                        >
                          {telegramScanning ? 'Đang quét...' : '🔍 Tự động quét Chat ID'}
                        </button>
                        <button
                          type="button"
                          onClick={handleResetWebhook}
                          disabled={resettingWebhook || !telegramBotToken.trim()}
                          className="rounded-xl bg-slate-600 hover:bg-slate-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-3 py-2 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                          title="Xóa webhook nếu bot bị xung đột"
                        >
                          {resettingWebhook ? 'Đang reset...' : '🔄 Reset Webhook'}
                        </button>
                        <span className="text-[10px] text-slate-500">
                          Bot: <strong className="text-sky-700">@japancsvcbot</strong>
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={handleTestTelegram}
                        disabled={telegramTesting || !telegramBotToken.trim() || !telegramChatId.trim()}
                        className="rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
                      >
                        {telegramTesting ? 'Đang gửi...' : '🚀 Gửi thử tới @japancsvcbot'}
                      </button>
                    </div>

                    {telegramTestResult && (
                      <div className="text-xs font-semibold p-3 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-800" dangerouslySetInnerHTML={{ __html: telegramTestResult }} />
                    )}
                  </div>
                ) : configTab === 'n8n' ? (
                  <div className="space-y-3">
                    <div className="space-y-1.5">
                      <label className="block text-[11px] font-bold text-slate-700">n8n Webhook URL:</label>
                      <div className="flex gap-2">
                        <input
                          type="text"
                          value={n8nWebhookUrl}
                          onChange={(e) => setN8nWebhookUrl(e.target.value)}
                          placeholder="https://n8n.example.com/webhook/..."
                          className="flex-1 rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white text-slate-800 focus:outline-none focus:border-emerald-500 font-mono"
                        />
                        <button
                          type="button"
                          onClick={handleTestN8nWebhook}
                          disabled={n8nTesting}
                          className="rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-4 py-2 text-xs font-bold transition flex items-center gap-1.5 disabled:opacity-50 shadow-sm"
                        >
                          {n8nTesting ? 'Đang gửi...' : '🚀 Test Gửi Webhook'}
                        </button>
                      </div>
                    </div>

                    {n8nTestResult && (
                      <div className="text-xs font-semibold p-3 rounded-xl bg-white border border-slate-200 shadow-sm text-slate-800">
                        {n8nTestResult}
                      </div>
                    )}
                  </div>
                ) : (
                  renderDeviceNotificationSettings()
                )}
              </div>
            ) : (
              <div className="rounded-xl p-3 bg-slate-50 border border-slate-200 flex items-center justify-between text-xs">
                <div className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${telegramChatId ? 'bg-emerald-500 animate-pulse' : 'bg-amber-400'}`} />
                  <span className="text-slate-700 font-medium">
                    {telegramChatId ? (
                      <>Kênh Telegram: <b className="text-emerald-700">@japancsvcbot đã kết nối</b> (Mọi báo cáo sự cố gửi đi sẽ thông báo tới kỹ thuật viên ngay)</>
                    ) : (
                      <>Kênh Telegram: <span className="text-amber-700">Chưa thiết lập Chat ID</span> (Quản trị viên cần kết nối để nhận tin Telegram)</>
                    )}
                  </span>
                </div>
              </div>
            )}

            {/* BÁO CÁO SỰ CỐ PANEL */}
            <h2 className="text-center font-extrabold text-2xl text-rose-600 tracking-wide uppercase mt-1 mb-4">
              BÁO CÁO SỰ CỐ
            </h2>

            {scannedRoom ? (
              /* --- KHUNG CHỌN THIẾT BỊ TRONG PHÒNG --- */
              <div className="bg-white border border-slate-200 rounded-2xl p-5 space-y-4 shadow-sm animate-fade-in text-left">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <div>
                    <h3 className="font-extrabold text-slate-900 text-sm flex items-center gap-1.5">
                      📍 Phòng: <span className="text-rose-600 font-extrabold">{scannedRoom}</span>
                    </h3>
                    <p className="text-[10px] text-slate-500 mt-0.5">Vui lòng chọn thiết bị gặp sự cố tại phòng này:</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setScannedRoom(null);
                      setIncidentForm(prev => ({ ...prev, deviceId: '', deviceSn: '', deviceName: '' }));
                    }}
                    className="text-[10px] font-bold text-slate-500 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 px-2.5 py-1 rounded transition"
                  >
                    Quay lại
                  </button>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-[220px] overflow-y-auto pr-1">
                  {devices.filter(d => d.location.room && normalizeRoom(d.location.room) === normalizeRoom(scannedRoom)).length > 0 ? (
                    devices
                      .filter(d => d.location.room && normalizeRoom(d.location.room) === normalizeRoom(scannedRoom))
                      .map(dev => (
                        <button
                          key={dev.id}
                          type="button"
                          onClick={() => {
                            setIncidentForm(prev => ({
                              ...prev,
                              deviceId: dev.id,
                              deviceSn: dev.serialNumber,
                              deviceName: dev.name,
                              faculty: dev.location.faculty,
                              room: dev.location.room
                            }));
                            setScannedRoom(null);
                          }}
                          className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 hover:border-rose-500 hover:bg-rose-50/20 text-left transition group shadow-sm bg-slate-50/50 w-full"
                        >
                          <div className="p-1.5 rounded-lg bg-indigo-50 group-hover:bg-rose-50 text-indigo-600 group-hover:text-rose-600 shrink-0 transition">
                            📟
                          </div>
                          <div className="min-w-0">
                            <p className="font-bold text-slate-800 text-[11px] truncate group-hover:text-rose-700">{dev.name}</p>
                            <p className="text-[9px] font-mono text-slate-500 truncate mt-0.5">SN: {dev.serialNumber}</p>
                          </div>
                        </button>
                      ))
                  ) : (
                    <div className="col-span-full py-6 text-center">
                      <p className="text-xs text-slate-500 italic">Chưa có thiết bị nào khai báo trong phòng học này.</p>
                    </div>
                  )}
                </div>
              </div>
            ) : selectedIncidentDevice ? (
              /* --- KHUNG THIẾT BỊ ĐÃ QUÉT VÀ FORM NHẬP LIỆU --- */
              <form onSubmit={handleIncidentSubmit} className="space-y-4 animate-fade-in">
                
                {/* Khung hiển thị thông tin thiết bị đã quét */}
                <div id="deviceDetails" className="bg-[#f0f4f8] border border-slate-250 p-4.5 rounded-xl space-y-2 shadow-sm text-xs">
                  <p className="text-slate-700">
                    📍 <b>Phòng:</b> <span id="lblRoom" className="font-semibold text-slate-900 text-sm">{selectedIncidentDevice.location.room} ({selectedIncidentDevice.location.lectureHall})</span>
                  </p>
                  <p className="text-slate-700">
                    📟 <b>Mã Thiết bị:</b> <span id="lblDeviceId" className="font-mono font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-100">{selectedIncidentDevice.serialNumber}</span>
                  </p>
                  <p className="text-[12px] text-emerald-600 font-bold flex items-center gap-1">
                    ✔ Đã nhận dạng thiết bị thành công
                  </p>
                  
                  <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
                    <span className="text-[10px] text-slate-500 font-medium">Tên thiết bị: <strong className="text-slate-700">{selectedIncidentDevice.name}</strong></span>
                    <button
                      type="button"
                      onClick={() => {
                        setIncidentForm(prev => ({ ...prev, deviceId: '', deviceSn: '', deviceName: '' }));
                        setShowManualSelect(false);
                      }}
                      className="text-[11px] text-rose-600 hover:text-rose-700 font-bold transition hover:underline"
                    >
                      Chọn thiết bị khác
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">👤 Người báo cáo:</label>
                    <input
                      type="text"
                      required
                      disabled={currentUser?.role === 'staff'}
                      value={incidentForm.reporterName}
                      onChange={(e) => setIncidentForm(prev => ({ ...prev, reporterName: e.target.value }))}
                      placeholder="Nhập tên người báo..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-slate-50 disabled:opacity-75 disabled:cursor-not-allowed font-semibold text-slate-700 shadow-sm focus:outline-none focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">⚠️ Mức độ khẩn cấp:</label>
                    <select
                      value={incidentForm.severity}
                      onChange={(e) => setIncidentForm(prev => ({ ...prev, severity: e.target.value as any }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white text-slate-800 shadow-sm cursor-pointer focus:outline-none focus:border-rose-500 transition font-medium"
                    >
                      <option value="low">🟢 Thấp (thiết bị vẫn tạm dùng được)</option>
                      <option value="medium">🟡 Trung bình (cần sửa trong 1-2 ngày)</option>
                      <option value="high">🔴 Cao / Gấp (ảnh hưởng việc giảng dạy)</option>
                    </select>
                  </div>
                </div>

                {/* Form nhập liệu chi tiết lỗi */}
                <div className="space-y-1">
                  <label htmlFor="txtDescription" className="block text-xs font-bold text-slate-700"><b>Mô tả chi tiết lỗi *</b></label>
                  <textarea
                    id="txtDescription"
                    required
                    rows={3}
                    value={incidentForm.description}
                    onChange={(e) => setIncidentForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Ví dụ: Máy chiếu nháy đèn đỏ không lên hình, điều hòa chảy nước xuống bục giảng, mic không nghe thấy tiếng..."
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-sm placeholder-slate-400 leading-relaxed text-slate-800 transition"
                  />
                </div>

                <div className="rounded-xl bg-rose-50/50 p-3 border border-rose-100 flex items-center gap-2 text-rose-900 text-[11px] leading-relaxed">
                  <Zap className="h-4 w-4 text-rose-600 shrink-0 animate-pulse" />
                  <span>Cảnh báo sự cố này sẽ được chuyển ngay đến bộ phận kỹ thuật qua Telegram Bot (@japancsvcbot)!</span>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#0056b3] hover:bg-[#004085] py-3 text-xs font-bold text-white transition-all shadow-md hover:shadow-indigo-100 active:scale-[0.98] uppercase tracking-wider"
                >
                  GỬI BÁO CÁO KHẨN
                </button>
              </form>
            ) : incidentForm.deviceId === 'custom' ? (
              /* --- KHUNG BÁO CÁO THIẾT BỊ PHÒNG HỌC (CÁN BỘ KHOA/GIẢNG ĐƯỜNG) --- */
              <form onSubmit={handleIncidentSubmit} className="space-y-4 animate-fade-in text-left">
                <div className="bg-amber-50/80 border border-amber-200 p-4.5 rounded-xl space-y-2 shadow-sm text-xs">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
                      🏫 Báo hỏng thiết bị phòng học / thiết bị khác
                    </span>
                    <button
                      type="button"
                      onClick={() => {
                        setIncidentForm(prev => ({ ...prev, deviceId: '', deviceSn: '', deviceName: '' }));
                        setScannedRoom(null);
                      }}
                      className="text-[11px] text-rose-600 hover:text-rose-700 font-bold transition hover:underline"
                    >
                      Quay lại quét QR
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-600">
                    Dành cho Cán bộ Khoa / Giảng đường khai báo nhanh thiết bị phòng học gặp sự cố chưa có sẵn trong danh sách.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">📍 Phòng học / Phòng Lab *:</label>
                    <input
                      type="text"
                      required
                      placeholder="Ví dụ: D305, A101, Phòng máy tính..."
                      value={incidentForm.room}
                      onChange={(e) => setIncidentForm(prev => ({ ...prev, room: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white text-slate-800 font-semibold shadow-sm focus:outline-none focus:border-rose-500 transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">🏫 Khoa / Bộ môn:</label>
                    <input
                      type="text"
                      placeholder="Ví dụ: Khoa CNTT, Cơ khí, Ngoại ngữ..."
                      value={incidentForm.faculty}
                      onChange={(e) => setIncidentForm(prev => ({ ...prev, faculty: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white text-slate-800 font-semibold shadow-sm focus:outline-none focus:border-rose-500 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">📟 Loại thiết bị phòng học *:</label>
                    <select
                      required
                      value={customCategory}
                      onChange={(e) => {
                        const val = e.target.value;
                        setCustomCategory(val);
                        if (val !== 'Khác') {
                          setIncidentForm(prev => ({ ...prev, deviceName: val }));
                        } else {
                          setIncidentForm(prev => ({ ...prev, deviceName: '' }));
                        }
                      }}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white text-slate-800 shadow-sm cursor-pointer focus:outline-none focus:border-rose-500 transition font-semibold"
                    >
                      <option value="">-- Chọn loại thiết bị phòng học --</option>
                      <option value="Máy chiếu">1. Máy chiếu</option>
                      <option value="Dây cáp HDMI">2. Dây cáp HDMI</option>
                      <option value="Dây VGA">3. Dây VGA</option>
                      <option value="Thiết bị điện">4. Thiết bị điện</option>
                      <option value="Điều hoà">5. Điều hoà</option>
                      <option value="Âm thanh">6. Âm thanh</option>
                      <option value="Bàn ghế">7. Bàn ghế</option>
                      <option value="Khác">Khác (Tự nhập tên thiết bị...)</option>
                    </select>

                    {customCategory === 'Khác' && (
                      <input
                        type="text"
                        required
                        placeholder="Nhập tên thiết bị khác..."
                        value={incidentForm.deviceName}
                        onChange={(e) => setIncidentForm(prev => ({ ...prev, deviceName: e.target.value }))}
                        className="w-full mt-2 rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white text-slate-800 font-semibold shadow-sm focus:outline-none focus:border-rose-500 transition animate-fade-in"
                      />
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">🔑 Số sê-ri SN (Nếu có):</label>
                    <input
                      type="text"
                      placeholder="Nhập mã SN thiết bị..."
                      value={incidentForm.deviceSn}
                      onChange={(e) => setIncidentForm(prev => ({ ...prev, deviceSn: e.target.value }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white text-slate-800 font-mono shadow-sm focus:outline-none focus:border-rose-500 transition"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">👤 Người báo cáo:</label>
                    <input
                      type="text"
                      required
                      disabled={currentUser?.role === 'staff'}
                      value={incidentForm.reporterName}
                      onChange={(e) => setIncidentForm(prev => ({ ...prev, reporterName: e.target.value }))}
                      placeholder="Nhập tên người báo..."
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-slate-50 disabled:opacity-75 disabled:cursor-not-allowed font-semibold text-slate-700 shadow-sm focus:outline-none focus:border-rose-500 transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="block text-[11px] font-bold text-slate-600">⚠️ Mức độ khẩn cấp:</label>
                    <select
                      value={incidentForm.severity}
                      onChange={(e) => setIncidentForm(prev => ({ ...prev, severity: e.target.value as any }))}
                      className="w-full rounded-lg border border-slate-300 px-3 py-1.5 text-xs bg-white text-slate-800 shadow-sm cursor-pointer focus:outline-none focus:border-rose-500 transition font-medium"
                    >
                      <option value="low">🟢 Thấp (thiết bị vẫn tạm dùng được)</option>
                      <option value="medium">🟡 Trung bình (cần sửa trong 1-2 ngày)</option>
                      <option value="high">🔴 Cao / Gấp (ảnh hưởng việc giảng dạy)</option>
                      <option value="urgent">🚨 Khẩn cấp (ngừng lớp học)</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1">
                  <label htmlFor="txtCustomDescription" className="block text-xs font-bold text-slate-700">Mô tả chi tiết sự cố phòng học *</label>
                  <textarea
                    id="txtCustomDescription"
                    required
                    rows={3}
                    value={incidentForm.description}
                    onChange={(e) => setIncidentForm(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="Ví dụ: Máy chiếu không lên hình tại phòng D305, điều hòa chảy nước, micro bị hú rè..."
                    className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs focus:border-rose-500 focus:outline-none focus:ring-1 focus:ring-rose-500 shadow-sm placeholder-slate-400 leading-relaxed text-slate-800 transition"
                  />
                </div>

                <div className="rounded-xl bg-amber-50 p-3 border border-amber-150 flex items-center gap-2 text-amber-900 text-[11px] leading-relaxed">
                  <Zap className="h-4 w-4 text-amber-600 shrink-0 animate-pulse" />
                  <span>Báo cáo sự cố thiết bị phòng học sẽ được gửi thông báo tức thì đến bộ phận kỹ thuật qua Telegram Bot (@japancsvcbot)!</span>
                </div>

                <button
                  type="submit"
                  className="w-full rounded-xl bg-[#0056b3] hover:bg-[#004085] py-3 text-xs font-bold text-white transition-all shadow-md hover:shadow-indigo-100 active:scale-[0.98] uppercase tracking-wider"
                >
                  GỬI BÁO CÁO SỰ CỐ PHÒNG HỌC
                </button>
              </form>
            ) : (
              /* --- TRẠNG THÁI CHỜ QUÉT QR HOẶC CHỌN THỦ CÔNG --- */
              <div id="errorState" className="bg-white border border-slate-200 rounded-2xl p-6.5 text-center space-y-4 shadow-sm animate-fade-in">
                <div className="mx-auto inline-flex items-center justify-center p-3.5 rounded-full bg-rose-50 text-rose-600 mb-1">
                  <Camera className="h-6 w-6" />
                </div>
                <p className="text-xs text-slate-500 font-medium">
                  Vui lòng quét mã QR của Phòng hoặc của Thiết bị để bắt đầu báo cáo sự cố.
                </p>
                
                {/* Nút bật camera quét mã QR */}
                <button
                  type="button"
                  onClick={() => handleScanDeviceForTab('incident')}
                  className="mx-auto flex items-center justify-center gap-2 w-full max-w-sm rounded-xl bg-rose-600 hover:bg-rose-700 px-5 py-3 text-xs font-bold text-white transition-all shadow-md active:scale-95 uppercase tracking-wide"
                >
                  <Camera className="h-4.5 w-4.5 text-white" />
                  Mở Camera Quét QR
                </button>

                {/* Hoặc chọn thiết bị thủ công */}
                <div className="pt-2">
                  {showManualSelect ? (
                    <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3 text-left max-w-sm mx-auto animate-fade-in">
                      <div className="flex items-center justify-between">
                        <label className="block text-[11px] font-bold text-slate-600">Chọn thiết bị thủ công:</label>
                        <button
                          type="button"
                          onClick={() => setShowManualSelect(false)}
                          className="text-[10px] text-slate-500 hover:text-slate-800 underline transition"
                        >
                          Quay lại quét QR
                        </button>
                      </div>

                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Tìm nhanh theo tên, mã SN, phòng..."
                          value={incidentDeviceSearchQuery}
                          onChange={(e) => setIncidentDeviceSearchQuery(e.target.value)}
                          className="w-full rounded-lg border border-slate-300 pl-2.5 pr-8 py-1.5 text-xs bg-white text-slate-800 focus:outline-none focus:border-rose-500 shadow-sm transition"
                        />
                        <span className="absolute right-2 top-2 text-slate-400 text-xs">🔍</span>
                      </div>

                      <select
                        required
                        value={incidentForm.deviceId}
                        onChange={(e) => handleSelectDeviceForIncident(e.target.value)}
                        className="w-full rounded-lg border border-slate-300 px-2 py-1.5 text-xs focus:outline-none focus:border-rose-500 bg-white text-slate-800 shadow-sm cursor-pointer transition font-medium"
                      >
                        <option value="">-- Chọn thiết bị từ danh sách --</option>
                        {devices
                          .filter(dev => {
                            if (!incidentDeviceSearchQuery.trim()) return true;
                            const q = incidentDeviceSearchQuery.toLowerCase();
                            return (
                              dev.name.toLowerCase().includes(q) ||
                              dev.serialNumber.toLowerCase().includes(q) ||
                              dev.location.faculty.toLowerCase().includes(q) ||
                              dev.location.room.toLowerCase().includes(q)
                            );
                          })
                          .map(dev => (
                            <option key={dev.id} value={dev.id}>
                              [{dev.serialNumber}] {dev.name} ({dev.location.room})
                            </option>
                          ))}
                      </select>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      <button
                        type="button"
                        onClick={() => setShowManualSelect(true)}
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold underline transition-all block mx-auto"
                      >
                        🔍 Hoặc tìm kiếm & chọn thiết bị thủ công từ danh sách
                      </button>

                      <div className="pt-2 border-t border-slate-100">
                        <button
                          type="button"
                          onClick={() => {
                            setIncidentForm(prev => ({
                              ...prev,
                              deviceId: 'custom',
                              room: '',
                              deviceName: '',
                              deviceSn: '',
                              faculty: ''
                            }));
                            setCustomCategory('');
                          }}
                          className="w-full flex items-center justify-center gap-2 rounded-xl bg-amber-50 hover:bg-amber-100 border border-amber-300 px-4 py-2.5 text-xs font-bold text-amber-900 transition shadow-sm"
                        >
                          🏫 Báo hỏng thiết bị phòng học (Cán bộ Khoa/Giảng đường)
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="space-y-6">
            {/* Mã QR Báo Cáo Sự Cố Của Phòng (Chỉ hiển thị cho Quản trị viên) */}
            {currentUser?.role === 'admin' && (
              <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 space-y-4 animate-fade-in">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                  <h4 className="font-bold text-sm text-slate-900 flex items-center gap-1.5">
                    <span>Mã QR Báo Sự Cố Phòng Lab / Học</span>
                  </h4>
                  <span className="text-[10px] uppercase font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                    MÃ PHÒNG CHUYÊN DỤNG
                  </span>
                </div>

                <div className="space-y-3">
                  <label className="block text-[11px] font-bold text-slate-600">📍 Chọn Phòng Học / Phòng Lab:</label>
                  <select
                    value={selectedAdminRoom}
                    onChange={(e) => setSelectedAdminRoom(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white text-slate-800 shadow-sm font-semibold focus:outline-none focus:border-indigo-500 cursor-pointer transition"
                  >
                    <option value="">-- Chọn phòng từ danh sách --</option>
                    {Array.from(new Set(devices.map(d => d.location.room).filter(Boolean)))
                      .sort()
                      .map(rm => (
                        <option key={rm} value={rm}>
                          Phòng {rm} ({devices.find(d => d.location.room === rm)?.location.faculty || 'Khoa'})
                        </option>
                      ))}
                  </select>
                  <div className="flex items-center gap-2 pt-1">
                    <span className="text-[10px] text-slate-500 font-bold whitespace-nowrap">Hoặc nhập phòng tự do:</span>
                    <input
                      type="text"
                      placeholder="Ví dụ: D305, H002..."
                      value={selectedAdminRoom}
                      onChange={(e) => setSelectedAdminRoom(e.target.value)}
                      className="flex-1 rounded-xl border border-slate-300 px-3 py-1.5 text-xs bg-white text-slate-800 focus:outline-none focus:border-indigo-500 font-semibold shadow-sm"
                    />
                  </div>
                </div>

                {selectedAdminRoom ? (
                  <div className="space-y-4 pt-1">
                    <div className="bg-indigo-50/50 text-indigo-900 p-3 rounded-xl border border-indigo-100 text-[11px] leading-relaxed">
                      💡 <b>In tem phòng:</b> Khi dán mã QR này tại phòng <b>{selectedAdminRoom}</b>, người dùng chỉ cần quét mã bằng điện thoại là có thể thấy toàn bộ danh sách thiết bị trong phòng này để báo hỏng!
                    </div>

                    <div className="flex flex-col items-center justify-center p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                      <div ref={roomQrPrintRef} className="p-3 bg-white rounded-lg border border-slate-300 shadow-sm flex flex-col items-center justify-center">
                        <QRCodeSVG
                          value={`ROOM:${selectedAdminRoom}`}
                          size={150}
                          level="M"
                        />
                        <span className="font-bold text-[11px] text-slate-800 mt-2 bg-slate-100 px-3 py-0.5 rounded border border-slate-200 uppercase tracking-wider">
                          PHÒNG: {selectedAdminRoom}
                        </span>
                      </div>

                      <div className="w-full space-y-2 text-[11px] text-slate-700 bg-white p-3 rounded-xl border border-slate-200">
                        <div className="border-b border-dashed border-slate-200 pb-1.5 text-center text-xs font-bold text-slate-800">
                          Danh mục thiết bị khi quét QR phòng:
                        </div>
                        <div className="grid grid-cols-1 gap-1 text-[10px] bg-slate-50 p-2 rounded-lg border border-slate-100 text-slate-600 font-semibold">
                          <div>1. Máy chiếu</div>
                          <div>2. Dây cáp HDMI</div>
                          <div>3. Dây VGA</div>
                          <div>4. Thiết bị điện</div>
                          <div>5. Điều hoà</div>
                          <div>6. Âm thanh</div>
                          <div>7. Bàn ghế</div>
                        </div>
                        <div className="text-[10px] font-bold text-indigo-700 pt-1 border-t border-slate-100">
                          + Thiết bị riêng trong phòng ({devices.filter(d => d.location.room === selectedAdminRoom).length}):
                        </div>
                        <div className="max-h-[80px] overflow-y-auto space-y-1">
                          {devices
                            .filter(d => d.location.room === selectedAdminRoom)
                            .map((dev, idx) => (
                              <p key={dev.id} className="truncate font-medium text-slate-600">
                                • <span className="font-bold text-slate-800">{dev.name}</span> <span className="text-[9px] font-mono bg-slate-100 px-1 rounded text-slate-500">[{dev.serialNumber}]</span>
                              </p>
                            ))}
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 w-full pt-1">
                        <button
                          type="button"
                          onClick={handlePrintRoomQR}
                          className="rounded-xl bg-slate-900 hover:bg-slate-800 text-white py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                        >
                          🖨️ In Tem QR Phòng
                        </button>
                        <button
                          type="button"
                          onClick={handleDownloadRoomSVG}
                          className="rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 border border-slate-300"
                        >
                          💾 Tải file SVG
                        </button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 px-4 text-center text-slate-400 space-y-3 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                    <AlertTriangle className="h-10 w-10 text-slate-300" />
                    <div>
                      <p className="text-xs font-bold text-slate-600">Chưa có phòng nào</p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Vui lòng thêm thiết bị kèm vị trí phòng học để tạo mã QR báo sự cố phòng.
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Incidents Active List */}
            <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
              <h4 className="font-bold text-sm text-slate-900 border-b border-slate-100 pb-3 flex items-center justify-between">
                <span>Danh Sách Sự Cố Đang Xử Lý</span>
                <span className="text-xs font-bold text-rose-700 bg-rose-50 px-2.5 py-0.5 rounded-full border border-rose-200">
                  {incidents.filter(i => i.status !== 'resolved').length} chưa xong
                </span>
              </h4>

              <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1">
                {incidents.length === 0 ? (
                  <p className="text-center text-slate-400 py-6 text-[11px]">Chưa có sự cố nào được báo cáo</p>
                ) : (
                  incidents.map(inc => (
                    <div key={inc.id} className="p-4 rounded-xl border border-slate-200 bg-slate-50 space-y-2.5 text-xs shadow-sm hover:shadow transition-all animate-fade-in">
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-indigo-700 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded text-[10px]">
                          {inc.deviceSn}
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                            inc.severity === 'urgent' ? 'bg-rose-600 text-white' :
                            inc.severity === 'high' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'
                          }`}>
                            {inc.severity.toUpperCase()}
                          </span>
                        </div>
                      </div>

                      <div>
                        <p className="font-bold text-slate-900 text-sm leading-tight">{inc.deviceName}</p>
                        <p className="text-[11px] text-slate-500 mt-0.5">📍 {inc.faculty} - Phòng {inc.room}</p>
                      </div>

                      <div className="bg-white p-2.5 rounded border border-slate-200 space-y-1.5 shadow-inner">
                        <p className="font-semibold text-slate-400 text-[10px] uppercase tracking-wider">Mô tả sự cố:</p>
                        <p className="text-slate-700 leading-relaxed font-medium">{inc.description}</p>
                      </div>

                      <div className="flex flex-col gap-1 text-[10px] text-slate-500 border-t border-slate-200/60 pt-2">
                        <p className="flex items-center gap-1.5">
                          <span>👤 Người báo:</span>
                          <strong className="text-slate-700">{inc.reporterName}</strong>
                        </p>
                        <p className="flex items-center gap-1.5">
                          <span>🕒 Thời gian báo:</span>
                          <span>{new Date(inc.reportedAt).toLocaleString('vi-VN')}</span>
                        </p>
                      </div>

                      {/* Display Status Badge */}
                      <div className="flex items-center justify-between border-t border-slate-200/60 pt-2">
                        <span className="text-slate-400 font-medium">Trạng thái:</span>
                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold border ${
                          inc.status === 'resolved' 
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200' 
                            : inc.status === 'in_progress'
                              ? 'bg-blue-50 text-blue-700 border-blue-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                        }`}>
                          {inc.status === 'resolved' ? '✅ Đã khắc phục xong' : 
                           inc.status === 'in_progress' ? '⚙️ Kỹ thuật đang xử lý' : '⏳ Chờ tiếp nhận'}
                        </span>
                      </div>

                      {/* Display Resolution Outcome */}
                      {inc.status === 'resolved' && (
                        <div className="bg-emerald-50/70 border border-emerald-200/60 rounded-xl p-3 space-y-1 mt-2">
                          <p className="font-bold text-emerald-800 text-[10px] uppercase tracking-wider flex items-center gap-1">
                            <span>📢 Kết quả xử lý:</span>
                          </p>
                          <p className="text-slate-700 font-medium text-[11px] leading-relaxed">{inc.resolutionNotes || 'Đã xử lý hoàn tất'}</p>
                          {inc.resolvedAt && (
                            <p className="text-[9px] text-slate-400 italic pt-1 border-t border-emerald-100/50 mt-1">
                              🕒 Hoàn tất lúc: {new Date(inc.resolvedAt).toLocaleString('vi-VN')}
                            </p>
                          )}
                        </div>
                      )}

                      {/* Action buttons for Technicians & Admins */}
                      {inc.status !== 'resolved' && currentUser?.role !== 'staff' && (
                        <div className="grid grid-cols-2 gap-2 mt-2 pt-1">
                          {inc.status === 'open' && (
                            <button
                              onClick={() => onAcceptIncident(inc.id)}
                              className="rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white py-1.5 text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-sm active:scale-95 animate-pulse"
                            >
                              🔧 Tiếp nhận xử lý
                            </button>
                          )}
                          <button
                            onClick={() => {
                              setResolvingIncidentId(inc.id);
                              setResolutionNoteText('');
                            }}
                            className={`rounded-lg py-1.5 text-[10px] font-bold transition flex items-center justify-center gap-1 shadow-sm active:scale-95 ${
                              inc.status === 'open' 
                                ? 'col-span-1 bg-emerald-600 hover:bg-emerald-700 text-white' 
                                : 'col-span-2 bg-emerald-600 hover:bg-emerald-700 text-white'
                            }`}
                          >
                            ✅ Đã sửa xong
                          </button>
                        </div>
                      )}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 4. Combined Maintenance Timeline */}
      {activeSubTab === 'history' && (
        <div className="rounded-2xl bg-white p-6 shadow-sm border border-slate-200 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
            <div>
              <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                <Activity className="h-5 w-5 text-emerald-600" />
                Nhật Ký Bảo Trì, Sửa Chữa & Thay Thế Vật Tư Toàn Trường
              </h3>
              <p className="text-xs text-slate-500">Dòng thời gian tổng hợp lịch sử kiểm tra định kỳ, hỏng hóc và thay linh kiện</p>
            </div>

            <div className="w-full sm:w-64 flex gap-2">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileImportMaintenance}
                accept=".xlsx,.xls"
                className="hidden"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex items-center gap-1.5 rounded-lg bg-slate-100 px-3.5 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
              >
                <Upload className="h-4 w-4" />
                Nhập Excel
              </button>
              <button
                onClick={handleExportExcel}
                className="flex items-center gap-1.5 rounded-lg bg-emerald-600 px-3.5 py-2 text-xs font-semibold text-white hover:bg-emerald-700 transition"
              >
                <Download className="h-4 w-4" />
                Excel
              </button>
            </div>
          </div>

          <div className="space-y-4 pt-2">
            {/* Inspections list */}
            {inspections
              .filter(i => !selectedDeviceSn || i.deviceSn === selectedDeviceSn)
              .map(i => (
                <div key={i.id} className="flex gap-4 items-start p-4 rounded-xl border border-slate-200 bg-slate-50/50">
                  <div className="h-10 w-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0 font-bold text-xs">
                    KĐ
                  </div>
                  <div className="flex-grow space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs">
                        Kiểm tra định kỳ: {i.deviceName} ({i.deviceSn})
                      </span>
                      <span className="text-xs font-semibold text-slate-500">{formatDate(i.inspectionDate)}</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Người kiểm tra: <strong>{i.inspectorName}</strong> • Kết quả: <span className="font-bold uppercase text-emerald-700">{i.result}</span>
                    </p>
                    {i.notes && <p className="text-xs text-slate-500 italic">"{i.notes}"</p>}
                  </div>
                </div>
            ))}

            {/* Replacements list */}
            {replacements
              .filter(r => !selectedDeviceSn || r.deviceSn === selectedDeviceSn)
              .map(r => (
                <div key={r.id} className="flex gap-4 items-start p-4 rounded-xl border border-slate-200 bg-amber-50/30">
                  <div className="h-10 w-10 rounded-xl bg-amber-100 text-amber-800 flex items-center justify-center shrink-0 font-bold text-xs">
                    LK
                  </div>
                  <div className="flex-grow space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-slate-900 text-xs">
                        Thay vật tư: {r.partName} ({r.deviceSn})
                      </span>
                      <span className="text-xs font-bold text-emerald-700">{r.cost.toLocaleString('vi-VN')} đ</span>
                    </div>
                    <p className="text-xs text-slate-600">
                      Thiết bị: {r.deviceName} • Kỹ thuật viên: <strong>{r.replacedBy}</strong> ({formatDate(r.replacementDate)})
                    </p>
                    {r.reason && <p className="text-xs text-slate-500 italic">Lý do: "{r.reason}"</p>}
                  </div>
                </div>
            ))}
          </div>
        </div>
      )}

      {/* Custom Incident Resolution Dialog Modal */}
      {resolvingIncidentId !== null && (() => {
        const resolvingInc = incidents.find(i => i.id === resolvingIncidentId);
        if (!resolvingInc) return null;
        return (
          <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm flex items-center justify-center z-[100] animate-fade-in p-4">
            <div className="bg-white rounded-2xl shadow-2xl border border-slate-100 max-w-md w-full p-6 space-y-4 animate-scale-up">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <span>✅ Báo cáo Kết quả Khắc phục</span>
                </h3>
                <button
                  onClick={() => setResolvingIncidentId(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="bg-slate-50 rounded-xl p-3 text-xs space-y-1">
                <p className="text-slate-500">Thiết bị đang xử lý:</p>
                <p className="font-bold text-slate-800 text-sm">{resolvingInc.deviceName}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="font-mono text-[10px] text-indigo-600 bg-indigo-50 border border-indigo-100 px-1.5 py-0.5 rounded inline-block">
                    SN: {resolvingInc.deviceSn}
                  </span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-bold ${
                    resolvingInc.severity === 'urgent' ? 'bg-rose-100 text-rose-800' :
                    resolvingInc.severity === 'high' ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-800'
                  }`}>
                    {resolvingInc.severity.toUpperCase()}
                  </span>
                </div>
                <p className="text-slate-500 mt-1">📍 Vị trí: {resolvingInc.room} - {resolvingInc.faculty}</p>
              </div>

              <div className="space-y-2">
                <label className="block text-[11px] font-bold text-slate-700 uppercase tracking-wider">
                  Nội dung & Phương án khắc phục:
                </label>
                <textarea
                  value={resolutionNoteText}
                  onChange={(e) => setResolutionNoteText(e.target.value)}
                  placeholder="Nhập chi tiết cách xử lý sự cố, vật tư thay thế, thông tin bảo hành (nếu có)..."
                  className="w-full h-28 rounded-xl border border-slate-200 p-3 text-xs focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 outline-none resize-none placeholder-slate-400 font-medium"
                  required
                />
              </div>

              <div className="flex items-center gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setResolvingIncidentId(null)}
                  className="flex-1 rounded-xl border border-slate-200 hover:bg-slate-50 py-2.5 text-xs font-bold text-slate-700 transition"
                >
                  Hủy bỏ
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onResolveIncident(resolvingIncidentId, resolutionNoteText || 'Đã khắc phục hoàn tất');
                    setResolvingIncidentId(null);
                    setResolutionNoteText('');
                  }}
                  className="flex-grow flex-1 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-md shadow-emerald-200"
                >
                  <span>Gửi Báo cáo</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

    </div>
  );
};
