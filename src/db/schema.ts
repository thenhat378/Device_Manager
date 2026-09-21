import { pgTable, serial, text, timestamp, boolean, integer } from 'drizzle-orm/pg-core';

// Users table (using Firebase Auth UID)
export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  uid: text('uid').notNull().unique(), // Firebase Auth UID
  email: text('email').notNull(),
  name: text('name'),
  role: text('role'), // 'admin' | 'technician' | 'staff'
  department: text('department'),
  createdAt: timestamp('created_at').defaultNow(),
});

// Devices table
export const devices = pgTable('devices', {
  id: text('id').primaryKey(), // dev-12345
  serialNumber: text('serial_number').notNull().unique(),
  name: text('name').notNull(),
  category: text('category').notNull(),
  faculty: text('faculty').notNull(),
  lectureHall: text('lecture_hall').notNull(),
  room: text('room').notNull(),
  status: text('status').notNull(), // 'active' | 'maintenance_needed' | 'damaged' | 'decommissioned'
  purchaseDate: text('purchase_date').notNull(),
  warrantyUntil: text('warranty_until').notNull(),
  supplier: text('supplier').notNull(),
  nextMaintenanceDate: text('next_maintenance_date'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
});

// Inspections table
export const inspections = pgTable('inspections', {
  id: text('id').primaryKey(), // insp-12345
  deviceId: text('device_id').references(() => devices.id, { onDelete: 'cascade' }).notNull(),
  deviceSn: text('device_sn').notNull(),
  deviceName: text('device_name').notNull(),
  inspectorName: text('inspector_name').notNull(),
  inspectionDate: text('inspection_date').notNull(),
  result: text('result').notNull(), // 'passed' | 'warning' | 'failed'
  checkPower: boolean('check_power').notNull().default(false),
  checkDisplayAudio: boolean('check_display_audio').notNull().default(false),
  checkConnections: boolean('check_connections').notNull().default(false),
  checkCleaningFan: boolean('check_cleaning_fan').notNull().default(false),
  notes: text('notes').notNull(),
  actionRequired: text('action_required'),
});

// Replacements table
export const replacements = pgTable('replacements', {
  id: text('id').primaryKey(), // part-12345
  deviceId: text('device_id').references(() => devices.id, { onDelete: 'cascade' }).notNull(),
  deviceSn: text('device_sn').notNull(),
  deviceName: text('device_name').notNull(),
  partName: text('part_name').notNull(),
  partCondition: text('part_condition').notNull(), // 'new' | 'refurbished'
  cost: integer('cost').notNull(),
  quantity: integer('quantity').notNull(),
  replacedBy: text('replaced_by').notNull(),
  replacementDate: text('replacement_date').notNull(),
  reason: text('reason').notNull(),
  warrantyMonths: integer('warranty_months').notNull(),
});

// Incidents table
export const incidents = pgTable('incidents', {
  id: text('id').primaryKey(), // inc-12345
  deviceId: text('device_id').references(() => devices.id, { onDelete: 'cascade' }).notNull(),
  deviceSn: text('device_sn').notNull(),
  deviceName: text('device_name').notNull(),
  reporterName: text('reporter_name').notNull(),
  faculty: text('faculty').notNull(),
  room: text('room').notNull(),
  severity: text('severity').notNull(), // 'low' | 'medium' | 'high' | 'urgent'
  status: text('status').notNull(), // 'open' | 'in_progress' | 'resolved'
  description: text('description').notNull(),
  reportedAt: text('reported_at').notNull(),
  resolvedAt: text('resolved_at'),
  resolutionNotes: text('resolution_notes'),
});

// Transfers table
export const transfers = pgTable('transfers', {
  id: text('id').primaryKey(), // trf-12345
  deviceId: text('device_id').references(() => devices.id, { onDelete: 'cascade' }).notNull(),
  deviceSn: text('device_sn').notNull(),
  deviceName: text('device_name').notNull(),
  type: text('type').notNull(), // 'transfer' | 'recall'
  fromFaculty: text('from_faculty').notNull(),
  fromLectureHall: text('from_lecture_hall').notNull(),
  fromRoom: text('from_room').notNull(),
  toFaculty: text('to_faculty').notNull(),
  toLectureHall: text('to_lecture_hall').notNull(),
  toRoom: text('to_room').notNull(),
  reason: text('reason').notNull(),
  transferDate: text('transfer_date').notNull(),
  performedBy: text('performed_by').notNull(),
  receiverName: text('receiver_name'),
  documentNumber: text('document_number'),
  conditionAtTransfer: text('condition_at_transfer'),
  notes: text('notes'),
  createdAt: text('created_at').notNull(),
});


