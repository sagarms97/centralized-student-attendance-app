export interface SendInviteRequest {
  email: string;
  fullName: string;
  phone: string;
  role: 'Staff' | 'Parent';
  employeeId?: string;
  subjectSpecialization?: string;
  linkedStudentIds?: number[];
}

export interface SendInviteResponse {
  inviteId: number;
  email: string;
  fullName: string;
  role: string;
  inviteLink: string;
  expiresAt: string;
}

export interface ValidateInviteResponse {
  isValid: boolean;
  message?: string;
  email?: string;
  fullName?: string;
  phone?: string;
  role?: string;
  instituteName?: string;
  instituteCode?: string;
  employeeId?: string;
  subjectSpecialization?: string;
}

export interface RegisterWithInviteRequest {
  token: string;
  password: string;
  confirmPassword: string;
  fullName?: string;
  phone?: string;
  address?: string;
}

export interface VerifyRegistrationOtpRequest {
  email: string;
  instituteCode: string;
  otp: string;
}

export interface ResendRegistrationOtpRequest {
  email: string;
  instituteCode: string;
}

export interface PendingApprovalUser {
  userId: number;
  fullName: string;
  email: string;
  phone: string;
  role: string;
  accountStatus: string;
  employeeId?: string;
  subjectSpecialization?: string;
  address?: string;
  linkedStudentsCount: number;
  linkedStudents: string[];
  createdAt: string;
}

export interface RejectApprovalRequest {
  reason: string;
}
