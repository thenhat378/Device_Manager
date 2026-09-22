import React, { useState, useEffect, useRef } from 'react';
import { 
  Bot, 
  X, 
  Send, 
  Sparkles, 
  AlertTriangle, 
  CheckCircle2, 
  Mic, 
  MicOff, 
  RotateCcw, 
  Maximize2, 
  Minimize2, 
  MessageSquare, 
  ChevronRight,
  SendHorizontal,
  Zap,
  HelpCircle,
  Phone
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { User, Device, IncidentReport } from '../types';
import { AcademicMarkdown } from './AcademicMarkdown';

interface ChatMessage {
  id: string;
  sender: 'bot' | 'user';
  text: string;
  timestamp: string;
  incidentDraft?: {
    room: string;
    deviceName: string;
    description: string;
    severity: 'low' | 'medium' | 'high' | 'urgent';
    deviceSn?: string;
  };
  incidentSubmitted?: boolean;
}

interface QuickChatbotProps {
  currentUser: User | null;
  devices: Device[];
  onAddIncident: (report: Omit<IncidentReport, 'id' | 'reportedAt' | 'status'>) => Promise<void>;
  isOpenExternal?: boolean;
  onCloseExternal?: () => void;
  onOpenTelegramConfig?: () => void;
}

const QUICK_PROMPTS = [
  { label: '🚨 Báo hỏng máy chiếu phòng học', prompt: 'Báo hỏng máy chiếu phòng học không lên nguồn' },
  { label: '🔌 Cáp HDMI không hiển thị hình', prompt: 'Dây cáp HDMI cắm laptop không nhận tín hiệu hình ảnh' },
  { label: '🎤 Micro giảng đường mất tiếng', prompt: 'Micro phòng học bị mất tiếng và chập chờn' },
  { label: '❄️ Điều hoà không mát', prompt: 'Điều hoà phòng học chạy nhưng không có hơi mát' },
  { label: '⚡ Kiểm tra thiết bị điện & quạt', prompt: 'Ổ cắm điện bàn giáo viên bị mất điện' }
];

export const QuickChatbot: React.FC<QuickChatbotProps> = ({
  currentUser,
  devices,
  onAddIncident,
  isOpenExternal,
  onCloseExternal,
  onOpenTelegramConfig
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // Sync external open state if provided
  useEffect(() => {
    if (typeof isOpenExternal === 'boolean') {
      setIsOpen(isOpenExternal);
    }
  }, [isOpenExternal]);

  // Initial welcome message
  useEffect(() => {
    if (currentUser && messages.length === 0) {
      setMessages([
        {
          id: 'welcome-1',
          sender: 'bot',
          text: `👋 Xin chào **${currentUser.name}**! Tôi là **Trợ lý Ảo CSVC DUE**.\n\nTôi sẵn sàng hỗ trợ bạn:\n• **Báo hỏng nhanh**: Gõ phòng và sự cố (ví dụ: *"Phòng D305 hỏng máy chiếu"*)\n• **Hướng dẫn xử lý**: Khắc phục lỗi cáp HDMI, âm thanh mic, remote điều hoà...\n• **Phát thông báo qua Bot Telegram**: Khi bạn xác nhận, sự cố sẽ chuyển ngay đến Kỹ thuật viên qua Bot Telegram **@hotrogiangday_bot**!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  }, [currentUser]);

  // Auto scroll to bottom of messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 200);
    }
  }, [isOpen]);

  // Client-side smart assistant logic to ensure zero downtime even if network hiccups
  const generateClientAssistantResponse = (userMsg: string) => {
    const lower = userMsg.toLowerCase();

    // Extract room name (e.g., D305, H102, A201, or matching known device rooms)
    const roomMatch = userMsg.match(/([a-zA-Z]\d{3}|phòng\s+[a-zA-Z0-9]+)/i);
    let detectedRoom = roomMatch ? roomMatch[0].toUpperCase() : '';
    if (detectedRoom && !detectedRoom.startsWith('PHÒNG')) {
      detectedRoom = `Phòng ${detectedRoom}`;
    }

    // Try matching with actual devices in inventory
    let detectedDevice = '';
    const foundDev = devices.find(d => 
      (detectedRoom && d.location?.room && detectedRoom.toLowerCase().includes(d.location.room.toLowerCase())) &&
      (lower.includes(d.name.toLowerCase()) || lower.includes(d.category.toLowerCase()))
    );

    if (foundDev) {
      detectedDevice = foundDev.name;
    } else if (lower.includes('máy chiếu') || lower.includes('projector')) {
      detectedDevice = 'Máy chiếu';
    } else if (lower.includes('hdmi')) {
      detectedDevice = 'Dây cáp HDMI';
    } else if (lower.includes('vga')) {
      detectedDevice = 'Dây VGA';
    } else if (lower.includes('mic') || lower.includes('micro')) {
      detectedDevice = 'Âm thanh (Micro giảng đường)';
    } else if (lower.includes('loa') || lower.includes('âm thanh') || lower.includes('amply')) {
      detectedDevice = 'Hệ thống Loa / Amply';
    } else if (lower.includes('điều hoà') || lower.includes('máy lạnh')) {
      detectedDevice = 'Điều hoà nhiệt độ';
    } else if (lower.includes('điện') || lower.includes('ổ cắm') || lower.includes('quạt')) {
      detectedDevice = 'Hệ thống Điện / Ổ cắm / Quạt';
    } else if (lower.includes('bàn') || lower.includes('ghế')) {
      detectedDevice = 'Cơ sở vật chất (Bàn ghế)';
    }

    const isReporting = lower.includes('hỏng') || lower.includes('hư') || lower.includes('lỗi') || 
                        lower.includes('không lên') || lower.includes('chập chờn') || lower.includes('báo sự cố') || 
                        lower.includes('báo hỏng') || lower.includes('sửa') || lower.includes('cháy');

    if (isReporting && (detectedRoom || detectedDevice)) {
      const targetRoom = detectedRoom || 'Phòng học';
      const targetDevice = detectedDevice || 'Thiết bị giảng đường';
      const severityLevel: 'urgent' | 'high' = lower.includes('cháy') || lower.includes('nổ') || lower.includes('khẩn') ? 'urgent' : 'high';
      return {
        reply: `Tôi đã nhận diện sự cố của bạn tại **${targetRoom}** đối với thiết bị **${targetDevice}**.\n\nBạn hãy kiểm tra thông tin đề xuất bên dưới và nhấn nút xác nhận để lưu phiếu và phát tin tức thì tới **Telegram Bot (@hotrogiangday_bot)** nhé!`,
        incidentDraft: {
          room: targetRoom,
          deviceName: targetDevice,
          description: userMsg,
          severity: severityLevel
        }
      };
    }

    if (lower.includes('hdmi') || lower.includes('không nhận cáp') || lower.includes('không lên hình') || lower.includes('máy chiếu')) {
      return {
        reply: `💡 **Hướng dẫn khắc phục nhanh Máy chiếu & Cáp HDMI:**\n\n1. **Kiểm tra nguồn**: Đảm bảo máy chiếu đã bật đèn xanh (Power LED).\n2. **Chọn Input**: Dùng remote hoặc nút bấm trên máy chiếu chọn đúng **HDMI 1** hoặc **HDMI 2**.\n3. **Phím tắt xuất hình**: Trên laptop nhấn tổ hợp phím **Windows + P** và chọn chế độ **Duplicate** (Nhân bản màn hình).\n4. **Cắm chặt 2 đầu cáp**: Rút cáp HDMI ra và cắm lại thật chặt ở cả cổng laptop và ổ cắm bàn giáo viên.\n\n*Nếu máy chiếu vẫn không hoạt động, bạn hãy gõ ví dụ: "Phòng D305 hỏng máy chiếu" để gửi thông báo tới Telegram Bot @hotrogiangday_bot ngay!*`
      };
    }

    if (lower.includes('micro') || lower.includes('mic') || lower.includes('âm thanh')) {
      return {
        reply: `🎤 **Hướng dẫn kiểm tra Micro / Âm thanh:**\n\n1. **Kiểm tra pin**: Bật công tắc micro, nếu đèn báo đỏ mờ hoặc không sáng, mic đã hết pin (liên hệ phòng bảo vệ hoặc phòng trực nhận pin mới).\n2. **Tần số thu phát**: Đảm bảo micro và bộ thu đặt cùng kênh tần số.\n3. **Volume Amply**: Kiểm tra núm vặn Master Volume trên bàn điều khiển amply của bục giảng.\n\n*Nếu cần kỹ thuật viên mang mic dự phòng tới ngay, bạn hãy bấm gửi báo hỏng tới Telegram Bot @hotrogiangday_bot nhé!*`
      };
    }

    if (lower.includes('điều hoà') || lower.includes('máy lạnh')) {
      return {
        reply: `❄️ **Hướng dẫn sử dụng Điều hoà:**\n\n1. Đảm bảo aptomat (cầu dao) điều hoà trên tường phòng học đã bật ON.\n2. Dùng remote điều khiển hướng thẳng vào mắt nhận của dàn lạnh, bấm nút Power và chọn chế độ **Cool** (hình bông tuyết), cài đặt 24 - 26°C.\n3. Đóng kín các cửa sổ và cửa ra vào phòng học.\n\n*Nếu điều hoà chảy nước hoặc không mát, bạn hãy báo sự cố để chuyển tới Telegram Bot @hotrogiangday_bot.*`
      };
    }

    return {
      reply: `Xin chào **${currentUser?.name || 'Thầy/Cô'}**! Tôi là **Trợ lý AI CSVC DUE**.\n\nTôi có thể hỗ trợ bạn:\n• **Báo hỏng siêu tốc**: Nhập số phòng và thiết bị (ví dụ: *"Phòng D305 hỏng máy chiếu"*)\n• **Khắc phục lỗi giảng đường**: Tư vấn kết nối HDMI, micro âm thanh, remote điều hoà...\n• **Phát thông báo Telegram Bot @hotrogiangday_bot**: Kết nối trực tiếp Kỹ thuật viên trực ban 24/7!\n\nBạn đang cần hỗ trợ vấn đề gì tại phòng học ạ?`
    };
  };

  const handleSendMessage = async (textToSend?: string) => {
    const query = (textToSend || inputText).trim();
    if (!query || loading) return;

    const userMsg: ChatMessage = {
      id: `msg-${Date.now()}`,
      sender: 'user',
      text: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputText('');
    setLoading(true);

    try {
      const knownRooms = Array.from(new Set(devices.map(d => d.location.room).filter(Boolean)));
      const knownDevices = Array.from(new Set(devices.map(d => d.name).filter(Boolean)));

      const historyPayload = messages.slice(-6).map(m => ({
        sender: m.sender,
        text: m.text
      }));

      // Set a client timeout of 7 seconds to keep chat fast and responsive
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 7000);

      const res = await fetch('/api/chat/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          message: query,
          history: historyPayload,
          currentUser: currentUser ? {
            name: currentUser.name,
            role: currentUser.role,
            department: currentUser.department
          } : null,
          knownRooms,
          knownDevices
        })
      });

      clearTimeout(timer);

      let data: any = null;
      if (res.ok) {
        const rawText = await res.text();
        try {
          data = JSON.parse(rawText);
        } catch {
          data = null;
        }
      }

      // If backend returned valid reply, use it; otherwise seamlessly use client assistant
      const finalReply = data?.reply ? data : generateClientAssistantResponse(query);

      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: finalReply.reply || 'Tôi đã nhận được thông tin. Bạn có cần hỗ trợ thêm vấn đề gì không?',
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        incidentDraft: finalReply.incidentDraft || undefined
      };

      setMessages(prev => [...prev, botMsg]);
    } catch {
      // Seamless client-side intelligent fallback - user never sees connection failure!
      const fallbackResult = generateClientAssistantResponse(query);
      const botMsg: ChatMessage = {
        id: `bot-${Date.now()}`,
        sender: 'bot',
        text: fallbackResult.reply,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        incidentDraft: fallbackResult.incidentDraft
      };
      setMessages(prev => [...prev, botMsg]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitDraftIncident = async (msgId: string, draft: NonNullable<ChatMessage['incidentDraft']>) => {
    try {
      setLoading(true);
      
      // Look up matching device
      const matchedDevice = devices.find(d => 
        (d.location?.room && draft.room.toLowerCase().includes(d.location.room.toLowerCase())) ||
        d.name.toLowerCase().includes(draft.deviceName.toLowerCase())
      );

      const deviceSn = matchedDevice?.serialNumber || `SN-AUTO-${Math.floor(1000 + Math.random() * 9000)}`;
      const deviceId = matchedDevice?.id || `TEMP-${Date.now()}`;
      const faculty = matchedDevice?.location?.faculty || currentUser?.department || 'Khu Giảng Đường';

      await onAddIncident({
        deviceId,
        deviceSn,
        deviceName: draft.deviceName,
        reporterName: currentUser?.name || 'Cán bộ phòng học',
        faculty,
        room: draft.room,
        severity: draft.severity || 'high',
        description: `[Báo nhanh qua Chatbot]: ${draft.description}`
      });

      // Mark this message as submitted
      setMessages(prev => prev.map(m => m.id === msgId ? { ...m, incidentSubmitted: true } : m));

      // Append confirmation bot message
      setMessages(prev => [
        ...prev,
        {
          id: `bot-confirm-${Date.now()}`,
          sender: 'bot',
          text: `🎉 **Đã phát tin thông báo sự cố thành công!**\n• Phòng: **${draft.room}**\n• Thiết bị: **${draft.deviceName}**\n• Trạng thái: **Đã lưu hệ thống & phát cảnh báo tới Telegram Bot (@hotrogiangday_bot)**.\n\nKỹ thuật viên phòng Cơ sở vật chất sẽ tiếp nhận và kiểm tra xử lý ngay!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    } catch (err: any) {
      alert(`Không thể gửi báo hỏng: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  // Voice Speech Recognition Setup
  const handleToggleVoice = () => {
    const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert('Trình duyệt hiện tại chưa hỗ trợ nhận diện giọng nói (Web Speech API). Bạn vui lòng dùng bàn phím để gõ tin nhắn.');
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

      recognition.onstart = () => {
        setIsListening(true);
      };

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputText(transcript);
          handleSendMessage(transcript);
        }
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognition.start();
    } catch (e) {
      setIsListening(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Bạn có chắc chắn muốn xóa lịch sử trò chuyện này?')) {
      setMessages([
        {
          id: 'welcome-new',
          sender: 'bot',
          text: `Cuộc trò chuyện đã được làm mới. Hãy gõ bất kỳ câu hỏi hoặc báo sự cố phòng học cho tôi nhé!`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        }
      ]);
    }
  };

  const handleClose = () => {
    setIsOpen(false);
    if (onCloseExternal) onCloseExternal();
  };

  return (
    <>
      {/* Floating Trigger Button */}
      <div className="fixed bottom-5 right-5 z-40">
        <AnimatePresence>
          {!isOpen && (
            <motion.button
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0, opacity: 0 }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsOpen(true)}
              id="open-chatbot-trigger-btn"
              className="relative flex items-center gap-2.5 rounded-full bg-gradient-to-r from-blue-600 via-indigo-600 to-blue-700 p-3 sm:px-4 sm:py-3 text-white shadow-xl shadow-blue-900/30 hover:shadow-blue-700/40 border border-white/20 transition group"
              title="Mở Trợ lý Chatbot CSVC DUE"
            >
              <div className="relative">
                <Bot className="h-6 w-6 text-white group-hover:rotate-12 transition-transform duration-300" />
                <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500 border border-white"></span>
                </span>
              </div>
              <div className="hidden sm:flex flex-col text-left pr-1">
                <span className="text-xs font-bold tracking-tight text-white leading-tight">Chatbot CSVC</span>
                <span className="text-[10px] text-blue-100 font-medium leading-none">Chát nhanh & Báo hỏng</span>
              </div>
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* Main Chatbot Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 30, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 30, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            id="chatbot-main-window"
            className={`fixed z-50 flex flex-col bg-white border border-slate-200 shadow-2xl rounded-2xl overflow-hidden transition-all duration-200 ${
              isExpanded
                ? 'inset-3 sm:inset-6 md:inset-10 lg:inset-20'
                : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[94vw] sm:w-[420px] h-[580px] max-h-[calc(100vh-32px)]'
            }`}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-slate-900 via-blue-950 to-indigo-950 text-white px-4 py-3.5 flex items-center justify-between shadow-md border-b border-white/10 shrink-0">
              <div className="flex items-center gap-3">
                <div className="relative flex items-center justify-center h-9 w-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-500 text-white shadow-md border border-white/20">
                  <Bot className="h-5 w-5" />
                  <span className="absolute -bottom-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 border border-slate-900"></span>
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <h3 className="text-xs sm:text-sm font-bold text-white leading-tight">Trợ Lý AI CSVC DUE</h3>
                    <span className="rounded bg-emerald-500/20 px-1.5 py-0.2 text-[9px] font-semibold text-emerald-300 border border-emerald-500/30">
                      Online
                    </span>
                  </div>
                  <p className="text-[10px] text-sky-200 font-medium">Hỗ trợ CSVC & Tiếp nhận qua Telegram Bot</p>
                </div>
              </div>

              <div className="flex items-center gap-1">
                <a
                  href="https://t.me/hotrogiangday_bot"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-lg px-2 py-1 bg-sky-600/90 hover:bg-sky-500 text-white transition flex items-center gap-1 text-[11px] font-medium shadow-xs"
                  title="Mở kênh Telegram Bot @hotrogiangday_bot"
                >
                  <Send className="h-3 w-3 text-sky-100" />
                  <span className="text-[10px]">Telegram: @hotrogiangday_bot</span>
                </a>
                <button
                  onClick={handleClearHistory}
                  className="rounded-lg p-1.5 text-blue-200 hover:text-white hover:bg-white/10 transition"
                  title="Xóa làm mới đoạn chat"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="rounded-lg p-1.5 text-blue-200 hover:text-white hover:bg-white/10 transition hidden sm:block"
                  title={isExpanded ? 'Thu nhỏ cửa sổ' : 'Phóng to cửa sổ'}
                >
                  {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </button>
                <button
                  onClick={handleClose}
                  className="rounded-lg p-1.5 text-blue-200 hover:text-white hover:bg-white/10 transition"
                  title="Đóng cửa sổ chat"
                  id="close-chatbot-btn"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>

            {/* Quick Action Suggestion Pills */}
            <div className="bg-slate-50 border-b border-slate-200/80 px-3 py-2 overflow-x-auto no-scrollbar flex items-center gap-1.5 shrink-0">
              <span className="text-[10px] font-bold text-slate-500 shrink-0 flex items-center gap-1">
                <Zap className="h-3 w-3 text-amber-500" /> Nhanh:
              </span>
              {QUICK_PROMPTS.map((qp, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleSendMessage(qp.prompt)}
                  disabled={loading}
                  className="rounded-full bg-white hover:bg-blue-50 text-slate-700 hover:text-blue-700 border border-slate-200 hover:border-blue-300 px-2.5 py-1 text-[11px] font-semibold whitespace-nowrap shadow-xs transition active:scale-95 disabled:opacity-50"
                >
                  {qp.label}
                </button>
              ))}
            </div>

            {/* Messages Feed */}
            <div className="flex-1 p-3 sm:p-4 overflow-y-auto space-y-3.5 bg-slate-50/50">
              {messages.map((msg) => {
                const isUser = msg.sender === 'user';
                return (
                  <div
                    key={msg.id}
                    className={`flex flex-col ${isUser ? 'items-end' : 'items-start'}`}
                  >
                    <div className={`flex gap-2 max-w-[88%] sm:max-w-[85%] ${isUser ? 'flex-row-reverse' : 'flex-row'}`}>
                      {!isUser && (
                        <div className="h-7 w-7 rounded-full bg-blue-600 text-white flex items-center justify-center shrink-0 text-xs shadow-xs mt-0.5">
                          <Bot className="h-4 w-4" />
                        </div>
                      )}

                      <div
                        className={`rounded-2xl px-3.5 py-2.5 text-xs sm:text-[13px] leading-relaxed shadow-xs ${
                          isUser
                            ? 'bg-blue-600 text-white rounded-tr-none'
                            : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-none'
                        }`}
                      >
                        <AcademicMarkdown content={msg.text} isUser={isUser} />
                        <div
                          className={`text-[9px] mt-1.5 text-right font-mono ${
                            isUser ? 'text-blue-100' : 'text-slate-400'
                          }`}
                        >
                          {msg.timestamp}
                        </div>

                        {/* Interactive Incident Card if Detected */}
                        {msg.incidentDraft && (
                          <div className="mt-3 pt-3 border-t border-slate-200/80 bg-rose-50/70 p-3 rounded-xl border border-rose-200 text-slate-800 space-y-2">
                            <div className="flex items-center justify-between gap-1">
                              <span className="text-[11px] font-bold text-rose-800 flex items-center gap-1.5">
                                <AlertTriangle className="h-3.5 w-3.5 text-rose-600 shrink-0" />
                                Phiếu Báo Hỏng Đề Xuất
                              </span>
                              <span className="rounded-md bg-rose-100 px-1.5 py-0.5 text-[9px] font-bold text-rose-700 uppercase">
                                {msg.incidentDraft.severity === 'urgent' ? 'Khẩn cấp' : 'Ưu tiên cao'}
                              </span>
                            </div>

                            <div className="text-[11px] space-y-1 bg-white p-2.5 rounded-lg border border-rose-150">
                              <div>🏢 <strong>Vị trí:</strong> {msg.incidentDraft.room}</div>
                              <div>📟 <strong>Thiết bị:</strong> {msg.incidentDraft.deviceName}</div>
                              <div>📝 <strong>Mô tả:</strong> {msg.incidentDraft.description}</div>
                            </div>

                            {msg.incidentSubmitted ? (
                              <div className="flex items-center gap-1.5 text-[11px] font-bold text-sky-700 bg-sky-100 p-2 rounded-lg">
                                <CheckCircle2 className="h-4 w-4 text-sky-600 shrink-0" />
                                Đã gửi báo cáo & phát thông báo tới Telegram Bot @hotrogiangday_bot!
                              </div>
                            ) : (
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => handleSubmitDraftIncident(msg.id, msg.incidentDraft!)}
                                  disabled={loading}
                                  className="w-full rounded-lg bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white py-2 px-2 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                  <Zap className="h-3.5 w-3.5" />
                                  Gửi Báo Hỏng Ngay
                                </button>
                                <a
                                  href="https://t.me/hotrogiangday_bot"
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="w-full rounded-lg bg-sky-600 hover:bg-sky-700 active:scale-98 text-white py-2 px-2 text-xs font-bold transition flex items-center justify-center gap-1.5 shadow-sm"
                                >
                                  <Send className="h-3.5 w-3.5" />
                                  Mở Telegram Bot
                                </a>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>

                    <span className="text-[9px] text-slate-400 mt-1 px-1">
                      {msg.timestamp}
                    </span>
                  </div>
                );
              })}

              {/* Bot typing loading indicator */}
              {loading && (
                <div className="flex items-center gap-2 text-slate-500 text-xs">
                  <div className="h-6 w-6 rounded-full bg-blue-600 text-white flex items-center justify-center text-xs">
                    <Bot className="h-3.5 w-3.5 animate-spin" />
                  </div>
                  <div className="bg-white border border-slate-200 px-3 py-2 rounded-2xl rounded-tl-none flex items-center gap-1 shadow-xs">
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-bounce"></span>
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:0.2s]"></span>
                    <span className="h-1.5 w-1.5 rounded-full bg-blue-600 animate-bounce [animation-delay:0.4s]"></span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input Form Bar */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="p-3 bg-white border-t border-slate-200 flex items-center gap-2 shrink-0"
            >
              {/* Voice recognition button */}
              <button
                type="button"
                onClick={handleToggleVoice}
                className={`p-2 rounded-xl border transition ${
                  isListening
                    ? 'bg-rose-100 text-rose-600 border-rose-300 animate-pulse'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200 border-slate-200'
                }`}
                title={isListening ? 'Đang lắng nghe giọng nói...' : 'Nói qua microphone (Nhận diện giọng nói tiếng Việt)'}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>

              <input
                ref={inputRef}
                type="text"
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="Hỏi đáp hoặc gõ: 'D305 hỏng máy chiếu'..."
                disabled={loading}
                className="flex-1 rounded-xl border border-slate-300 px-3.5 py-2.5 text-xs sm:text-sm bg-slate-50 text-slate-900 focus:bg-white focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 transition shadow-inner"
              />

              <button
                type="submit"
                disabled={!inputText.trim() || loading}
                id="chatbot-send-btn"
                className="rounded-xl bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white p-2.5 text-xs font-bold transition flex items-center justify-center shadow-sm active:scale-95 shrink-0"
                title="Gửi tin nhắn"
              >
                <SendHorizontal className="h-4 w-4" />
              </button>
            </form>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};
