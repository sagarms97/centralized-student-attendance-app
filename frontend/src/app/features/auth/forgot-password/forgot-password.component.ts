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
import { ProfileService } from '../../../core/services/profile.service';

@Component({
  selector: 'app-forgot-password',
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
    <div class="auth-wrapper">
      <mat-card class="auth-card">
        <mat-card-header>
          <div class="logo-box">
            <mat-icon color="primary">lock_reset</mat-icon>
          </div>
          <mat-card-title>Forgot Password</mat-card-title>
          <mat-card-subtitle>Enter your email and institute code to receive a reset link</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          @if (submitted()) {
            <div class="success-alert">
              <mat-icon>check_circle</mat-icon>
              <div>
                <strong>Request Dispatched</strong>
                <p>If an account exists with the provided details, we have sent a password reset link to your email address.</p>
                <small>The link will remain active for 30 minutes.</small>
              </div>
            </div>

            <div class="footer-link mt-4">
              <a routerLink="/login" mat-flat-button color="primary">
                <mat-icon>arrow_back</mat-icon> Back to Sign In
              </a>
            </div>
          } @else {
            <form [formGroup]="form" (ngSubmit)="onSubmit()">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Institute Code</mat-label>
                <input matInput formControlName="instituteCode" placeholder="e.g. MIT-001">
                <mat-icon matSuffix>business</mat-icon>
                @if (form.get('instituteCode')?.hasError('required') && form.get('instituteCode')?.touched) {
                  <mat-error>Institute code is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Email Address</mat-label>
                <input matInput type="email" formControlName="email" placeholder="your-email@college.edu">
                <mat-icon matSuffix>email</mat-icon>
                @if (form.get('email')?.hasError('required') && form.get('email')?.touched) {
                  <mat-error>Email is required</mat-error>
                }
                @if (form.get('email')?.hasError('email') && form.get('email')?.touched) {
                  <mat-error>Enter a valid email</mat-error>
                }
              </mat-form-field>

              <button mat-raised-button color="primary" class="full-width submit-btn" type="submit" [disabled]="form.invalid || loading()">
                @if (loading()) {
                  <mat-spinner diameter="20" class="spinner-inline"></mat-spinner>
                  <span>Sending Link...</span>
                } @else {
                  <span>Send Reset Link</span>
                }
              </button>
            </form>

            <div class="footer-link">
              <a routerLink="/login">Return to Sign In</a>
            </div>
          }
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .auth-wrapper {
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #1a237e 0%, #283593 50%, #004d40 100%);
      padding: 16px;
    }
    .auth-card {
      width: 100%;
      max-width: 440px;
      padding: 32px 24px;
      border-radius: 16px;
      box-shadow: 0 12px 32px rgba(0,0,0,0.25);
    }
    .logo-box {
      width: 56px;
      height: 56px;
      border-radius: 12px;
      background: #e8eaf6;
      display: flex;
      align-items: center;
      justify-content: center;
      margin-bottom: 12px;
      mat-icon { font-size: 32px; width: 32px; height: 32px; color: #1a237e; }
    }
    mat-card-header {
      display: flex;
      flex-direction: column;
      align-items: center;
      text-align: center;
      margin-bottom: 24px;
    }
    mat-card-title {
      font-size: 1.4rem;
      font-weight: 700;
      color: #1a237e;
    }
    mat-card-subtitle {
      color: #64748b;
      margin-top: 4px;
    }
    .full-width {
      width: 100%;
      margin-bottom: 12px;
    }
    .submit-btn {
      height: 48px;
      font-size: 1rem;
      font-weight: 600;
      margin-top: 8px;
    }
    .spinner-inline {
      display: inline-block;
      margin-right: 8px;
    }
    .success-alert {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      background: #e8f5e9;
      color: #2e7d32;
      border: 1px solid #a5d6a7;
      padding: 16px;
      border-radius: 8px;
      margin-bottom: 16px;
      mat-icon { font-size: 26px; width: 26px; height: 26px; color: #2e7d32; flex-shrink: 0; }
      p { margin: 4px 0; font-size: 0.9rem; }
      small { color: #558b2f; }
    }
    .footer-link {
      text-align: center;
      margin-top: 20px;
      font-size: 0.9rem;
      a {
        color: #1a237e;
        text-decoration: none;
        font-weight: 600;
        &:hover { text-decoration: underline; }
      }
    }
    .mt-4 { margin-top: 16px; }
  `]
})
export class ForgotPasswordComponent {
  private fb = inject(FormBuilder);
  private profileService = inject(ProfileService);

  loading = signal(false);
  submitted = signal(false);

  form = this.fb.group({
    instituteCode: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]]
  });

  onSubmit(): void {
    if (this.form.invalid) return;

    this.loading.set(true);
    const val = this.form.value;

    this.profileService.forgotPassword({
      instituteCode: val.instituteCode!.trim().toUpperCase(),
      email: val.email!.trim().toLowerCase()
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.submitted.set(true);
      },
      error: () => {
        // Even on error, do not leak info to client
        this.loading.set(false);
        this.submitted.set(true);
      }
    });
  }
}
