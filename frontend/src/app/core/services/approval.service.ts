import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { PendingApprovalUser } from '../models/invite.models';

@Injectable({
  providedIn: 'root'
})
export class ApprovalService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/approvals`;

  getPendingApprovals(): Observable<PendingApprovalUser[]> {
    return this.http.get<PendingApprovalUser[]>(`${this.apiUrl}/pending`);
  }

  getPendingCount(): Observable<number> {
    return this.http.get<number>(`${this.apiUrl}/count`);
  }

  approveUser(userId: number): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/${userId}/approve`, {});
  }

  rejectUser(userId: number, reason: string): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.apiUrl}/${userId}/reject`, { reason });
  }
}
