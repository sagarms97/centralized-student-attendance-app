import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StaffDailyScheduleItem, AttendanceSheet, StudentAttendanceItem, PeriodSwapRequestItem } from '../models/attendance.models';

@Injectable({
  providedIn: 'root'
})
export class AttendanceService {
  private http = inject(HttpClient);

  getMySchedule(date?: string): Observable<StaffDailyScheduleItem[]> {
    const url = date ? `${environment.apiUrl}/attendance/my-schedule?date=${date}` : `${environment.apiUrl}/attendance/my-schedule`;
    return this.http.get<StaffDailyScheduleItem[]>(url);
  }

  getAttendanceSheet(timetableEntryId: number, date: string): Observable<AttendanceSheet> {
    return this.http.get<AttendanceSheet>(`${environment.apiUrl}/attendance/sheet?timetableEntryId=${timetableEntryId}&date=${date}`);
  }

  submitAttendance(payload: { timetableEntryId: number; periodId: number; date: string; source?: string; records: StudentAttendanceItem[] }): Observable<{ message: string; updatedCount?: number; insertedCount?: number }> {
    return this.http.post<{ message: string; updatedCount?: number; insertedCount?: number }>(`${environment.apiUrl}/attendance/submit`, payload);
  }

  getMySwapRequests(): Observable<PeriodSwapRequestItem[]> {
    return this.http.get<PeriodSwapRequestItem[]>(`${environment.apiUrl}/period-swaps/my-requests`);
  }

  createSwapRequest(payload: { timetableEntryId: number; targetStaffId: number; swapDate: string; reason?: string }): Observable<PeriodSwapRequestItem> {
    return this.http.post<PeriodSwapRequestItem>(`${environment.apiUrl}/period-swaps/request`, payload);
  }

  respondToSwap(id: number, status: 'Approved' | 'Rejected'): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${environment.apiUrl}/period-swaps/${id}/respond`, { status });
  }
}
