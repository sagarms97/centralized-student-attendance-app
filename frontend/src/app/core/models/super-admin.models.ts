export interface RegistrationTrend {
  date: string;
  count: number;
}

export interface AuditLogItem {
  id: number;
  instituteId?: number;
  instituteName?: string;
  userId: number;
  userEmail: string;
  action: string;
  details: string;
  ipAddress?: string;
  timestamp: string;
}

export interface PlatformOverview {
  totalInstitutes: number;
  activeInstitutes: number;
  inactiveInstitutes: number;
  totalStaff: number;
  totalStudents: number;
  totalParents: number;
  todayAttendancePercent: number;
  totalAttendanceRecordedToday: number;
  registrationTrends: RegistrationTrend[];
  recentAuditLogs: AuditLogItem[];
}

export interface SuperAdminInstituteItem {
  id: number;
  name: string;
  code: string;
  city: string;
  state: string;
  contactEmail: string;
  contactPhone: string;
  logoPath?: string;
  isActive: boolean;
  createdAt: string;
  staffCount: number;
  studentCount: number;
  classCount: number;
  parentCount: number;
  todayAttendancePercent: number;
}

export interface ClassStrength {
  classId: number;
  className: string;
  sections: string;
  studentCount: number;
}

export interface SuperAdminStaffItem {
  id: number;
  employeeId: string;
  fullName: string;
  email: string;
  phone: string;
  subjectSpecialization?: string;
  isActive: boolean;
}

export interface SuperAdminStudentItem {
  id: number;
  rollNo: string;
  fullName: string;
  className: string;
  section: string;
  parentPhone: string;
  email?: string;
  isActive: boolean;
  attendancePercentage: number;
}

export interface SuperAdminSubject {
  id: number;
  name: string;
  code: string;
  assignedClassesCount: number;
}

export interface TimetableDaySummary {
  dayOfWeek: string;
  totalSlots: number;
  activeSubjects: number;
  activeTeachers: number;
}

export interface SuperAdminInstituteDetail {
  id: number;
  name: string;
  code: string;
  address: string;
  city: string;
  state: string;
  contactEmail: string;
  contactPhone: string;
  logoPath?: string;
  isActive: boolean;
  createdAt: string;
  staffCount: number;
  studentCount: number;
  classCount: number;
  parentCount: number;
  todayAttendancePercent: number;
  monthAttendancePercent: number;
  classStrength: ClassStrength[];
  staffList: SuperAdminStaffItem[];
  studentList: SuperAdminStudentItem[];
  subjects: SuperAdminSubject[];
  timetableSummary: TimetableDaySummary[];
}

export interface SuperAdminStudentAttendanceRecord {
  date: string;
  periodName: string;
  timeRange: string;
  subjectName: string;
  staffName: string;
  status: string;
  remarks?: string;
}

export interface SuperAdminStudentAttendanceHistory {
  studentId: number;
  fullName: string;
  rollNo: string;
  className: string;
  section: string;
  instituteName: string;
  totalSessions: number;
  presentSessions: number;
  absentSessions: number;
  lateSessions: number;
  onLeaveSessions: number;
  attendancePercentage: number;
  records: SuperAdminStudentAttendanceRecord[];
}
