/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useState, useRef } from 'react';
import { 
  Device, 
  InspectionRecord, 
  PartReplacementRecord, 
  IncidentReport, 
  User, 
  UserRole, 
  ToastMessage,
  ToastType,
  DeviceTransferRecord,
  DeviceInventoryRecord
} from './types';
import { db, auth } from './lib/firebase';
import { 
  collection, 
  onSnapshot, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc, 
  addDoc, 
  query, 
  orderBy 
} from 'firebase/firestore';
import { handleFirestoreError, OperationType } from './lib/errorHandling';
import { Header } from './components/Header';
import { Sidebar } from './components/Sidebar';
import { LoginForm } from './components/LoginForm';
import { DeviceManagement } from './components/DeviceManagement';
import { MaintenanceForm } from './components/MaintenanceForm';
import { DeviceTransferManagement } from './components/DeviceTransferManagement';
import { AnalyticsDashboard } from './components/AnalyticsDashboard';
import { UserManagement } from './components/UserManagement';
import { DeviceInventory } from './components/DeviceInventory';
import { QRScannerModal } from './components/QRScannerModal';
import { QRGeneratorModal } from './components/QRGeneratorModal';
import { BatchQRPrintModal } from './components/BatchQRPrintModal';
import { ToastContainer } from './components/ToastContainer';
import { AdminProfileModal } from './components/AdminProfileModal';
import { QuickChatbot } from './components/QuickChatbot';
import { TelegramConfigModal } from './components/TelegramConfigModal';
import { StaffChatbotPortal } from './components/StaffChatbotPortal';

