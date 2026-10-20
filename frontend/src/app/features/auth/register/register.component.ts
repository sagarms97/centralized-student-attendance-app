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
  selector: 'app-register',
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
    <div class="register-wrapper">
      <mat-card class="register-card">
        <mat-card-header>
          <div class="logo-box">
            <mat-icon color="primary">account_balance</mat-icon>
          </div>
          <mat-card-title>Register Your Institution</mat-card-title>
          <mat-card-subtitle>Create a dedicated multi-tenant attendance workspace</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content>
          @if (errorMessage()) {
            <div class="error-alert">
              <mat-icon>error_outline</mat-icon>
              <span>{{ errorMessage() }}</span>
            </div>
          }

          <form [formGroup]="registerForm" (ngSubmit)="onSubmit()">
            <div class="section-title">
              <mat-icon>domain</mat-icon>
              <span>Institute Details</span>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline" class="flex-2">
                <mat-label>College / University Name</mat-label>
                <input matInput formControlName="collegeName" placeholder="e.g. Apex Institute of Technology">
                @if (registerForm.get('collegeName')?.hasError('required') && registerForm.get('collegeName')?.touched) {
                  <mat-error>College name is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>Institute Code</mat-label>
                <input matInput formControlName="instituteCode" placeholder="APEX-TECH">
                <mat-hint>Unique short code</mat-hint>
                @if (registerForm.get('instituteCode')?.hasError('required') && registerForm.get('instituteCode')?.touched) {
                  <mat-error>Code is required</mat-error>
                }
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Campus Address</mat-label>
              <input matInput formControlName="address" placeholder="123 Knowledge Park Road">
              @if (registerForm.get('address')?.hasError('required') && registerForm.get('address')?.touched) {
                <mat-error>Address is required</mat-error>
              }
            </mat-form-field>

            <div class="form-row">
              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>City</mat-label>
                <input matInput formControlName="city" placeholder="e.g. Mumbai">
                @if (registerForm.get('city')?.hasError('required') && registerForm.get('city')?.touched) {
                  <mat-error>City is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>State / Province</mat-label>
                <input matInput formControlName="state" placeholder="e.g. Maharashtra">
                @if (registerForm.get('state')?.hasError('required') && registerForm.get('state')?.touched) {
                  <mat-error>State is required</mat-error>
                }
              </mat-form-field>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>Official Contact Email</mat-label>
                <input matInput type="email" formControlName="contactEmail" placeholder="contact@apex.edu">
                @if (registerForm.get('contactEmail')?.hasError('required') && registerForm.get('contactEmail')?.touched) {
                  <mat-error>Contact email is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>Official Contact Phone</mat-label>
                <input matInput formControlName="contactPhone" placeholder="+91 9876543210">
                @if (registerForm.get('contactPhone')?.hasError('required') && registerForm.get('contactPhone')?.touched) {
                  <mat-error>Contact phone is required</mat-error>
                }
              </mat-form-field>
            </div>

            <div class="section-title admin-title">
              <mat-icon>admin_panel_settings</mat-icon>
              <span>First Administrator Account</span>
            </div>

            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Admin Full Name</mat-label>
              <input matInput formControlName="adminName" placeholder="Dr. John Doe">
              @if (registerForm.get('adminName')?.hasError('required') && registerForm.get('adminName')?.touched) {
                <mat-error>Admin name is required</mat-error>
              }
            </mat-form-field>

            <div class="form-row">
              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>Admin Login Email</mat-label>
                <input matInput type="email" formControlName="adminEmail" placeholder="admin@apex.edu">
                @if (registerForm.get('adminEmail')?.hasError('required') && registerForm.get('adminEmail')?.touched) {
                  <mat-error>Admin email is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>Admin Password</mat-label>
                <input matInput [type]="hidePassword() ? 'password' : 'text'" formControlName="adminPassword">
                <button mat-icon-button matSuffix type="button" (click)="hidePassword.set(!hidePassword())">
                  <mat-icon>{{ hidePassword() ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (registerForm.get('adminPassword')?.hasError('required') && registerForm.get('adminPassword')?.touched) {
                  <mat-error>Password is required</mat-error>
                }
                @if (registerForm.get('adminPassword')?.hasError('minlength') && registerForm.get('adminPassword')?.touched) {
                  <mat-error>Password must be at least 6 characters</mat-error>
                }
              </mat-form-field>
            </div>

            <button mat-raised-button color="primary" class="full-width submit-btn" type="submit" [disabled]="registerForm.invalid || isLoading()">
              @if (isLoading()) {
                <mat-spinner diameter="20" class="spinner-inline"></mat-spinner>
                <span>Setting up Institution...</span>
              } @else {
                <span>Complete Registration & Launch</span>
              }
            </button>
          </form>

          <div class="footer-link">
            <span>Already registered?</span>
            <a routerLink="/login">Sign In here</a>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .register-wrapper {
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: center;
      background: linear-gradient(135deg, #1a237e 0%, #283593 50%, #004d40 100%);
      padding: 32px 16px;
    }
    .register-card {
      width: 100%;
      max-width: 680px;
      padding: 32px 28px;
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
      font-size: 1.5rem;
      font-weight: 700;
      color: #1a237e;
    }
    mat-card-subtitle {
      font-size: 0.95rem;
      color: #5f6368;
      margin-top: 4px;
    }
    .section-title {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 1.05rem;
      font-weight: 600;
      color: #1a237e;
      margin-bottom: 16px;
      border-bottom: 2px solid #e8eaf6;
      padding-bottom: 6px;

      mat-icon {
        font-size: 20px;
        width: 20px;
        height: 20px;
      }

      &.admin-title {
        margin-top: 16px;
        color: #004d40;
        border-color: #e0f2f1;
      }
    }
    .form-row {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;

      .flex-1 {
        flex: 1 1 200px;
      }
      .flex-2 {
        flex: 2 1 300px;
      }
    }
    .full-width {
      width: 100%;
      margin-bottom: 12px;
    }
    .submit-btn {
      height: 50px;
      font-size: 1rem;
      font-weight: 600;
      border-radius: 8px;
      margin-top: 16px;
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
      padding: 12px;
      border-radius: 8px;
      margin-bottom: 16px;
      font-size: 0.9rem;
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
export class RegisterComponent {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private router = inject(Router);

  hidePassword = signal(true);
  isLoading = signal(false);
  errorMessage = signal<string | null>(null);

  registerForm = this.fb.group({
    collegeName: ['', [Validators.required, Validators.minLength(2)]],
    instituteCode: ['', [Validators.required, Validators.minLength(2)]],
    address: ['', [Validators.required]],
    city: ['', [Validators.required]],
    state: ['', [Validators.required]],
    contactEmail: ['', [Validators.required, Validators.email]],
    contactPhone: ['', [Validators.required]],
    adminName: ['', [Validators.required, Validators.minLength(2)]],
    adminEmail: ['', [Validators.required, Validators.email]],
    adminPassword: ['', [Validators.required, Validators.minLength(6)]]
  });

  onSubmit(): void {
    if (this.registerForm.invalid) return;

    this.isLoading.set(true);
    this.errorMessage.set(null);

    const fv = this.registerForm.value;

    this.authService.registerInstitute({
      collegeName: fv.collegeName!.trim(),
      instituteCode: fv.instituteCode!.trim().toUpperCase(),
      address: fv.address!.trim(),
      city: fv.city!.trim(),
      state: fv.state!.trim(),
      contactEmail: fv.contactEmail!.trim().toLowerCase(),
      contactPhone: fv.contactPhone!.trim(),
      adminName: fv.adminName!.trim(),
      adminEmail: fv.adminEmail!.trim().toLowerCase(),
      adminPassword: fv.adminPassword!
    }).subscribe({
      next: () => {
        this.isLoading.set(false);
        this.router.navigate(['/app/dashboard']);
      },
      error: (err) => {
        this.isLoading.set(false);
        this.errorMessage.set(err.error?.message || 'Failed to complete registration. Please check inputs.');
      }
    });
  }
}
