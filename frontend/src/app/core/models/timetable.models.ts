export interface Period {
  id: number;
  periodNumber: number;
  name: string;
  startTime: string;
  endTime: string;
  timeFormatted: string;
  isActive: boolean;
}

export interface TimetableEntry {
  id: number;
  classId: number;
  className: string;
  section: string;
  dayOfWeek: number;
  dayName: string;
  periodId: number;
  periodNumber: number;
  periodName: string;
  timeRange: string;
  subjectId: number;
  subjectName: string;
  subjectCode: string;
  staffId: number;
  staffName: string;
  staffEmployeeId: string;
}

export interface CreateTimetableEntryRequest {
  classId: number;
  section: string;
  dayOfWeek: number;
  periodId: number;
  subjectId: number;
  staffId: number;
}
