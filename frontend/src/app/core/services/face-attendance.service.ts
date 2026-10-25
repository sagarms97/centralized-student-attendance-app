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

export interface EnrollPhotoItem {
  poseType: 'Front' | 'SlightLeft' | 'SlightRight' | string;
  imageBase64: string;
}

export interface EnrollStudentFaceRequest {
  studentId: number;
  photos: EnrollPhotoItem[];
}

export interface FaceEnrollmentResult {
  studentId: number;
  studentName: string;
  successfullyEnrolledCount: number;
  totalStoredEmbeddings: number;
  details: string[];
}

export interface FaceBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceCropMatchRequest {
  cropIndex: number;
  photoIndex: number;
  imageBase64: string;
  boundingBox?: FaceBoundingBox;
}

export interface MatchClassAttendanceRequest {
  classId: number;
  section?: string;
  periodId?: number;
  attendanceDate?: string;
  faceCrops: FaceCropMatchRequest[];
}

export interface RecognizedFace {
  cropIndex: number;
  photoIndex: number;
  matchedStudentId?: number;
  matchedStudentName?: string;
  rollNumber?: string;
  section?: string;
  confidence: number;
  status: 'Matched' | 'LowConfidence' | 'Unknown';
  isDuplicate: boolean;
  boundingBox?: FaceBoundingBox;
}

export interface NotDetectedStudent {
  studentId: number;
  studentName: string;
  rollNumber: string;
  section: string;
  hasConsent: boolean;
  isEnrolled: boolean;
}

export interface ClassRecognitionResult {
  classId: number;
  className: string;
  section?: string;
  totalStudentsInClass: number;
  consentedStudentsCount: number;
  enrolledStudentsCount: number;
  processedPhotosCount: number;
  totalFacesDetected: number;
  matchedCount: number;
  lowConfidenceCount: number;
  unknownCount: number;
  recognizedFaces: RecognizedFace[];
  notDetectedStudents: NotDetectedStudent[];
}

export interface ReviewPhotoItem {
  index: number;
  label: string;
  imageSrc: string;
}

export interface FaceReviewSessionData {
  classId: number;
  className: string;
  section?: string;
  timetableEntryId?: number;
  periodId?: number;
  periodName?: string;
  date: string;
  photos: ReviewPhotoItem[];
  recognitionResult: ClassRecognitionResult;
}

@Injectable({
  providedIn: 'root'
})
export class FaceAttendanceService {
  private http = inject(HttpClient);
  private apiUrl = `${environment.apiUrl}/face`;
  private reviewSession: FaceReviewSessionData | null = null;

  setReviewSession(session: FaceReviewSessionData): void {
    this.reviewSession = session;
    try {
      sessionStorage.setItem('face_review_session', JSON.stringify(session));
    } catch (e) {
      console.warn('Session storage write error', e);
    }
  }

  getReviewSession(): FaceReviewSessionData | null {
    if (this.reviewSession) return this.reviewSession;
    try {
      const stored = sessionStorage.getItem('face_review_session');
      if (stored) {
        this.reviewSession = JSON.parse(stored);
        return this.reviewSession;
      }
    } catch (e) {
      console.warn('Session storage read error', e);
    }
    return null;
  }

  clearReviewSession(): void {
    this.reviewSession = null;
    try {
      sessionStorage.removeItem('face_review_session');
    } catch (e) {
      // ignore
    }
  }

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

  // Phase 2: Enrollment
  enrollStudent(request: EnrollStudentFaceRequest): Observable<FaceEnrollmentResult> {
    return this.http.post<FaceEnrollmentResult>(`${this.apiUrl}/enrollment`, request);
  }

  getStudentEnrollment(studentId: number): Observable<any> {
    return this.http.get<any>(`${this.apiUrl}/enrollment/student/${studentId}`);
  }

  deleteEmbedding(embeddingId: number): Observable<any> {
    return this.http.delete<any>(`${this.apiUrl}/enrollment/embedding/${embeddingId}`);
  }

  // Phase 4: Recognition
  matchClassFaces(request: MatchClassAttendanceRequest): Observable<ClassRecognitionResult> {
    return this.http.post<ClassRecognitionResult>(`${this.apiUrl}/recognition/match-class`, request);
  }
}
