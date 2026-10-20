import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { AuthService } from '../../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    RouterModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="login-wrapper">
      <mat-card class="login-card">
        <mat-card-header>
          <div class="logo-box">
            <mat-icon color="primary">school</mat-icon>
          </div>
          <mat-card-title>Student Attendance System</mat-card-title>
          <mat-card-subtitle>Sign in to your institution portal</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          @if (errorMessage()) {
            <div class="error-alert">
              <mat-icon>error_outline</mat-icon>
              <span>{{ errorMessage() }}</span>
            </div>
          }

          <form [formGroup]="loginForm" (ngSubmit)="onSubmit()">
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Institute Code (Optional)</mat-label>
              <input matInput formControlName="instituteCode" placeholder="e.g. INST-001" uppercase>
              <mat-icon matSuffix>business</mat-icon>
              <mat-hint>Leave blank if your email is globally unique</mat-hint>
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Email Address</mat-label>
              <input matInput type="email" formControlName="email" placeholder="admin@college.edu">
              <mat-icon matSuffix>email</mat-icon>
              @if (loginForm.get('email')?.hasError('required') && loginForm.get('email')?.touched) {
                <mat-error>Email is required</mat-error>
              }
              @if (loginForm.get('email')?.hasError('email') && loginForm.get('email')?.touched) {
                <mat-error>Enter a valid email address</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Password</mat-label>
              <input matInput [type]="hidePassword() ? 'password' : 'text'" formControlName="password">
              <button mat-icon-button matSuffix type="button" (click)="hidePassword.set(!hidePassword())">
                <mat-icon>{{ hidePassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
              </button>
              @if (loginForm.get('password')?.hasError('required') && loginForm.get('password')?.touched) {
                <mat-error>Password is required</mat-error>
              }
            </mat-form-field>

            <button mat-raised-button color="primary" class="full-width submit-btn" type="submit" [disabled]="loginForm.invalid || isLoading()">
              @if (isLoading()) {
                <mat-spinner diameter="20" class="spinner-inline"></mat-spinner>
                <span>Signing In...</span>
              } @else {
                <span>Sign In</span>
              }
            </button>
          </form>

          <div class="footer-link">
            <span>New institution?</span>
            <a routerLink="/register">Register your College</a>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .login-wrapper {
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #1a237e 0%, #283593 50%, #004d40 100%);
      padding: 16px;
    }
    .login-card {
      width: 100%;
      max-width: 440px;
      padding: 32px 24px;
      border-radius: 16px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.25);
    }
    mat-card-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      margin-bottom: 24px;
    }
    .logo-box {
      width: 56px;
      height: 56px;
      background: #e8eaf6;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
      mat-icon {
        font-size: 32px;
        width: 32px;
        height: 32px;
      }
    }
    mat-card-title {
      font-size: 1.4rem;
      font-weight: 700;
      color: #1a237e;
    }
    mat-card-subtitle {
      font-size: 0.9rem;
      margin-top: 4px;
      color: #5f6368;
    }
    .full-width {
      width: 100%;
      margin-bottom: 16px;
    }
    .submit-btn {
      height: 48px;
      font-size: 1rem;
      font-weight: 600;
      border-radius: 8px;
      margin-top: 8px;
    }
    .spinner-inline {
      display: inline-block;
      margin-right: 8px;
    }
    .error-alert {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #ffebee;
      color: #c62828;
      padding: 10px 14px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 0.875rem;
    }
    .footer-link {
      margin-top: 24px;
      text-align: center;
      font-size: 0.9rem;
      color: #5f6368;
      a {
        margin-left: 6px;
        color: #1a237e;
        font-weight: 600;
        text-decoration: none;
        &:hover {
          text-decoration: underline;
        }
      }
    }
  `]
})
export class LoginComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  hidePassword = signal(true);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  loginForm = this.fb.group({
    instituteCode: [''],
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]]
  });

  onSubmit(): void {
    if (this.loginForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const { instituteCode, email, password } = this.loginForm.value;

    this.authService.login({
      instituteCode: instituteCode ? instituteCode.trim().toUpperCase() : undefined,
      email: email!.trim(),
      password: password!
    }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/app/dashboard']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to sign in. Please check your credentials.');
      }
    });
  }
}
