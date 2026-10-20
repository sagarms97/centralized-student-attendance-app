import { Component, inject, OnInit, signal, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { ActivatedRoute, Router, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { InviteService } from '../../../core/services/invite.service';
import { ValidateInviteResponse } from '../../../core/models/invite.models';

@Component({
  selector: 'app-register-invite',
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
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  template: `
    <div class="auth-wrapper">
      <mat-card class="auth-card">
        <!-- Header -->
        <mat-card-header>
          <div class="logo-box">
            <mat-icon color="primary">how_to_reg</mat-icon>
          </div>
          <mat-card-title>Account Registration</mat-card-title>
          @if (inviteData()?.instituteName) {
            <mat-card-subtitle>{{ inviteData()?.instituteName }}</mat-card-subtitle>
          }
        </mat-card-header>

        <mat-card-content>
          <!-- Validating Invite State -->
          @if (validating()) {
            <div class="loading-state">
              <mat-spinner diameter="36"></mat-spinner>
              <p>Validating your invitation link...</p>
            </div>
          }

          <!-- Invalid Token State -->
          @else if (!inviteValid()) {
            <div class="error-alert">
              <mat-icon>error_outline</mat-icon>
              <span>{{ inviteError() || 'This invitation link is invalid or has expired.' }}</span>
            </div>
            <div class="footer-link mt-4">
              <a routerLink="/login" mat-flat-button color="primary">Return to Sign In</a>
            </div>
          }

          <!-- Step 1: Set Password & Confirm Details -->
          @else if (currentStep() === 1) {
            <div class="invite-banner">
              <div class="banner-top">
                <span class="invited-as">Joining as:</span>
                <span class="badge" [class.badge-staff]="inviteData()?.role === 'Staff'" [class.badge-parent]="inviteData()?.role === 'Parent'">
                  {{ inviteData()?.role }}
                </span>
              </div>
              <div class="banner-name"><strong>{{ inviteData()?.fullName }}</strong></div>
              <div class="banner-email">{{ inviteData()?.email }}</div>
            </div>

            <form [formGroup]="registerForm" (ngSubmit)="submitRegistration()">
              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Full Name</mat-label>
                <input matInput formControlName="fullName">
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Phone Number</mat-label>
                <input matInput formControlName="phone">
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Set Account Password</mat-label>
                <input matInput [type]="hidePassword ? 'password' : 'text'" formControlName="password">
                <button type="button" mat-icon-button matSuffix (click)="hidePassword = !hidePassword">
                  <mat-icon>{{ hidePassword ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (registerForm.get('password')?.hasError('required') && registerForm.get('password')?.touched) {
                  <mat-error>Password is required</mat-error>
                }
                @if (registerForm.get('password')?.hasError('minlength') && registerForm.get('password')?.touched) {
                  <mat-error>Password must be at least 6 characters</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Confirm Password</mat-label>
                <input matInput [type]="hideConfirm ? 'password' : 'text'" formControlName="confirmPassword">
                <button type="button" mat-icon-button matSuffix (click)="hideConfirm = !hideConfirm">
                  <mat-icon>{{ hideConfirm ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (registerForm.get('confirmPassword')?.hasError('required') && registerForm.get('confirmPassword')?.touched) {
                  <mat-error>Confirm password is required</mat-error>
                }
              </mat-form-field>

              <button mat-raised-button color="primary" class="full-width submit-btn" type="submit" [disabled]="registerForm.invalid || submitting()">
                @if (submitting()) {
                  <mat-spinner diameter="20" class="spinner-inline"></mat-spinner>
                  <span>Submitting...</span>
                } @else {
                  <span>Continue to OTP Verification</span>
                }
              </button>
            </form>
          }

          <!-- Step 2: OTP Verification -->
          @else if (currentStep() === 2) {
            <div class="otp-container">
              <div class="otp-notice">
                <mat-icon color="primary">mark_email_read</mat-icon>
                <p>
                  A 6-digit verification code has been dispatched to<br>
                  <strong>{{ userEmail }}</strong>
                </p>
              </div>

              @if (otpError()) {
                <div class="error-alert">
                  <mat-icon>error_outline</mat-icon>
                  <span>{{ otpError() }}</span>
                </div>
              }

              <form [formGroup]="otpForm" (ngSubmit)="verifyOtp()">
                <mat-form-field appearance="outline" class="full-width text-center">
                  <mat-label>Enter 6-Digit OTP</mat-label>
                  <input matInput formControlName="otp" maxlength="6" class="otp-input" placeholder="••••••">
                  @if (otpForm.get('otp')?.hasError('required') && otpForm.get('otp')?.touched) {
                    <mat-error>OTP code is required</mat-error>
                  }
                  @if (otpForm.get('otp')?.hasError('minlength') && otpForm.get('otp')?.touched) {
                    <mat-error>Must be 6 digits</mat-error>
                  }
                </mat-form-field>

                <div class="resend-row">
                  @if (resendCooldown() > 0) {
                    <span class="cooldown-text">Resend code in {{ resendCooldown() }}s</span>
                  } @else {
                    <button type="button" mat-button color="primary" [disabled]="resendingOtp()" (click)="resendOtp()">
                      <mat-icon>refresh</mat-icon> Resend OTP Code
                    </button>
                  }
                </div>

                <button mat-raised-button color="primary" class="full-width submit-btn" type="submit" [disabled]="otpForm.invalid || verifyingOtp()">
                  @if (verifyingOtp()) {
                    <mat-spinner diameter="20" class="spinner-inline"></mat-spinner>
                    <span>Verifying...</span>
                  } @else {
                    <span>Verify & Complete Registration</span>
                  }
                </button>
              </form>
            </div>
          }

          <!-- Step 3: Registration Complete & Pending Admin Approval -->
          @else if (currentStep() === 3) {
            <div class="pending-approval-box">
              <div class="approval-icon">
                <mat-icon>hourglass_top</mat-icon>
              </div>
              <h3>Registration Successful!</h3>
              <div class="pending-pill">Status: Pending Administrator Approval</div>
              <p class="approval-desc">
                Your email has been verified. To maintain institutional security, an administrator at
                <strong>{{ inviteData()?.instituteName }}</strong> must review and approve your account before you can log in.
              </p>
              <div class="info-alert">
                <mat-icon>info</mat-icon>
                <span>You will receive an automated email notification as soon as your account is approved.</span>
              </div>
              <div class="footer-link mt-4">
                <a routerLink="/login" mat-flat-button color="primary">Return to Sign In</a>
              </div>
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
      max-width: 480px;
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
      margin-bottom: 20px;
    }
    mat-card-title {
      font-size: 1.4rem;
      font-weight: 700;
      color: #1a237e;
    }
    mat-card-subtitle {
      color: #64748b;
      margin-top: 4px;
      font-size: 0.92rem;
    }
    .loading-state {
      text-align: center;
      padding: 40px 0;
      color: #64748b;
      mat-spinner { margin: 0 auto 16px; }
    }
    .invite-banner {
      background: #f1f5f9;
      border-radius: 8px;
      padding: 14px 16px;
      margin-bottom: 16px;
      border-left: 4px solid #1a237e;
      .banner-top {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 4px;
        .invited-as { font-size: 0.78rem; color: #64748b; }
      }
      .banner-name { font-size: 1rem; color: #1e293b; }
      .banner-email { font-size: 0.82rem; color: #64748b; }
    }
    .full-width {
      width: 100%;
      margin-bottom: 8px;
    }
    .submit-btn {
      height: 48px;
      font-size: 1rem;
      font-weight: 600;
      margin-top: 10px;
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
      font-size: 0.88rem;
    }
    .otp-notice {
      text-align: center;
      padding: 8px 0 16px;
      mat-icon { font-size: 36px; width: 36px; height: 36px; margin-bottom: 4px; }
      p { margin: 0; color: #475569; font-size: 0.9rem; }
    }
    .otp-input {
      font-size: 1.6rem;
      letter-spacing: 8px;
      text-align: center;
      font-weight: 700;
    }
    .resend-row {
      display: flex;
      justify-content: center;
      align-items: center;
      margin: 8px 0 16px;
    }
    .cooldown-text {
      font-size: 0.82rem;
      color: #94a3b8;
    }
    .pending-approval-box {
      text-align: center;
      padding: 16px 8px;
      .approval-icon {
        width: 64px;
        height: 64px;
        border-radius: 50%;
        background: #fff3e0;
        color: #e65100;
        display: flex;
        align-items: center;
        justify-content: center;
        margin: 0 auto 16px;
        mat-icon { font-size: 36px; width: 36px; height: 36px; }
      }
      h3 { margin: 0 0 10px; font-size: 1.3rem; color: #1e293b; }
      .pending-pill {
        display: inline-block;
        background: #fff3e0;
        color: #e65100;
        font-weight: 700;
        font-size: 0.8rem;
        padding: 4px 12px;
        border-radius: 16px;
        margin-bottom: 16px;
      }
      .approval-desc {
        color: #475569;
        font-size: 0.9rem;
        line-height: 1.5;
        margin: 0 0 20px;
      }
      .info-alert {
        display: flex;
        align-items: center;
        gap: 8px;
        background: #e0f2f1;
        color: #004d40;
        border: 1px solid #b2dfdb;
        padding: 12px;
        border-radius: 8px;
        font-size: 0.85rem;
        text-align: left;
      }
    }
    .footer-link {
      text-align: center;
      margin-top: 16px;
    }
    .mt-4 { margin-top: 16px; }
  `]
})
export class RegisterInviteComponent implements OnInit, OnDestroy {
  private fb = inject(FormBuilder);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private inviteService = inject(InviteService);
  private snackBar = inject(MatSnackBar);

  token: string | null = null;
  validating = signal(true);
  inviteValid = signal(false);
  inviteError = signal<string | null>(null);
  inviteData = signal<ValidateInviteResponse | null>(null);

  currentStep = signal<1 | 2 | 3>(1);

  // Step 1 state
  submitting = signal(false);
  hidePassword = true;
  hideConfirm = true;

  registerForm = this.fb.group({
    fullName: ['', [Validators.required]],
    phone: ['', [Validators.required]],
    password: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  });

  // Step 2 state
  userEmail = '';
  instituteCode = '';
  verifyingOtp = signal(false);
  resendingOtp = signal(false);
  otpError = signal<string | null>(null);
  resendCooldown = signal(0);
  private cooldownTimer: any = null;

  otpForm = this.fb.group({
    otp: ['', [Validators.required, Validators.minLength(6)]]
  });

  ngOnInit(): void {
    this.token = this.route.snapshot.queryParamMap.get('token');
    if (!this.token) {
      this.validating.set(false);
      this.inviteValid.set(false);
      this.inviteError.set('Missing invitation token.');
      return;
    }

    this.inviteService.validateInvite(this.token).subscribe({
      next: res => {
        this.validating.set(false);
        if (res.isValid) {
          this.inviteValid.set(true);
          this.inviteData.set(res);
          this.registerForm.patchValue({
            fullName: res.fullName || '',
            phone: res.phone || ''
          });
        } else {
          this.inviteValid.set(false);
          this.inviteError.set(res.message || 'Invalid or expired invitation token.');
        }
      },
      error: () => {
        this.validating.set(false);
        this.inviteValid.set(false);
        this.inviteError.set('Could not validate invitation. Please try again.');
      }
    });
  }

  ngOnDestroy(): void {
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
  }

  submitRegistration(): void {
    if (this.registerForm.invalid || !this.token) return;

    const val = this.registerForm.value;
    if (val.password !== val.confirmPassword) {
      this.snackBar.open('Passwords do not match.', 'Close', { duration: 4000 });
      return;
    }

    this.submitting.set(true);
    this.inviteService.registerWithInvite({
      token: this.token,
      password: val.password!,
      confirmPassword: val.confirmPassword!,
      fullName: val.fullName || undefined,
      phone: val.phone || undefined
    }).subscribe({
      next: res => {
        this.submitting.set(false);
        this.userEmail = res.email;
        this.instituteCode = res.instituteCode;
        this.currentStep.set(2);
        this.startCooldown(60);
      },
      error: err => {
        this.submitting.set(false);
        this.snackBar.open(err.error?.message || 'Registration failed', 'Close', { duration: 4000 });
      }
    });
  }

  verifyOtp(): void {
    if (this.otpForm.invalid) return;

    this.verifyingOtp.set(true);
    this.otpError.set(null);

    this.inviteService.verifyRegistrationOtp({
      email: this.userEmail,
      instituteCode: this.instituteCode,
      otp: this.otpForm.value.otp!.trim()
    }).subscribe({
      next: () => {
        this.verifyingOtp.set(false);
        this.currentStep.set(3);
      },
      error: err => {
        this.verifyingOtp.set(false);
        this.otpError.set(err.error?.message || 'Invalid verification code.');
      }
    });
  }

  resendOtp(): void {
    if (this.resendCooldown() > 0) return;

    this.resendingOtp.set(true);
    this.otpError.set(null);

    this.inviteService.resendRegistrationOtp({
      email: this.userEmail,
      instituteCode: this.instituteCode
    }).subscribe({
      next: () => {
        this.resendingOtp.set(false);
        this.snackBar.open('A new OTP code has been sent to your email.', 'Close', { duration: 3000 });
        this.startCooldown(60);
      },
      error: err => {
        this.resendingOtp.set(false);
        this.snackBar.open(err.error?.message || 'Failed to resend OTP.', 'Close', { duration: 4000 });
      }
    });
  }

  private startCooldown(seconds: number): void {
    this.resendCooldown.set(seconds);
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
    this.cooldownTimer = setInterval(() => {
      const cur = this.resendCooldown();
      if (cur <= 1) {
        this.resendCooldown.set(0);
        clearInterval(this.cooldownTimer);
      } else {
        this.resendCooldown.set(cur - 1);
      }
    }, 1000);
  }
}