export default function App() {
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    try {
      const saved = localStorage.getItem('current_user');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [activeTab, setActiveTab] = useState<'devices' | 'maintenance' | 'transfers' | 'analytics' | 'users' | 'inventory'>('devices');
  const [isAdminProfileOpen, setIsAdminProfileOpen] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [isChatbotOpen, setIsChatbotOpen] = useState(false);

  useEffect(() => {
    if (currentUser) {
      localStorage.setItem('current_user', JSON.stringify(currentUser));
    } else {
      localStorage.removeItem('current_user');
    }
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.role === 'staff') {
      setActiveTab('maintenance');
    }
  }, [currentUser]);

  // Core App State
  const [devices, setDevices] = useState<Device[]>([]);
  const [inspections, setInspections] = useState<InspectionRecord[]>([]);
  const [replacements, setReplacements] = useState<PartReplacementRecord[]>([]);
  const [incidents, setIncidents] = useState<IncidentReport[]>([]);
  const [transfers, setTransfers] = useState<DeviceTransferRecord[]>([]);
  const [inventories, setInventories] = useState<DeviceInventoryRecord[]>([]);
  const [selectedTransferDeviceId, setSelectedTransferDeviceId] = useState<string | null>(null);
  const [selectedInventoryDevice, setSelectedInventoryDevice] = useState<Device | null>(null);

  // Toast Notifications State
  const [toasts, setToasts] = useState<ToastMessage[]>([]);

  // Modals
  const [isScannerOpen, setIsScannerOpen] = useState(false);
  const [scannerCallback, setScannerCallback] = useState<((sn: string) => void) | null>(null);

  const [isQRGenOpen, setIsQRGenOpen] = useState(false);
  const [selectedQRDevice, setSelectedQRDevice] = useState<Device | null>(null);

  const [isBatchQRPrintOpen, setIsBatchQRPrintOpen] = useState(false);

  // Telegram Integration State
  const [telegramChatId, setTelegramChatId] = useState<string>(() => localStorage.getItem('DUE_TELEGRAM_CHAT_ID') || '');
  const [telegramBotToken, setTelegramBotToken] = useState<string>(() => localStorage.getItem('DUE_TELEGRAM_BOT_TOKEN') || '8715568190:AAEKFL-s06KAuNDVldDB0eyVLhrEcrSVgV8');
  const [isTelegramModalOpen, setIsTelegramModalOpen] = useState(false);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);

  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choiceResult = await deferredPrompt.userChoice;
      if (choiceResult.outcome === 'accepted') {
        console.log('User accepted the install prompt');
      } else {
        console.log('User dismissed the install prompt');
      }
      setDeferredPrompt(null);
      setIsInstallable(false);
    }
  };

  const isFirstLoadIncidents = useRef(true);

  const triggerDeviceNotification = (title: string, body: string, url: string = '/') => {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;
    if (localStorage.getItem('DUE_ENABLE_DEVICE_NOTIFICATIONS') === 'false') return;

    const options = {
      body,
      icon: '/icon.svg',
      badge: '/icon.svg',
      vibrate: [100, 50, 100],
      data: { url }
    };

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((registration) => {
        registration.showNotification(title, options);
      }).catch(() => {
        new Notification(title, options);
      });
    } else {
      new Notification(title, options);
    }
  };

  // Toast Helper
  const addToast = (
    title: string, 
    message: string, 
    type: ToastType = 'info', 
    deviceSn?: string,
    onClick?: () => void
  ) => {
    const newToast: ToastMessage = {
      id: 'toast-' + Date.now() + '-' + Math.random().toString(36).substring(2, 6),
      title,
      message,
      type,
      timestamp: new Date().toISOString(),
      deviceSn,
      onClick
    };
    setToasts(prev => [newToast, ...prev].slice(0, 6));

    // Auto clear toast after 5s (or 8s if actionable)
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== newToast.id));
    }, onClick ? 8000 : 5000);
  };

  const handleDismissToast = (id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id));
  };

  const handleClearAllToasts = () => {
    setToasts([]);
  };

  // Test notification trigger
  const handleTriggerTestToast = () => {
    const sampleTypes: { title: string; message: string; type: ToastType; sn: string }[] = [
      {
        title: 'Cảnh Báo Hư Hỏng Thiết Bị!',
        message: 'Máy chiếu Panasonic PT-LB386 tại phòng A101 vừa báo sự cố bóng đèn hỏng.',
        type: 'error',
        sn: 'SN-PJ386-9921'
      },
      {
        title: 'Cần Bảo Trì Định Kỳ',
        message: 'Máy tính PC Dell Vostro tại B204 cần vệ sinh quạt tản nhiệt.',
        type: 'warning',
        sn: 'SN-PC-DELL-8830'
      },
      {
        title: 'Thay Thế Vật Tư Thành Công',
        message: 'Đã thay mới Micro không dây Shure SVX288 cho phòng A102.',
        type: 'success',
        sn: 'SN-MIC-SHURE-221'
      }
    ];
    const item = sampleTypes[Math.floor(Math.random() * sampleTypes.length)];
    addToast(item.title, item.message, item.type, item.sn);
  };

  // Fetch from Express backend on mount
  useEffect(() => {
    if (!currentUser) return;

    const unsubDevices = onSnapshot(collection(db, 'devices'), 
      (snapshot) => setDevices(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Device)).filter(d => d.id !== '_settings')),
      (error) => handleFirestoreError(error, OperationType.LIST, 'devices')
    );
    const unsubInspections = onSnapshot(collection(db, 'inspections'), 
      (snapshot) => setInspections(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as InspectionRecord))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'inspections')
    );
    const unsubReplacements = onSnapshot(collection(db, 'replacements'), 
      (snapshot) => setReplacements(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as PartReplacementRecord))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'replacements')
    );
    const unsubIncidents = onSnapshot(collection(db, 'incidents'), 
      (snapshot) => {
        const parsed = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as IncidentReport));
        setIncidents(parsed);

        // Check if it's the very first snapshot load (ignore historical records)
        if (isFirstLoadIncidents.current) {
          isFirstLoadIncidents.current = false;
          return;
        }

        // Only notify on active changes to the database
        snapshot.docChanges().forEach((change) => {
          const incData = { id: change.doc.id, ...change.doc.data() } as IncidentReport;
          
          if (change.type === 'added') {
            triggerDeviceNotification(
              `🚨 BÁO SỰ CỐ MỚI: ${incData.deviceName}`,
              `Vị trí: ${incData.room} - ${incData.faculty}. Mức độ: ${(incData.severity || 'trung bình').toUpperCase()}`,
              '/maintenance'
            );
          } else if (change.type === 'modified') {
            if (incData.status === 'in_progress') {
              triggerDeviceNotification(
                `🔧 SỰ CỐ ĐÃ ĐƯỢC TIẾP NHẬN`,
                `Sự cố của ${incData.deviceName} (SN: ${incData.deviceSn}) tại phòng ${incData.room} đã được tiếp nhận để xử lý.`,
                '/maintenance'
              );
              addToast(
                `🔧 Đã Tiếp Nhận Sự Cố`,
                `Kỹ thuật viên đã tiếp nhận sự cố thiết bị ${incData.deviceName} (Mã: ${incData.deviceSn}) tại phòng ${incData.room} và đang xử lý!`,
                'info',
                incData.deviceSn
              );
            } else if (incData.status === 'resolved') {
              triggerDeviceNotification(
                `✅ ĐÃ KHẮC PHỤC XONG`,
                `Sự cố của ${incData.deviceName} (SN: ${incData.deviceSn}) đã sửa xong: ${incData.resolutionNotes || 'Đã khắc phục hoàn tất'}`,
                '/maintenance'
              );
              addToast(
                `✅ Đã Khắc Phục Sự Cố`,
                `Sự cố thiết bị ${incData.deviceName} (Mã: ${incData.deviceSn}) tại phòng ${incData.room} đã được sửa xong: ${incData.resolutionNotes || 'Hoạt động tốt'}`,
                'success',
                incData.deviceSn
              );
            }
          }
        });
      },
      (error) => handleFirestoreError(error, OperationType.LIST, 'incidents')
    );
    const unsubTransfers = onSnapshot(collection(db, 'transfers'), 
      (snapshot) => setTransfers(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DeviceTransferRecord))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'transfers')
    );
    const unsubInventories = onSnapshot(collection(db, 'inventories'), 
      (snapshot) => setInventories(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as DeviceInventoryRecord))),
      (error) => handleFirestoreError(error, OperationType.LIST, 'inventories')
    );

    // Sync app_config (Telegram settings) across all sessions in real-time
    const unsubConfig = onSnapshot(doc(db, 'settings', 'app_config'), (snapshot) => {
      if (snapshot.exists()) {
        const data = snapshot.data();
        if (data?.telegramChatId) {
          setTelegramChatId(data.telegramChatId);
          localStorage.setItem('DUE_TELEGRAM_CHAT_ID', data.telegramChatId);
        }
        if (data?.telegramBotToken) {
          setTelegramBotToken(data.telegramBotToken);
          localStorage.setItem('DUE_TELEGRAM_BOT_TOKEN', data.telegramBotToken);
        }
      }
    }, (error) => {
      console.warn('App config sync:', error);
    });
    
    return () => {
      unsubDevices();
      unsubInspections();
      unsubReplacements();
      unsubIncidents();
      unsubTransfers();
      unsubInventories();
      unsubConfig();
    };
  }, [currentUser]);

  useEffect(() => {
    if (currentUser?.role === 'staff' && activeTab !== 'maintenance') {
      setActiveTab('maintenance');
    }
  }, [currentUser, activeTab]);

  const sanitizeForFirestore = <T extends Record<string, any>>(obj: T): T => {
    return Object.fromEntries(
      Object.entries(obj).filter(([_, v]) => v !== undefined)
    ) as T;
  };

  // Device Actions
  const handleAddDevice = async (deviceData: Omit<Device, 'id' | 'createdAt' | 'updatedAt'>) => {
    const newDev: Omit<Device, 'id'> = {
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      ...deviceData
    };
    
    addToast('Đã thêm thiết bị mới', `Khai báo thiết bị ${deviceData.name} thành công.`, 'success', deviceData.serialNumber);

    try {
      await addDoc(collection(db, 'devices'), sanitizeForFirestore(newDev));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'devices');
    }
  };

  const handleImportDevices = async (imported: Device[]) => {
    try {
      // Check for duplicates with existing devices
      const existingSns = new Set(devices.map(d => d.serialNumber.trim().toLowerCase()));
      const duplicatesInImport = new Set<string>();
      const seenImportSns = new Set<string>();

      const validImported = imported.filter(item => {
        const sn = item.serialNumber.trim().toLowerCase();
        if (existingSns.has(sn)) {
          duplicatesInImport.add(item.serialNumber);
          return false;
        }
        if (seenImportSns.has(sn)) {
          duplicatesInImport.add(item.serialNumber);
          return false;
        }
        seenImportSns.add(sn);
        return true;
      });

      if (duplicatesInImport.size > 0) {
        alert(`Cảnh báo: Phát hiện ${duplicatesInImport.size} thiết bị có mã số sê-ri đã tồn tại hoặc bị trùng trong danh sách nhập khẩu. Các thiết bị này sẽ bị bỏ qua để tránh trùng lặp.\nDanh sách sê-ri trùng: ${Array.from(duplicatesInImport).join(', ')}`);
      }

      if (validImported.length === 0) {
        addToast('Không có thiết bị mới', 'Tất cả thiết bị nhập vào đều có mã sê-ri đã tồn tại trên hệ thống.', 'warning');
        return;
      }

      const batchRequests = validImported.map(item => {
        const newRecord: Omit<Device, 'id'> = {
           createdAt: new Date().toISOString(),
           updatedAt: new Date().toISOString(),
           serialNumber: item.serialNumber,
           name: item.name,
           category: item.category,
           location: item.location,
           status: item.status,
           purchaseDate: item.purchaseDate,
           warrantyUntil: item.warrantyUntil,
           supplier: item.supplier,
           nextMaintenanceDate: item.nextMaintenanceDate, specs: item.specs || '',
           notes: item.notes
        };
        return addDoc(collection(db, 'devices'), sanitizeForFirestore(newRecord));
      });
      await Promise.all(batchRequests);
      addToast('Nhập file thành công', `Đã đồng bộ ${validImported.length} thiết bị vào danh mục.`, 'success');
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'devices');
    }
  };

  const handleDeleteMultipleDevices = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (currentUser?.role !== 'admin') {
      addToast('Quyền truy cập bị từ chối', 'Chỉ Quản trị viên mới được phép xóa thiết bị.', 'error');
      return;
    }
    try {
      const batchRequests = ids.map(id => deleteDoc(doc(db, 'devices', id)));
      await Promise.all(batchRequests);
      addToast('Xóa hàng loạt', `Đã xóa thành công ${ids.length} thiết bị khỏi danh sách.`, 'info');
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'devices');
    }
  };

  const handleUpdateDevice = async (id: string, updates: Partial<Device>) => {
    const targetDev = devices.find(d => d.id === id);
    
    if (updates.status && targetDev) {
      if (updates.status === 'damaged') {
        addToast(
          'Cảnh báo: Thiết bị Hư Hỏng!',
          `Thiết bị ${targetDev.name} (${targetDev.serialNumber}) đã chuyển sang trạng thái Hư Hỏng / Sự Cố!`,
          'error',
          targetDev.serialNumber
        );
      } else if (updates.status === 'maintenance_needed') {
        addToast(
          'Thông báo: Cần Bảo Trì!',
          `Thiết bị ${targetDev.name} (${targetDev.serialNumber}) cần được kiểm tra bảo trì.`,
          'warning',
          targetDev.serialNumber
        );
      } else if (updates.status === 'active') {
        addToast(
          'Thiết bị Sẵn Sàng',
          `Thiết bị ${targetDev.name} (${targetDev.serialNumber}) đã sẵn sàng hoạt động tốt.`,
          'success',
          targetDev.serialNumber
        );
      } else if (updates.status === 'decommissioned') {
        addToast(
          'Thanh Lý Thiết Bị',
          `Thiết bị ${targetDev.name} (${targetDev.serialNumber}) đã chuyển trạng thái thanh lý.`,
          'info',
          targetDev.serialNumber
        );
      }
    }

    try {
      await updateDoc(doc(db, 'devices', id), { ...updates, updatedAt: new Date().toISOString() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `devices/${id}`);
    }
  };

  const handleDeleteDevice = async (id: string) => {
    if (currentUser?.role !== 'admin') {
      addToast('Quyền truy cập bị từ chối', 'Chỉ Quản trị viên mới được phép xóa thiết bị.', 'error');
      return;
    }
    const targetDev = devices.find(d => d.id === id);
    if (targetDev) {
      addToast('Đã xóa thiết bị', `Đã xóa thiết bị ${targetDev.name} khỏi danh sách.`, 'info', targetDev.serialNumber);
    }

    try {
      await deleteDoc(doc(db, 'devices', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `devices/${id}`);
    }
  };

  // Device Transfer & Recall Actions
  const handleAddTransfer = async (transferData: Omit<DeviceTransferRecord, 'id' | 'createdAt'>) => {
    const newRecord: Omit<DeviceTransferRecord, 'id'> = {
      createdAt: new Date().toISOString(),
      ...transferData
    };

    const dev = devices.find(d => d.id === transferData.deviceId || d.serialNumber === transferData.deviceSn);

    const title = transferData.type === 'transfer' ? 'Bàn giao / Điều chuyển thành công' : 'Thu hồi thiết bị về kho';
    const message = transferData.type === 'transfer'
      ? `Đã chuyển thiết bị ${transferData.deviceName} đến ${transferData.toLocation.faculty} (${transferData.toLocation.room})`
      : `Đã thu hồi thiết bị ${transferData.deviceName} về kho trung tâm thành công`;

    addToast(title, message, 'success', transferData.deviceSn);

    try {
      await addDoc(collection(db, 'transfers'), sanitizeForFirestore(newRecord));
      if (dev) {
         await updateDoc(doc(db, 'devices', dev.id), { 
             location: { ...transferData.toLocation },
             updatedAt: new Date().toISOString()
         });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'transfers');
    }
  };

  // Inspection Actions
  const handleAddInspection = async (
    record: Omit<InspectionRecord, 'id'>,
    damageReport?: { severity: 'low' | 'medium' | 'high' | 'urgent'; description: string }
  ) => {
    const newRecord: Omit<InspectionRecord, 'id'> = { ...record };
    
    const dev = devices.find(d => d.id === record.deviceId || d.serialNumber === record.deviceSn);
    let newStatus = dev?.status;

    if (dev) {
        if (record.result === 'warning') {
          newStatus = 'maintenance_needed';
          addToast('Cảnh Báo Kiểm Tra Định Kỳ!', `Kết quả kiểm tra: Thiết bị ${record.deviceName} (${record.deviceSn}) cần được BẢO TRÌ!`, 'warning', record.deviceSn);
        } else if (record.result === 'failed') {
          newStatus = 'damaged';
          addToast('Cảnh Báo Hư Hỏng Khẩn Cấp!', `Kiểm tra thất bại: Thiết bị ${record.deviceName} (${record.deviceSn}) gặp sự cố HƯ HỎNG!`, 'error', record.deviceSn);
        } else if (record.result === 'passed') {
          if (dev.status !== 'active') newStatus = 'active';
          addToast('Kiểm Tra Đạt Yêu Cầu', `Thiết bị ${record.deviceName} (${record.deviceSn}) đã kiểm tra hoạt động tốt.`, 'success', record.deviceSn);
        }
    }

    try {
      await addDoc(collection(db, 'inspections'), sanitizeForFirestore(newRecord));
      if (dev && newStatus && dev.status !== newStatus) {
        await updateDoc(doc(db, 'devices', dev.id), { status: newStatus, updatedAt: new Date().toISOString() });
      }

      if (damageReport && damageReport.description.trim() && dev) {
        const newIncident: Omit<IncidentReport, 'id'> = {
          deviceId: dev.id,
          deviceSn: dev.serialNumber,
          deviceName: dev.name,
          reporterName: record.inspectorName,
          faculty: dev.location.faculty,
          room: dev.location.room,
          severity: damageReport.severity,
          status: 'open',
          description: `[Biên bản kiểm tra ngày ${record.inspectionDate}]: ${damageReport.description}`,
          reportedAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'incidents'), sanitizeForFirestore(newIncident));
        addToast('Lập Phiếu Báo Cáo Hư Hỏng', `Đã tạo phiếu báo cáo sự cố tự động cho thiết bị ${dev.name} (${dev.serialNumber}).`, 'error', dev.serialNumber);
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'inspections');
    }
  };

  // Replacement Actions
  const handleAddReplacement = async (record: Omit<PartReplacementRecord, 'id'>) => {
    const newRecord: Omit<PartReplacementRecord, 'id'> = { ...record };
    
    const dev = devices.find(d => d.id === record.deviceId || d.serialNumber === record.deviceSn);

    addToast('Thay Vật Tư Hoàn Tất', `Đã thay ${record.partName} cho ${record.deviceName} (${record.deviceSn}). Trạng thái: Hoạt động tốt.`, 'success', record.deviceSn);

    try {
      await addDoc(collection(db, 'replacements'), sanitizeForFirestore(newRecord));
      if (dev && dev.status !== 'active') {
        await updateDoc(doc(db, 'devices', dev.id), { status: 'active', updatedAt: new Date().toISOString() });
      }
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'replacements');
    }
  };

  // Inventory Check Actions
  const handleAddInventory = async (record: Omit<DeviceInventoryRecord, 'id' | 'createdAt'>) => {
    const newRecord: Omit<DeviceInventoryRecord, 'id'> = {
      ...record,
      createdAt: new Date().toISOString()
    };
    try {
      await addDoc(collection(db, 'inventories'), sanitizeForFirestore(newRecord));
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'inventories');
    }
  };

  const handleUpdateDeviceStatus = async (id: string, status: any, notes?: string) => {
    const updates: Record<string, any> = {
      status,
      updatedAt: new Date().toISOString()
    };
    if (notes) {
      updates.notes = notes;
    }
    try {
      await updateDoc(doc(db, 'devices', id), updates);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `devices/${id}`);
    }
  };

  // Incident Actions
  const handleAddIncident = async (report: Omit<IncidentReport, 'id' | 'reportedAt' | 'status'>) => {
    const newReport: Omit<IncidentReport, 'id'> = {
      reportedAt: new Date().toISOString(),
      status: 'open',
      zaloPhone: '0987119665',
      zaloSent: true,
      ...report
    };

    const dev = devices.find(d => d.id === report.deviceId || d.serialNumber === report.deviceSn);

    addToast(`Báo Báo Sự Cố Khẩn Cấp [${report.severity.toUpperCase()}]`, `Ghi nhận sự cố tại ${report.faculty} - ${report.room} cho ${report.deviceName} (${report.deviceSn}). Trạng thái: Hư hỏng!`, 'error', report.deviceSn);

    try {
      await addDoc(collection(db, 'incidents'), sanitizeForFirestore(newReport));
      if (dev && dev.status !== 'damaged') {
         await updateDoc(doc(db, 'devices', dev.id), { status: 'damaged', updatedAt: new Date().toISOString() });
      }

      // Send Notifications to Hotline Zalo 0987119665
      await sendZaloAlert(newReport, 'new');
      await sendTelegramAlert(newReport, 'new');

    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'incidents');
    }
  };

  const escapeHTML = (str: string) => {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  };

  const sendTelegramAlert = async (incident: any, eventType: 'new' | 'accepted' | 'resolved', resolutionNotes?: string) => {
    const token = telegramBotToken || localStorage.getItem('DUE_TELEGRAM_BOT_TOKEN') || '8715568190:AAEKFL-s06KAuNDVldDB0eyVLhrEcrSVgV8';
    const chatId = telegramChatId || localStorage.getItem('DUE_TELEGRAM_CHAT_ID');

    try {
      const res = await fetch('/api/telegram/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          chatId: chatId || undefined,
          incident,
          eventType,
          resolutionNotes,
          updatedBy: currentUser?.name || 'Cán Bộ Kỹ Thuật'
        })
      });

      const resData = await res.json();
      if (!res.ok) {
        if (resData.noChatId || !chatId) {
          addToast(
            '⚠️ Chưa Kết Nối Telegram Bot',
            'Sự cố đã được lưu vào hệ thống nhưng chưa thể gửi tới Telegram do chưa có Chat ID! Nhấn vào đây để kết nối bot @japancsvcbot.',
            'warning',
            incident?.deviceSn,
            () => setIsTelegramModalOpen(true)
          );
        } else {
          addToast(
            'Lỗi Gửi Telegram',
            `Không thể chuyển tin tới bot: ${resData.error || 'Lỗi kết nối Telegram'}`,
            'error',
            incident?.deviceSn,
            () => setIsTelegramModalOpen(true)
          );
        }
        return false;
      } else {
        addToast(
          '🚀 Đã Phát Tin Tới Telegram',
          `Cảnh báo sự cố đã gửi tới bot @japancsvcbot thành công (Chat ID: ${resData.sentToChatId || chatId})!`,
          'success',
          incident?.deviceSn
        );
        return true;
      }
    } catch (err: any) {
      console.error('Error sending Telegram alert from frontend:', err);
      return false;
    }
  };

  const sendZaloAlert = async (incident: any, eventType: 'new' | 'accepted' | 'resolved', notes?: string) => {
    try {
      await fetch('/api/zalo/notify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          phone: '0987119665',
          incident: {
            ...incident,
            eventType,
            notes,
            updatedBy: currentUser?.name || 'Cán Bộ Kỹ Thuật',
            updatedAt: new Date().toISOString()
          },
          reporterName: incident.reporterName || currentUser?.name || 'Cán bộ'
        })
      });
    } catch (err) {
      console.warn('Error sending Zalo alert:', err);
    }
  };

  const handleResolveIncident = async (incidentId: string, resolutionNotes: string) => {
    const inc = incidents.find(i => i.id === incidentId);
    
    if (inc) {
      addToast('Đã Khắc Phục Sự Cố', `Sự cố của ${inc.deviceName} (${inc.deviceSn}) đã được ghi nhận xử lý xong.`, 'success', inc.deviceSn);
      
      const dev = devices.find(d => d.id === inc.deviceId || d.serialNumber === inc.deviceSn);
      if (dev && dev.status === 'damaged') {
        try {
          await updateDoc(doc(db, 'devices', dev.id), { status: 'active', updatedAt: new Date().toISOString() });
        } catch (err) {
          console.error("Error updating device status upon incident resolution:", err);
        }
      }

      // Send Notifications to Hotline Zalo 0987119665
      await sendZaloAlert(inc, 'resolved', resolutionNotes);
      await sendTelegramAlert(inc, 'resolved', resolutionNotes);
    }

    try {
      await updateDoc(doc(db, 'incidents', incidentId), { 
        status: 'resolved', 
        resolvedAt: new Date().toISOString(), 
        resolutionNotes,
        responderName: currentUser?.name || 'Kỹ thuật viên CSVC'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `incidents/${incidentId}`);
    }
  };

  const handleAcceptIncident = async (incidentId: string, acceptanceNotes?: string) => {
    const inc = incidents.find(i => i.id === incidentId);
    
    if (inc) {
      addToast('Đã Tiếp Nhận Sự Cố', `Sự cố của ${inc.deviceName} (${inc.deviceSn}) đã được tiếp nhận để xử lý.`, 'info', inc.deviceSn);
      
      // Send Notifications to Hotline Zalo 0987119665
      await sendZaloAlert(inc, 'accepted', acceptanceNotes);
      await sendTelegramAlert(inc, 'accepted', acceptanceNotes);
    }

    try {
      await updateDoc(doc(db, 'incidents', incidentId), { 
        status: 'in_progress',
        acceptedBy: currentUser?.name || 'Kỹ thuật viên CSVC',
        acceptedAt: new Date().toISOString(),
        acceptanceNotes: acceptanceNotes || 'Đã tiếp nhận yêu cầu và đang phân công xử lý.'
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `incidents/${incidentId}`);
    }
  };



  // Camera QR Scanner Trigger
  const handleOpenScannerWithCallback = (callback: (sn: string) => void) => {
    setScannerCallback(() => callback);
    setIsScannerOpen(true);
  };

  // Open QR Generator Modal
  const handleOpenQRGenerator = (device: Device) => {
    setSelectedQRDevice(device);
    setIsQRGenOpen(true);
  };

  return (
    <div className="min-h-screen bg-slate-100/70 font-sans text-slate-800 antialiased selection:bg-blue-600 selection:text-white">
      
      {/* Toast Floating Container */}
      <ToastContainer
        toasts={toasts}
        onDismiss={handleDismissToast}
        onClearAll={handleClearAllToasts}
      />

      {/* Top Header */}
      <Header
        currentUser={currentUser}
        onLogout={() => {
          setCurrentUser(null);
          addToast('Đã đăng xuất', 'Bạn đã đăng xuất khỏi hệ thống.', 'info');
        }}
        isInstallable={isInstallable}
        onInstallApp={handleInstallApp}
        onOpenQuickScan={() => handleOpenScannerWithCallback((scannedValue) => {
          let sn = scannedValue.trim();

          // Try parsing as URL first in case QR contains full link
          if (sn.startsWith('http://') || sn.startsWith('https://')) {
            try {
              const url = new URL(sn);
              const snParam = url.searchParams.get('sn') || url.searchParams.get('serialNumber');
              const roomParam = url.searchParams.get('room') || url.searchParams.get('roomName');
              const idParam = url.searchParams.get('id') || url.searchParams.get('deviceId');
              if (snParam) {
                sn = snParam;
              } else if (roomParam) {
                sn = `ROOM:${roomParam}`;
              } else if (idParam) {
                sn = idParam;
              }
            } catch (urlErr) {
              console.warn('Failed to parse scanned URL:', urlErr);
            }
          }

          try {
            const parsed = JSON.parse(scannedValue);
            if (parsed) {
              if (parsed.type === 'room' && parsed.room) {
                sn = `ROOM:${parsed.room}`;
              } else if (parsed.room) {
                sn = `ROOM:${parsed.room}`;
              } else if (parsed.sn) {
                sn = parsed.sn;
              }
            }
          } catch (e) {
            // Not a JSON string
          }

          const dev = devices.find(d => d.serialNumber.toLowerCase() === sn.toLowerCase() || d.id === sn);
          if (dev) {
            setSelectedInventoryDevice(dev);
            setActiveTab('inventory');
            addToast(
              'Quét kiểm kê thành công', 
              `Đã truy xuất nguồn gốc & hành trình thiết bị: ${dev.name} (SN: ${dev.serialNumber})`, 
              'success', 
              dev.serialNumber
            );
          } else {
            // Check if it's a room code
            const isRoomPrefix = sn.toUpperCase().startsWith('ROOM:');
            const matchedRoom = isRoomPrefix ? sn.substring(5).trim() : sn;
            const normRoom = matchedRoom.toLowerCase().replace(/^(phòng|phong|p\.|p)\s*/g, '').trim();
            const hasRoomDevices = devices.some(d => d.location.room && d.location.room.toLowerCase().replace(/^(phòng|phong|p\.|p)\s*/g, '').trim() === normRoom);

            if (hasRoomDevices) {
              setActiveTab('maintenance');
              addToast(
                'Quét mã phòng thành công', 
                `Đã phát hiện phòng học: "${matchedRoom}". Hãy nhấn Quét Camera trên tab Báo sự cố để chọn phòng này.`, 
                'success'
              );
            } else {
              addToast('Mã SN chưa có', `Đã quét được SN ${sn}. Bạn có thể thêm thiết bị mới.`, 'info', sn);
              setActiveTab('devices');
            }
          }
        })}
        toastCount={toasts.length}
        onTriggerTestToast={handleTriggerTestToast}
        onOpenAdminProfile={() => setIsAdminProfileOpen(true)}
        isSidebarOpen={isSidebarOpen}
        onToggleSidebar={() => setIsSidebarOpen(!isSidebarOpen)}
        onOpenChatbot={() => setIsChatbotOpen(true)}
        telegramChatId={telegramChatId}
        onOpenTelegramConfig={() => setIsTelegramModalOpen(true)}
      />

      {/* Main Container */}
      {!currentUser ? (
        <LoginForm onLoginSuccess={(u) => {
          setCurrentUser(u);
          addToast('Đăng nhập thành công', `Xin chào ${u.name}!`, 'success');
        }} />
      ) : (
        <div className="mx-auto max-w-7xl px-3 sm:px-6 lg:px-8 py-4 sm:py-6 flex flex-col lg:flex-row gap-6">
          
          {/* Vertical Sidebar Navigation */}
          <Sidebar
            activeTab={activeTab}
            setActiveTab={setActiveTab}
            currentUser={currentUser}
            isOpen={isSidebarOpen}
            setIsOpen={setIsSidebarOpen}
            onOpenAdminProfile={() => setIsAdminProfileOpen(true)}
            onOpenChatbot={() => setIsChatbotOpen(true)}
          />

          {/* Main Content Area */}
          <main className="flex-1 min-w-0">
            {activeTab === 'devices' && (
              <DeviceManagement
                devices={devices}
                currentUser={currentUser}
                onAddDevice={handleAddDevice}
                onUpdateDevice={handleUpdateDevice}
                onDeleteDevice={handleDeleteDevice}
                onOpenScanner={handleOpenScannerWithCallback}
                onOpenQRGenerator={handleOpenQRGenerator}
                onOpenBatchQRPrint={() => setIsBatchQRPrintOpen(true)}
                onImportDevices={handleImportDevices}
                onDeleteMultipleDevices={handleDeleteMultipleDevices}
                onTransferDevice={(device) => {
                  setSelectedTransferDeviceId(device.id);
                  setActiveTab('transfers');
                }}
              />
            )}

            {activeTab === 'maintenance' && (
              currentUser?.role === 'staff' ? (
                <StaffChatbotPortal
                  currentUser={currentUser}
                  devices={devices}
                  incidents={incidents}
                  onAddIncident={handleAddIncident}
                  onOpenTelegramModal={() => setIsTelegramModalOpen(true)}
                  telegramChatId={telegramChatId}
                  telegramBotToken={telegramBotToken}
                  onAddToast={addToast}
                />
              ) : (
                <MaintenanceForm
                  devices={devices}
                  inspections={inspections}
                  replacements={replacements}
                  incidents={incidents}
                  currentUser={currentUser}
                  onAddInspection={handleAddInspection}
                  onAddReplacement={handleAddReplacement}
                  onAddIncident={handleAddIncident}
                  onResolveIncident={handleResolveIncident}
                  onAcceptIncident={handleAcceptIncident}
                  onOpenScanner={handleOpenScannerWithCallback}
                  onReturnToDevices={() => setActiveTab('devices')}
                />
              )
            )}

            {activeTab === 'transfers' && (
              <DeviceTransferManagement
                devices={devices}
                transfers={transfers}
                currentUser={currentUser}
                onAddTransfer={handleAddTransfer}
                onOpenScanner={handleOpenScannerWithCallback}
                initialSelectedDeviceId={selectedTransferDeviceId}
              />
            )}

            {activeTab === 'analytics' && (
              <AnalyticsDashboard
                devices={devices}
                inspections={inspections}
                replacements={replacements}
                incidents={incidents}
              />
            )}

            {activeTab === 'inventory' && (
              <DeviceInventory
                devices={devices}
                transfers={transfers}
                inventories={inventories}
                currentUser={currentUser}
                onAddInventory={handleAddInventory}
                onUpdateDeviceStatus={handleUpdateDeviceStatus}
                onOpenScanner={handleOpenScannerWithCallback}
                onAddToast={addToast}
                selectedDeviceFromApp={selectedInventoryDevice}
                onSelectDeviceFromApp={setSelectedInventoryDevice}
              />
            )}

            {activeTab === 'users' && currentUser?.role === 'admin' && (
              <UserManagement
                currentUser={currentUser}
                onAddToast={addToast}
              />
            )}
          </main>
        </div>
      )}

      {/* Camera QR Scanner Modal */}
      <QRScannerModal
        isOpen={isScannerOpen}
        onClose={() => {
          setIsScannerOpen(false);
          setScannerCallback(null);
        }}
        onScanSuccess={(scannedText) => {
          if (scannerCallback) {
            scannerCallback(scannedText);
          }
        }}
      />

      {/* QR Code Printable Tag Generator Modal */}
      <QRGeneratorModal
        isOpen={isQRGenOpen}
        onClose={() => {
          setIsQRGenOpen(false);
          setSelectedQRDevice(null);
        }}
        device={selectedQRDevice}
      />

      {/* Batch QR Code A4 Page Printer Modal */}
      <BatchQRPrintModal
        isOpen={isBatchQRPrintOpen}
        onClose={() => setIsBatchQRPrintOpen(false)}
        devices={devices}
      />

      {/* Admin Profile Settings Modal */}
      {currentUser && (
        <AdminProfileModal
          isOpen={isAdminProfileOpen}
          onClose={() => setIsAdminProfileOpen(false)}
          currentUser={currentUser}
          onUpdateUser={(updated) => setCurrentUser(updated)}
          onAddToast={addToast}
        />
      )}

      {/* Quick AI Chatbot for User Accounts */}
      {currentUser && currentUser.role !== 'staff' && (
        <QuickChatbot
          currentUser={currentUser}
          devices={devices}
          onAddIncident={handleAddIncident}
          isOpenExternal={isChatbotOpen}
          onCloseExternal={() => setIsChatbotOpen(false)}
          onOpenTelegramConfig={() => setIsTelegramModalOpen(true)}
        />
      )}

      {/* Telegram Bot Setup Modal */}
      <TelegramConfigModal
        isOpen={isTelegramModalOpen}
        onClose={() => setIsTelegramModalOpen(false)}
        currentChatId={telegramChatId}
        currentBotToken={telegramBotToken}
        onSaved={(newChatId, newBotToken) => {
          setTelegramChatId(newChatId);
          setTelegramBotToken(newBotToken);
          addToast(
            '✅ Đã Kết Nối Telegram',
            `Đã lưu Chat ID [${newChatId}] thành công. Mọi sự cố phòng học sẽ được bắn trực tiếp tới Telegram này!`,
            'success'
          );
        }}
      />

    </div>
  );
}

