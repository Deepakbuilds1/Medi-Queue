export type TokenStatus = 
  | 'WAITING' 
  | 'CALLED' 
  | 'IN CONSULTATION' 
  | 'COMPLETED' 
  | 'SKIPPED' 
  | 'CANCELLED';

export interface Doctor {
  id: string;
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
  phone: string;
  age: number;
  gender: 'Male' | 'Female' | 'Other';
  role: 'patient' | 'admin';
  createdAt: string;
}

export interface Patient {
  id: string;
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
  | '/admin/settings';
