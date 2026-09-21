export type UserRole = 'admin' | 'technician' | 'staff';

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  department: string;
  avatar?: string;
}

export type DeviceStatus = 'active' | 'maintenance_needed' | 'damaged' | 'decommissioned' | 'spare';

export type DeviceCategory = string;

export interface DeviceLocation {
  faculty: string;       // Khoa (e.g. Khoa CNTT, Khoa Điện)
  lectureHall: string;   // Giảng đường (e.g. Tòa A, Tòa B)
  room: string;          // Phòng (e.g. Phòng A101, Lab 02)
}

export interface Device {
  id: string;
  serialNumber: string;  // Mã SN thiết bị
  name: string;          // Tên thiết bị
  category: DeviceCategory;
  location: DeviceLocation;
  status: DeviceStatus;
  purchaseDate: string;  // YYYY-MM-DD
  warrantyUntil: string; // YYYY-MM-DD
  supplier: string;      // Nhà cung cấp
  nextMaintenanceDate?: string; // Hạn bảo trì định kỳ tiếp theo (YYYY-MM-DD)
  notes?: string;
  specs?: string;        // Thông số kỹ thuật thiết bị
  createdAt: string;
  updatedAt: string;
}

export type InspectionResult = 'passed' | 'warning' | 'failed';

export interface InspectionRecord {
  id: string;
  deviceId: string;
  deviceSn: string;
  deviceName: string;
  inspectorName: string;
  inspectionDate: string; // YYYY-MM-DD
  result: InspectionResult;
  checkPower: boolean;
  checkDisplayAudio: boolean;
  checkConnections: boolean;
  checkCleaningFan: boolean;
  notes: string;
  actionRequired?: string;
}

export type PartCondition = 'new' | 'refurbished' | 'spare';

export interface PartReplacementRecord {
  id: string;
  deviceId: string;
  deviceSn: string;
  deviceName: string;
  partName: string;          // Tên vật tư / linh kiện thay thế
  partCondition: PartCondition; // Mới / Tái chế
  cost: number;              // Chi phí VNĐ
  quantity: number;
  replacedBy: string;        // Kỹ thuật viên thực hiện
  replacementDate: string;   // YYYY-MM-DD
  reason: string;            // Lý do thay thế
  warrantyMonths: number;    // Thời gian bảo hành linh kiện (tháng)
}

export type IncidentSeverity = 'low' | 'medium' | 'high' | 'urgent';
export type IncidentStatus = 'open' | 'in_progress' | 'resolved';

export interface IncidentReport {
  id: string;
  deviceId: string;
  deviceSn: string;
  deviceName: string;
  reporterName: string;
  faculty: string;
  room: string;
  severity: IncidentSeverity;
  status: IncidentStatus;
  description: string;
  reportedAt: string;
  resolvedAt?: string;
  resolutionNotes?: string;
}



export type ToastType = 'info' | 'success' | 'warning' | 'error';

export interface ToastMessage {
  id: string;
  title: string;
  message: string;
  type: ToastType;
  timestamp: string;
  deviceSn?: string;
}

export type DeviceTransferType = 'transfer' | 'recall';

export interface DeviceTransferRecord {
  id: string;
  deviceId: string;
  deviceSn: string;
  deviceName: string;
  type: DeviceTransferType; // 'transfer': Điều chuyển | 'recall': Thu hồi
  fromLocation: DeviceLocation;
  toLocation: DeviceLocation;
  reason: string;
  transferDate: string; // YYYY-MM-DD
  performedBy: string; // Người thực hiện / Bàn giao
  receiverName?: string; // Người / Đơn vị tiếp nhận
  documentNumber?: string; // Số biên bản / Quyết định
  conditionAtTransfer?: string; // Tình trạng thiết bị
  notes?: string;
  createdAt: string;
}

export interface DeviceInventoryRecord {
  id: string;
  deviceId: string;
  deviceSn: string;
  deviceName: string;
  inventoryDate: string; // YYYY-MM-DD
  auditorName: string;   // Người thực hiện kiểm kê
  status: DeviceStatus;  // Tình trạng thực tế
  locationStatus: 'matched' | 'mismatched'; // Trạng thái vị trí thực tế so với hệ thống ('matched': Khớp, 'mismatched': Lệch)
  actualLocation?: DeviceLocation; // Vị trí thực tế nếu bị lệch
  notes: string;
  createdAt: string;
}

