import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface FaceSettings {
  isEnabled: boolean;
  matchThreshold: number;
  lowConfidenceThreshold: number;
  dataRetentionDays: number;
  consentNoticeText: string;
  updatedAt?: string;
  updatedBy?: string;
}

export interface StudentConsent {
  studentId: number;
  studentName: string;
  rollNumber: string;
  classId: number;
  className: string;
  section: string;
  status: 'Consented' | 'Withdrawn' | 'Pending' | 'Declined' | string;
  consentGivenBy?: string;
  consentDate?: string;
  recordedBy?: string;
  withdrawnDate?: string;
  withdrawnBy?: string;
  notes?: string;
  faceEmbeddingCount: number;
}

export interface RecordConsentRequest {
  studentId: number;
  consentGivenBy: string;
  notes?: string;
}

export interface WithdrawConsentRequest {
  studentId: number;
  reason?: string;
}

export interface ClassConsentSummary {
  classId: number;
  className: string;
  totalStudents: number;
  consentedCount: number;
  withdrawnCount: number;
  pendingCount: number;
  enrolledCount: number;
}

export interface FaceDataDeletionResult {
  scope: string;
  deletedEmbeddingsCount: number;
  message: string;
}

@Injectable({
  providedIn: 'root'
})
export class FaceAttendanceService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/face`;

  getSettings(): Observable<FaceSettings> {
    return this.http.get<FaceSettings>(`${this.apiUrl}/settings`);
  }

  updateSettings(settings: Partial<FaceSettings>): Observable<FaceSettings> {
    return this.http.put<FaceSettings>(`${this.apiUrl}/settings`, settings);
  }

  getPrivacyNotice(): Observable<{ isEnabled: boolean; consentNoticeText: string; dataRetentionDays: number }> {
    return this.http.get<{ isEnabled: boolean; consentNoticeText: string; dataRetentionDays: number }>(`${this.apiUrl}/privacy-notice`);
  }

  getClassConsents(classId: number): Observable<StudentConsent[]> {
    return this.http.get<StudentConsent[]>(`${this.apiUrl}/consent/class/${classId}`);
  }

  getStudentConsent(studentId: number): Observable<StudentConsent> {
    return this.http.get<StudentConsent>(`${this.apiUrl}/consent/student/${studentId}`);
  }

  recordConsent(request: RecordConsentRequest): Observable<StudentConsent> {
    return this.http.post<StudentConsent>(`${this.apiUrl}/consent`, request);
  }

  withdrawConsent(request: WithdrawConsentRequest): Observable<StudentConsent> {
    return this.http.post<StudentConsent>(`${this.apiUrl}/consent/withdraw`, request);
  }

  getConsentSummary(): Observable<ClassConsentSummary[]> {
    return this.http.get<ClassConsentSummary[]>(`${this.apiUrl}/consent/summary`);
  }

  deleteStudentFaceData(studentId: number): Observable<FaceDataDeletionResult> {
    return this.http.delete<FaceDataDeletionResult>(`${this.apiUrl}/data/student/${studentId}`);
  }

  deleteClassFaceData(classId: number): Observable<FaceDataDeletionResult> {
    return this.http.delete<FaceDataDeletionResult>(`${this.apiUrl}/data/class/${classId}`);
  }

  purgeInstituteFaceData(): Observable<FaceDataDeletionResult> {
    return this.http.delete<FaceDataDeletionResult>(`${this.apiUrl}/data/institute`);
  }

  cleanupExpired(): Observable<FaceDataDeletionResult> {
    return this.http.post<FaceDataDeletionResult>(`${this.apiUrl}/data/cleanup-expired`, {});
  }
}
