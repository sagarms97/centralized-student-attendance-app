export interface Staff {
  id: number;
  userId: number;
  employeeId: string;
  fullName: string;
  email: string;
  phone: string;
  subjectSpecialization?: string;
  photoPath?: string;
  hasPhoto?: boolean;
  isActive: boolean;
  createdAt: string;
}

export interface Student {
  id: number;
  rollNo: string;
  firstName: string;
  lastName: string;
  fullName: string;
  classId: number;
  className: string;
  section: string;
  parentPhone: string;
  email?: string;
  photoPath?: string;
  isActive: boolean;
  createdAt: string;
}

export interface ClassItem {
  id: number;
  name: string;
  sections: string;
  sectionList: string[];
  studentCount: number;
  isActive: boolean;
}

export interface SubjectItem {
  id: number;
  name: string;
  code: string;
  isActive: boolean;
}

export interface ExcelImportRowPreview {
  rowNumber: number;
  rollNo: string;
  firstName: string;
  lastName: string;
  className: string;
  classId?: number;
  section: string;
  parentPhone: string;
  email?: string;
  isValid: boolean;
  errors: string[];
}

export interface ExcelImportPreviewResult {
  totalRows: number;
  validRowsCount: number;
  invalidRowsCount: number;
  rows: ExcelImportRowPreview[];
}
