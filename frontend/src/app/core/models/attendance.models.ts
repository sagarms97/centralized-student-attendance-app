export interface StaffDailyScheduleItem {
  timetableEntryId: number;
  periodId: number;
  periodNumber: number;
  periodName: string;
  timeRange: string;
  classId: number;
  className: string;
  section: string;
  subjectId: number;
  subjectName: string;
  isSubstitutedForMe: boolean;
  isHandedOverToOther: boolean;
  substituteStaffName?: string;
  isAttendanceMarked: boolean;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  totalStudents: number;
}

export interface StudentAttendanceItem {
  studentId: number;
  rollNo: string;
  fullName: string;
  status: 'Present' | 'Absent' | 'Late';
  remarks?: string;
}

export interface AttendanceSheet {
  timetableEntryId: number;
  periodId: number;
  periodName: string;
  classId: number;
  className: string;
  section: string;
  subjectName: string;
  date: string;
  isEditable: boolean;
  isAlreadyMarked: boolean;
  students: StudentAttendanceItem[];
}

export interface PeriodSwapRequestItem {
  id: number;
  timetableEntryId: number;
  className: string;
  section: string;
  periodName: string;
  timeRange: string;
  subjectName: string;
  swapDate: string;
  requesterStaffId: number;
  requesterStaffName: string;
  targetStaffId: number;
  targetStaffName: string;
  reason?: string;
  status: 'Pending' | 'Approved' | 'Rejected' | 'Cancelled';
  createdAt: string;
  canRespond: boolean;
}
