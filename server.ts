import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { eq, desc, inArray } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, collection, getDocs, query, where, getDoc, setDoc } from 'firebase/firestore';
import fs from 'fs';
import { 
  Device, 
  InspectionRecord, 
  PartReplacementRecord, 
  IncidentReport, 
  DeviceTransferRecord,
  DeviceStatus
} from './src/types.ts';
import { INITIAL_DEVICES } from './src/data/mockData.ts';
import { db } from './src/db/index.ts';
import { 
  devices, 
  inspections, 
  replacements, 
  incidents, 
  transfers
} from './src/db/schema.ts';

// Initialize Firestore on Server-side
let dbFirestore: any = null;
try {
  const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
  const appFirestore = initializeApp(firebaseConfig);
  dbFirestore = getFirestore(appFirestore, firebaseConfig.firestoreDatabaseId);
  console.log("Initialized Firestore on server successfully.");
} catch (err) {
  console.error("Failed to initialize Firestore on server:", err);
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // --- API ENDPOINTS ---

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', serverTime: new Date().toISOString() });
  });

  // Devices CRUD
  app.get('/api/devices', async (req, res) => {
    try {
      const dbDevices = await db.select().from(devices);
      const mappedDevices = dbDevices.map(d => ({
        id: d.id,
        serialNumber: d.serialNumber,
        name: d.name,
        category: d.category,
        location: {
          faculty: d.faculty,
          lectureHall: d.lectureHall,
          room: d.room,
        },
        status: d.status as DeviceStatus,
        purchaseDate: d.purchaseDate,
        warrantyUntil: d.warrantyUntil,
        supplier: d.supplier,
        nextMaintenanceDate: d.nextMaintenanceDate || undefined,
        notes: d.notes || undefined,
        createdAt: d.createdAt,
        updatedAt: d.updatedAt,
      }));
      res.json(mappedDevices);
    } catch (err) {
      console.error('Error fetching devices:', err);
      res.status(500).json({ error: 'Database error fetching devices' });
    }
  });

  app.post('/api/devices', async (req, res) => {
    try {
      const { id, serialNumber, name, category, location, status, purchaseDate, warrantyUntil, supplier, nextMaintenanceDate, notes, createdAt } = req.body;
      const newDevice: Device = {
        id: id || 'dev-' + Date.now(),
        serialNumber,
        name,
        category,
        location,
        status: status || 'active',
        purchaseDate,
        warrantyUntil,
        supplier,
        nextMaintenanceDate,
        notes,
        createdAt: createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };

      await db.insert(devices).values({
        id: newDevice.id,
        serialNumber: newDevice.serialNumber,
        name: newDevice.name,
        category: newDevice.category,
        faculty: newDevice.location.faculty,
        lectureHall: newDevice.location.lectureHall,
        room: newDevice.location.room,
        status: newDevice.status,
        purchaseDate: newDevice.purchaseDate,
        warrantyUntil: newDevice.warrantyUntil,
        supplier: newDevice.supplier,
        nextMaintenanceDate: newDevice.nextMaintenanceDate || null,
        notes: newDevice.notes || null,
        createdAt: newDevice.createdAt,
        updatedAt: newDevice.updatedAt
      });
      
      // Trigger n8n event

      res.status(201).json(newDevice);
    } catch (err) {
      console.error('Error creating device:', err);
      res.status(500).json({ error: 'Database error creating device' });
    }
  });

  app.put('/api/devices/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { serialNumber, name, category, location, status, purchaseDate, warrantyUntil, supplier, nextMaintenanceDate, notes } = req.body;
      
      const existing = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Không tìm thấy thiết bị' });
      }

      const updatedAt = new Date().toISOString();
      await db.update(devices).set({
        serialNumber: serialNumber !== undefined ? serialNumber : existing[0].serialNumber,
        name: name !== undefined ? name : existing[0].name,
        category: category !== undefined ? category : existing[0].category,
        faculty: location?.faculty !== undefined ? location.faculty : existing[0].faculty,
        lectureHall: location?.lectureHall !== undefined ? location.lectureHall : existing[0].lectureHall,
        room: location?.room !== undefined ? location.room : existing[0].room,
        status: status !== undefined ? status : existing[0].status,
        purchaseDate: purchaseDate !== undefined ? purchaseDate : existing[0].purchaseDate,
        warrantyUntil: warrantyUntil !== undefined ? warrantyUntil : existing[0].warrantyUntil,
        supplier: supplier !== undefined ? supplier : existing[0].supplier,
        nextMaintenanceDate: nextMaintenanceDate !== undefined ? nextMaintenanceDate : existing[0].nextMaintenanceDate,
        notes: notes !== undefined ? notes : existing[0].notes,
        updatedAt
      }).where(eq(devices.id, id));

      const updatedDevice: Device = {
        id,
        serialNumber: serialNumber ?? existing[0].serialNumber,
        name: name ?? existing[0].name,
        category: category ?? existing[0].category,
        location: {
          faculty: location?.faculty ?? existing[0].faculty,
          lectureHall: location?.lectureHall ?? existing[0].lectureHall,
          room: location?.room ?? existing[0].room,
        },
        status: (status ?? existing[0].status) as DeviceStatus,
        purchaseDate: purchaseDate ?? existing[0].purchaseDate,
        warrantyUntil: warrantyUntil ?? existing[0].warrantyUntil,
        supplier: supplier ?? existing[0].supplier,
        nextMaintenanceDate: nextMaintenanceDate ?? existing[0].nextMaintenanceDate ?? undefined,
        notes: notes ?? existing[0].notes ?? undefined,
        createdAt: existing[0].createdAt,
        updatedAt
      };

      res.json(updatedDevice);
    } catch (err) {
      console.error('Error updating device:', err);
      res.status(500).json({ error: 'Database error updating device' });
    }
  });

  app.delete('/api/devices/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const existing = await db.select().from(devices).where(eq(devices.id, id)).limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Không tìm thấy thiết bị' });
      }

      await db.delete(devices).where(eq(devices.id, id));

      res.json({ success: true });
    } catch (err) {
      console.error('Error deleting device:', err);
      res.status(500).json({ error: 'Database error deleting device' });
    }
  });

  app.post('/api/devices/bulk-delete', async (req, res) => {
    try {
      const { ids } = req.body;
      if (!Array.isArray(ids) || ids.length === 0) {
        return res.status(400).json({ error: 'Danh sách ID thiết bị không hợp lệ' });
      }

      await db.delete(devices).where(inArray(devices.id, ids));

      res.json({ success: true, count: ids.length });
    } catch (err) {
      console.error('Error bulk deleting devices:', err);
      res.status(500).json({ error: 'Database error bulk deleting devices' });
    }
  });

  // Inspections CRUD
  app.get('/api/inspections', async (req, res) => {
    try {
      const dbInspections = await db.select().from(inspections);
      res.json(dbInspections);
    } catch (err) {
      console.error('Error fetching inspections:', err);
      res.status(500).json({ error: 'Database error fetching inspections' });
    }
  });

  app.post('/api/inspections', async (req, res) => {
    try {
      const record: InspectionRecord = {
        id: 'insp-' + Date.now(),
        ...req.body
      };

      await db.insert(inspections).values({
        id: record.id,
        deviceId: record.deviceId,
        deviceSn: record.deviceSn,
        deviceName: record.deviceName,
        inspectorName: record.inspectorName,
        inspectionDate: record.inspectionDate,
        result: record.result,
        checkPower: record.checkPower,
        checkDisplayAudio: record.checkDisplayAudio,
        checkConnections: record.checkConnections,
        checkCleaningFan: record.checkCleaningFan,
        notes: record.notes,
        actionRequired: record.actionRequired || null
      });

      // Auto-update device status if inspection result is warning/failed
      let targetStatus: DeviceStatus | null = null;
      if (record.result === 'warning') {
        targetStatus = 'maintenance_needed';
      } else if (record.result === 'failed') {
        targetStatus = 'damaged';
      } else if (record.result === 'passed') {
        targetStatus = 'active';
      }

      if (targetStatus) {
        await db.update(devices).set({
          status: targetStatus,
          updatedAt: new Date().toISOString()
        }).where(eq(devices.id, record.deviceId));
      }

      res.status(201).json(record);
    } catch (err) {
      console.error('Error creating inspection:', err);
      res.status(500).json({ error: 'Database error creating inspection' });
    }
  });

  // Replacements CRUD
  app.get('/api/replacements', async (req, res) => {
    try {
      const dbReplacements = await db.select().from(replacements);
      res.json(dbReplacements);
    } catch (err) {
      console.error('Error fetching replacements:', err);
      res.status(500).json({ error: 'Database error fetching replacements' });
    }
  });

  app.post('/api/replacements', async (req, res) => {
    try {
      const record: PartReplacementRecord = {
        id: 'part-' + Date.now(),
        ...req.body
      };

      await db.insert(replacements).values({
        id: record.id,
        deviceId: record.deviceId,
        deviceSn: record.deviceSn,
        deviceName: record.deviceName,
        partName: record.partName,
        partCondition: record.partCondition,
        cost: record.cost,
        quantity: record.quantity,
        replacedBy: record.replacedBy,
        replacementDate: record.replacementDate,
        reason: record.reason,
        warrantyMonths: record.warrantyMonths
      });

      // If replacement completed, mark device active
      await db.update(devices).set({
        status: 'active',
        updatedAt: new Date().toISOString()
      }).where(eq(devices.id, record.deviceId));

      res.status(201).json(record);
    } catch (err) {
      console.error('Error creating replacement:', err);
      res.status(500).json({ error: 'Database error creating replacement' });
    }
  });

  // Incidents CRUD
  app.get('/api/incidents', async (req, res) => {
    try {
      const dbIncidents = await db.select().from(incidents);
      res.json(dbIncidents);
    } catch (err) {
      console.error('Error fetching incidents:', err);
      res.status(500).json({ error: 'Database error fetching incidents' });
    }
  });

  app.post('/api/incidents', async (req, res) => {
    try {
      const report: IncidentReport = {
        id: 'inc-' + Date.now(),
        reportedAt: new Date().toISOString(),
        status: 'open',
        ...req.body
      };

      await db.insert(incidents).values({
        id: report.id,
        deviceId: report.deviceId,
        deviceSn: report.deviceSn,
        deviceName: report.deviceName,
        reporterName: report.reporterName,
        faculty: report.faculty,
        room: report.room,
        severity: report.severity,
        status: report.status,
        description: report.description,
        reportedAt: report.reportedAt
      });

      // Update device status to damaged
      await db.update(devices).set({
        status: 'damaged',
        updatedAt: new Date().toISOString()
      }).where(eq(devices.id, report.deviceId));

      // Device status updated to damaged
      res.status(201).json(report);
    } catch (err) {
      console.error('Error creating incident:', err);
      res.status(500).json({ error: 'Database error creating incident' });
    }
  });

  async function getAiAnalysis(deviceName: string, room: string, description: string): Promise<string> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      console.warn("GEMINI_API_KEY is not defined, using fallback AI diagnostics.");
      return `nguyen_nhan_du_kien: "Chưa thể chẩn đoán tự động (Thiếu API Key)"
muc_do_anh_huong: "Cần kỹ thuật viên kiểm tra trực tiếp"
huong_su_ly: "Đến vị trí kiểm tra tình trạng kết nối và nguồn điện của thiết bị"
thoi_gian_uoc_tinh: "Chưa xác định"
do_khan_cap: "Cần đánh giá tại hiện trường"`;
    }

    try {
      const aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          }
        }
      });

      const prompt = `Hãy đóng vai trò là một kỹ thuật viên IT và cơ sở vật chất giàu kinh nghiệm tại Trường Đại học Kinh tế - Đại học Đà Nẵng (DUE). Hãy phân tích báo cáo sự cố sau đây và đưa ra chẩn đoán sơ bộ dưới định dạng YAML đơn giản.
Thiết bị: ${deviceName}
Vị trí: ${room}
Mô tả sự cố từ người dùng: ${description}

Hãy trả về kết quả dưới định dạng YAML với các trường cụ thể (dùng tiếng Việt có dấu):
- nguyen_nhan_du_kien (Nguyên nhân dự kiến)
- muc_do_anh_huong (Mức độ ảnh hưởng)
- huong_su_ly (Hướng xử lý đề xuất cho kỹ thuật viên)
- thoi_gian_uoc_tinh (Thời gian ước tính khắc phục, ví dụ: 30 phút, 1 ngày, v.v.)
- do_khan_cap (Độ khẩn cấp: Thấp/Trung bình/Cao/Khẩn cấp)

Không cần viết bất kỳ phần giải thích nào khác ngoài chuỗi YAML đó. Không cần bọc trong markdown code block, chỉ trả về chuỗi YAML thô.`;

      const response = await aiClient.models.generateContent({
        model: "gemini-3.6-flash",
        contents: prompt,
      });

      let text = response.text || "";
      // Clean up any markdown code blocks if the model wrapped it
      text = text.replace(/```yaml/g, '').replace(/```/g, '').trim();
      return text;
    } catch (err: any) {
      console.error("Error generating AI analysis:", err);
      return `nguyen_nhan_du_kien: "Lỗi kết nối với hệ thống trí tuệ nhân tạo Gemini (${err.message || 'Unknown error'})"
muc_do_anh_huong: "Cần kỹ thuật viên kiểm tra thủ công"
huong_su_ly: "Tiến hành khảo sát trực tiếp tại phòng học để ghi nhận lỗi"
thoi_gian_uoc_tinh: "Không khả dụng"
do_khan_cap: "Chưa xác định"`;
    }
  }





  const DEFAULT_TELEGRAM_BOT_TOKEN = '8611136413:AAHYvr_pXyA6sjC-2SlVI0WPUcqq5K8S5iI';
  const DEFAULT_TELEGRAM_BOT_USERNAME = 'hotrogiangday_bot';

  // Helper to read and auto-migrate Telegram configuration from Firestore database
  async function getTelegramConfigFromDb(): Promise<{ telegramBotToken?: string; telegramChatId?: string; telegramGroupName?: string } | null> {
    try {
      if (dbFirestore) {
        const docSnap = await getDoc(doc(dbFirestore, 'settings', 'app_config'));
        if (docSnap.exists()) {
          const data = docSnap.data() as any;
          // Auto-fix old expired/revoked token 8715568190...
          if (data && (!data.telegramBotToken || data.telegramBotToken.includes('8715568190') || data.telegramBotToken !== DEFAULT_TELEGRAM_BOT_TOKEN)) {
            await setDoc(doc(dbFirestore, 'settings', 'app_config'), {
              telegramBotToken: DEFAULT_TELEGRAM_BOT_TOKEN,
              updatedAt: new Date().toISOString()
            }, { merge: true });
            data.telegramBotToken = DEFAULT_TELEGRAM_BOT_TOKEN;
          }
          return data;
        } else {
          // Initialize if not exists
          await setDoc(doc(dbFirestore, 'settings', 'app_config'), {
            telegramBotToken: DEFAULT_TELEGRAM_BOT_TOKEN,
            updatedAt: new Date().toISOString()
          }, { merge: true });
          return { telegramBotToken: DEFAULT_TELEGRAM_BOT_TOKEN };
        }
      }
    } catch (e: any) {
      console.warn('Could not read settings/app_config from Firestore:', e.message);
    }
    return { telegramBotToken: DEFAULT_TELEGRAM_BOT_TOKEN };
  }

  // Get current global Telegram config
  app.get('/api/telegram/config', async (req, res) => {
    try {
      const dbConfig = await getTelegramConfigFromDb();
      res.json({
        token: dbConfig?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN,
        chatId: dbConfig?.telegramChatId || process.env.TELEGRAM_CHAT_ID || '',
        groupName: dbConfig?.telegramGroupName || '',
        botUsername: DEFAULT_TELEGRAM_BOT_USERNAME
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Save global Telegram config
  app.post('/api/telegram/config', async (req, res) => {
    try {
      const { token, chatId, groupName } = req.body;
      const targetToken = token?.trim() || DEFAULT_TELEGRAM_BOT_TOKEN;
      const targetChatId = chatId?.trim() || '';
      const targetGroupName = groupName?.trim() || '';

      if (dbFirestore) {
        await setDoc(doc(dbFirestore, 'settings', 'app_config'), {
          telegramBotToken: targetToken,
          telegramChatId: targetChatId,
          telegramGroupName: targetGroupName,
          updatedAt: new Date().toISOString()
        }, { merge: true });
      }
      res.json({ success: true, message: 'Đã lưu cấu hình Telegram thành công vào hệ thống' });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Query Webhook Info from Telegram API
  app.get('/api/telegram/webhook-info', async (req, res) => {
    try {
      const dbConfig = await getTelegramConfigFromDb();
      const targetToken = dbConfig?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;
      const response = await fetch(`https://api.telegram.org/bot${targetToken}/getWebhookInfo`);
      const data = await response.json();
      res.json({ success: true, info: data.result });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Set Webhook Endpoint for Telegram Bot
  app.post('/api/telegram/set-webhook', async (req, res) => {
    try {
      const { webhookUrl, token } = req.body;
      const dbConfig = await getTelegramConfigFromDb();
      const targetToken = token?.trim() || dbConfig?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;

      // Determine webhook url
      let finalWebhookUrl = webhookUrl;
      if (!finalWebhookUrl) {
        const appUrl = process.env.APP_URL || (req.protocol + '://' + req.get('host'));
        finalWebhookUrl = `${appUrl}/api/telegram/webhook`;
      }

      console.log(`Setting Telegram Webhook for bot @${DEFAULT_TELEGRAM_BOT_USERNAME} to ${finalWebhookUrl}`);
      const response = await fetch(`https://api.telegram.org/bot${targetToken}/setWebhook`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: finalWebhookUrl,
          allowed_updates: ['message', 'callback_query', 'edited_message', 'channel_post'],
          drop_pending_updates: false
        })
      });

      const data = await response.json();
      if (!data.ok) {
        return res.status(400).json({ error: data.description || 'Lỗi khi cài đặt Webhook trên Telegram' });
      }

      res.json({ success: true, result: data, webhookUrl: finalWebhookUrl });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Reset/Delete Webhook endpoint to unblock Telegram bot
  app.post('/api/telegram/reset-webhook', async (req, res) => {
    try {
      const { token } = req.body;
      const targetToken = token || process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;
      const response = await fetch(`https://api.telegram.org/bot${targetToken}/deleteWebhook?drop_pending_updates=false`);
      const data = await response.json();
      res.json({ success: true, result: data });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  // Helper to escape HTML for Telegram messages
  function escapeHTML(str: string) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  // Helper to format Telegram date time: HH:mm:ss D/M/YYYY
  function formatTelegramDateTime(dateInput?: string | Date) {
    const d = dateInput ? new Date(dateInput) : new Date();
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    const day = d.getDate();
    const month = d.getMonth() + 1;
    const year = d.getFullYear();
    return `${hours}:${minutes}:${seconds} ${day}/${month}/${year}`;
  }

  // Helper to format severity as in image (⚪ THẤP, 🟡 TRUNG BÌNH, 🟠 CAO, 🔴 KHẨN CẤP)
  function formatSeverityBadge(sev?: string) {
    const s = (sev || '').toLowerCase();
    if (s === 'urgent' || s.includes('khẩn')) return '🔴 KHẨN CẤP';
    if (s === 'high' || s.includes('cao')) return '🟠 CAO';
    if (s === 'medium' || s.includes('trung')) return '🟡 TRUNG BÌNH';
    return '⚪ THẤP';
  }

  // Helper to format location
  function formatTelegramLocation(room?: string, faculty?: string) {
    let r = (room || 'Không rõ phòng').trim();
    if (!r.toLowerCase().startsWith('phòng') && !r.toLowerCase().startsWith('hội trường') && !r.toLowerCase().startsWith('khu')) {
      r = `Phòng ${r}`;
    }
    const f = faculty ? faculty.trim() : 'Phòng Tổ chức - Hành chính';
    return `${r} - ${f}`;
  }

  // Telegram Webhook Handler (Incoming Messages & Button Callbacks)
  app.post('/api/telegram/webhook', async (req, res) => {
    try {
      const update = req.body;
      const dbConfig = await getTelegramConfigFromDb();
      const botToken = dbConfig?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;

      // 1. Handle Button Clicks (Inline Keyboard Callback Queries)
      if (update.callback_query) {
        const callbackQuery = update.callback_query;
        const callbackData = callbackQuery.data || '';
        const fromUser = callbackQuery.from;
        const technicianName = fromUser.first_name ? `${fromUser.first_name} ${fromUser.last_name || ''}`.trim() : (fromUser.username ? `@${fromUser.username}` : 'Kỹ thuật viên CSVC');
        const chatId = callbackQuery.message?.chat?.id;
        const messageId = callbackQuery.message?.message_id;

        console.log(`[Telegram Webhook] Callback: ${callbackData} by ${technicianName}`);

        if (callbackData.startsWith('accept_')) {
          const incidentId = callbackData.replace('accept_', '');
          const updateTimestamp = new Date().toISOString();

          // Update Firestore
          if (dbFirestore) {
            try {
              await setDoc(doc(dbFirestore, 'incidents', incidentId), {
                status: 'in_progress',
                acceptedBy: technicianName,
                acceptedAt: updateTimestamp,
                updatedAt: updateTimestamp
              }, { merge: true });
            } catch (e) {
              console.error('Error updating Firestore on callback accept:', e);
            }
          }

          // Update PostgreSQL
          try {
            await db.update(incidents).set({
              status: 'in_progress'
            }).where(eq(incidents.id, incidentId));
          } catch (e) {
            console.error('Error updating CloudSQL on callback accept:', e);
          }

          // Answer Callback query popup
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: callbackQuery.id,
              text: `✅ ${technicianName} đã tiếp nhận xử lý sự cố [${incidentId}]!`,
              show_alert: false
            })
          });

          // Edit Telegram message to update status and keep resolve button
          if (chatId && messageId && callbackQuery.message?.text) {
            const originalText = callbackQuery.message.text;
            const updatedText = `${originalText}\n\n⚙️ <b>TIẾP NHẬN XỬ LÝ:</b>\n👨‍🔧 Người nhận: <b>${escapeHTML(technicianName)}</b>\n🕒 Lúc: ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}\nTrạng thái: 🟡 <i>Đang kiểm tra & sửa chữa</i>`;

            await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                text: updatedText,
                parse_mode: 'HTML',
                reply_markup: {
                  inline_keyboard: [
                    [
                      { text: '🎉 Đã Khắc Phục Xong', callback_data: `resolve_${incidentId}` }
                    ]
                  ]
                }
              })
            });
          }

          return res.status(200).json({ ok: true });
        }

        if (callbackData.startsWith('resolve_')) {
          const incidentId = callbackData.replace('resolve_', '');
          const resolveTimestamp = new Date().toISOString();

          // Update Firestore
          if (dbFirestore) {
            try {
              const incRef = doc(dbFirestore, 'incidents', incidentId);
              const incSnap = await getDoc(incRef);
              const incData = incSnap.exists() ? incSnap.data() : null;

              await setDoc(incRef, {
                status: 'resolved',
                resolvedBy: technicianName,
                resolvedAt: resolveTimestamp,
                resolutionNotes: 'Đã khắc phục hoàn tất qua Telegram Bot',
                updatedAt: resolveTimestamp
              }, { merge: true });

              // Reset device status to active if matched
              if (incData?.deviceId) {
                await setDoc(doc(dbFirestore, 'devices', incData.deviceId), {
                  status: 'active',
                  updatedAt: resolveTimestamp
                }, { merge: true });
              }
            } catch (e) {
              console.error('Error updating Firestore on callback resolve:', e);
            }
          }

          // Update PostgreSQL
          try {
            await db.update(incidents).set({
              status: 'resolved',
              resolvedAt: resolveTimestamp,
              resolutionNotes: 'Đã khắc phục hoàn tất qua Telegram Bot'
            }).where(eq(incidents.id, incidentId));
          } catch (e) {
            console.error('Error updating CloudSQL on callback resolve:', e);
          }

          // Answer Callback query
          await fetch(`https://api.telegram.org/bot${botToken}/answerCallbackQuery`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              callback_query_id: callbackQuery.id,
              text: `🎉 Sự cố [${incidentId}] đã được khắc phục hoàn tất!`,
              show_alert: true
            })
          });

          // Edit Telegram message to show resolved state
          if (chatId && messageId && callbackQuery.message?.text) {
            const originalText = callbackQuery.message.text;
            const updatedText = `${originalText}\n\n✅ <b>HOÀN TẤT KHẮC PHỤC:</b>\n👨‍🔧 Kỹ thuật viên: <b>${escapeHTML(technicianName)}</b>\n🕒 Lúc: ${new Date().toLocaleTimeString('vi-VN', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}\nTrạng thái: 🟢 <b>Đã xử lý thành công (Hoạt động bình thường)</b>`;

            await fetch(`https://api.telegram.org/bot${botToken}/editMessageText`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                chat_id: chatId,
                message_id: messageId,
                text: updatedText,
                parse_mode: 'HTML'
              })
            });
          }

          return res.status(200).json({ ok: true });
        }
      }

      // 2. Handle Text Messages
      const message = update.message || update.channel_post;
      if (message && message.text) {
        const chatId = message.chat.id;
        const text = message.text.trim();
        const senderName = message.from?.first_name ? `${message.from.first_name} ${message.from.last_name || ''}`.trim() : (message.from?.username ? `@${message.from.username}` : 'Thầy/Cô');

        // Automatically store chat ID in app_config if empty
        if (dbFirestore) {
          try {
            const curConfig = await getTelegramConfigFromDb();
            if (!curConfig?.telegramChatId) {
              await setDoc(doc(dbFirestore, 'settings', 'app_config'), {
                telegramChatId: String(chatId),
                telegramGroupName: message.chat.title || senderName,
                updatedAt: new Date().toISOString()
              }, { merge: true });
              console.log(`Auto-saved Chat ID ${chatId} to settings/app_config`);
            }
          } catch (e) {}
        }

        // Handle /start or /help commands
        if (text.startsWith('/start') || text.startsWith('/help') || text.startsWith('/menu')) {
          const welcomeMsg = 
            `👋 <b>Xin chào ${escapeHTML(senderName)}!</b>\n\n` +
            `Tôi là <b>Trợ Lý Ảo CSVC & Hỗ Trợ Giảng Dạy (@${DEFAULT_TELEGRAM_BOT_USERNAME})</b> - Trường Đại học Kinh tế, ĐH Đà Nẵng (DUE).\n\n` +
            `🛠️ <b>HƯỚNG DẪN XỬ LÝ LỖI GIẢNG ĐƯỜNG:</b>\n` +
            `• <b>Máy chiếu / HDMI</b>: Nhấn <code>Windows + P</code> chọn <b>Duplicate</b>. Thử cắm lại cáp hoặc chọn cổng HDMI 1/2.\n` +
            `• <b>Micro âm thanh</b>: Kiểm tra pin, kiểm tra công tắc nguồn và Volume Amply trên bục giảng.\n` +
            `• <b>Điều hoà nhiệt độ</b>: Bật aptomat phòng học, dùng remote chọn chế độ Cool (24-26°C).\n\n` +
            `🚨 <b>BÁO HỎNG SIÊU TỐC:</b>\n` +
            `Quý Thầy/Cô chỉ cần nhắn tin theo cú pháp:\n` +
            `<i>"Phòng D305 máy chiếu không lên nguồn"</i> hoặc <i>"Phòng E201 micro bị rè"</i>.\n\n` +
            `⚡ <i>Hệ thống AI sẽ tạo phiếu báo hỏng và chuyển ngay nút Tiếp nhận xử lý cho Kỹ thuật viên!</i>`;

          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: welcomeMsg,
              parse_mode: 'HTML'
            })
          });

          return res.status(200).json({ ok: true });
        }

        // Process message with AI / Incident detector
        const lower = text.toLowerCase();
        const roomRegex = /([a-z]\s?\d{3,4}|hội trường\s?[a-z0-9]+|phòng\s?[a-z0-9-]+)/i;
        const roomMatch = text.match(roomRegex);
        const detectedRoom = roomMatch ? roomMatch[0].trim() : '';

        // Device detection
        let detectedDevice = '';
        if (lower.includes('máy chiếu') || lower.includes('projector')) detectedDevice = 'Máy chiếu';
        else if (lower.includes('micro') || lower.includes('mic') || lower.includes('âm thanh') || lower.includes('loa')) detectedDevice = 'Micro & Âm thanh';
        else if (lower.includes('điều hoà') || lower.includes('máy lạnh') || lower.includes('mát')) detectedDevice = 'Điều hoà nhiệt độ';
        else if (lower.includes('cáp') || lower.includes('hdmi') || lower.includes('vga')) detectedDevice = 'Cáp kết nối HDMI';
        else if (lower.includes('mạng') || lower.includes('wifi') || lower.includes('internet')) detectedDevice = 'Mạng Internet / Wifi';
        else if (lower.includes('đèn') || lower.includes('quạt') || lower.includes('điện')) detectedDevice = 'Hệ thống điện chiếu sáng';

        const isIncident = detectedRoom || detectedDevice || lower.includes('hỏng') || lower.includes('lỗi') || lower.includes('không lên') || lower.includes('cháy') || lower.includes('rè') || lower.includes('hư');

        if (isIncident && (detectedRoom || detectedDevice)) {
          const incidentId = `INC-${Date.now().toString().slice(-6)}`;
          const finalRoom = detectedRoom || 'Phòng học giảng đường';
          const finalDevice = detectedDevice || 'Thiết bị giảng đường';
          const finalReporter = senderName;
          const reportedTime = new Date().toISOString();

          // 1. Save incident to Firestore
          if (dbFirestore) {
            try {
              await setDoc(doc(dbFirestore, 'incidents', incidentId), {
                id: incidentId,
                deviceId: `DEV-${Date.now()}`,
                deviceSn: `SN-${Date.now().toString().slice(-6)}`,
                deviceName: finalDevice,
                reporterName: finalReporter,
                faculty: 'Khoa / Giảng đường',
                room: finalRoom,
                severity: lower.includes('khẩn') || lower.includes('cháy') ? 'urgent' : 'high',
                status: 'open',
                description: text,
                reportedAt: reportedTime,
                source: 'telegram_bot'
              });
            } catch (fErr) {
              console.error('Error saving incident to Firestore from webhook:', fErr);
            }
          }

          // 2. Save to Cloud SQL
          try {
            await db.insert(incidents).values({
              id: incidentId,
              deviceId: `DEV-${Date.now()}`,
              deviceSn: `SN-${Date.now().toString().slice(-6)}`,
              deviceName: finalDevice,
              reporterName: finalReporter,
              faculty: 'Khoa / Giảng đường',
              room: finalRoom,
              severity: 'high',
              status: 'open',
              description: text,
              reportedAt: reportedTime
            });
          } catch (sqlErr) {
            console.error('Error saving incident to Cloud SQL from webhook:', sqlErr);
          }

          // 3. Send Incident Notification with Action Buttons matching exact user template
          const ticketMsg = 
            `🚨 <b>BÁO CÁO SỰ CỐ THIẾT BỊ MỚI</b> 🚨\n\n` +
            `💻 <b>Thiết bị:</b> ${escapeHTML(finalDevice)} (SN: ${escapeHTML(`SN-${incidentId}`)})\n` +
            `📍 <b>Vị trí:</b> ${escapeHTML(formatTelegramLocation(finalRoom, 'Phòng Tổ chức - Hành chính'))}\n` +
            `⚠️ <b>Mức độ:</b> ${formatSeverityBadge(lower.includes('khẩn') || lower.includes('cháy') ? 'urgent' : (lower.includes('cao') ? 'high' : 'low'))}\n` +
            `👤 <b>Người báo cáo:</b> ${escapeHTML(finalReporter || 'Cán Bộ Khoa / Giảng Đường')}\n` +
            `⏰ <b>Thời gian:</b> ${formatTelegramDateTime(reportedTime)}\n\n` +
            `📝 <b>Mô tả chi tiết sự cố:</b>\n` +
            `<i>${escapeHTML(text)}</i>\n\n` +
            `💻 <i>Hệ thống Quản lý Thiết bị DUE</i>`;

          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: ticketMsg,
              parse_mode: 'HTML',
              reply_markup: {
                inline_keyboard: [
                  [
                    { text: '✅ Tiếp Nhận Xử Lý', callback_data: `accept_${incidentId}` },
                    { text: '🎉 Đã Khắc Phục Xong', callback_data: `resolve_${incidentId}` }
                  ]
                ]
              }
            })
          });

          return res.status(200).json({ ok: true });
        } else {
          // General troubleshooting assistance reply
          let guideText = '';
          if (lower.includes('hdmi') || lower.includes('máy chiếu') || lower.includes('không lên')) {
            guideText = `💡 <b>Khắc phục nhanh Máy chiếu & HDMI:</b>\n1. Kiểm tra đèn nguồn máy chiếu (LED xanh).\n2. Nhấn <code>Windows + P</code> trên laptop và chọn <b>Duplicate</b>.\n3. Rút và cắm lại chặt 2 đầu cáp HDMI.\n\nNếu vẫn không được, Thầy/Cô hãy gửi số phòng (ví dụ: <i>"Phòng D305 máy chiếu hỏng"</i>) để kỹ thuật viên đến hỗ trợ ngay!`;
          } else if (lower.includes('mic') || lower.includes('micro') || lower.includes('tiếng') || lower.includes('âm thanh')) {
            guideText = `🎤 <b>Khắc phục nhanh Micro & Âm thanh:</b>\n1. Kiểm tra pin micro (đèn đỏ mờ là hết pin).\n2. Kiểm tra núm âm lượng Master trên Amply bục giảng.\n\nNếu cần mang micro dự phòng, Thầy/Cô hãy nhắn số phòng để bộ phận trực ban hỗ trợ!`;
          } else {
            guideText = `👋 Trợ lý AI CSVC DUE đã nhận được tin nhắn của Quý Thầy/Cô.\n\nĐể báo hỏng thiết bị gấp, Thầy/Cô vui lòng nhắn rõ <b>Tên phòng</b> và <b>Thiết bị</b> (Ví dụ: <i>"Phòng D305 máy chiếu không lên"</i>) để hệ thống tạo phiếu xử lý tức thì!`;
          }

          await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              chat_id: chatId,
              text: guideText,
              parse_mode: 'HTML'
            })
          });

          return res.status(200).json({ ok: true });
        }
      }

      res.status(200).json({ ok: true });
    } catch (err: any) {
      console.error('Error handling Telegram webhook:', err);
      res.status(500).json({ error: err.message });
    }
  });

  // Direct Telegram Integration Endpoints (Outgoing Alerts from Web UI)
  app.post('/api/telegram/send', async (req, res) => {
    try {
      const { token, chatId, message, incident, eventType = 'new', resolutionNotes, updatedBy } = req.body;
      const dbConfig = await getTelegramConfigFromDb();
      let targetToken = token || dbConfig?.telegramBotToken || process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;
      let targetChatId = chatId || dbConfig?.telegramChatId || process.env.TELEGRAM_CHAT_ID;

      if (!targetToken) {
        return res.status(400).json({ error: 'Chưa cấu hình Telegram Bot Token' });
      }

      // Auto-discover Chat ID from getUpdates if not specified
      if (!targetChatId) {
        try {
          const upRes = await fetch(`https://api.telegram.org/bot${targetToken}/getUpdates?limit=20`);
          const upData: any = await upRes.json();
          if (upData.ok && upData.result && upData.result.length > 0) {
            for (let i = upData.result.length - 1; i >= 0; i--) {
              const u = upData.result[i];
              const cid = u.message?.chat?.id || u.callback_query?.message?.chat?.id;
              if (cid) {
                targetChatId = String(cid);
                if (dbFirestore) {
                  try {
                    await setDoc(doc(dbFirestore, 'system_config', 'telegram'), { telegramChatId: targetChatId }, { merge: true });
                  } catch (e) {}
                }
                break;
              }
            }
          }
        } catch (scanErr) {
          console.warn('Auto-scan getUpdates failed in /api/telegram/send:', scanErr);
        }
      }

      if (!targetChatId) {
        return res.status(400).json({ 
          error: 'Chưa cung cấp Telegram Chat ID người nhận. Vui lòng mở bot Telegram @hotrogiangday_bot và bấm /start để kích hoạt nhận tin!',
          noChatId: true 
        });
      }

      let text = message;
      let replyMarkup: any = undefined;

      if (incident) {
        const incidentId = incident.id || incident.deviceSn || `INC-${Date.now().toString().slice(-6)}`;
        const devName = incident.deviceName || 'Thiết bị giảng đường';
        const devSn = incident.deviceSn ? ` (SN: ${escapeHTML(incident.deviceSn)})` : '';
        const loc = formatTelegramLocation(incident.room, incident.faculty);
        const reporter = incident.reporterName || 'Cán Bộ Khoa / Giảng Đường';
        const sevBadge = formatSeverityBadge(incident.severity);
        const timeStr = formatTelegramDateTime(incident.reportedAt || incident.createdAt);
        
        if (eventType === 'accepted') {
          text = `⚙️ <b>TIẾP NHẬN XỬ LÝ SỰ CỐ</b> ⚙️\n\n` +
                 `💻 <b>Thiết bị:</b> ${escapeHTML(devName)}${devSn}\n` +
                 `📍 <b>Vị trí:</b> ${escapeHTML(loc)}\n` +
                 `⚠️ <b>Mức độ:</b> ${sevBadge}\n` +
                 `👤 <b>Người báo cáo:</b> ${escapeHTML(reporter)}\n` +
                 `👨‍🔧 <b>Kỹ thuật viên tiếp nhận:</b> <b>${escapeHTML(updatedBy || 'Bộ phận Kỹ thuật DUE')}</b>\n` +
                 `⏰ <b>Thời gian:</b> ${timeStr}\n\n` +
                 `⚠️ <b>Trạng thái:</b> 🟡 <i>Đang kiểm tra & sửa chữa</i>\n\n` +
                 `💻 <i>Hệ thống Quản lý Thiết bị DUE</i>`;

          replyMarkup = {
            inline_keyboard: [
              [
                { text: '🎉 Đã Khắc Phục Xong', callback_data: `resolve_${incidentId}` }
              ]
            ]
          };
        } else if (eventType === 'resolved') {
          text = `✅ <b>SỰ CỐ ĐÃ ĐƯỢC KHẮC PHỤC HOÀN TẤT</b> ✅\n\n` +
                 `💻 <b>Thiết bị:</b> ${escapeHTML(devName)}${devSn}\n` +
                 `📍 <b>Vị trí:</b> ${escapeHTML(loc)}\n` +
                 `👤 <b>Người báo cáo:</b> ${escapeHTML(reporter)}\n` +
                 `👨‍🔧 <b>Người xử lý:</b> <b>${escapeHTML(updatedBy || 'Bộ phận Kỹ thuật DUE')}</b>\n` +
                 `⏰ <b>Thời gian:</b> ${formatTelegramDateTime()}\n\n` +
                 `📝 <b>Kết quả xử lý:</b>\n` +
                 `<i>${escapeHTML(resolutionNotes || 'Đã khắc phục xong và thiết bị hoạt động bình thường')}</i>\n\n` +
                 `⚠️ <b>Trạng thái:</b> 🟢 <b>Đã xử lý thành công (Hoạt động bình thường)</b>\n\n` +
                 `💻 <i>Hệ thống Quản lý Thiết bị DUE</i>`;
        } else {
          // New Incident Notification - EXACT FORMAT MATCHING USER IMAGE
          text = `🚨 <b>BÁO CÁO SỰ CỐ THIẾT BỊ MỚI</b> 🚨\n\n` +
                 `💻 <b>Thiết bị:</b> ${escapeHTML(devName)}${devSn}\n` +
                 `📍 <b>Vị trí:</b> ${escapeHTML(loc)}\n` +
                 `⚠️ <b>Mức độ:</b> ${sevBadge}\n` +
                 `👤 <b>Người báo cáo:</b> ${escapeHTML(reporter)}\n` +
                 `⏰ <b>Thời gian:</b> ${timeStr}\n\n` +
                 `📝 <b>Mô tả chi tiết sự cố:</b>\n` +
                 `<i>${escapeHTML(incident.description || 'Không có mô tả chi tiết')}</i>\n\n` +
                 `💻 <i>Hệ thống Quản lý Thiết bị DUE</i>`;

          replyMarkup = {
            inline_keyboard: [
              [
                { text: '✅ Tiếp Nhận Xử Lý', callback_data: `accept_${incidentId}` },
                { text: '🎉 Đã Khắc Phục Xong', callback_data: `resolve_${incidentId}` }
              ]
            ]
          };
        }
      }

      const telegramUrl = `https://api.telegram.org/bot${targetToken}/sendMessage`;
      const response = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: text || 'Tín hiệu kết nối từ DUE Equipment Management hoạt động tốt!',
          parse_mode: 'HTML',
          reply_markup: replyMarkup
        })
      });

      const resData: any = await response.json();
      if (!resData.ok) {
        return res.status(400).json({ error: resData.description || 'Lỗi từ Telegram API' });
      }

      res.json({ success: true, result: resData.result, sentToChatId: targetChatId });
    } catch (err: any) {
      console.error('Error sending Telegram message:', err);
      res.status(500).json({ error: err.message || 'Lỗi kết nối tới Telegram API' });
    }
  });

  // Telegram Get Updates Endpoint (Auto-Scan Chat IDs with Auto-Recovery)
  app.post('/api/telegram/get-updates', async (req, res) => {
    try {
      const { token } = req.body;
      const targetToken = token || process.env.TELEGRAM_BOT_TOKEN || DEFAULT_TELEGRAM_BOT_TOKEN;

      if (!targetToken) {
        return res.status(400).json({ error: 'Chưa cung cấp Telegram Bot Token' });
      }

      // Query updates
      let response = await fetch(`https://api.telegram.org/bot${targetToken}/getUpdates?limit=50`);
      let data: any = await response.json();

      // If webhook conflict, delete webhook automatically and retry
      if (!data.ok && data.description && data.description.includes('webhook')) {
        console.log('Webhook detected on Telegram bot, deleting webhook to allow getUpdates...');
        await fetch(`https://api.telegram.org/bot${targetToken}/deleteWebhook?drop_pending_updates=false`);
        response = await fetch(`https://api.telegram.org/bot${targetToken}/getUpdates?limit=50`);
        data = await response.json();
      }

      if (!data.ok) {
        if (data.description && data.description.includes('Conflict')) {
          return res.status(400).json({ 
            error: 'Bot đang có kết nối khác mở. Bạn vui lòng mở Telegram, nhắn tin bất kỳ (ví dụ /start) cho bot @hotrogiangday_bot rồi nhấn Quét lại, hoặc nhập Chat ID thủ công.',
            isConflict: true 
          });
        }
        return res.status(400).json({ error: data.description || 'Lỗi từ Telegram API' });
      }

      const chatsMap = new Map();
      const updates = data.result || [];
      updates.forEach((u: any) => {
        const msg = u.message || u.channel_post || u.edited_message || u.callback_query?.message;
        if (msg && msg.chat) {
          const chat = msg.chat;
          const name = chat.title || [chat.first_name, chat.last_name].filter(Boolean).join(' ') || chat.username || `ID: ${chat.id}`;
          chatsMap.set(chat.id, {
            id: String(chat.id),
            name: name,
            type: chat.type || 'private',
            username: chat.username ? `@${chat.username}` : ''
          });
        }
      });

      res.json({ success: true, chats: Array.from(chatsMap.values()) });
    } catch (err: any) {
      console.error('Error getting Telegram updates:', err);
      res.status(500).json({ error: err.message || 'Lỗi kết nối tới Telegram API' });
    }
  });

  // Direct LLM Transformer API Chat Endpoint (Gemini API via Server)
  app.post('/api/chat', async (req, res) => {
    try {
      const userMessage = req.body.message || req.body.prompt;
      if (!userMessage || typeof userMessage !== 'string') {
        return res.status(400).json({ error: 'Nội dung tin nhắn không hợp lệ (cần truyền trường message hoặc prompt)' });
      }

      const apiKey = process.env.GEMINI_API_KEY;
      if (!apiKey) {
        return res.json({ 
          reply: `Xin chào! Tôi là Trợ lý Ảo AI Quản lý Cơ sở vật chất DUE. Do hệ thống đang ở chế độ cục bộ không có GEMINI_API_KEY, bạn vui lòng cấu hình API Key trong Settings để kích hoạt đầy đủ sức mạnh của mô hình ngôn ngữ lớn.` 
        });
      }

      const aiClient = new GoogleGenAI({
        apiKey: apiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build'
          }
        }
      });

      const systemInstruction = `Bạn là Trợ lý Ảo AI Thông minh của Hệ thống Quản lý Thiết bị & Cơ sở vật chất Trường Đại học Kinh tế - Đại học Đà Nẵng (DUE).
Nhiệm vụ của bạn là giải đáp, tư vấn, hướng dẫn xử lý sự cố thiết bị giảng đường (máy chiếu, cáp HDMI, VGA, micro, âm thanh, điều hoà, hệ thống điện, bàn ghế) bằng phong cách lịch sự, chuẩn mực môi trường đại học và đưa ra các bước xử lý súc tích, dễ thực hiện.
Kênh tiếp nhận & phản hồi chính thức: Telegram Bot @hotrogiangday_bot (https://t.me/hotrogiangday_bot).`;

      let response;
      try {
        response = await aiClient.models.generateContent({
          model: 'gemini-3.8-flash',
          contents: userMessage,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.7
          }
        });
      } catch (flashErr) {
        // Fallback to flash-lite if high load
        response = await aiClient.models.generateContent({
          model: 'gemini-3.1-flash-lite',
          contents: userMessage,
          config: {
            systemInstruction: systemInstruction,
            temperature: 0.7
          }
        });
      }

      res.json({ reply: response.text || '' });
    } catch (error: any) {
      console.error("Lỗi AI Chatbot:", error);
      res.status(500).json({ reply: "Xin lỗi, hệ thống AI đang gặp sự cố kết nối hoặc máy chủ phản hồi quá tải. Vui lòng thử lại sau giây lát." });
    }
  });

  // AI Chatbot Assistant for User Accounts
  app.post('/api/chat/assistant', async (req, res) => {
    try {
      const { message, history = [], currentUser, knownRooms = [], knownDevices = [] } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'Nội dung tin nhắn không hợp lệ' });
      }

      const apiKey = process.env.GEMINI_API_KEY;

      // Fallback response generator if Gemini is unavailable
      const generateFallbackResponse = (userMsg: string) => {
        const lower = userMsg.toLowerCase();
        
        // Extract room if any (e.g. D305, H102, A201, E101, etc.)
        const roomMatch = userMsg.match(/([a-zA-Z]\d{3}|phòng\s+[a-zA-Z0-9]+)/i);
        const detectedRoom = roomMatch ? roomMatch[0].toUpperCase() : '';

        // Device identification
        let detectedDevice = '';
        if (lower.includes('máy chiếu') || lower.includes('projector')) detectedDevice = 'Máy chiếu';
        else if (lower.includes('hdmi')) detectedDevice = 'Dây cáp HDMI';
        else if (lower.includes('vga')) detectedDevice = 'Dây VGA';
        else if (lower.includes('mic') || lower.includes('micro')) detectedDevice = 'Âm thanh (Micro)';
        else if (lower.includes('loa') || lower.includes('âm thanh')) detectedDevice = 'Âm thanh (Loa/Amply)';
        else if (lower.includes('điều hoà') || lower.includes('máy lạnh')) detectedDevice = 'Điều hoà nhiệt độ';
        else if (lower.includes('điện') || lower.includes('ổ cắm') || lower.includes('quạt')) detectedDevice = 'Thiết bị điện';
        else if (lower.includes('bàn') || lower.includes('ghế')) detectedDevice = 'Bàn ghế';

        const isReporting = lower.includes('hỏng') || lower.includes('hư') || lower.includes('lỗi') || lower.includes('không lên') || lower.includes('chập chờn') || lower.includes('báo sự cố') || lower.includes('báo hỏng');

        if (isReporting && (detectedRoom || detectedDevice)) {
          const roomName = detectedRoom ? (detectedRoom.startsWith('PHÒNG') ? detectedRoom : `Phòng ${detectedRoom}`) : 'Chưa rõ phòng (Vui lòng chọn)';
          const devName = detectedDevice || 'Thiết bị phòng học';
          const severity = lower.includes('cháy') || lower.includes('nổ') || lower.includes('khẩn') || lower.includes('đang dạy') || lower.includes('gấp') ? 'urgent' : 'high';

          return {
            reply: `Tôi đã nhận diện sự cố của bạn tại **${roomName}** đối với **${devName}**.\n\nBạn hãy kiểm tra thông tin dưới đây và nhấn nút **"Gửi Báo Cáo Tới Telegram Bot (@hotrogiangday_bot)"** để chuyển phiếu ngay tới Kỹ thuật viên trực ban nhé!`,
            incidentDraft: {
              room: roomName,
              deviceName: devName,
              description: userMsg,
              severity: severity
            }
          };
        }

        if (lower.includes('hdmi') || lower.includes('không nhận cáp') || lower.includes('không lên hình')) {
          return {
            reply: `💡 **Hướng dẫn khắc phục nhanh Máy chiếu / Cáp HDMI:**\n\n1. **Kiểm tra nguồn**: Đảm bảo máy chiếu đã bật đèn xanh (Power LED).\n2. **Chọn đúng cổng Input**: Dùng remote hoặc nút bấm trên máy chiếu chọn đúng **HDMI 1** hoặc **HDMI 2** tương ứng với cổng cắm.\n3. **Phím tắt xuất màn hình**: Trên laptop nhấn tổ hợp phím **Windows + P** và chọn chế độ **Duplicate** (Nhân bản màn hình).\n4. **Cắm chặt 2 đầu cáp**: Rút cáp HDMI ra và cắm lại thật chặt ở cả cổng laptop và ổ cắm bàn giáo viên.\n\n*Nếu vẫn không lên hình, bạn hãy gõ ví dụ: "Phòng D305 hỏng máy chiếu" để tôi tạo phiếu phát tin tới Telegram Bot @hotrogiangday_bot nhé!*`
          };
        }

        if (lower.includes('micro') || lower.includes('mic') || lower.includes('âm thanh')) {
          return {
            reply: `🎤 **Hướng dẫn kiểm tra Micro / Hệ thống Âm thanh:**\n\n1. **Kiểm tra pin**: Bật công tắc micro, nếu đèn báo đỏ mờ hoặc không sáng, mic đã hết pin (liên hệ phòng bảo vệ hoặc phòng trực nhận pin mới).\n2. **Tần số thu phát**: Đảm bảo micro và bộ thu đặt cùng kênh tần số.\n3. **Volume Amply**: Kiểm tra núm vặn Master Volume trên bàn điều khiển amply của bục giảng.\n\n*Nếu cần hỗ trợ gấp trong giờ dạy, bạn có thể bấm nút báo hỏng để gửi tin trực tiếp đến bot Telegram @hotrogiangday_bot!*`
          };
        }

        if (lower.includes('điều hoà') || lower.includes('máy lạnh')) {
          return {
            reply: `❄️ **Hướng dẫn sử dụng Điều hoà:**\n\n1. Đảm bảo aptomat (cầu dao) điều hoà trên tường phòng học đã được bật ON.\n2. Dùng remote điều khiển hướng thẳng vào mắt nhận của dàn lạnh, bấm nút Power và chọn chế độ **Cool** (hình bông tuyết), cài đặt nhiệt độ từ 24 - 26°C.\n3. Đóng kín cửa sổ và cửa ra vào phòng học để đảm bảo hiệu quả làm mát.\n\n*Nếu điều hoà phát tiếng ồn lớn, chảy nước hoặc không phả hơi lạnh, vui lòng gõ sự cố để chuyển tới Telegram Bot @hotrogiangday_bot nhé.*`
          };
        }

        return {
          reply: `Xin chào ${currentUser?.name || 'Thầy/Cô'}! Tôi là **Trợ lý AI CSVC DUE** (Đại học Kinh tế - ĐH Đà Nẵng).\n\nTôi sẵn sàng hỗ trợ Quý Thầy/Cô:\n• **Báo hỏng giảng đường**: Gõ sự cố (ví dụ: *"Phòng D305 máy chiếu không lên nguồn"*)\n• **Khắc phục lỗi nhanh**: Hướng dẫn cắm cáp HDMI, pin micro, remote điều hoà...\n• **Phát thông báo qua Telegram Bot (@hotrogiangday_bot)**: Chuyển thẳng tới Kỹ thuật viên trực ban tức thì chỉ với 1 chạm!\n\nQuý Thầy/Cô đang gặp vấn đề gì tại phòng học cần hỗ trợ ạ?`
        };
      };

      if (!apiKey) {
        return res.json(generateFallbackResponse(message));
      }

      try {
        const aiClient = new GoogleGenAI({
          apiKey: apiKey,
          httpOptions: { headers: { 'User-Agent': 'aistudio-build' } }
        });

        const systemPrompt = `Bạn là Trợ lý Ảo AI Quản lý & Hỗ trợ Kỹ thuật Cơ sở vật chất (CSVC) của Trường Đại học Kinh tế - Đại học Đà Nẵng (DUE).
Người đang trò chuyện với bạn là: ${currentUser?.name || 'Cán bộ / Giảng viên'} (${currentUser?.department || 'Khoa/Phòng ban'}, vai trò: ${currentUser?.role || 'staff'}).
Kênh tiếp nhận & phản hồi chính thức: Telegram Bot @hotrogiangday_bot (https://t.me/hotrogiangday_bot).

Nhiệm vụ của bạn:
1. Trả lời thân thiện, kính trọng, lịch sự ("Kính chào Quý Thầy/Cô", "Dạ thưa Thầy/Cô..."), văn phong chuẩn mực môi trường giáo dục đại học, súc tích và giải quyết việc ngay.
2. Hướng dẫn nhanh cán bộ/giảng viên cách tự khắc phục nhanh tại lớp học:
   - Máy chiếu: kiểm tra đèn nguồn LED xanh, chọn Source HDMI 1/2 trên remote, bấm phím tắt Windows + P chọn Duplicate (nhân bản màn hình).
   - Cáp HDMI/VGA: cắm chặt 2 đầu cáp ở laptop và ổ cắm bàn giáo viên, kiểm tra chân cắm.
   - Âm thanh: Micro hết pin (nhận pin dự phòng phòng bảo vệ/trực ban), tần số micro, núm vặn Master Volume của bục giảng.
   - Điều hoà: kiểm tra aptomat trên tường bật ON, dùng remote bật chế độ Cool 24-26°C.
   - Mất điện ổ cắm, quạt, bàn ghế giảng đường.
3. KHI NGƯỜI DÙNG CÓ Ý ĐỊNH BÁO HỎNG / BÁO SỰ CỐ (ví dụ nhắc đến phòng học, thiết bị bị lỗi, chập chờn, hoặc cần kỹ thuật viên hỗ trợ):
   - Bạn PHẢI trích xuất thông tin để tạo incidentDraft gửi thông báo tới Telegram Bot @hotrogiangday_bot.
   - Định dạng trả về BẮT BUỘC là JSON hợp lệ theo cấu trúc sau:
   {
     "reply": "Lời phản hồi thân thiện, thông báo đã nhận diện sự cố và mời Thầy/Cô xác nhận gửi thông báo tới Telegram Bot @hotrogiangday_bot",
     "incidentDraft": {
       "room": "Tên phòng (ví dụ: Phòng D305, Phòng H102)",
       "deviceName": "Tên thiết bị (ví dụ: Máy chiếu Panasonic, Dây cáp HDMI, Micro không dây, Điều hoà)",
       "description": "Tóm tắt ngắn gọn mô tả sự cố từ người dùng",
       "severity": "low | medium | high | urgent"
     }
   }
4. NẾU NGƯỜI DÙNG CHỈ HỎI ĐÁP / TƯ VẤN THÔNG THƯỜNG (không báo hỏng):
   - Trả về JSON:
   {
     "reply": "Nội dung trả lời chi tiết, định dạng Markdown đẹp, có gạch đầu dòng rõ ràng, kèm nhắc kênh hỗ trợ Telegram Bot @hotrogiangday_bot khi cần hỗ trợ khẩn cấp."
   }

QUAN TRỌNG: Chỉ trả về JSON duy nhất, không kèm markdown \`\`\`json\`\`\`.`;

        const recentHistory = (history || []).slice(-6).map((h: any) => `${h.sender === 'user' ? 'Người dùng' : 'Trợ lý'}: ${h.text}`).join('\n');
        const userPrompt = `${recentHistory ? `Lịch sử hội thoại:\n${recentHistory}\n\n` : ''}Tin nhắn mới của người dùng: "${message}"`;

        // Run with timeout (6 seconds) to prevent gateway timeout
        const callGeminiWithTimeout = async (modelName: string) => {
          const timeoutPromise = new Promise<never>((_, reject) => 
            setTimeout(() => reject(new Error(`Timeout model ${modelName}`)), 6000)
          );
          const aiPromise = aiClient.models.generateContent({
            model: modelName,
            contents: `${systemPrompt}\n\n${userPrompt}`
          });
          return await Promise.race([aiPromise, timeoutPromise]);
        };

        let aiResponse: any = null;
        try {
          // gemini-3.1-flash-lite is fastest and avoids 503 high demand spikes
          aiResponse = await callGeminiWithTimeout('gemini-3.1-flash-lite');
        } catch (err1: any) {
          console.warn('gemini-3.1-flash-lite failed or timed out, trying gemini-3.8-flash:', err1.message);
          try {
            aiResponse = await callGeminiWithTimeout('gemini-3.8-flash');
          } catch (err2: any) {
            console.warn('gemini-3.8-flash also failed, using smart fallback:', err2.message);
            return res.json(generateFallbackResponse(message));
          }
        }

        let responseText = aiResponse?.text || '';
        responseText = responseText.replace(/```json/g, '').replace(/```/g, '').trim();

        try {
          const parsed = JSON.parse(responseText);
          return res.json(parsed);
        } catch (jsonErr) {
          return res.json({ reply: responseText });
        }
      } catch (genAiErr: any) {
        console.warn('Gemini chat assistant fallback:', genAiErr.message);
        return res.json(generateFallbackResponse(message));
      }
    } catch (err: any) {
      console.error('Error in chat assistant endpoint:', err);
      // Guarantee 200 response with smart fallback so client never gets an error
      return res.json({
        reply: `Xin chào Quý Thầy/Cô! Tôi là **Trợ lý AI CSVC DUE** (Đại học Kinh tế - ĐH Đà Nẵng). Tôi có thể hỗ trợ kiểm tra máy chiếu, cáp HDMI, âm thanh micro hoặc tạo phiếu báo hỏng phát thông báo trực tiếp tới Kỹ thuật viên qua Bot Telegram **@hotrogiangday_bot**. Quý Thầy/Cô vui lòng cho biết phòng học và thiết bị cần hỗ trợ nhé!`
      });
    }
  });

  // Zalo Notification Endpoint for Staff Incident Dispatch (0987119665)
  app.post('/api/zalo/notify', async (req, res) => {
    try {
      const { phone = '0987119665', incident, reporterName } = req.body;
      const targetPhone = phone || '0987119665';

      const logData = {
        phone: targetPhone,
        incidentId: incident?.id || 'NEW',
        room: incident?.room || '',
        deviceName: incident?.deviceName || '',
        reporterName: reporterName || incident?.reporterName || 'Cán bộ',
        sentAt: new Date().toISOString(),
        zaloChatUrl: `https://zalo.me/${targetPhone}`
      };

      if (dbFirestore) {
        try {
          await setDoc(doc(collection(dbFirestore, 'zalo_logs')), logData);
        } catch (e: any) {
          console.warn('Could not save zalo_log to Firestore:', e.message);
        }
      }

      res.json({
        success: true,
        phone: targetPhone,
        zaloUrl: `https://zalo.me/${targetPhone}`,
        message: `Đã chuẩn bị thông báo gửi tới số điện thoại Zalo ${targetPhone}`
      });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  });

  app.put('/api/incidents/:id', async (req, res) => {
    try {
      const { id } = req.params;
      const { status, resolutionNotes } = req.body;
      
      const existing = await db.select().from(incidents).where(eq(incidents.id, id)).limit(1);
      if (existing.length === 0) {
        return res.status(404).json({ error: 'Không tìm thấy báo cáo sự cố' });
      }

      const resolvedAt = status === 'resolved' ? new Date().toISOString() : existing[0].resolvedAt;
      
      await db.update(incidents).set({
        status: status !== undefined ? status : existing[0].status,
        resolutionNotes: resolutionNotes !== undefined ? resolutionNotes : existing[0].resolutionNotes,
        resolvedAt
      }).where(eq(incidents.id, id));

      // Sync to Firestore
      if (dbFirestore) {
        try {
          const docRef = doc(dbFirestore, 'incidents', id);
          const updatePayload: any = {
            status: status !== undefined ? status : existing[0].status,
            updatedAt: new Date().toISOString()
          };
          if (status === 'resolved') {
            updatePayload.resolvedAt = resolvedAt;
            updatePayload.resolutionNotes = resolutionNotes || 'Đã khắc phục hoàn tất';
          }
          await updateDoc(docRef, updatePayload);
          console.log(`Synced update to Firestore for incident ${id}`);
        } catch (fErr) {
          console.error("Failed to sync status update to Firestore:", fErr);
        }
      }

      const updatedReport: IncidentReport = {
        id,
        deviceId: existing[0].deviceId,
        deviceSn: existing[0].deviceSn,
        deviceName: existing[0].deviceName,
        reporterName: existing[0].reporterName,
        faculty: existing[0].faculty,
        room: existing[0].room,
        severity: existing[0].severity as any,
        status: (status ?? existing[0].status) as any,
        description: existing[0].description,
        reportedAt: existing[0].reportedAt,
        resolvedAt: resolvedAt || undefined,
        resolutionNotes: resolutionNotes ?? existing[0].resolutionNotes ?? undefined
      };

      res.json(updatedReport);
    } catch (err) {
      console.error('Error updating incident:', err);
      res.status(500).json({ error: 'Database error updating incident' });
    }
  });

  // Dedicated Webhook endpoint for n8n/Telegram to update incident status
  app.post('/api/incidents/update-status', async (req, res) => {
    try {
      const { id, deviceSn, status, resolutionNotes } = req.body;

      if (!status || !['in_progress', 'resolved'].includes(status)) {
        return res.status(400).json({ error: "Trạng thái 'status' phải là 'in_progress' hoặc 'resolved'" });
      }

      if (!id && !deviceSn) {
        return res.status(400).json({ error: "Yêu cầu cung cấp 'id' (mã sự cố) hoặc 'deviceSn' (mã sê-ri thiết bị)" });
      }

      let updatedCount = 0;
      const targetStatus = status; // 'in_progress' or 'resolved'
      const resolvedAt = targetStatus === 'resolved' ? new Date().toISOString() : null;

      // 1. Update Firestore to trigger client-side real-time listener (onSnapshot)
      if (dbFirestore) {
        try {
          const incidentsCol = collection(dbFirestore, 'incidents');
          let docIdsToUpdate: string[] = [];

          if (id) {
            docIdsToUpdate.push(id);
          } else if (deviceSn) {
            const q = query(incidentsCol, where('deviceSn', '==', deviceSn));
            const snapshot = await getDocs(q);
            snapshot.forEach((d) => {
              const data = d.data();
              if (data.status !== 'resolved') {
                docIdsToUpdate.push(d.id);
              }
            });
          }

          for (const docId of docIdsToUpdate) {
            const docRef = doc(dbFirestore, 'incidents', docId);
            const updatePayload: any = {
              status: targetStatus,
              updatedAt: new Date().toISOString()
            };
            if (targetStatus === 'resolved') {
              updatePayload.resolvedAt = resolvedAt;
              updatePayload.resolutionNotes = resolutionNotes || 'Đã khắc phục hoàn tất qua hệ thống';
            }
            await updateDoc(docRef, updatePayload);
            updatedCount++;
            console.log(`Successfully updated Firestore incident ${docId} to status ${targetStatus}`);
          }
        } catch (fErr) {
          console.error("Error updating Firestore from server webhook:", fErr);
        }
      }

      // 2. Update PostgreSQL (Drizzle) to stay in sync
      try {
        if (id) {
          await db.update(incidents).set({
            status: targetStatus,
            resolutionNotes: targetStatus === 'resolved' ? (resolutionNotes || 'Đã khắc phục hoàn tất qua hệ thống') : null,
            resolvedAt: resolvedAt
          }).where(eq(incidents.id, id));
        } else if (deviceSn) {
          await db.update(incidents).set({
            status: targetStatus,
            resolutionNotes: targetStatus === 'resolved' ? (resolutionNotes || 'Đã khắc phục hoàn tất qua hệ thống') : null,
            resolvedAt: resolvedAt
          }).where(eq(incidents.deviceSn, deviceSn));
        }
      } catch (sqlErr) {
        console.error("Error updating SQL db from server webhook:", sqlErr);
      }

      // 3. Update device status if resolved
      if (targetStatus === 'resolved') {
        try {
          const sn = deviceSn || (id ? (await db.select().from(incidents).where(eq(incidents.id, id)).limit(1))[0]?.deviceSn : null);
          if (sn) {
            await db.update(devices).set({
              status: 'active',
              updatedAt: new Date().toISOString()
            }).where(eq(devices.serialNumber, sn));

            if (dbFirestore) {
              const qDev = query(collection(dbFirestore, 'devices'), where('serialNumber', '==', sn));
              const snapDev = await getDocs(qDev);
              snapDev.forEach(async (d) => {
                await updateDoc(doc(dbFirestore, 'devices', d.id), {
                  status: 'active',
                  updatedAt: new Date().toISOString()
                });
              });
            }
          }
        } catch (devErr) {
          console.error("Error updating device status from server webhook:", devErr);
        }
      }

      res.json({
        success: true,
        message: `Đã cập nhật trạng thái sự cố sang '${targetStatus}' thành công!`,
        updatedCount
      });
    } catch (err: any) {
      console.error("Error in update-status endpoint:", err);
      res.status(500).json({ error: err.message });
    }
  });

  // Transfers & Recalls CRUD
  app.get('/api/transfers', async (req, res) => {
    try {
      const dbTransfers = await db.select().from(transfers);
      const mappedTransfers = dbTransfers.map(t => ({
        id: t.id,
        deviceId: t.deviceId,
        deviceSn: t.deviceSn,
        deviceName: t.deviceName,
        type: t.type as any,
        fromLocation: {
          faculty: t.fromFaculty,
          lectureHall: t.fromLectureHall,
          room: t.fromRoom
        },
        toLocation: {
          faculty: t.toFaculty,
          lectureHall: t.toLectureHall,
          room: t.toRoom
        },
        reason: t.reason,
        transferDate: t.transferDate,
        performedBy: t.performedBy,
        receiverName: t.receiverName || undefined,
        documentNumber: t.documentNumber || undefined,
        conditionAtTransfer: t.conditionAtTransfer || undefined,
        notes: t.notes || undefined,
        createdAt: t.createdAt
      }));
      res.json(mappedTransfers);
    } catch (err) {
      console.error('Error fetching transfers:', err);
      res.status(500).json({ error: 'Database error fetching transfers' });
    }
  });

  app.post('/api/transfers', async (req, res) => {
    try {
      const record: DeviceTransferRecord = {
        id: 'trf-' + Date.now(),
        createdAt: new Date().toISOString(),
        ...req.body
      };

      await db.insert(transfers).values({
        id: record.id,
        deviceId: record.deviceId,
        deviceSn: record.deviceSn,
        deviceName: record.deviceName,
        type: record.type,
        fromFaculty: record.fromLocation.faculty,
        fromLectureHall: record.fromLocation.lectureHall,
        fromRoom: record.fromLocation.room,
        toFaculty: record.toLocation.faculty,
        toLectureHall: record.toLocation.lectureHall,
        toRoom: record.toLocation.room,
        reason: record.reason,
        transferDate: record.transferDate,
        performedBy: record.performedBy,
        receiverName: record.receiverName || null,
        documentNumber: record.documentNumber || null,
        conditionAtTransfer: record.conditionAtTransfer || null,
        notes: record.notes || null,
        createdAt: record.createdAt
      });

      // Update affected device location and timestamp
      await db.update(devices).set({
        faculty: record.toLocation.faculty,
        lectureHall: record.toLocation.lectureHall,
        room: record.toLocation.room,
        updatedAt: new Date().toISOString()
      }).where(eq(devices.id, record.deviceId));

      res.status(201).json(record);
    } catch (err) {
      console.error('Error creating transfer:', err);
      res.status(500).json({ error: 'Database error creating transfer' });
    }
  });



  // Serve Vite in development or static files in production
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  // Seed / sync all 42 devices if not already present
  try {
    const existingDevices = await db.select().from(devices);
    const existingSnSet = new Set(existingDevices.map(d => d.serialNumber));
    
    for (const dev of INITIAL_DEVICES) {
      if (!existingSnSet.has(dev.serialNumber)) {
        await db.insert(devices).values({
          id: dev.id,
          serialNumber: dev.serialNumber,
          name: dev.name,
          category: dev.category,
          faculty: dev.location.faculty,
          lectureHall: dev.location.lectureHall,
          room: dev.location.room,
          status: dev.status,
          purchaseDate: dev.purchaseDate,
          warrantyUntil: dev.warrantyUntil,
          supplier: dev.supplier,
          nextMaintenanceDate: dev.nextMaintenanceDate || null,
          notes: dev.notes || null,
          createdAt: dev.createdAt,
          updatedAt: dev.updatedAt
        });
      }
    }
    console.log(`Synced all initial devices successfully.`);
  } catch (err) {
    console.error('Failed to sync initial devices:', err);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server executing at http://0.0.0.0:${PORT}`);
  });
}

startServer();
