import React, { useState, useEffect } from 'react';
import { Send, Bot, CheckCircle2, AlertCircle, RefreshCw, X, ExternalLink, MessageSquare, Check, Radio, Globe, Zap } from 'lucide-react';
import { doc, setDoc } from 'firebase/firestore';
import { db } from '../lib/firebase.ts';

const DEFAULT_BOT_TOKEN = '8611136413:AAHYvr_pXyA6sjC-2SlVI0WPUcqq5K8S5iI';
const BOT_USERNAME = 'hotrogiangday_bot';

interface TelegramConfigModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentChatId: string;
  currentBotToken: string;
  onSaved: (chatId: string, botToken: string) => void;
}

export const TelegramConfigModal: React.FC<TelegramConfigModalProps> = ({
  isOpen,
  onClose,
  currentChatId,
  currentBotToken,
  onSaved
}) => {
  const [botToken, setBotToken] = useState(currentBotToken || DEFAULT_BOT_TOKEN);
  const [chatId, setChatId] = useState(currentChatId || '');
  const [scanning, setScanning] = useState(false);
  const [testing, setTesting] = useState(false);
  const [settingWebhook, setSettingWebhook] = useState(false);
  const [resettingWebhook, setResettingWebhook] = useState(false);
  const [webhookInfo, setWebhookInfo] = useState<any>(null);
  const [detectedChats, setDetectedChats] = useState<Array<{ id: string; name: string; type: string; username?: string }>>([]);
  const [statusMessage, setStatusMessage] = useState<{ type: 'success' | 'error' | 'info'; text: string } | null>(null);

  useEffect(() => {
    if (isOpen) {
      setChatId(currentChatId || localStorage.getItem('DUE_TELEGRAM_CHAT_ID') || '');
      setBotToken(currentBotToken || localStorage.getItem('DUE_TELEGRAM_BOT_TOKEN') || DEFAULT_BOT_TOKEN);
      setStatusMessage(null);
      fetchWebhookInfo();
    }
  }, [isOpen, currentChatId, currentBotToken]);

  const fetchWebhookInfo = async () => {
    try {
      const res = await fetch('/api/telegram/webhook-info');
      const data = await res.json();
      if (res.ok && data.info) {
        setWebhookInfo(data.info);
      }
    } catch (e) {}
  };

  if (!isOpen) return null;

  const handleSetWebhook = async () => {
    setSettingWebhook(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/telegram/set-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: botToken.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({
          type: 'success',
          text: `🎉 Đã kích hoạt Webhook thành công (${data.webhookUrl})! Bot @${BOT_USERNAME} hiện đã sẵn sàng nhận tin nhắn và nút bấm tương tác 2 chiều.`
        });
        fetchWebhookInfo();
      } else {
        setStatusMessage({
          type: 'error',
          text: `Lỗi kích hoạt Webhook: ${data.error || 'Không thể thiết lập'}`
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Lỗi kết nối máy chủ: ${err.message}`
      });
    } finally {
      setSettingWebhook(false);
    }
  };

  const handleScanChats = async () => {
    if (!botToken.trim()) {
      setStatusMessage({ type: 'error', text: 'Vui lòng điền Bot Token trước khi quét.' });
      return;
    }

    setScanning(true);
    setStatusMessage(null);
    setDetectedChats([]);

    try {
      const res = await fetch('/api/telegram/get-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: botToken.trim() })
      });

      const data = await res.json();

      if (res.ok && data.chats && data.chats.length > 0) {
        setDetectedChats(data.chats);
        setStatusMessage({
          type: 'success',
          text: `Đã tìm thấy ${data.chats.length} cuộc trò chuyện/nhóm gần đây! Hãy bấm vào một mục bên dưới để áp dụng.`
        });
      } else {
        setStatusMessage({
          type: 'info',
          text: `Chưa thấy tin nhắn mới từ bạn. Hãy mở Telegram, tìm bot @${BOT_USERNAME} rồi bấm START (hoặc gửi tin nhắn bất kỳ), sau đó bấm "Quét Lại"!`
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Lỗi kết nối máy chủ Telegram: ${err.message}`
      });
    } finally {
      setScanning(false);
    }
  };

  const handleSelectChat = async (selectedId: string) => {
    setChatId(selectedId);
    await handleSave(selectedId);
  };

  const handleSave = async (idToSave?: string) => {
    const targetChatId = (idToSave || chatId).trim();
    const targetToken = botToken.trim();

    if (!targetChatId) {
      setStatusMessage({ type: 'error', text: 'Vui lòng nhập hoặc chọn Chat ID.' });
      return;
    }

    try {
      // 1. Save to Firestore for all users
      await setDoc(doc(db, 'settings', 'app_config'), {
        telegramBotToken: targetToken,
        telegramChatId: targetChatId,
        updatedAt: new Date().toISOString()
      }, { merge: true });

      // 2. Save to local storage
      localStorage.setItem('DUE_TELEGRAM_BOT_TOKEN', targetToken);
      localStorage.setItem('DUE_TELEGRAM_CHAT_ID', targetChatId);

      onSaved(targetChatId, targetToken);

      setStatusMessage({
        type: 'success',
        text: `✅ Đã lưu Chat ID [${targetChatId}] thành công! Tất cả báo cáo sự cố từ giảng đường sẽ được phát tức thì tới Telegram bot @${BOT_USERNAME}.`
      });
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Không thể lưu vào Firestore: ${err.message}`
      });
    }
  };

  const handleSendTest = async () => {
    const targetChatId = chatId.trim();
    if (!targetChatId) {
      setStatusMessage({ type: 'error', text: 'Chưa có Chat ID để gửi thử nghiệm!' });
      return;
    }

    setTesting(true);
    setStatusMessage(null);

    try {
      const res = await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token: botToken.trim(),
          chatId: targetChatId,
          incident: {
            id: `TEST-${Date.now().toString().slice(-4)}`,
            room: 'Phòng D305',
            deviceName: 'Máy chiếu giảng đường & Cáp HDMI',
            deviceSn: 'SN-TEST-DUE',
            reporterName: 'Thử nghiệm hệ thống',
            description: 'Kiểm tra thông báo sự cố kèm nút bấm tương tác [Tiếp nhận] & [Khắc phục xong].'
          },
          eventType: 'new'
        })
      });

      const data = await res.json();
      if (res.ok) {
        setStatusMessage({
          type: 'success',
          text: `🎉 Gửi thử thành công! Mở Telegram để kiểm tra tin nhắn và các nút bấm tương tác vừa nhận được từ bot @${BOT_USERNAME}.`
        });
      } else {
        setStatusMessage({
          type: 'error',
          text: `Lỗi Telegram: ${data.error || 'Không gửi được tin nhắn'}`
        });
      }
    } catch (err: any) {
      setStatusMessage({
        type: 'error',
        text: `Lỗi kết nối: ${err.message}`
      });
    } finally {
      setTesting(false);
    }
  };

  const handleResetWebhook = async () => {
    setResettingWebhook(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/telegram/reset-webhook', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: botToken.trim() })
      });
      const data = await res.json();
      if (res.ok) {
        setStatusMessage({
          type: 'success',
          text: 'Đã giải phóng kết nối Telegram Bot. Bây giờ bạn có thể quét Chat ID hoặc cài đặt lại Webhook!'
        });
        fetchWebhookInfo();
      } else {
        setStatusMessage({ type: 'error', text: data.error || 'Lỗi khi reset bot' });
      }
    } catch (err: any) {
      setStatusMessage({ type: 'error', text: err.message });
    } finally {
      setResettingWebhook(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl border border-slate-200 overflow-hidden flex flex-col max-h-[92vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-sky-600 via-sky-700 to-indigo-700 px-6 py-4 text-white flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/20 flex items-center justify-center backdrop-blur-xs shadow-inner">
              <Bot className="w-6 h-6 text-white" />
            </div>
            <div>
              <h3 className="font-bold text-base flex items-center gap-2">
                Cấu Hình Telegram Bot (@{BOT_USERNAME})
                <span className="text-[10px] uppercase font-semibold tracking-wider bg-sky-400/30 text-sky-100 px-2 py-0.5 rounded-full border border-sky-300/30">
                  Webhook 2 Chiều
                </span>
              </h3>
              <p className="text-xs text-sky-100">Hỗ trợ giảng dạy, xử lý sự cố & tiếp nhận trực tiếp qua Telegram</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-white/80 hover:text-white hover:bg-white/10 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs text-slate-600">
          {/* Status Indicator */}
          <div className={`p-3.5 rounded-xl border flex items-start gap-3 ${
            chatId 
              ? 'bg-emerald-50/80 border-emerald-200 text-emerald-900' 
              : 'bg-amber-50/80 border-amber-200 text-amber-900'
          }`}>
            {chatId ? (
              <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0 mt-0.5" />
            ) : (
              <AlertCircle className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            )}
            <div className="flex-1">
              <div className="font-bold text-[13px] flex items-center justify-between">
                <span>{chatId ? `Đang kết nối: Chat ID ${chatId}` : 'Chưa cấu hình Chat ID Telegram!'}</span>
                {webhookInfo?.url && (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-full font-semibold">
                    Webhook Hoạt Động
                  </span>
                )}
              </div>
              <p className="text-[11px] mt-0.5 opacity-90">
                {chatId 
                  ? `Hệ thống đã kết nối với bot @${BOT_USERNAME}. Khi có sự cố mới từ giảng đường, thông báo sẽ gửi kèm nút [Tiếp Nhận] và [Xử Lý Xong].` 
                  : 'Nếu chưa có Chat ID, hãy bấm START với bot hoặc quét Chat ID tự động để kết nối.'}
              </p>
            </div>
          </div>

          {/* Webhook Controller Card */}
          <div className="bg-slate-900 text-slate-200 p-4 rounded-xl border border-slate-800 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Globe className="w-4 h-4 text-sky-400" />
                <span className="font-bold text-white text-xs">Cơ Chế Webhook 2 Chiều</span>
              </div>
              {webhookInfo?.url ? (
                <span className="text-[10px] bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-md font-mono">
                  URL: /api/telegram/webhook
                </span>
              ) : (
                <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md">
                  Chưa cài đặt Webhook
                </span>
              )}
            </div>
            <p className="text-[11px] text-slate-400 leading-relaxed">
              Webhook cho phép bot <b>@{BOT_USERNAME}</b> tự động nhận lệnh báo hỏng trực tiếp từ tin nhắn của Giảng viên và xử lý nút bấm <i>[Tiếp nhận / Hoàn tất]</i> tức thì.
            </p>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleSetWebhook}
                disabled={settingWebhook}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-sky-500 hover:bg-sky-400 text-slate-950 font-bold text-xs transition disabled:opacity-50"
              >
                <Zap className={`w-3.5 h-3.5 ${settingWebhook ? 'animate-spin' : ''}`} />
                {settingWebhook ? 'Đang kích hoạt...' : '⚡ Kích Hoạt Webhook Tự Động'}
              </button>

              <button
                type="button"
                onClick={handleResetWebhook}
                disabled={resettingWebhook}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 font-medium text-xs transition border border-slate-700"
              >
                <RefreshCw className={`w-3 h-3 ${resettingWebhook ? 'animate-spin text-sky-400' : ''}`} />
                Reset Webhook
              </button>
            </div>
          </div>

          {/* Quick Setup Guide */}
          <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
            <h4 className="font-bold text-slate-800 text-[12px] flex items-center gap-1.5">
              <Radio className="w-4 h-4 text-sky-600" />
              Cách kích hoạt nhận thông báo Telegram (2 bước siêu tốc):
            </h4>
            
            <div className="space-y-2">
              <div className="flex items-start gap-2.5">
                <span className="w-5 h-5 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">1</span>
                <div className="flex-1">
                  <span className="font-semibold text-slate-700">Mở Bot Telegram & Bấm Start:</span>
                  <div className="mt-1 flex items-center gap-2">
                    <a 
                      href={`https://t.me/${BOT_USERNAME}`} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-sky-600 hover:bg-sky-700 text-white font-semibold text-[11px] shadow-xs transition"
                    >
                      <ExternalLink className="w-3.5 h-3.5" />
                      Mở bot @{BOT_USERNAME} trên Telegram
                    </a>
                    <span className="text-[11px] text-slate-500">(hoặc thêm bot vào nhóm kỹ thuật của bạn)</span>
                  </div>
                </div>
              </div>

              <div className="flex items-start gap-2.5 pt-1">
                <span className="w-5 h-5 rounded-full bg-sky-600 text-white font-bold flex items-center justify-center text-[10px] shrink-0 mt-0.5">2</span>
                <div className="flex-1">
                  <span className="font-semibold text-slate-700">Quét tự động hoặc dán Chat ID:</span>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Sau khi đã gửi tin nhắn bất kỳ cho bot, nhấn nút <b>"Quét Chat ID Tự Động"</b> bên dưới để hệ thống nhận diện tức thì.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Action: Scan & Auto Detect */}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleScanChats}
              disabled={scanning}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-sky-600 hover:bg-sky-700 text-white font-bold transition shadow-xs disabled:bg-slate-300"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${scanning ? 'animate-spin' : ''}`} />
              {scanning ? 'Đang dò tin nhắn...' : '🔍 Quét Chat ID Tự Động'}
            </button>
          </div>

          {/* Detected Chats List */}
          {detectedChats.length > 0 && (
            <div className="space-y-1.5 p-3 bg-sky-50/70 border border-sky-200 rounded-xl">
              <div className="font-bold text-sky-900 text-[11px]">Chọn tài khoản / nhóm muốn nhận thông báo:</div>
              <div className="space-y-1 max-h-36 overflow-y-auto">
                {detectedChats.map(c => (
                  <div 
                    key={c.id} 
                    className="flex items-center justify-between p-2 rounded-lg bg-white border border-sky-100 hover:border-sky-300 transition shadow-2xs"
                  >
                    <div>
                      <span className="font-bold text-slate-800 text-[11px]">{c.name}</span>
                      <span className="text-[10px] text-slate-400 ml-2">ID: <code className="font-mono text-sky-700">{c.id}</code></span>
                      <span className="text-[9px] bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded ml-1.5 uppercase font-medium">{c.type}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => handleSelectChat(c.id)}
                      className="px-2.5 py-1 rounded-md bg-sky-600 hover:bg-sky-700 text-white font-bold text-[10px] transition flex items-center gap-1"
                    >
                      <Check className="w-3 h-3" />
                      Chọn & Lưu
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Manual Input Form */}
          <div className="space-y-3 pt-2 border-t border-slate-200">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Telegram Chat ID / Group ID:</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  value={chatId}
                  onChange={(e) => setChatId(e.target.value)}
                  placeholder="Ví dụ: 12345678 (cá nhân) hoặc -1001234567890 (nhóm)"
                  className="flex-1 px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono focus:outline-none focus:border-sky-500 bg-white"
                />
                <button
                  type="button"
                  onClick={() => handleSave()}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white font-bold transition shadow-xs"
                >
                  Lưu Cấu Hình
                </button>
              </div>
              <span className="text-[10px] text-slate-400 mt-1 block">
                💡 Mẹo: Bạn có thể chat với bot <b>@userinfobot</b> trên Telegram để xem nhanh Chat ID của mình.
              </span>
            </div>

            <div>
              <label className="block font-bold text-slate-700 mb-1">Bot Token (Mặc định @{BOT_USERNAME}):</label>
              <input
                type="text"
                value={botToken}
                onChange={(e) => setBotToken(e.target.value)}
                className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 font-mono text-slate-600 focus:outline-none focus:border-sky-500 bg-slate-50"
              />
            </div>
          </div>

          {/* Status feedback message */}
          {statusMessage && (
            <div className={`p-3 rounded-xl text-[11px] font-medium border flex items-start gap-2 ${
              statusMessage.type === 'success' ? 'bg-emerald-50 border-emerald-200 text-emerald-800' :
              statusMessage.type === 'error' ? 'bg-rose-50 border-rose-200 text-rose-800' :
              'bg-sky-50 border-sky-200 text-sky-800'
            }`}>
              {statusMessage.type === 'success' ? <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" /> :
               statusMessage.type === 'error' ? <AlertCircle className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" /> :
               <MessageSquare className="w-4 h-4 text-sky-600 shrink-0 mt-0.5" />}
              <span>{statusMessage.text}</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3.5 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <button
            type="button"
            onClick={handleSendTest}
            disabled={testing || !chatId.trim()}
            className="px-4 py-2 rounded-xl bg-sky-600 hover:bg-sky-700 disabled:bg-slate-300 disabled:cursor-not-allowed text-white font-bold text-xs transition flex items-center gap-1.5 shadow-xs"
          >
            <Send className="w-3.5 h-3.5" />
            {testing ? 'Đang gửi thử...' : '🚀 Bắn Tin Nhắn Kiểm Tra'}
          </button>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl border border-slate-300 bg-white hover:bg-slate-100 text-slate-700 font-semibold text-xs transition"
          >
            Đóng
          </button>
        </div>
      </div>
    </div>
  );
};
