import { Device, InspectionRecord, PartReplacementRecord, IncidentReport, User, DeviceTransferRecord, DeviceCategory } from '../types';

export const DEVICE_CATEGORIES: DeviceCategory[] = [
  'Máy chiếu',
  'Màn chiếu',
  'Màn hình',
  'Âm thanh (Amply/Loa)',
  'Máy tính',
  'Điều hòa nhiệt độ',
  'Micro không dây',
  'Bảng tương tác / Tivi',
  'Thiết bị Mạng',
  'Đèn chiếu sáng linh hoạt',
  'Khác'
];

export const INITIAL_USERS: User[] = [
  {
    id: 'user-admin',
    name: 'Nguyễn Văn Quản Trị',
    email: 'admin@edu.vn',
    role: 'admin',
    department: 'Phòng Cơ sở vật chất',
    avatar: ''
  },
  {
    id: 'user-tech1',
    name: 'Trần Kỹ Thuật',
    email: 'tech@edu.vn',
    role: 'technician',
    department: 'Bộ phận quản trị',
    avatar: ''
  },
  {
    id: 'user-staff1',
    name: 'Cán Bộ Khoa / Giảng Đường',
    email: 'canbo@due.edu.vn',
    role: 'staff',
    department: 'Khoa Kinh tế',
    avatar: ''
  }
];

export const FACULTIES = [
  'Phòng Cơ sở vật chất',
  'Phòng Tổ chức - Hành chính',
  'Phòng Đào tạo',
  'Phòng CTSV, QHDN & TT',
  'Phòng KH & HTQT',
  'Phòng QLCL',
  'Phòng KHTC',
  'Tổ Ngoại ngữ Chuyên ngành',
  'TT Số & HL',
  'Trung tâm Tin học - Ngoại ngữ',
  'Trung tâm Đào tạo Quốc tế',
  'Viện Fintech',
  'Khoa Kinh tế',
  'Khoa Quản trị Kinh doanh',
  'Khoa Ngân hàng',
  'Khoa Tài chính',
  'Khoa Kế toán',
  'Khoa Thương mại',
  'Khoa Du lịch',
  'Khoa Luật',
  'Khoa Thống kê - Tin học',
  'Khoa Lý luận chính trị'
];

export const LECTURE_HALLS = [
  'Giảng đường A',
  'Giảng đường C',
  'Giảng đường D',
  'Giảng đường E',
  'Giảng đường F',
  'Giảng đường G',
  'Khu H'
];

export const INITIAL_DEVICES: Device[] = [];

export const INITIAL_INSPECTIONS: InspectionRecord[] = [];

export const INITIAL_REPLACEMENTS: PartReplacementRecord[] = [];

export const INITIAL_INCIDENTS: IncidentReport[] = [];

export const INITIAL_TRANSFERS: DeviceTransferRecord[] = [];


