import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import { eq, desc, inArray } from 'drizzle-orm';
import { 
  DEFAULT_N8N_CONFIG,
  INITIAL_DEVICES
} from './src/data/mockData.ts';
import { 
  Device, 
  InspectionRecord, 
  PartReplacementRecord, 
  IncidentReport, 
  DeviceTransferRecord,
  N8nConfig, 
  N8nWebhookLog,
  DeviceStatus
} from './src/types.ts';
import { db } from './src/db/index.ts';
import { 
  devices, 
  inspections, 
  replacements, 
  incidents, 
  transfers, 
  n8nWebhookLogs, 
  n8nConfig 
} from './src/db/schema.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Utility to push to n8n webhook log in database
  const addN8nLog = async (direction: 'outbound' | 'inbound', event: string, status: 'success' | 'failed' | 'simulated', payloadSummary: string) => {
    const logItem: N8nWebhookLog = {
      id: 'log-' + Date.now() + '-' + Math.floor(Math.random() * 1000),
      timestamp: new Date().toISOString(),
      direction,
      event,
      status,
      payloadSummary
    };
    try {
      await db.insert(n8nWebhookLogs).values({
        id: logItem.id,
        timestamp: logItem.timestamp,
        direction: logItem.direction,
        event: logItem.event,
        status: logItem.status,
        payloadSummary: logItem.payloadSummary
      });
    } catch (err) {
      console.error('Error saving n8n webhook log:', err);
    }
    return logItem;
  };

  // Helper function to send webhook to n8n if configured
  const triggerN8nWorkflow = async (eventType: string, payload: any) => {
    try {
      const configResult = await db.select().from(n8nConfig).limit(1);
      const activeConfig = configResult.length > 0 ? configResult[0] : DEFAULT_N8N_CONFIG;

      if (!activeConfig.webhookBaseUrl) return;

      await addN8nLog(
        'outbound', 
        eventType, 
        'simulated', 
        `Trigger [${eventType}] gửi đến n8n (${activeConfig.webhookBaseUrl}): SN ${payload.deviceSn || payload.serialNumber || 'N/A'}`
      );
      
      // Optionally attempt actual fetch if external URL provided and not placeholder
      if (activeConfig.webhookBaseUrl.startsWith('http') && !activeConfig.webhookBaseUrl.includes('your-university-server')) {
        fetch(activeConfig.webhookBaseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-N8N-Secret-Token': activeConfig.secretKey || ''
          },
          body: JSON.stringify({
            event: eventType,
            timestamp: new Date().toISOString(),
            data: payload
          })
        }).catch(() => {
          // Silently handle outbound webhook delivery failures
        });
      }
    } catch (err) {
      console.error('N8n trigger error:', err);
    }
  };

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
      await triggerN8nWorkflow('DEVICE_CREATED', newDevice);

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

      // Trigger n8n if status changed
      await triggerN8nWorkflow('DEVICE_UPDATED', updatedDevice);

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

      await triggerN8nWorkflow('DEVICE_DELETED', { id, serialNumber: existing[0].serialNumber, name: existing[0].name });
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

      await triggerN8nWorkflow('DEVICES_BULK_DELETED', { count: ids.length, ids });
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

      await triggerN8nWorkflow('INSPECTION_COMPLETED', record);

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

      await triggerN8nWorkflow('PART_REPLACED', record);

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

      await triggerN8nWorkflow('INCIDENT_REPORTED', report);

      res.status(201).json(report);
    } catch (err) {
      console.error('Error creating incident:', err);
      res.status(500).json({ error: 'Database error creating incident' });
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

      await triggerN8nWorkflow('INCIDENT_UPDATED', updatedReport);

      res.json(updatedReport);
    } catch (err) {
      console.error('Error updating incident:', err);
      res.status(500).json({ error: 'Database error updating incident' });
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

      await triggerN8nWorkflow(record.type === 'transfer' ? 'DEVICE_TRANSFERRED' : 'DEVICE_RECALLED', record);

      res.status(201).json(record);
    } catch (err) {
      console.error('Error creating transfer:', err);
      res.status(500).json({ error: 'Database error creating transfer' });
    }
  });

  // --- N8N WORKFLOW INTEGRATION ENDPOINTS ---

  app.get('/api/n8n/config', async (req, res) => {
    try {
      const configResult = await db.select().from(n8nConfig).limit(1);
      if (configResult.length === 0) {
        res.json(DEFAULT_N8N_CONFIG);
      } else {
        res.json(configResult[0]);
      }
    } catch (err) {
      console.error('Error fetching n8n config:', err);
      res.json(DEFAULT_N8N_CONFIG);
    }
  });

  app.post('/api/n8n/config', async (req, res) => {
    try {
      const updateData = req.body;
      const existing = await db.select().from(n8nConfig).limit(1);
      const timestamp = new Date().toISOString();

      if (existing.length === 0) {
        await db.insert(n8nConfig).values({
          id: 1,
          webhookBaseUrl: updateData.webhookBaseUrl || '',
          secretKey: updateData.secretKey || '',
          activeTriggers: updateData.activeTriggers || {
            incidentReported: true,
            maintenanceNeeded: true,
            partReplaced: true,
            deviceStatusChanged: true,
            deviceTransferred: true
          },
          lastSyncAt: timestamp
        });
      } else {
        await db.update(n8nConfig).set({
          webhookBaseUrl: updateData.webhookBaseUrl !== undefined ? updateData.webhookBaseUrl : existing[0].webhookBaseUrl,
          secretKey: updateData.secretKey !== undefined ? updateData.secretKey : existing[0].secretKey,
          activeTriggers: updateData.activeTriggers !== undefined ? updateData.activeTriggers : existing[0].activeTriggers,
          lastSyncAt: timestamp
        }).where(eq(n8nConfig.id, 1));
      }

      await addN8nLog('outbound', 'CONFIG_UPDATE', 'success', 'Cập nhật cấu hình Webhook n8n thành công');
      
      const updatedConfig = await db.select().from(n8nConfig).limit(1);
      res.json(updatedConfig[0]);
    } catch (err) {
      console.error('Error updating n8n config:', err);
      res.status(500).json({ error: 'Database error updating n8n config' });
    }
  });

  app.get('/api/n8n/logs', async (req, res) => {
    try {
      const dbLogs = await db.select().from(n8nWebhookLogs).orderBy(desc(n8nWebhookLogs.timestamp)).limit(50);
      res.json(dbLogs);
    } catch (err) {
      console.error('Error fetching n8n logs:', err);
      res.status(500).json({ error: 'Database error fetching logs' });
    }
  });

  // Inbound Webhook Endpoint for n8n: allows n8n workflow to trigger updates in the app!
  app.post('/api/n8n/webhook', async (req, res) => {
    try {
      const { action, serialNumber, deviceId, status, inspection, replacement, incidentNote } = req.body;

      let affectedDevice: any;
      if (serialNumber) {
        const found = await db.select().from(devices).where(eq(devices.serialNumber, serialNumber)).limit(1);
        if (found.length > 0) affectedDevice = found[0];
      } else if (deviceId) {
        const found = await db.select().from(devices).where(eq(devices.id, deviceId)).limit(1);
        if (found.length > 0) affectedDevice = found[0];
      }

      await addN8nLog(
        'inbound',
        action || 'N8N_INBOUND_WEBHOOK',
        affectedDevice ? 'success' : 'failed',
        `n8n nhận lệnh: Action=[${action || 'UPDATE'}], SN=[${serialNumber || deviceId || 'ALL'}], Status=[${status || 'N/A'}]`
      );

      if (action === 'update_device_status' && affectedDevice) {
        const targetStatus = status || affectedDevice.status;
        await db.update(devices).set({
          status: targetStatus,
          updatedAt: new Date().toISOString()
        }).where(eq(devices.id, affectedDevice.id));

        const updated = {
          ...affectedDevice,
          status: targetStatus,
          location: {
            faculty: affectedDevice.faculty,
            lectureHall: affectedDevice.lectureHall,
            room: affectedDevice.room
          }
        };

        return res.json({ 
          success: true, 
          message: `Đã tự động cập nhật trạng thái thiết bị ${affectedDevice.serialNumber} thành ${targetStatus}`,
          device: updated 
        });
      }

      if (action === 'add_inspection' && affectedDevice && inspection) {
        const newInsp: InspectionRecord = {
          id: 'insp-n8n-' + Date.now(),
          deviceId: affectedDevice.id,
          deviceSn: affectedDevice.serialNumber,
          deviceName: affectedDevice.name,
          inspectorName: inspection.inspectorName || 'n8n Automated Bot',
          inspectionDate: inspection.inspectionDate || new Date().toISOString().split('T')[0],
          result: inspection.result || 'passed',
          checkPower: inspection.checkPower ?? true,
          checkDisplayAudio: inspection.checkDisplayAudio ?? true,
          checkConnections: inspection.checkConnections ?? true,
          checkCleaningFan: inspection.checkCleaningFan ?? true,
          notes: inspection.notes || 'Cập nhật tự động từ n8n workflow',
          actionRequired: inspection.actionRequired
        };

        await db.insert(inspections).values({
          id: newInsp.id,
          deviceId: newInsp.deviceId,
          deviceSn: newInsp.deviceSn,
          deviceName: newInsp.deviceName,
          inspectorName: newInsp.inspectorName,
          inspectionDate: newInsp.inspectionDate,
          result: newInsp.result,
          checkPower: newInsp.checkPower,
          checkDisplayAudio: newInsp.checkDisplayAudio,
          checkConnections: newInsp.checkConnections,
          checkCleaningFan: newInsp.checkCleaningFan,
          notes: newInsp.notes,
          actionRequired: newInsp.actionRequired || null
        });

        return res.json({ success: true, message: 'Thêm kiểm tra định kỳ từ n8n thành công', inspection: newInsp });
      }

      res.json({
        success: true,
        receivedAt: new Date().toISOString(),
        message: 'Đã nhận webhook n8n thành công!',
        affectedDevice: affectedDevice ? {
          ...affectedDevice,
          location: {
            faculty: affectedDevice.faculty,
            lectureHall: affectedDevice.lectureHall,
            room: affectedDevice.room
          }
        } : null
      });
    } catch (err) {
      console.error('Error handling n8n webhook:', err);
      res.status(500).json({ error: 'Database error handling n8n webhook' });
    }
  });

  // Exportable n8n Workflow JSON template for users to import directly into n8n
  app.get('/api/n8n/template', (req, res) => {
    const n8nTemplate = {
      name: "n8n Equipment Maintenance & Incident Notification Workflow",
      nodes: [
        {
          parameters: {
            httpMethod: "POST",
            path: "equipment-maintenance-webhook",
            options: {}
          },
          name: "Webhook Trigger",
          type: "n8n-nodes-base.webhook",
          typeVersion: 1,
          position: [100, 300]
        },
        {
          parameters: {
            dataType: "string",
            value1: "={{$json[\"event\"]}}",
            rules: {
              rules: [
                { value2: "INCIDENT_REPORTED", output: 0 },
                { value2: "PART_REPLACED", output: 1 },
                { value2: "INSPECTION_COMPLETED", output: 2 }
              ]
            }
          },
          name: "Switch Event Type",
          type: "n8n-nodes-base.switch",
          typeVersion: 1,
          position: [320, 300]
        },
        {
          parameters: {
            chatId: "-100123456789",
            text: "🚨 *BÁO CÁO SỰ CỐ MỚI THIẾT BỊ GIẢNG ĐƯỜNG*\n\n🔹 *Thiết bị:* {{$json[\"data\"][\"deviceName\"]}}\n🔹 *Mã SN:* {{$json[\"data\"][\"deviceSn\"]}}\n📍 *Vị trí:* {{$json[\"data\"][\"faculty\"]}} - {{$json[\"data\"][\"room\"]}}\n⚠️ *Mức độ:* {{$json[\"data\"][\"severity\"]}}\n📝 *Mô tả:* {{$json[\"data\"][\"description\"]}}\n\n_Vui lòng cử kỹ thuật viên kiểm tra khẩn cấp!_",
            additionalFields: { parse_mode: "Markdown" }
          },
          name: "Telegram Alert Bot",
          type: "n8n-nodes-base.telegram",
          typeVersion: 1,
          position: [560, 180]
        },
        {
          parameters: {
            operation: "append",
            sheetId: "1AbCdEfGhIjKlMnOpQrStUvWxYz_SHEET_ID",
            range: "Lịch sử Thay Vật tư!A:F",
            options: {}
          },
          name: "Google Sheets Sync",
          type: "n8n-nodes-base.googleSheets",
          typeVersion: 1,
          position: [560, 320]
        },
        {
          parameters: {
            requestMethod: "POST",
            url: "={{$node[\"Webhook Trigger\"].json[\"appUrl\"] || \"https://your-app-domain.com\"}}/api/n8n/webhook",
            jsonParameters: true,
            bodyParametersJson: "{\n  \"action\": \"update_device_status\",\n  \"serialNumber\": \"{{$json[\"data\"][\"deviceSn\"]}}\",\n  \"status\": \"maintenance_needed\"\n}"
          },
          name: "HTTP Return to App",
          type: "n8n-nodes-base.httpRequest",
          typeVersion: 1,
          position: [560, 460]
        }
      ],
      connections: {
        "Webhook Trigger": {
          main: [[{ node: "Switch Event Type", type: "main", index: 0 }]]
        },
        "Switch Event Type": {
          main: [
            [{ node: "Telegram Alert Bot", type: "main", index: 0 }],
            [{ node: "Google Sheets Sync", type: "main", index: 0 }],
            [{ node: "HTTP Return to App", type: "main", index: 0 }]
          ]
        }
      }
    };

    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Content-Disposition', 'attachment; filename=n8n-maintenance-workflow.json');
    res.json(n8nTemplate);
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
