import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

export interface UserProfile {
  id: number;
  instituteId?: number;
  instituteName?: string;
  instituteCode?: string;
  fullName: string;
  email: string;
  role: string;
  accountStatus: string;
  photoPath?: string;
  phone?: string;
  address?: string;
  employeeId?: string;
  subjectSpecialization?: string;
  createdAt: string;
}

export interface ChangePasswordRequest {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
}

export interface ForgotPasswordRequest {
  email: string;
  instituteCode: string;
}

export interface ResetPasswordRequest {
  token: string;
  newPassword: string;
  confirmPassword: string;
}

@Injectable({
  providedIn: 'root'
})
export class ProfileService {
  private http = inject(HttpClient);
  private profileUrl = `${environment.apiUrl}/profile`;
  private authUrl = `${environment.apiUrl}/auth`;

  getMyProfile(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.profileUrl}/me`);
  }

  changePassword(request: ChangePasswordRequest): Observable<{ message: string }> {
    return this.http.put<{ message: string }>(`${this.profileUrl}/password`, request);
  }

  uploadPhoto(file: File): Observable<{ photoPath: string; message: string }> {
    const formData = new FormData();
    formData.append('file', file);
    return this.http.post<{ photoPath: string; message: string }>(`${this.profileUrl}/photo`, formData);
  }

  forgotPassword(request: ForgotPasswordRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.authUrl}/forgot-password`, request);
  }

  resetPassword(request: ResetPasswordRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.authUrl}/reset-password`, request);
  }

  getPhotoUrl(photoPath: string | undefined, instituteId: number | undefined): string | null {
    if (!photoPath) return null;
    return `${this.profileUrl}/photo/${photoPath}?instituteId=${instituteId || 0}`;
  }
}
