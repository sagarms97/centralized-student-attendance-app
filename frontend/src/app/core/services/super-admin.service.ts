import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  PlatformOverview,
  SuperAdminInstituteItem,
  SuperAdminInstituteDetail,
  SuperAdminStudentAttendanceHistory,
  AuditLogItem
} from '../models/super-admin.models';

@Injectable({
  providedIn: 'root'
})
export class SuperAdminService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/superadmin`;

  getPlatformOverview(): Observable<PlatformOverview> {
    return this.http.get<PlatformOverview>(`${this.apiUrl}/overview`);
  }

  getInstitutes(search?: string, status?: string): Observable<SuperAdminInstituteItem[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search.trim());
    if (status && status !== 'All') params = params.set('status', status);
    return this.http.get<SuperAdminInstituteItem[]>(`${this.apiUrl}/institutes`, { params });
  }

  getInstituteDetail(id: number): Observable<SuperAdminInstituteDetail> {
    return this.http.get<SuperAdminInstituteDetail>(`${this.apiUrl}/institutes/${id}`);
  }

  toggleInstituteStatus(id: number, isActive: boolean): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.apiUrl}/institutes/${id}/status`, { isActive });
  }

  getStudentAttendanceHistory(id: number): Observable<SuperAdminStudentAttendanceHistory> {
    return this.http.get<SuperAdminStudentAttendanceHistory>(`${this.apiUrl}/students/${id}/attendance`);
  }

  getAuditLogs(search?: string, instituteId?: number): Observable<AuditLogItem[]> {
    let params = new HttpParams();
    if (search) params = params.set('search', search.trim());
    if (instituteId) params = params.set('instituteId', instituteId.toString());
    return this.http.get<AuditLogItem[]>(`${this.apiUrl}/audit-logs`, { params });
  }
}
