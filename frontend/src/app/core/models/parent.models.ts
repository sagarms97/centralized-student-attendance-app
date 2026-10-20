export interface LinkedStudent {
  studentId: number;
  rollNo: string;
  fullName: string;
  className: string;
  section: string;
  relationship: string;
}

export interface ParentItem {
  id: number;
  userId: number;
  fullName: string;
  email: string;
  phone: string;
  address?: string;
  photoPath?: string;
  isActive: boolean;
  createdAt: string;
  linkedStudents: LinkedStudent[];
}

export interface CreateParentRequest {
  fullName: string;
  email: string;
  phone: string;
  address?: string;
  initialPassword?: string;
  linkedStudents?: { studentId: number; relationship: string }[];
}

export interface UpdateParentRequest {
  fullName: string;
  email: string;
  phone: string;
  address?: string;
  isActive?: boolean;
}
