export interface ParentChildOverview {
  studentId: number;
  rollNo: string;
  fullName: string;
  classId: number;
  className: string;
  section: string;
  photoPath?: string;
  relationship: string;
  totalSessions: number;
  presentSessions: number;
  absentSessions: number;
  lateSessions: number;
  onLeaveSessions: number;
  attendancePercentage: number;
  todayStatus?: string;
}

export interface ChildPeriodAttendance {
  periodId: number;
  periodName: string;
  timeRange: string;
  subjectName: string;
  staffName: string;
  status: string;
  remarks?: string;
}

export interface ChildDailyAttendance {
  date: string;
  dayOfWeek: string;
  status: string;
  isLeave: boolean;
  leaveReason?: string;
  periods: ChildPeriodAttendance[];
}

export interface ChildMonthlyCalendar {
  studentId: number;
  fullName: string;
  rollNo: string;
  className: string;
  section: string;
  month: string;
  totalRecordedDays: number;
  presentDays: number;
  absentDays: number;
  lateDays: number;
  onLeaveDays: number;
  attendancePercentage: number;
  days: ChildDailyAttendance[];
}

export interface LeaveRequestItem {
  id: number;
  studentId: number;
  studentName: string;
  rollNo: string;
  className: string;
  section: string;
  parentId: number;
  parentName: string;
  parentPhone: string;
  startDate: string;
  endDate: string;
  daysCount: number;
  reason: string;
  status: 'Pending' | 'Approved' | 'Rejected';
  reviewedByUserId?: number;
  reviewedByUserName?: string;
  reviewedAt?: string;
  reviewRemarks?: string;
  createdAt: string;
}

export interface CreateLeaveRequestPayload {
  studentId: number;
  startDate: string;
  endDate: string;
  reason: string;
}

export interface ReviewLeaveRequestPayload {
  status: 'Approved' | 'Rejected';
  reviewRemarks?: string;
}
