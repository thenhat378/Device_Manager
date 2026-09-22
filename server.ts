import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { eq, desc, inArray } from 'drizzle-orm';
import { GoogleGenAI } from '@google/genai';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, updateDoc, collection, getDocs, query, where } from 'firebase/firestore';
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

async function safeTriggerWebhook(url: string, payload: any, retries = 3, delayMs = 1000): Promise<Response> {
  let lastError: any = null;
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000); // 6s timeout to prevent hanging the app

      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal
      });
      clearTimeout(timeoutId);

      if (res.ok) {
        return res;
      }
      if (res.status >= 500) {
        throw new Error(`Server returned error status: ${res.status}`);
      }
      return res; // Return non-retryable response
    } catch (err: any) {
      lastError = err;
      console.warn(`Webhook attempt ${attempt} failed: ${err.message || err}. Retrying in ${delayMs * attempt}ms...`);
      if (attempt < retries) {
        await new Promise(resolve => setTimeout(resolve, delayMs * attempt)); // Exponential backoff
      }
    }
  }
  throw lastError || new Error('All webhook attempts failed');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Utility to push to n8n webhook log in database


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

      // Trigger n8n Telegram workflow if webhook is configured in env
      if (process.env.N8N_WEBHOOK_URL) {
        const formatRoom = (rm: string) => {
          if (!rm) return 'Không rõ phòng';
          if (rm.toLowerCase().startsWith('phòng')) return rm;
          return `Phòng ${rm}`;
        };

        const telegramMessageText = `🚨BÁO CÁO SỰ CỐ THIẾT BỊ MỚI 🚨\n` +
          `Thông tin chi tiết\n` +
          `🏢 Vị trí / Phòng\n` +
          `${formatRoom(report.room)}\n` +
          `📟 Thiết bị cần báo lỗi:\n` +
          `${report.deviceName} (SN: ${report.deviceSn})\n` +
          `👤 Người báo cáo\n` +
          `${report.reporterName || 'Cán Bộ Kỹ Thuật'}\n` +
          `📝 Mô tả từ người dùng\n` +
          `${report.description}`;

        safeTriggerWebhook(process.env.N8N_WEBHOOK_URL, {
          event: 'new_incident',
          timestamp: new Date().toISOString(),
          message: telegramMessageText,
          incident: report
        }).then(() => {
          console.log('Successfully triggered n8n Telegram webhook for incident:', report.id);
        }).catch(webhookErr => {
          console.warn('Could not trigger optional n8n webhook (non-fatal):', webhookErr.message || webhookErr);
        });
      }

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

  // Discord Webhook Sending Endpoint
  app.post('/api/discord/send', async (req, res) => {
    try {
      const { webhookUrl, faultData, eventType, resolutionNotes } = req.body;
      const targetUrl = webhookUrl || process.env.DISCORD_WEBHOOK_URL || 'https://discordapp.com/api/webhooks/1536963623295909888/GeJsvcz_wBp13avyIy_BKEq2M_brDAkDKtvbEOvRJzYxMyVVKNRvzpC55in9EYhgr7U-';

      if (!targetUrl) {
        return res.status(400).json({ error: 'Chưa cấu hình Discord Webhook URL' });
      }

      // 1. Generate AI Analysis if it's a new incident
      let aiAnalysis = '';
      if (!eventType || eventType === 'new') {
        aiAnalysis = await getAiAnalysis(faultData.deviceName, faultData.room, faultData.description);
      }

      // 2. Build message payload based on event type
      let messagePayload: any = {
        username: "Hệ thống Báo hỏng DUE",
        avatar_url: "https://cdn-icons-png.flaticon.com/512/1046/1046365.png",
      };

      if (!eventType || eventType === 'new') {
        const formatRoom = (rm: string) => {
          if (!rm) return 'Không rõ phòng';
          if (rm.toLowerCase().startsWith('phòng')) return rm;
          return `Phòng ${rm}`;
        };

        messagePayload.content = `🚨 **BÁO CÁO SỰ CỐ THIẾT BỊ MỚI** 🚨\n` +
          `Thông tin chi tiết\n` +
          `🏢 Vị trí / Phòng\n` +
          `**${formatRoom(faultData.room)}**\n` +
          `📟 Thiết bị cần báo lỗi:\n` +
          `**${faultData.deviceName}** (SN: ${faultData.sn})\n` +
          `👤 Người báo cáo\n` +
          `**${faultData.reporter}**\n` +
          `📝 Mô tả từ người dùng\n` +
          `*${faultData.description}*`;

        messagePayload.embeds = [
          {
            title: "Thông tin chi tiết (Kèm Chẩn đoán AI)",
            color: 16711680, // Mã màu Đỏ (Red)
            fields: [
              {
                name: "🏢 Vị trí / Phòng",
                value: `**${formatRoom(faultData.room)}**`,
                inline: true
              },
              {
                name: "📟 Thiết bị lỗi",
                value: `**${faultData.deviceName}**\n(Mã: ${faultData.sn})`,
                inline: true
              },
              {
                name: "👤 Người báo cáo",
                value: `${faultData.reporter}`,
                inline: true
              },
              {
                name: "📝 Mô tả từ người dùng",
                value: `${faultData.description}`,
                inline: false
              },
              {
                name: "🤖 AI Chẩn đoán sơ bộ",
                value: `\`\`\`yaml\n${aiAnalysis}\n\`\`\``,
                inline: false
              }
            ],
            footer: {
              text: "Hệ thống Quản trị Cơ sở vật chất"
            },
            timestamp: new Date().toISOString()
          }
        ];
      } else if (eventType === 'accepted') {
        messagePayload.content = "🔧 **TIẾP NHẬN SỰ CỐ THIẾT BỊ** 🔧";
        messagePayload.embeds = [
          {
            title: "Thông tin tiếp nhận",
            color: 16753920, // Mã màu Cam (Orange)
            fields: [
              {
                name: "🏢 Vị trí / Phòng",
                value: `**${faultData.room}**`,
                inline: true
              },
              {
                name: "📟 Thiết bị lỗi",
                value: `**${faultData.deviceName}**\n(Mã: ${faultData.sn})`,
                inline: true
              },
              {
                name: "👤 Kỹ thuật tiếp nhận",
                value: `${faultData.reporter}`,
                inline: true
              },
              {
                name: "📝 Mô tả từ người dùng",
                value: `${faultData.description}`,
                inline: false
              },
              {
                name: "💬 Trạng thái xử lý",
                value: "Kỹ thuật viên đang tiến hành kiểm tra và khắc phục lỗi.",
                inline: false
              }
            ],
            footer: {
              text: "Hệ thống Quản trị Cơ sở vật chất"
            },
            timestamp: new Date().toISOString()
          }
        ];
      } else if (eventType === 'resolved') {
        messagePayload.content = "✅ **ĐÃ KHẮC PHỤC XONG SỰ CỐ** ✅";
        messagePayload.embeds = [
          {
            title: "Kết quả khắc phục",
            color: 65280, // Mã màu Xanh lá (Green)
            fields: [
              {
                name: "🏢 Vị trí / Phòng",
                value: `**${faultData.room}**`,
                inline: true
              },
              {
                name: "📟 Thiết bị lỗi",
                value: `**${faultData.deviceName}**\n(Mã: ${faultData.sn})`,
                inline: true
              },
              {
                name: "👤 Kỹ thuật thực hiện",
                value: `${faultData.reporter}`,
                inline: true
              },
              {
                name: "📢 Phương án khắc phục",
                value: `${resolutionNotes || 'Đã xử lý hoàn tất'}`,
                inline: false
              },
              {
                name: "💬 Trạng thái thiết bị",
                value: "Thiết bị đã hoạt động bình thường trở lại.",
                inline: false
              }
            ],
            footer: {
              text: "Hệ thống Quản trị Cơ sở vật chất"
            },
            timestamp: new Date().toISOString()
          }
        ];
      }

      const response = await fetch(targetUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(messagePayload)
      });

      if (response.ok) {
        res.json({ success: true, message: "Đã gửi thông báo Discord thành công!" });
      } else {
        const errorText = await response.text();
        console.error("Lỗi từ Discord Webhook:", response.status, errorText);
        res.status(400).json({ error: `Lỗi từ Discord: ${response.status} - ${errorText}` });
      }
    } catch (err: any) {
      console.error("Lỗi kết nối khi gọi Discord:", err);
      res.status(500).json({ error: `Lỗi kết nối Discord Webhook: ${err.message}` });
    }
  });

  app.post('/api/n8n/trigger-telegram', async (req, res) => {
    try {
      const { webhookUrl, message, incident } = req.body;
      const targetUrl = webhookUrl || process.env.N8N_WEBHOOK_URL;
      
      if (!targetUrl) {
        return res.status(400).json({ error: 'Chưa cấu hình n8n Webhook URL' });
      }

      const payload = {
        source: 'DUE Equipment Management',
        timestamp: new Date().toISOString(),
        message: message || 'Test kích hoạt n8n workflow gửi Telegram thông báo sự cố',
        incident: incident || {
          deviceSn: 'TEST-SN-01',
          deviceName: 'Thiết bị kiểm tra giả lập',
          faculty: 'Khoa CNTT',
          room: 'Phòng thực hành A1',
          severity: 'urgent',
          description: 'Kiểm tra tín hiệu kết nối Telegram từ hệ thống n8n workflow.'
        }
      };

      const response = await safeTriggerWebhook(targetUrl, payload);
      const responseText = await response.text();
      res.json({ success: true, status: response.status, responseText });
    } catch (err: any) {
      console.warn('Could not trigger n8n webhook (non-fatal):', err.message || err);
      res.status(502).json({ error: `Không thể kết nối n8n webhook: ${err.message || 'Lỗi mạng hoặc sai tên miền URL'}` });
    }
  });

  // Direct Telegram Integration Endpoints
  app.post('/api/telegram/send', async (req, res) => {
    try {
      const { token, chatId, message, incident } = req.body;
      const targetToken = token || process.env.TELEGRAM_BOT_TOKEN || '8611136413:AAHYvr_pXyA6sjC-2SlVI0WPUcqq5K8S5iI';
      const targetChatId = chatId || process.env.TELEGRAM_CHAT_ID;

      if (!targetToken) {
        return res.status(400).json({ error: 'Chưa cấu hình Telegram Bot Token' });
      }
      if (!targetChatId) {
        return res.status(400).json({ error: 'Chưa cung cấp Chat ID người nhận' });
      }

      function escapeHTML(str: string) {
        return (str || '')
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;');
      }

      let text = message;
      if (incident) {
        const formatRoom = (rm: string) => {
          if (!rm) return 'Không rõ phòng';
          if (rm.toLowerCase().startsWith('phòng')) return rm;
          return `Phòng ${rm}`;
        };
        
        text = `🚨<b>BÁO CÁO SỰ CỐ THIẾT BỊ MỚI</b> 🚨\n` +
               `Thông tin chi tiết\n` +
               `🏢 Vị trí / Phòng\n` +
               `<b>${escapeHTML(formatRoom(incident.room))}</b>\n` +
               `📟 Thiết bị cần báo lỗi:\n` +
               `<b>${escapeHTML(incident.deviceName)}</b> (SN: <code>${escapeHTML(incident.deviceSn)}</code>)\n` +
               `👤 Người báo cáo\n` +
               `<b>${escapeHTML(incident.reporterName || 'Cán Bộ Kỹ Thuật')}</b>\n` +
               `📝 Mô tả từ người dùng\n` +
               `<i>${escapeHTML(incident.description)}</i>`;
      }

      const telegramUrl = `https://api.telegram.org/bot${targetToken}/sendMessage`;
      const response = await fetch(telegramUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: targetChatId,
          text: text || 'Tín hiệu kết nối từ DUE Equipment Management hoạt động tốt!',
          parse_mode: 'HTML'
        })
      });

      const resData: any = await response.json();
      if (!resData.ok) {
        return res.status(400).json({ error: resData.description || 'Lỗi từ Telegram API' });
      }

      res.json({ success: true, result: resData.result });
    } catch (err: any) {
      console.error('Error sending Telegram message:', err);
      res.status(500).json({ error: err.message || 'Lỗi kết nối tới Telegram API' });
    }
  });

  app.post('/api/telegram/get-updates', async (req, res) => {
    try {
      const { token } = req.body;
      const targetToken = token || process.env.TELEGRAM_BOT_TOKEN || '8611136413:AAHYvr_pXyA6sjC-2SlVI0WPUcqq5K8S5iI';

      if (!targetToken) {
        return res.status(400).json({ error: 'Chưa cung cấp Telegram Bot Token' });
      }

      const response = await fetch(`https://api.telegram.org/bot${targetToken}/getUpdates?timeout=3`);
      const data: any = await response.json();

      if (!data.ok) {
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

  // Dedicated Webhook endpoint for Discord/n8n to update incident status
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
              updatePayload.resolutionNotes = resolutionNotes || 'Đã khắc phục hoàn tất qua Discord';
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
            resolutionNotes: targetStatus === 'resolved' ? (resolutionNotes || 'Đã khắc phục hoàn tất qua Discord') : null,
            resolvedAt: resolvedAt
          }).where(eq(incidents.id, id));
        } else if (deviceSn) {
          await db.update(incidents).set({
            status: targetStatus,
            resolutionNotes: targetStatus === 'resolved' ? (resolutionNotes || 'Đã khắc phục hoàn tất qua Discord') : null,
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
