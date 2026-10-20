import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  ParentChildOverview,
  ChildMonthlyCalendar,
  LeaveRequestItem,
  CreateLeaveRequestPayload,
  ReviewLeaveRequestPayload
} from '../models/leave.models';

@Injectable({
  providedIn: 'root'
})
export class LeaveService {
  private http = inject(HttpClient);
  private apiUrl = environment.apiUrl;

  getMyChildren(): Observable<ParentChildOverview[]> {
    return this.http.get<ParentChildOverview[]>(`${this.apiUrl}/parents/my-children`);
  }

  getChildAttendance(studentId: number, month?: string): Observable<ChildMonthlyCalendar> {
    let params = new HttpParams();
    if (month) {
      params = params.set('month', month);
    }
    return this.http.get<ChildMonthlyCalendar>(`${this.apiUrl}/parents/my-children/${studentId}/attendance`, { params });
  }

  getLeaves(status?: string, studentId?: number): Observable<LeaveRequestItem[]> {
    let params = new HttpParams();
    if (status && status !== 'All') {
      params = params.set('status', status);
    }
    if (studentId) {
      params = params.set('studentId', studentId.toString());
    }
    return this.http.get<LeaveRequestItem[]>(`${this.apiUrl}/leaves`, { params });
  }

  createLeave(payload: CreateLeaveRequestPayload): Observable<LeaveRequestItem> {
    return this.http.post<LeaveRequestItem>(`${this.apiUrl}/leaves`, payload);
  }

  reviewLeave(id: number, payload: ReviewLeaveRequestPayload): Observable<LeaveRequestItem> {
    return this.http.put<LeaveRequestItem>(`${this.apiUrl}/leaves/${id}/review`, payload);
  }

  getPendingCount(): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/leaves/pending-count`);
  }
}
