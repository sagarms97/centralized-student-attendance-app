import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  SendInviteRequest,
  SendInviteResponse,
  ValidateInviteResponse,
  RegisterWithInviteRequest,
  VerifyRegistrationOtpRequest,
  ResendRegistrationOtpRequest
} from '../models/invite.models';

@Injectable({
  providedIn: 'root'
})
export class InviteService {
  private http = inject(HttpClient);
  private invitesUrl = `${environment.apiUrl}/invites`;
  private authUrl = `${environment.apiUrl}/auth`;

  sendInvite(request: SendInviteRequest): Observable<SendInviteResponse> {
    return this.http.post<SendInviteResponse>(`${this.invitesUrl}/send`, request);
  }

  validateInvite(token: string): Observable<ValidateInviteResponse> {
    return this.http.get<ValidateInviteResponse>(`${this.invitesUrl}/validate?token=${encodeURIComponent(token)}`);
  }

  registerWithInvite(request: RegisterWithInviteRequest): Observable<{ message: string; email: string; instituteCode: string; fullName: string }> {
    return this.http.post<{ message: string; email: string; instituteCode: string; fullName: string }>(`${this.authUrl}/register-invite`, request);
  }

  verifyRegistrationOtp(request: VerifyRegistrationOtpRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.authUrl}/verify-registration-otp`, request);
  }

  resendRegistrationOtp(request: ResendRegistrationOtpRequest): Observable<{ message: string }> {
    return this.http.post<{ message: string }>(`${this.authUrl}/resend-registration-otp`, request);
  }
}
