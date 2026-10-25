export interface DailyAttendanceReportItem {
  date: string;
  classId: number;
  className: string;
  section: string;
  periodName: string;
  subjectName: string;
  staffName: string;
  totalStudents: number;
  presentCount: number;
  absentCount: number;
  lateCount: number;
  attendancePercentage: number;
  source?: string;
  faceVerifiedCount?: number;
  manualCount?: number;
  averageFaceConfidence?: number;
}

export interface StudentAttendanceSummary {
  studentId: number;
  rollNo: string;
  fullName: string;
  className: string;
  section: string;
  totalSessions: number;
  presentSessions: number;
  absentSessions: number;
  lateSessions: number;
  faceVerifiedSessions?: number;
  manualSessions?: number;
  attendancePercentage: number;
  isDefaulter: boolean;
}

export interface ClassSummary {
  classId: number;
  className: string;
  section: string;
  totalEnrolled: number;
  totalSessionsConducted: number;
  averageAttendancePercentage: number;
}
