export interface User {
  id: number;
  instituteId?: number;
  fullName: string;
  email: string;
  role: 'SuperAdmin' | 'InstituteAdmin' | 'Staff';
  staffId?: number;
}

export interface Institute {
  id: number;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  contactEmail: string;
  contactPhone: string;
  logoPath?: string;
}

export interface AuthResponse {
  accessToken: string;
  refreshToken: string;
  expiresAt: string;
  user: User;
  institute?: Institute;
}

export interface RegisterInstituteRequest {
  collegeName: string;
  instituteCode: string;
  address: string;
  city: string;
  state: string;
  contactEmail: string;
  contactPhone: string;
  adminName: string;
  adminEmail: string;
  adminPassword: string;
}

export interface LoginRequest {
  email: string;
  password: string;
  instituteCode?: string;
}
