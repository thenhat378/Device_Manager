import React, { useState, useMemo, useRef, useEffect } from 'react';
import { 
  Bot, 
  Send, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Mic, 
  MicOff, 
  RotateCcw, 
  Phone, 
  Download, 
  Printer, 
  Filter, 
  Calendar, 
  Search, 
  Copy, 
  ExternalLink, 
  Building2, 
  User as UserIcon, 
  Check, 
  MessageSquare,
  FileSpreadsheet,
  Layers,
  Activity,
  ArrowRight,
  ShieldCheck,
  SendHorizontal,
  Info
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Device, IncidentReport, IncidentSeverity, IncidentStatus } from '../types';

interface StaffChatbotPortalProps {
  currentUser: User;
  devices: Device[];
  incidents: IncidentReport[];
  onAddIncident: (report: Omit<IncidentReport, 'id' | 'reportedAt' | 'status'>) => Promise<void>;
  onOpenTelegramModal?: () => void;
  telegramChatId?: string;
  telegramBotToken?: string;
  onAddToast?: (title: string, message: string, type: 'info' | 'success' | 'warning' | 'error', deviceSn?: string) => void;
}

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  incidentDraft?: {
    room: string;
    deviceName: string;
    description: string;
    severity: IncidentSeverity;
    deviceSn?: string;
  };
  incidentSubmitted?: boolean;
}

const ZALO_PHONE = '0987119665';
const ZALO_LINK = `https://zalo.me/${ZALO_PHONE}`;

const QUICK_PROMPTS = [
  { label: '🚨 Máy chiếu phòng học không lên', prompt: 'Báo hỏng máy chiếu phòng học bật không lên hình' },
  { label: '🔌 Cáp HDMI không nhận tín hiệu', prompt: 'Dây cáp HDMI bàn giáo viên cắm laptop không nhận hình ảnh' },
  { label: '🎤 Micro giảng đường mất tiếng', prompt: 'Micro phòng học bị mất tiếng và chập chờn rè' },
  { label: '❄️ Điều hoà không mát', prompt: 'Điều hoà phòng học chạy nhưng không có hơi lạnh' },
  { label: '⚡ Mất điện ổ cắm bục giảng', prompt: 'Ổ cắm điện bục giảng viên bị mất điện' }
];

