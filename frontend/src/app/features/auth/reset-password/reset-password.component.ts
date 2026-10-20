import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ProfileService } from '../../../core/services/profile.service';

@Component({
  selector: 'app-reset-password',
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
          <mat-card-title>Reset Password</mat-card-title>
          <mat-card-subtitle>Choose a new password for your account</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          @if (!token) {
            <div class="error-alert">
              <mat-icon>error_outline</mat-icon>
              <span>Invalid or missing reset token. Please request a new password reset link.</span>
            </div>
            <div class="footer-link mt-4">
              <a routerLink="/forgot-password" mat-flat-button color="primary">Request New Link</a>
            </div>
          } @else if (resetSuccess()) {
            <div class="success-alert">
              <mat-icon>check_circle</mat-icon>
              <div>
                <strong>Password Reset Successfully!</strong>
                <p>Your password has been updated. You can now sign in with your new credentials.</p>
              </div>
            </div>

            <div class="footer-link mt-4">
              <a routerLink="/login" mat-flat-button color="primary">Proceed to Sign In</a>
            </div>
          } @else {
            @if (errorMessage()) {
              <div class="error-alert">
                <mat-icon>error_outline</mat-icon>
                <span>{{ errorMessage() }}</span>
              </div>
            }

            <form [formGroup]="form" (ngSubmit)="onSubmit()">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>New Password</mat-label>
                <input matInput [type]="hidePassword ? 'password' : 'text'" formControlName="newPassword">
                <button type="button" mat-icon-button matSuffix (click)="hidePassword = !hidePassword">
                  <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (form.get('newPassword')?.hasError('required') && form.get('newPassword')?.touched) {
                  <mat-error>New password is required</mat-error>
                }
                @if (form.get('newPassword')?.hasError('minlength') && form.get('newPassword')?.touched) {
                  <mat-error>Password must be at least 6 characters</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Confirm New Password</mat-label>
                <input matInput [type]="hideConfirm ? 'password' : 'text'" formControlName="confirmPassword">
                <button type="button" mat-icon-button matSuffix (click)="hideConfirm = !hideConfirm">
                  <mat-icon>{{ hideConfirm ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (form.get('confirmPassword')?.hasError('required') && form.get('confirmPassword')?.touched) {
                  <mat-error>Confirm password is required</mat-error>
                }
              </mat-form-field>

              <button mat-raised-button color="primary" class="full-width submit-btn" type="submit" [disabled]="form.invalid || loading()">
                @if (loading()) {
                  <mat-spinner diameter="20" class="spinner-inline"></mat-spinner>
                  <span>Updating Password...</span>
                } @else {
                  <span>Reset Password</span>
                }
              </button>
            </form>

            <div class="footer-link">
              <a routerLink="/login">Back to Sign In</a>
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
    .error-alert {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #ffebee;
      color: #c62828;
      border: 1px solid #ffcdd2;
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 0.9rem;
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
      p { margin: 4px 0 0; font-size: 0.9rem; }
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
export class ResetPasswordComponent implements OnInit {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private profileService = inject(ProfileService);

  token: string | null = null;
  loading = signal(false);
  resetSuccess = signal(false);
  errorMessage = signal<string | null>(null);

  hidePassword = true;
  hideConfirm = true;

  form = this.fb.group({
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  });

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
  }

  onSubmit(): void {
    if (this.form.invalid || !this.token) return;

    const val = this.form.value;
    if (val.newPassword !== val.confirmPassword) {
      this.errorMessage.set('Passwords do not match.');
      return;
    }

    this.loading.set(true);
    this.errorMessage.set(null);

    this.profileService.resetPassword({
      token: this.token,
      newPassword: val.newPassword!,
      confirmPassword: val.confirmPassword!
    }).subscribe({
      next: () => {
        this.loading.set(false);
        this.resetSuccess.set(true);
      },
      error: err => {
        this.loading.set(false);
        this.errorMessage.set(err.error?.message || 'Password reset failed. The link may have expired.');
      }
    });
  }
}
