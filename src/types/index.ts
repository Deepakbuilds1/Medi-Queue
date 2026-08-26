export type TokenStatus = 
  | 'WAITING' 
  | 'CALLED' 
  | 'IN CONSULTATION' 
  | 'COMPLETED' 
  | 'SKIPPED' 
  | 'CANCELLED';

export type UserRole = 
  | 'SUPER_ADMIN' 
  | 'CLINIC_ADMIN' 
  | 'DOCTOR' 
  | 'RECEPTIONIST' 
  | 'PATIENT'
  | 'patient' 
  | 'admin';

export interface Clinic {
  id: string; // e.g. 'clinic_citycare', 'clinic_apollo'
  name: string;
  slug: string;
  logo: string;
  address: string;
  phone: string;
  email: string;
  tokenPrefix: string;
  startingTokenNumber: number;
  status: 'ACTIVE' | 'INACTIVE';
  adminEmail?: string;
  createdAt: string;
  updatedAt: string;
  tokenDisplaySettings?: {
    enableSound: boolean;
    autoRefreshInterval: number; // in seconds
    announcementVoice: boolean;
  };
}

export interface Doctor {
  id: string;
  clinicId?: string;
  name: string;
  specialization: string;
  roomNumber: string;
  tokenPrefix: string; // e.g. 'A', 'B'
  status: 'ACTIVE' | 'INACTIVE';
  createdAt?: string;
}

export interface UserProfile {
  uid: string;
  email: string;
  name: string;
  displayName?: string;
  phone: string;
  age?: number;
  gender?: 'Male' | 'Female' | 'Other';
  role: UserRole;
  clinicId?: string; // Assigned primary clinic for staff/admin/patient
  clinicName?: string; // Name of assigned clinic
  clinicIds?: string[]; // Multiple authorized clinics
  accessibleClinicIds?: string[]; // Alias for clinicIds
  activeClinicId?: string;
  status?: 'active' | 'inactive' | 'ACTIVE' | 'INACTIVE';
  createdAt: string;
  updatedAt?: string;
}

export interface AuditLog {
  id: string;
  actorUid: string;
  actorEmail?: string;
  actorRole: UserRole;
  action: 
    | 'SUPER_ADMIN_LOGIN'
    | 'SUPER_ADMIN_LOGOUT'
    | 'CLINIC_ADMIN_LOGIN'
    | 'ADMIN_LOGOUT'
    | 'CLINIC_SWITCH'
    | 'CLINIC_CREATED'
    | 'CLINIC_UPDATED'
    | 'CLINIC_STATUS_TOGGLE'
    | 'ADMIN_CREATED'
    | 'ADMIN_UPDATED'
    | 'ADMIN_CLINIC_ASSIGNMENT'
    | 'ADMIN_ACCESS_REMOVED'
    | 'ADMIN_STATUS_TOGGLE'
    | 'PASSWORD_RESET_TRIGGERED';
  clinicId?: string;
  clinicName?: string;
  details?: Record<string, any>;
  timestamp: string;
}

export interface Patient {
  id: string;
  clinicId?: string;
  patientId: string; // Formatted ID e.g. PAT-1001
  userId?: string; // Firebase Auth UID
  email?: string;
  name: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  phone: string;
  reason?: string;
  createdAt: string; // ISO string
  lastVisit?: string;
  totalVisits?: number;
}

export interface QueueToken {
  id: string;
  clinicId?: string;
  clinicName?: string;
  tokenNumber: string; // e.g. 'A-025'
  patientId: string;
  userId?: string; // Firebase Auth UID for patient tracking
  patientName: string; // Used in Admin view
  patientAge?: number;
  patientGender?: string;
  patientPhone?: string;
  reason?: string;
  doctorId: string;
  doctorName: string;
  roomNumber: string;
  status: TokenStatus;
  createdAt: string; // ISO string
  calledAt?: string | null;
  completedAt?: string | null;
  queueDate: string; // YYYY-MM-DD
}

export interface ClinicSettings {
  id?: string;
  clinicId?: string;
  clinicName: string;
  clinicLogo: string;
  clinicAddress: string;
  phone: string;
  email: string;
  tokenPrefix: string;
  startingTokenNumber: number;
  tokenDisplaySettings: {
    enableSound: boolean;
    autoRefreshInterval: number; // in seconds
    announcementVoice: boolean;
  };
}

export type AdminRoute = 
  | '/admin/dashboard'
  | '/admin/patients'
  | '/admin/tokens'
  | '/admin/doctors'
  | '/admin/reports'
  | '/admin/settings'
  | '/admin/super-admin';