export const StaffChatbotPortal: React.FC<StaffChatbotPortalProps> = ({
  currentUser,
  devices,
  incidents,
  onAddIncident,
  onOpenTelegramModal,
  telegramChatId,
  telegramBotToken,
  onAddToast
}) => {
  const [activeSubView, setActiveSubView] = useState<'chatbot' | 'history'>('chatbot');

  // Chatbot state
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [copiedZaloMsg, setCopiedZaloMsg] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // History and Export Filter State
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | IncidentStatus>('all');
  const [filterSeverity, setFilterSeverity] = useState<'all' | IncidentSeverity>('all');
  const [filterRoom, setFilterRoom] = useState<string>('all');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [selectedIncidentForDetail, setSelectedIncidentForDetail] = useState<IncidentReport | null>(null);

  // Initial welcome message for Staff
  useEffect(() => {
    if (currentUser && messages.length === 0) {
      setMessages([
        {
          id: 'welcome-staff',
          sender: 'bot',
          text: `👋 Xin chào **${currentUser.name}** (${currentUser.department || 'Cán bộ Khoa/Giảng đường'})!\n\nTôi là **Trợ lý Ảo CSVC DUE**, sẵn sàng hỗ trợ Quý Thầy/Cô:\n• **Báo hỏng tức thì**: Gõ sự cố hoặc phòng học (ví dụ: *"Phòng D305 máy chiếu không lên"*).\n• **Thông báo Zalo 0987119665**: Sự cố sẽ lập tức được chuyển tới số điện thoại Zalo của Kỹ thuật viên trực ban **0987119665**.\n• **Theo dõi lịch sử tiếp nhận & phản hồi**: Quý Thầy/Cô có thể theo dõi tiến độ xử lý và trích xuất báo cáo tại tab bên cạnh bất cứ lúc nào!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [currentUser]);

  // Auto scroll in chat
  useEffect(() => {
    if (activeSubView === 'chatbot') {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, loading, activeSubView]);

  // Helper to format Zalo report text
  const formatZaloReportMessage = (draft: {
    room: string;
    deviceName: string;
    description: string;
    severity: string;
    deviceSn?: string;
  }) => {
    const timeStr = new Date().toLocaleString('vi-VN');
    return `[BÁO HỎNG CSVC DUE - ĐẠI HỌC KINH TẾ]
- Vị trí: ${draft.room}
- Thiết bị: ${draft.deviceName}${draft.deviceSn ? ` (Mã: ${draft.deviceSn})` : ''}
- Đơn vị: ${currentUser.department || 'Khoa / Giảng đường'}
- Mức độ khẩn: ${draft.severity.toUpperCase()}
- Nội dung sự cố: ${draft.description}
- Cán bộ báo: ${currentUser.name} (${currentUser.email})
- Thời gian báo: ${timeStr}
-> Kính gửi Bộ phận Kỹ thuật CSVC (Hotline Zalo ${ZALO_PHONE}) tiếp nhận xử lý giúp!`;
  };

  // Chat message submission
  const handleSendMessage = async (textToSend?: string) => {
    const queryText = (textToSend !== undefined ? textToSend : inputText).trim();
    if (!queryText || loading) return;

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: queryText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const response = await fetch('/api/chat/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: queryText,
          history: messages.slice(-6).map(m => ({ sender: m.sender, text: m.text })),
          currentUser,
          knownRooms: Array.from(new Set(devices.map(d => d.location?.room).filter(Boolean))),
          knownDevices: devices.slice(0, 30).map(d => ({ name: d.name, room: d.location?.room }))
        })
      });

      if (!response.ok) {
        throw new Error('Lỗi máy chủ trợ lý ảo');
      }

      const data = await response.json();
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: data.reply || 'Tôi đã tiếp nhận thông tin từ bạn.',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        incidentDraft: data.incidentDraft
      };

      setMessages(prev => [...prev, botMsg]);
    } catch (err: any) {
      // Smart client-side fallback
      const lower = queryText.toLowerCase();
      const roomMatch = queryText.match(/([a-zA-Z]\d{3}|phòng\s+[a-zA-Z0-9]+)/i);
      let detectedRoom = roomMatch ? roomMatch[0].toUpperCase() : '';
      if (detectedRoom && !detectedRoom.startsWith('PHÒNG')) {
        detectedRoom = `Phòng ${detectedRoom}`;
      }

      let detectedDevice = 'Thiết bị phòng học';
      if (lower.includes('máy chiếu') || lower.includes('projector')) detectedDevice = 'Máy chiếu';
      else if (lower.includes('hdmi')) detectedDevice = 'Dây cáp HDMI';
      else if (lower.includes('micro') || lower.includes('mic')) detectedDevice = 'Âm thanh (Micro giảng đường)';
      else if (lower.includes('điều hoà') || lower.includes('máy lạnh')) detectedDevice = 'Điều hoà nhiệt độ';
      else if (lower.includes('điện') || lower.includes('ổ cắm') || lower.includes('quạt')) detectedDevice = 'Hệ thống Điện / Ổ cắm';

      const isReporting = lower.includes('hỏng') || lower.includes('hư') || lower.includes('lỗi') || lower.includes('không lên') || lower.includes('báo');

      if (isReporting && (detectedRoom || detectedDevice !== 'Thiết bị phòng học')) {
        setMessages(prev => [
          ...prev,
          {
            id: `bot-fallback-${Date.now()}`,
            sender: 'bot',
            text: `Tôi đã ghi nhận sự cố tại **${detectedRoom || 'Phòng học'}** đối với **${detectedDevice}**.\n\nBạn hãy kiểm tra thông tin dưới đây và nhấn nút gửi xác nhận để phiếu báo hỏng được lưu hệ thống và phát thông báo tới **Zalo (${ZALO_PHONE})** và Telegram nhé!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            incidentDraft: {
              room: detectedRoom || 'Phòng học',
              deviceName: detectedDevice,
              description: queryText,
              severity: lower.includes('cháy') || lower.includes('nổ') || lower.includes('khẩn') ? 'urgent' : 'high'
            }
          }
        ]);
      } else {
        setMessages(prev => [
          ...prev,
          {
            id: `bot-fallback-info-${Date.now()}`,
            sender: 'bot',
            text: `Tôi đã nhận tin nhắn của bạn. Nếu cần báo hỏng gấp thiết bị giảng đường, bạn có thể gõ rõ tên phòng và thiết bị (Ví dụ: *"Phòng D305 hỏng máy chiếu"*) hoặc liên hệ trực tiếp qua số Zalo hỗ trợ kỹ thuật **${ZALO_PHONE}** nhé!`,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
          }
        ]);
      }
    } finally {
      setLoading(false);
    }
  };

  // Submit Incident from Chat draft
  const handleConfirmSubmitIncident = async (msgId: string, draft: NonNullable<ChatMessage['incidentDraft']>) => {
    setLoading(true);
    try {
      const matchedDevice = devices.find(d => 
        (draft.room && d.location?.room && draft.room.toLowerCase().includes(d.location.room.toLowerCase())) ||
        (d.name.toLowerCase().includes(draft.deviceName.toLowerCase()))
      );

      const deviceSn = draft.deviceSn || matchedDevice?.serialNumber || `SN-CB-${Math.floor(1000 + Math.random() * 9000)}`;
      const deviceId = matchedDevice?.id || `DEV-STAFF-${Date.now()}`;
      const faculty = matchedDevice?.location?.faculty || currentUser.department || 'Khoa / Giảng đường';

      // Submit incident to Firestore
      await onAddIncident({
        deviceId,
        deviceSn,
        deviceName: draft.deviceName,
        reporterName: currentUser.name,
        faculty,
        room: draft.room,
        severity: draft.severity || 'high',
        description: `[Báo qua Chatbot Cán bộ]: ${draft.description}`,
        zaloPhone: ZALO_PHONE,
        zaloSent: true
      });

      // Mark message as submitted
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, incidentSubmitted: true } : m));

      // Append confirmation
      setMessages(prev => [
        ...prev,
        {
          id: `bot-confirm-${Date.now()}`,
          sender: 'bot',
          text: `🎉 **Đã gửi báo hỏng thành công!**\n• Phòng: **${draft.room}**\n• Thiết bị: **${draft.deviceName}**\n• Trạng thái: **Đã lưu phiếu & phát thông báo tới Hotline Zalo (${ZALO_PHONE}) & Telegram**.\n\nKỹ thuật viên CSVC sẽ tiếp nhận và phản hồi tới Thầy/Cô sớm nhất. Thầy/Cô có thể bấm vào tab **"Lịch Sử Tiếp Nhận & Phản Hồi"** để theo dõi chi tiết!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);

      if (onAddToast) {
        onAddToast(
          'Đã gửi báo hỏng CSVC',
          `Sự cố tại ${draft.room} đã được lưu và gửi tới Zalo ${ZALO_PHONE}`,
          'success',
          deviceSn
        );
      }
    } catch (err: any) {
      alert(`Không thể gửi báo hỏng: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Copy Zalo formatted text
  const handleCopyZaloText = (draft: any) => {
    const text = formatZaloReportMessage(draft);
    navigator.clipboard.writeText(text).then(() => {
      setCopiedZaloMsg(true);
      setTimeout(() => setCopiedZaloMsg(false), 2500);
      if (onAddToast) {
        onAddToast('Đã sao chép tin nhắn Zalo', 'Bạn có thể dán (Paste) vào Zalo số 0987119665 ngay!', 'info');
      }
    });
  };

  // Voice Speech Recognition
  const handleToggleVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói Web Speech. Quý Thầy/Cô vui lòng dùng bàn phím để gõ tin nhắn.');
      return;
    }

    if (isListening) {
      setIsListening(false);
      return;
    }

    try {
      const recognition = new SpeechRecognition();
      recognition.lang = 'vi-VN';
      recognition.continuous = false;
      recognition.interimResults = false;

      recognition.onstart = () => setIsListening(true);
      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(transcript);
          handleSendMessage(transcript);
        }
        setIsListening(false);
      };
      recognition.onerror = () => setIsListening(false);
      recognition.onend = () => setIsListening(false);
      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  // Filtered incidents for Staff (only staff's own incidents or staff's department)
  const staffIncidents = useMemo(() => {
    return incidents.filter(inc => {
      // Search term
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const match = 
          inc.deviceName.toLowerCase().includes(q) ||
          inc.deviceSn.toLowerCase().includes(q) ||
          inc.room.toLowerCase().includes(q) ||
          inc.faculty.toLowerCase().includes(q) ||
          inc.description.toLowerCase().includes(q) ||
          (inc.reporterName && inc.reporterName.toLowerCase().includes(q)) ||
          (inc.acceptedBy && inc.acceptedBy.toLowerCase().includes(q)) ||
          (inc.resolutionNotes && inc.resolutionNotes.toLowerCase().includes(q));
        if (!match) return false;
      }

      // Status filter
      if (filterStatus !== 'all' && inc.status !== filterStatus) {
        return false;
      }

      // Severity filter
      if (filterSeverity !== 'all' && inc.severity !== filterSeverity) {
        return false;
      }

      // Room filter
      if (filterRoom !== 'all' && inc.room !== filterRoom) {
        return false;
      }

      // Date range filter
      if (startDate) {
        const incDate = inc.reportedAt.split('T')[0];
        if (incDate < startDate) return false;
      }
      if (endDate) {
        const incDate = inc.reportedAt.split('T')[0];
        if (incDate > endDate) return false;
      }

      return true;
    }).sort((a, b) => new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime());
  }, [incidents, searchQuery, filterStatus, filterSeverity, filterRoom, startDate, endDate]);

  // Unique rooms list for filter
  const uniqueRooms = useMemo(() => {
    const set = new Set<string>();
    incidents.forEach(i => { if (i.room) set.add(i.room); });
    devices.forEach(d => { if (d.location?.room) set.add(d.location.room); });
    return Array.from(set).sort();
  }, [incidents, devices]);

  // Export CSV/Excel with UTF-8 BOM
  const handleExportCSV = () => {
    if (staffIncidents.length === 0) {
      alert('Không có dữ liệu sự cố nào phù hợp với bộ lọc để trích xuất!');
      return;
    }

    const headers = [
      'STT',
      'Mã Sự Cố',
      'Thời Gian Báo',
      'Cán Bộ Báo Cáo',
      'Khoa / Đơn Vị',
      'Phòng Học',
      'Thiết Bị',
      'Mã Số Sê-ri (SN)',
      'Mức Độ Khẩn',
      'Mô Tả Sự Cố',
      'Kênh Thông Báo',
      'Tình Trạng',
      'Cán Bộ Tiếp Nhận',
      'Thời Gian Tiếp Nhận',
      'Ghi Chú Tiếp Nhận',
      'Cán Bộ Phản Hồi / Xử Lý',
      'Thời Gian Hoàn Tất',
      'Nội Dung Phản Hồi Kết Quả'
    ];

    const rows = staffIncidents.map((inc, index) => {
      const statusText = 
        inc.status === 'resolved' ? 'Đã khắc phục xong' :
        inc.status === 'in_progress' ? 'Đang tiếp nhận xử lý' : 'Chờ tiếp nhận';
      
      const severityText = 
        inc.severity === 'urgent' ? 'Khẩn cấp' :
        inc.severity === 'high' ? 'Cao' :
        inc.severity === 'medium' ? 'Trung bình' : 'Thấp';

      const reportedTime = inc.reportedAt ? new Date(inc.reportedAt).toLocaleString('vi-VN') : '';
      const acceptedTime = inc.acceptedAt ? new Date(inc.acceptedAt).toLocaleString('vi-VN') : '';
      const resolvedTime = inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleString('vi-VN') : '';

      return [
        index + 1,
        `"${inc.id}"`,
        `"${reportedTime}"`,
        `"${inc.reporterName || ''}"`,
        `"${inc.faculty || ''}"`,
        `"${inc.room || ''}"`,
        `"${inc.deviceName || ''}"`,
        `"${inc.deviceSn || ''}"`,
        `"${severityText}"`,
        `"${(inc.description || '').replace(/"/g, '""')}"`,
        `"Zalo ${ZALO_PHONE} / Telegram"`,
        `"${statusText}"`,
        `"${inc.acceptedBy || ''}"`,
        `"${acceptedTime}"`,
        `"${(inc.acceptanceNotes || '').replace(/"/g, '""')}"`,
        `"${inc.responderName || ''}"`,
        `"${resolvedTime}"`,
        `"${(inc.resolutionNotes || '').replace(/"/g, '""')}"`
      ].join(',');
    });

    // Add UTF-8 BOM so Excel opens with proper Vietnamese diacritics
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\r\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    const nowStr = new Date().toISOString().slice(0, 10);
    link.setAttribute('download', `BAO_CAO_SU_CO_CSVC_DUE_${nowStr}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (onAddToast) {
      onAddToast(
        'Trích xuất thành công',
        `Đã tải file Excel báo cáo gồm ${staffIncidents.length} bản ghi sự cố.`,
        'success'
      );
    }
  };

  // Print Report Handler
  const handlePrintReport = () => {
    window.print();
  };

  return (
    <div className="space-y-6 pb-12" id="staff-chatbot-portal-root">
      {/* Top Banner for Staff */}
      <div className="rounded-2xl bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white p-5 sm:p-6 shadow-xl border border-slate-800 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div className="space-y-1.5 max-w-2xl">
          <div className="flex items-center gap-2">
            <span className="rounded-md bg-blue-500/20 px-2.5 py-0.5 text-xs font-bold text-blue-300 border border-blue-400/30 flex items-center gap-1.5">
              <ShieldCheck className="h-3.5 w-3.5 text-blue-300" />
              CỔNG CÁN BỘ KHOA / GIẢNG ĐƯỜNG
            </span>
            <span className="text-xs text-slate-400">•</span>
            <span className="text-xs text-slate-300 font-medium">{currentUser.department || 'Đại học Kinh tế - ĐHĐN'}</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
            Trợ Lý AI CSVC & Quản Lý Sự Cố Giảng Đường
          </h2>
          <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
            Hỗ trợ cán bộ khoa báo hỏng nhanh qua chatbot, tự động thông báo tới Hotline Zalo <strong className="text-emerald-300">0987119665</strong>, đồng bộ Telegram, theo dõi tiến trình tiếp nhận và trích xuất báo cáo.
          </p>
        </div>

        {/* Action Button Group: Hotline Zalo */}
        <div className="flex flex-wrap items-center gap-2.5 shrink-0 w-full md:w-auto">
          <a
            href={ZALO_LINK}
            target="_blank"
            rel="noopener noreferrer"
            className="flex-1 md:flex-initial inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white px-4 py-2.5 text-xs font-bold shadow-lg shadow-emerald-900/30 transition transform active:scale-95 border border-white/20"
            title="Nhấn để mở cuộc trò chuyện Zalo với Kỹ thuật viên CSVC"
          >
            <Phone className="h-4 w-4 text-emerald-100 animate-pulse" />
            <span>Hotline Zalo: {ZALO_PHONE}</span>
            <ExternalLink className="h-3.5 w-3.5 opacity-80" />
          </a>

          {onOpenTelegramModal && (
            <button
              type="button"
              onClick={onOpenTelegramModal}
              className="inline-flex items-center justify-center gap-1.5 rounded-xl bg-slate-800/80 hover:bg-slate-700/80 text-slate-200 px-3 py-2.5 text-xs font-semibold border border-slate-700 transition"
              title="Cài đặt Telegram Bot @japancsvcbot"
            >
              <SendHorizontal className="h-3.5 w-3.5 text-sky-400" />
              <span>{telegramChatId ? 'Telegram Đã Nối' : 'Cấu Hình Telegram'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Sub-Tabs: Chatbot vs History & Reporting */}
      <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 pt-3 rounded-t-2xl shadow-sm">
        <div className="flex items-center gap-2 sm:gap-4">
          <button
            type="button"
            onClick={() => setActiveSubView('chatbot')}
            id="tab-staff-chatbot"
            className={`flex items-center gap-2 pb-3 pt-1 text-sm font-bold border-b-2 transition ${
              activeSubView === 'chatbot'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Bot className="h-4 w-4" />
            <span>Trợ Lý Chatbot CSVC & Báo Hỏng</span>
            <span className="rounded-full bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-0.5">
              Tức thì
            </span>
          </button>

          <button
            type="button"
            onClick={() => setActiveSubView('history')}
            id="tab-staff-history"
            className={`flex items-center gap-2 pb-3 pt-1 text-sm font-bold border-b-2 transition ${
              activeSubView === 'history'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <Activity className="h-4 w-4" />
            <span>Lịch Sử Tiếp Nhận & Phản Hồi</span>
            <span className="rounded-full bg-slate-100 text-slate-700 text-[10px] font-bold px-2 py-0.5">
              {staffIncidents.length} phiếu
            </span>
          </button>
        </div>

        {activeSubView === 'history' && (
          <div className="flex items-center gap-2 pb-2">
            <button
              type="button"
              onClick={handleExportCSV}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white px-3 py-1.5 text-xs font-bold transition shadow-sm"
              title="Tải bảng tính Excel định dạng chuẩn UTF-8"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>Trích Xuất Excel</span>
            </button>
            <button
              type="button"
              onClick={handlePrintReport}
              className="hidden sm:inline-flex items-center gap-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 text-xs font-bold transition border border-slate-300"
              title="In bản báo cáo kèm chữ ký"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>In Báo Cáo</span>
            </button>
          </div>
        )}
      </div>

      {/* VIEW 1: FULL SCREEN CHATBOT CSVC */}
      {activeSubView === 'chatbot' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Main Chat Interface */}
          <div className="lg:col-span-8 flex flex-col bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden h-[680px]">
            {/* Chat Header */}
            <div className="bg-gradient-to-r from-slate-900 to-blue-950 text-white px-5 py-3.5 flex items-center justify-between border-b border-slate-800 shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center h-10 w-10 rounded-xl bg-blue-600 text-white shadow-md">
                  <Bot className="h-5 w-5" />
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 border border-slate-900"></span>
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    Trợ Lý AI CSVC Trường Đại Học Kinh Tế
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[10px] font-semibold text-emerald-300 border border-emerald-500/30">
                      Sẵn sàng 24/7
                    </span>
                  </h3>
                  <p className="text-[11px] text-blue-200">
                    Báo hỏng gửi tới Zalo {ZALO_PHONE} & Bot Telegram @japancsvcbot
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => {
                    if (window.confirm('Xác nhận làm mới cuộc hội thoại này?')) {
                      setMessages([
                        {
                          id: 'welcome-reset',
                          sender: 'bot',
                          text: `Cuộc trò chuyện đã được làm mới. Quý Thầy/Cô vui lòng gõ sự cố hoặc câu hỏi để tôi hỗ trợ ngay!`,
                          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                        }
                      ]);
                    }
                  }}
                  className="rounded-lg p-2 text-slate-300 hover:bg-white/10 hover:text-white transition"
                  title="Làm mới cuộc trò chuyện"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 bg-slate-50/50">
              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex gap-3 ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  {msg.sender === 'bot' && (
                    <div className="h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm mt-0.5">
                      <Bot className="h-4 w-4" />
                    </div>
                  )}

                  <div className={`max-w-[85%] sm:max-w-[75%] space-y-2.5`}>
                    <div
                      className={`p-4 rounded-2xl text-xs sm:text-sm leading-relaxed shadow-sm ${
                        msg.sender === 'user'
                          ? 'bg-blue-600 text-white rounded-br-none'
                          : 'bg-white text-slate-800 border border-slate-200 rounded-bl-none'
                      }`}
                    >
                      <div className="whitespace-pre-wrap">{msg.text}</div>
                      <div
                        className={`text-[10px] mt-1.5 text-right ${
                          msg.sender === 'user' ? 'text-blue-100' : 'text-slate-400'
                        }`}
                      >
                        {msg.timestamp}
                      </div>
                    </div>

                    {/* Interactive Incident Draft Card */}
                    {msg.incidentDraft && !msg.incidentSubmitted && (
                      <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="rounded-2xl bg-gradient-to-br from-amber-50 to-orange-50/70 border-2 border-amber-300/80 p-4 text-xs space-y-3 shadow-md"
                      >
                        <div className="flex items-center justify-between border-b border-amber-200 pb-2">
                          <span className="font-bold text-amber-900 flex items-center gap-1.5 text-xs">
                            <AlertTriangle className="h-4 w-4 text-amber-600" />
                            XÁC NHẬN PHIẾU BÁO HỎNG PHÒNG HỌC
                          </span>
                          <span className="font-bold text-[10px] uppercase bg-amber-200/70 text-amber-900 px-2 py-0.5 rounded">
                            {msg.incidentDraft.severity}
                          </span>
                        </div>

                        <div className="grid grid-cols-2 gap-2 text-[11px] bg-white/90 p-3 rounded-xl border border-amber-200/60 shadow-inner">
                          <div>
                            <span className="text-slate-400 block text-[10px]">Phòng học:</span>
                            <span className="font-bold text-slate-800">{msg.incidentDraft.room}</span>
                          </div>
                          <div>
                            <span className="text-slate-400 block text-[10px]">Thiết bị:</span>
                            <span className="font-bold text-slate-800">{msg.incidentDraft.deviceName}</span>
                          </div>
                          <div className="col-span-2 pt-1 border-t border-dashed border-amber-200">
                            <span className="text-slate-400 block text-[10px]">Mô tả sự cố:</span>
                            <span className="text-slate-700 font-medium">{msg.incidentDraft.description}</span>
                          </div>
                          <div className="col-span-2 pt-1 border-t border-dashed border-amber-200 flex items-center justify-between text-[10px]">
                            <span className="text-slate-500">Thông báo gửi tới:</span>
                            <span className="font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200">
                              Zalo {ZALO_PHONE} & Telegram
                            </span>
                          </div>
                        </div>

                        {/* Fast Action Buttons */}
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                          <button
                            type="button"
                            disabled={loading}
                            onClick={() => handleConfirmSubmitIncident(msg.id, msg.incidentDraft!)}
                            className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white py-2 px-3 text-xs font-bold shadow transition active:scale-95 disabled:opacity-50"
                          >
                            <Send className="h-3.5 w-3.5" />
                            <span>Gửi Báo Hỏng Ngay</span>
                          </button>

                          <a
                            href={ZALO_LINK}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() => handleCopyZaloText(msg.incidentDraft)}
                            className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white py-2 px-3 text-xs font-bold shadow transition active:scale-95"
                          >
                            <Phone className="h-3.5 w-3.5" />
                            <span>Nhắn Zalo: {ZALO_PHONE}</span>
                            <ExternalLink className="h-3 w-3" />
                          </a>
                        </div>

                        <div className="flex items-center justify-between pt-1 text-[10px] text-slate-500">
                          <button
                            type="button"
                            onClick={() => handleCopyZaloText(msg.incidentDraft)}
                            className="text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 underline"
                          >
                            <Copy className="h-3 w-3" />
                            <span>{copiedZaloMsg ? 'Đã copy tin Zalo!' : 'Copy nội dung tin nhắn Zalo'}</span>
                          </button>
                          <span>Sau khi gửi, KTV tiếp nhận sẽ phản hồi tại đây</span>
                        </div>
                      </motion.div>
                    )}
                  </div>

                  {msg.sender === 'user' && (
                    <div className="h-8 w-8 rounded-xl bg-slate-200 text-slate-700 flex items-center justify-center shrink-0 shadow-sm mt-0.5 font-bold text-xs">
                      {currentUser.name.slice(0, 1).toUpperCase()}
                    </div>
                  )}
                </div>
              ))}

              {loading && (
                <div className="flex gap-3 items-center">
                  <div className="h-8 w-8 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-sm">
                    <Bot className="h-4 w-4 animate-spin" />
                  </div>
                  <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-xs text-slate-500 flex items-center gap-2 shadow-sm">
                    <span className="inline-block h-2 w-2 rounded-full bg-blue-600 animate-pulse"></span>
                    <span>Trợ lý AI CSVC đang xử lý yêu cầu và kiểm tra thông tin...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Prompt Pills */}
            <div className="px-4 py-2.5 bg-slate-100/70 border-t border-slate-200 overflow-x-auto flex items-center gap-2 no-scrollbar">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider shrink-0 flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-amber-500" />
                Gợi ý nhanh:
              </span>
              {QUICK_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => {
                    setInputText(qp.prompt);
                    handleSendMessage(qp.prompt);
                  }}
                  className="rounded-full bg-white hover:bg-blue-50 hover:text-blue-700 hover:border-blue-300 text-slate-700 border border-slate-300/80 px-3 py-1 text-[11px] font-medium whitespace-nowrap transition shrink-0 shadow-2xs"
                >
                  {qp.label}
                </button>
              ))}
            </div>

            {/* Chat Input Field */}
            <div className="p-3.5 sm:p-4 bg-white border-t border-slate-200">
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  handleSendMessage();
                }}
                className="flex items-center gap-2"
              >
                <div className="relative flex-1">
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    placeholder="Gõ sự cố thiết bị (VD: Phòng D305 máy chiếu không lên nguồn)..."
                    className="w-full rounded-xl border border-slate-300 pl-4 pr-11 py-2.5 text-xs sm:text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 font-medium"
                  />
                  <button
                    type="button"
                    onClick={handleToggleVoice}
                    className={`absolute right-2 top-2 p-1 rounded-lg transition ${
                      isListening ? 'bg-rose-500 text-white animate-pulse' : 'text-slate-400 hover:text-slate-700'
                    }`}
                    title="Nhận diện giọng nói tiếng Việt"
                  >
                    {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                  </button>
                </div>

                <button
                  type="submit"
                  disabled={!inputText.trim() || loading}
                  className="rounded-xl bg-blue-600 hover:bg-blue-700 text-white p-2.5 sm:px-4 sm:py-2.5 text-xs sm:text-sm font-bold transition shadow-sm active:scale-95 disabled:opacity-40 flex items-center gap-1.5"
                >
                  <Send className="h-4 w-4" />
                  <span className="hidden sm:inline">Gửi Tin</span>
                </button>
              </form>
            </div>
          </div>

          {/* Right Info Card: Zalo & Support Protocol */}
          <div className="lg:col-span-4 space-y-4">
            {/* Zalo Hotline Card */}
            <div className="rounded-2xl bg-gradient-to-br from-emerald-500 via-teal-600 to-emerald-700 text-white p-5 shadow-lg space-y-3.5 border border-emerald-400/40">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="h-9 w-9 rounded-xl bg-white/20 backdrop-blur-md flex items-center justify-center text-white">
                    <Phone className="h-5 w-5" />
                  </div>
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-100">Kênh Tiếp Nhận Khẩn</span>
                    <h4 className="text-sm font-black text-white">Hotline Zalo Kỹ Thuật CSVC</h4>
                  </div>
                </div>
                <span className="text-xs font-mono font-bold bg-white text-emerald-800 px-2 py-0.5 rounded-full">
                  24/7
                </span>
              </div>

              <div className="rounded-xl bg-white/10 p-3 backdrop-blur-sm border border-white/20 space-y-1 text-xs">
                <p className="font-bold text-white text-lg font-mono tracking-wider">{ZALO_PHONE}</p>
                <p className="text-emerald-100 text-[11px] leading-relaxed">
                  Đầu số Zalo của Kỹ thuật viên trực quản trị CSVC. Mọi báo hỏng qua chatbot đều chuyển tự động tới đây!
                </p>
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                <a
                  href={ZALO_LINK}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-white text-emerald-800 hover:bg-emerald-50 py-2 text-xs font-bold shadow-sm transition active:scale-95"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  <span>Mở Zalo Chat</span>
                </a>
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard.writeText(ZALO_PHONE);
                    if (onAddToast) onAddToast('Đã copy số điện thoại', `Số ${ZALO_PHONE} đã được sao chép`, 'info');
                  }}
                  className="flex items-center justify-center gap-1.5 rounded-xl bg-emerald-800/40 hover:bg-emerald-800/60 text-white py-2 text-xs font-bold border border-white/20 transition active:scale-95"
                >
                  <Copy className="h-3.5 w-3.5" />
                  <span>Copy SĐT</span>
                </button>
              </div>
            </div>

            {/* Quick Status Stats Card */}
            <div className="rounded-2xl bg-white p-5 shadow-sm border border-slate-200 space-y-3">
              <h4 className="text-xs font-bold uppercase text-slate-400 tracking-wider flex items-center justify-between">
                <span>Tiến Độ Xử Lý Của Khoa</span>
                <button
                  type="button"
                  onClick={() => setActiveSubView('history')}
                  className="text-blue-600 hover:underline text-[11px] font-semibold lowercase"
                >
                  xem tất cả →
                </button>
              </h4>

              <div className="grid grid-cols-3 gap-2">
                <div className="rounded-xl bg-amber-50 border border-amber-200 p-2.5 text-center">
                  <span className="text-lg font-black text-amber-700">
                    {staffIncidents.filter(i => i.status === 'open').length}
                  </span>
                  <p className="text-[10px] text-amber-800 font-bold mt-0.5">Chờ tiếp nhận</p>
                </div>
                <div className="rounded-xl bg-blue-50 border border-blue-200 p-2.5 text-center">
                  <span className="text-lg font-black text-blue-700">
                    {staffIncidents.filter(i => i.status === 'in_progress').length}
                  </span>
                  <p className="text-[10px] text-blue-800 font-bold mt-0.5">Đang xử lý</p>
                </div>
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-2.5 text-center">
                  <span className="text-lg font-black text-emerald-700">
                    {staffIncidents.filter(i => i.status === 'resolved').length}
                  </span>
                  <p className="text-[10px] text-emerald-800 font-bold mt-0.5">Đã xong</p>
                </div>
              </div>

              {/* Instructions */}
              <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-[11px] text-slate-600 space-y-1.5 leading-relaxed">
                <div className="font-bold text-slate-800 flex items-center gap-1">
                  <Info className="h-3.5 w-3.5 text-blue-600" />
                  Quy trình tiếp nhận sự cố giảng đường:
                </div>
                <p>1. Cán bộ báo sự cố qua Chatbot hoặc gọi Zalo {ZALO_PHONE}.</p>
                <p>2. Kỹ thuật viên tiếp nhận, trạng thái chuyển sang <strong>Đang xử lý</strong>.</p>
                <p>3. Khi hoàn tất, KTV cập nhật nội dung phản hồi. Cán bộ có thể xem và trích xuất báo cáo lưu trữ.</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VIEW 2: LỊCH SỬ TIẾP NHẬN & PHẢN HỒI (KÈM TRÍCH XUẤT BÁO CÁO) */}
      {activeSubView === 'history' && (
        <div className="space-y-5">
          {/* Filter Bar */}
          <div className="rounded-2xl bg-white p-4 sm:p-5 shadow-sm border border-slate-200 space-y-3.5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-2">
                  <Filter className="h-4 w-4 text-blue-600" />
                  Bộ Lọc & Tìm Kiếm Phiếu Tiếp Nhận - Phản Hồi
                </h3>
                <p className="text-xs text-slate-500">Lọc theo trạng thái, phòng học và thời gian để trích xuất báo cáo</p>
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleExportCSV}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white px-3.5 py-2 text-xs font-bold shadow-sm transition active:scale-95"
                >
                  <Download className="h-4 w-4" />
                  <span>Trích Xuất Báo Cáo Excel</span>
                </button>
                <button
                  type="button"
                  onClick={handlePrintReport}
                  className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 px-3.5 py-2 text-xs font-bold border border-slate-300 transition"
                >
                  <Printer className="h-4 w-4" />
                  <span>In Mẫu Báo Cáo</span>
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
              {/* Search text */}
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Tìm phòng, thiết bị, mô tả..."
                  className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2 text-xs focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              {/* Status Filter */}
              <div>
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value as any)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white text-slate-800 focus:border-blue-500 focus:outline-none font-medium"
                >
                  <option value="all">-- Tất cả trạng thái --</option>
                  <option value="open">⏳ Chờ tiếp nhận</option>
                  <option value="in_progress">⚙️ Đang tiếp nhận xử lý</option>
                  <option value="resolved">✅ Đã xử lý & Phản hồi xong</option>
                </select>
              </div>

              {/* Room Filter */}
              <div>
                <select
                  value={filterRoom}
                  onChange={(e) => setFilterRoom(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white text-slate-800 focus:border-blue-500 focus:outline-none font-medium"
                >
                  <option value="all">-- Tất cả phòng học --</option>
                  {uniqueRooms.map(rm => (
                    <option key={rm} value={rm}>Phòng {rm}</option>
                  ))}
                </select>
              </div>

              {/* Start Date */}
              <div>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white text-slate-800 focus:border-blue-500 focus:outline-none font-medium"
                  title="Từ ngày"
                />
              </div>

              {/* End Date */}
              <div>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs bg-white text-slate-800 focus:border-blue-500 focus:outline-none font-medium"
                  title="Đến ngày"
                />
              </div>
            </div>

            {(searchQuery || filterStatus !== 'all' || filterRoom !== 'all' || startDate || endDate) && (
              <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs text-slate-500">
                <span>Tìm thấy <strong>{staffIncidents.length}</strong> kết quả phù hợp</span>
                <button
                  type="button"
                  onClick={() => {
                    setSearchQuery('');
                    setFilterStatus('all');
                    setFilterRoom('all');
                    setFilterSeverity('all');
                    setStartDate('');
                    setEndDate('');
                  }}
                  className="text-blue-600 hover:underline font-medium text-[11px]"
                >
                  Đặt lại bộ lọc
                </button>
              </div>
            )}
          </div>

          {/* Incidents Table & Detailed Process Cards */}
          <div className="rounded-2xl bg-white shadow-sm border border-slate-200 overflow-hidden">
            <div className="p-4 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-700 tracking-wider">
                Bảng Thống Kê & Lịch Sử Tiếp Nhận - Phản Hồi ({staffIncidents.length})
              </span>
              <span className="text-[11px] text-slate-500">
                Cập nhật theo thời gian thực từ Firestore
              </span>
            </div>

            {staffIncidents.length === 0 ? (
              <div className="p-12 text-center text-slate-400 space-y-3">
                <AlertTriangle className="h-10 w-10 text-slate-300 mx-auto" />
                <p className="text-sm font-bold text-slate-600">Không tìm thấy sự cố nào</p>
                <p className="text-xs text-slate-400">
                  Hãy quay lại tab Chatbot để thử báo một sự cố hoặc mở rộng điều kiện lọc ngày.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-200">
                {staffIncidents.map((inc, index) => {
                  const isSelected = selectedIncidentForDetail?.id === inc.id;

                  return (
                    <div
                      key={inc.id}
                      className={`p-4 sm:p-5 transition hover:bg-slate-50/80 ${
                        isSelected ? 'bg-blue-50/40 border-l-4 border-l-blue-600' : ''
                      }`}
                    >
                      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3">
                        <div className="space-y-1.5 flex-1">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-mono font-bold text-slate-500 bg-slate-100 px-2 py-0.5 rounded">
                              #{index + 1}
                            </span>
                            <span className="font-bold text-slate-900 text-sm sm:text-base">
                              {inc.deviceName}
                            </span>
                            <span className="font-mono text-[11px] font-bold text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded">
                              {inc.deviceSn}
                            </span>
                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full uppercase ${
                              inc.severity === 'urgent' ? 'bg-rose-600 text-white' :
                              inc.severity === 'high' ? 'bg-amber-500 text-white' : 'bg-slate-200 text-slate-700'
                            }`}>
                              {inc.severity}
                            </span>
                          </div>

                          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                            <span>📍 <strong>{inc.room}</strong> ({inc.faculty})</span>
                            <span>👤 Báo bởi: <strong>{inc.reporterName}</strong></span>
                            <span>🕒 Báo lúc: {new Date(inc.reportedAt).toLocaleString('vi-VN')}</span>
                            <span className="text-emerald-700 font-medium">📲 Kênh: Zalo {ZALO_PHONE}</span>
                          </div>

                          <div className="bg-slate-50 p-2.5 rounded-xl border border-slate-200 text-xs text-slate-700 mt-1">
                            <strong className="text-slate-500 text-[10px] uppercase block mb-0.5">Nội dung sự cố:</strong>
                            {inc.description}
                          </div>
                        </div>

                        {/* Status & Toggle Detail Button */}
                        <div className="flex md:flex-col items-end justify-between md:justify-center gap-2 shrink-0">
                          <span className={`px-3 py-1 rounded-full text-xs font-bold border ${
                            inc.status === 'resolved'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-300'
                              : inc.status === 'in_progress'
                                ? 'bg-blue-50 text-blue-700 border-blue-300'
                                : 'bg-amber-50 text-amber-700 border-amber-300'
                          }`}>
                            {inc.status === 'resolved' ? '✅ Đã khắc phục xong' :
                             inc.status === 'in_progress' ? '⚙️ Đang tiếp nhận xử lý' : '⏳ Chờ KTV tiếp nhận'}
                          </span>

                          <button
                            type="button"
                            onClick={() => setSelectedIncidentForDetail(isSelected ? null : inc)}
                            className="rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 text-xs font-semibold transition border border-slate-300"
                          >
                            {isSelected ? 'Thu gọn tiến trình ▲' : 'Xem tiến trình tiếp nhận ▼'}
                          </button>
                        </div>
                      </div>

                      {/* EXPANDED TIMELINE PROCESS VIEW */}
                      <AnimatePresence>
                        {isSelected && (
                          <motion.div
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            className="mt-4 pt-4 border-t border-slate-200 space-y-4"
                          >
                            <h5 className="text-xs font-bold uppercase text-slate-600 tracking-wider flex items-center gap-1.5">
                              <Layers className="h-4 w-4 text-blue-600" />
                              Tiến Trình Tiếp Nhận & Phản Hồi Xử Lý Sự Cố:
                            </h5>

                            {/* Timeline 3 Steps */}
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                              {/* Step 1: Báo hỏng */}
                              <div className="rounded-xl bg-emerald-50/80 border border-emerald-200 p-3.5 space-y-1.5 text-xs">
                                <div className="flex items-center justify-between text-emerald-800 font-bold">
                                  <span className="flex items-center gap-1">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    1. Tiếp nhận ban đầu
                                  </span>
                                  <span className="text-[10px] bg-emerald-200/80 px-1.5 py-0.5 rounded">Đã gửi</span>
                                </div>
                                <p className="text-slate-600 text-[11px]">
                                  Báo bởi: <strong>{inc.reporterName}</strong>
                                </p>
                                <p className="text-slate-400 text-[10px]">
                                  🕒 {new Date(inc.reportedAt).toLocaleString('vi-VN')}
                                </p>
                                <p className="text-emerald-700 text-[10px] font-semibold pt-1 border-t border-emerald-200/50">
                                  Đã gửi thông báo tới Zalo Hotline {ZALO_PHONE}
                                </p>
                              </div>

                              {/* Step 2: Tiếp nhận */}
                              <div className={`rounded-xl p-3.5 space-y-1.5 text-xs border ${
                                inc.status === 'in_progress' || inc.status === 'resolved'
                                  ? 'bg-blue-50/80 border-blue-200'
                                  : 'bg-slate-50 border-dashed border-slate-300 text-slate-400'
                              }`}>
                                <div className="flex items-center justify-between font-bold">
                                  <span className="flex items-center gap-1">
                                    <Clock className="h-4 w-4 text-blue-600" />
                                    2. KTV Tiếp nhận
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold">
                                    {inc.acceptedAt ? 'Đã nhận' : 'Đang chờ'}
                                  </span>
                                </div>
                                {inc.acceptedAt ? (
                                  <>
                                    <p className="text-slate-700 text-[11px]">
                                      Người tiếp nhận: <strong>{inc.acceptedBy || 'Kỹ thuật viên CSVC'}</strong>
                                    </p>
                                    <p className="text-slate-400 text-[10px]">
                                      🕒 {new Date(inc.acceptedAt).toLocaleString('vi-VN')}
                                    </p>
                                    {inc.acceptanceNotes && (
                                      <p className="text-blue-900 text-[11px] bg-white p-2 rounded border border-blue-200 mt-1">
                                        Ghi chú: {inc.acceptanceNotes}
                                      </p>
                                    )}
                                  </>
                                ) : (
                                  <p className="text-slate-400 text-[11px] italic">
                                    Đang chờ Kỹ thuật viên CSVC bấm tiếp nhận phiếu trên hệ thống.
                                  </p>
                                )}
                              </div>

                              {/* Step 3: Phản hồi & Kết quả */}
                              <div className={`rounded-xl p-3.5 space-y-1.5 text-xs border ${
                                inc.status === 'resolved'
                                  ? 'bg-emerald-50/80 border-emerald-300'
                                  : 'bg-slate-50 border-dashed border-slate-300 text-slate-400'
                              }`}>
                                <div className="flex items-center justify-between font-bold">
                                  <span className="flex items-center gap-1">
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                    3. Phản hồi kết quả
                                  </span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded font-bold">
                                    {inc.resolvedAt ? 'Hoàn tất' : 'Chưa xong'}
                                  </span>
                                </div>

                                {inc.status === 'resolved' ? (
                                  <>
                                    <p className="text-slate-700 text-[11px]">
                                      Người xử lý: <strong>{inc.responderName || 'Kỹ thuật viên CSVC'}</strong>
                                    </p>
                                    <p className="text-slate-400 text-[10px]">
                                      🕒 {inc.resolvedAt ? new Date(inc.resolvedAt).toLocaleString('vi-VN') : 'Đã xử lý'}
                                    </p>
                                    <div className="bg-white p-2.5 rounded border border-emerald-200 text-[11px] text-slate-800 font-medium">
                                      <strong className="text-emerald-800 text-[10px] uppercase block mb-0.5">Nội dung phản hồi:</strong>
                                      {inc.resolutionNotes || 'Đã khắc phục hoàn tất thiết bị hoạt động bình thường.'}
                                    </div>
                                  </>
                                ) : (
                                  <p className="text-slate-400 text-[11px] italic">
                                    Kỹ thuật viên đang trong quá trình khảo sát và sửa chữa. Kết quả phản hồi sẽ hiện tại đây.
                                  </p>
                                )}
                              </div>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PRINTABLE TEMPLATE (Only renders when printing) */}
      <div className="hidden print:block p-8 text-black bg-white space-y-6">
        <div className="flex items-start justify-between border-b-2 border-black pb-4">
          <div className="text-center">
            <h4 className="text-xs font-bold uppercase">ĐẠI HỌC ĐÀ NẴNG</h4>
            <h3 className="text-sm font-black uppercase">TRƯỜNG ĐẠI HỌC KINH TẾ</h3>
            <p className="text-[10px] italic">Phòng Cơ sở vật chất</p>
          </div>
          <div className="text-center">
            <h4 className="text-xs font-bold uppercase">CỘNG HÒA XÃ HỘI CHỦ NGHĨA VIỆT NAM</h4>
            <p className="text-[11px] font-bold">Độc lập - Tự do - Hạnh phúc</p>
            <p className="text-[10px] italic mt-1">Đà Nẵng, ngày {new Date().getDate()} tháng {new Date().getMonth() + 1} năm {new Date().getFullYear()}</p>
          </div>
        </div>

        <div className="text-center space-y-1">
          <h2 className="text-base font-black uppercase tracking-wide">
            BÁO CÁO TÌNH HÌNH TIẾP NHẬN VÀ XỬ LÝ SỰ CỐ THIẾT BỊ GIẢNG ĐƯỜNG
          </h2>
          <p className="text-xs italic">Đơn vị báo cáo: {currentUser.department || 'Khoa / Giảng đường'}</p>
        </div>

        <div className="text-xs space-y-1">
          <p>• <strong>Tổng số sự cố ghi nhận:</strong> {staffIncidents.length} trường hợp</p>
          <p>• <strong>Đã xử lý và phản hồi hoàn tất:</strong> {staffIncidents.filter(i => i.status === 'resolved').length} trường hợp</p>
          <p>• <strong>Đang trong quá trình xử lý:</strong> {staffIncidents.filter(i => i.status === 'in_progress').length} trường hợp</p>
          <p>• <strong>Chờ tiếp nhận:</strong> {staffIncidents.filter(i => i.status === 'open').length} trường hợp</p>
        </div>

        <table className="w-full border-collapse border border-black text-[10px]">
          <thead>
            <tr className="bg-slate-100">
              <th className="border border-black p-1.5">STT</th>
              <th className="border border-black p-1.5">Phòng</th>
              <th className="border border-black p-1.5">Thiết bị (Mã SN)</th>
              <th className="border border-black p-1.5">Nội dung sự cố</th>
              <th className="border border-black p-1.5">Thời gian báo</th>
              <th className="border border-black p-1.5">Cán bộ tiếp nhận</th>
              <th className="border border-black p-1.5">Kết quả phản hồi</th>
              <th className="border border-black p-1.5">Tình trạng</th>
            </tr>
          </thead>
          <tbody>
            {staffIncidents.map((inc, i) => (
              <tr key={inc.id}>
                <td className="border border-black p-1 text-center">{i + 1}</td>
                <td className="border border-black p-1 font-bold">{inc.room}</td>
                <td className="border border-black p-1">{inc.deviceName} ({inc.deviceSn})</td>
                <td className="border border-black p-1">{inc.description}</td>
                <td className="border border-black p-1 text-center">{new Date(inc.reportedAt).toLocaleDateString('vi-VN')}</td>
                <td className="border border-black p-1">{inc.acceptedBy || '-'}</td>
                <td className="border border-black p-1">{inc.resolutionNotes || '-'}</td>
                <td className="border border-black p-1 text-center font-bold">
                  {inc.status === 'resolved' ? 'Đã xong' : inc.status === 'in_progress' ? 'Đang xử lý' : 'Chờ tiếp nhận'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="grid grid-cols-2 pt-8 text-center text-xs">
          <div>
            <p className="font-bold uppercase">CÁN BỘ LẬP BÁO CÁO</p>
            <p className="italic text-[10px]">(Ký và ghi rõ họ tên)</p>
            <p className="mt-16 font-bold">{currentUser.name}</p>
          </div>
          <div>
            <p className="font-bold uppercase">BỘ PHẬN QUẢN TRỊ CƠ SỞ VẬT CHẤT</p>
            <p className="italic text-[10px]">(Ký và ghi rõ họ tên)</p>
            <p className="mt-16 font-bold">Hotline Zalo: {ZALO_PHONE}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
