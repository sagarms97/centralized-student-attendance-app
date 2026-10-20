import { Injectable, inject, signal, computed } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Router } from '@angular/router';
import { Observable, tap, catchError, throwError } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthResponse, LoginRequest, RegisterInstituteRequest, User, Institute } from '../models/auth.models';

@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private http = inject(HttpClient);
  private router = inject(Router);
  private apiUrl = `${environment.apiUrl}/auth`;

  private readonly TOKEN_KEY = 'sa_access_token';
  private readonly REFRESH_KEY = 'sa_refresh_token';
  private readonly USER_KEY = 'sa_current_user';
  private readonly INSTITUTE_KEY = 'sa_current_institute';

  currentUser = signal<User | null>(this.getStoredUser());
  currentInstitute = signal<Institute | null>(this.getStoredInstitute());

  isAuthenticated = computed(() => !!this.currentUser() && !!this.getAccessToken());
  isAdmin = computed(() => {
    const role = this.currentUser()?.role;
    return role === 'InstituteAdmin' || role === 'SuperAdmin';
  });
  isStaff = computed(() => this.currentUser()?.role === 'Staff');
  isParent = computed(() => this.currentUser()?.role === 'Parent');
  isSuperAdmin = computed(() => this.currentUser()?.role === 'SuperAdmin');

  registerInstitute(request: RegisterInstituteRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/register-institute`, request).pipe(
      tap(res => this.handleAuthSuccess(res))
    );
  }

  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/login`, request).pipe(
      tap(res => this.handleAuthSuccess(res))
    );
  }

  refreshToken(): Observable<AuthResponse> {
    const refreshToken = this.getRefreshToken();
    if (!refreshToken) {
      this.logout();
      return throwError(() => new Error('No refresh token available'));
    }

    return this.http.post<AuthResponse>(`${this.apiUrl}/refresh-token`, { refreshToken }).pipe(
      tap(res => this.handleAuthSuccess(res)),
      catchError(err => {
        this.logout();
        return throwError(() => err);
      })
    );
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.REFRESH_KEY);
    localStorage.removeItem(this.USER_KEY);
    localStorage.removeItem(this.INSTITUTE_KEY);

    this.currentUser.set(null);
    this.currentInstitute.set(null);
    this.router.navigate(['/login']);
  }

  getAccessToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getRefreshToken(): string | null {
    return localStorage.getItem(this.REFRESH_KEY);
  }

  private handleAuthSuccess(res: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, res.accessToken);
    localStorage.setItem(this.REFRESH_KEY, res.refreshToken);
    localStorage.setItem(this.USER_KEY, JSON.stringify(res.user));

    this.currentUser.set(res.user);

    if (res.institute) {
      localStorage.setItem(this.INSTITUTE_KEY, JSON.stringify(res.institute));
      this.currentInstitute.set(res.institute);
    }
  }

  private getStoredUser(): User | null {
    const stored = localStorage.getItem(this.USER_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }

  private getStoredInstitute(): Institute | null {
    const stored = localStorage.getItem(this.INSTITUTE_KEY);
    if (!stored) return null;
    try {
      return JSON.parse(stored);
    } catch {
      return null;
    }
  }
}
