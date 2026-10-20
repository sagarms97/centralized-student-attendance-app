import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDividerModule } from '@angular/material/divider';
import { ProfileService, UserProfile } from '../../core/services/profile.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatTabsModule,
    MatSnackBarModule,
    MatDividerModule
  ],
  template: `
    <div class="dialog-header">
      <h2>
        <mat-icon color="primary">account_circle</mat-icon>
        <span>My Account & Security</span>
      </h2>
      <button mat-icon-button mat-dialog-close>
        <mat-icon>close</mat-icon>
      </button>
    </div>

    <mat-dialog-content class="profile-content">
      <mat-tab-group animationDuration="200ms">
        <!-- Tab 1: Profile Information & Photo -->
        <mat-tab label="Profile Details">
          <div class="tab-body">
            <!-- Avatar & Upload Section -->
            <div class="avatar-section">
              <div class="avatar-preview">
                @if (profile()?.photoPath) {
                  <img [src]="getPhotoUrl(profile()?.photoPath)" alt="Profile Photo" class="profile-img" (error)="onImgError($event)">
                } @else {
                  <div class="avatar-fallback">{{ userInitials }}</div>
                }
              </div>

              <div class="upload-meta">
                <h3>{{ profile()?.fullName }}</h3>
                <span class="role-pill">{{ profile()?.role }}</span>
                <span class="institute-label">{{ profile()?.instituteName }} ({{ profile()?.instituteCode }})</span>

                <div class="upload-btn-row">
                  <input type="file" #fileInput (change)="onFileSelected($event)" accept=".jpg,.jpeg,.png,.webp" style="display: none">
                  <button mat-stroked-button color="primary" [disabled]="uploading()" (click)="fileInput.click()">
                    <mat-icon>{{ uploading() ? 'hourglass_top' : 'photo_camera' }}</mat-icon>
                    {{ uploading() ? 'Uploading...' : 'Change Photo' }}
                  </button>
                  <small class="upload-hint">JPG, PNG, WebP • Max 2MB</small>
                </div>
              </div>
            </div>

            <mat-divider class="my-3"></mat-divider>

            <!-- Detailed Info Grid -->
            <div class="info-grid">
              <div class="info-item">
                <span class="info-label">Email Address</span>
                <span class="info-value">{{ profile()?.email }}</span>
              </div>

              <div class="info-item">
                <span class="info-label">Account Status</span>
                <span class="info-value">
                  <span class="badge badge-approved">{{ profile()?.accountStatus }}</span>
                </span>
              </div>

              @if (profile()?.phone) {
                <div class="info-item">
                  <span class="info-label">Phone</span>
                  <span class="info-value">{{ profile()?.phone }}</span>
                </div>
              }

              @if (profile()?.employeeId) {
                <div class="info-item">
                  <span class="info-label">Employee ID</span>
                  <span class="info-value">{{ profile()?.employeeId }}</span>
                </div>
              }

              @if (profile()?.subjectSpecialization) {
                <div class="info-item">
                  <span class="info-label">Specialization</span>
                  <span class="info-value">{{ profile()?.subjectSpecialization }}</span>
                </div>
              }

              @if (profile()?.address) {
                <div class="info-item full-span">
                  <span class="info-label">Address</span>
                  <span class="info-value">{{ profile()?.address }}</span>
                </div>
              }
            </div>
          </div>
        </mat-tab>

        <!-- Tab 2: Change Password -->
        <mat-tab label="Change Password">
          <div class="tab-body">
            <form [formGroup]="passwordForm" (ngSubmit)="changePassword()" class="password-form">
              <p class="form-desc">Choose a strong password containing at least 6 characters.</p>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Current Password</mat-label>
                <input matInput [type]="hideCurrent ? 'password' : 'text'" formControlName="currentPassword">
                <button type="button" mat-icon-button matSuffix (click)="hideCurrent = !hideCurrent">
                  <mat-icon>{{ hideCurrent ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (passwordForm.get('currentPassword')?.hasError('required')) {
                  <mat-error>Current password is required</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>New Password</mat-label>
                <input matInput [type]="hideNew ? 'password' : 'text'" formControlName="newPassword">
                <button type="button" mat-icon-button matSuffix (click)="hideNew = !hideNew">
                  <mat-icon>{{ hideNew ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (passwordForm.get('newPassword')?.hasError('required')) {
                  <mat-error>New password is required</mat-error>
                }
                @if (passwordForm.get('newPassword')?.hasError('minlength')) {
                  <mat-error>Password must be at least 6 characters</mat-error>
                }
              </mat-form-field>

              <mat-form-field appearance="outline" class="full-width">
                <mat-label>Confirm New Password</mat-label>
                <input matInput [type]="hideConfirm ? 'password' : 'text'" formControlName="confirmPassword">
                <button type="button" mat-icon-button matSuffix (click)="hideConfirm = !hideConfirm">
                  <mat-icon>{{ hideConfirm ? 'visibility_off' : 'visibility' }}</mat-icon>
                </button>
                @if (passwordForm.get('confirmPassword')?.hasError('required')) {
                  <mat-error>Please confirm your new password</mat-error>
                }
              </mat-form-field>

              <div class="form-actions">
                <button mat-flat-button color="primary" type="submit" [disabled]="passwordForm.invalid || changingPassword()">
                  <mat-icon>lock_reset</mat-icon>
                  {{ changingPassword() ? 'Updating...' : 'Update Password' }}
                </button>
              </div>
            </form>
          </div>
        </mat-tab>
      </mat-tab-group>
    </mat-dialog-content>
  `,
  styles: [`
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px 0;
      h2 {
        display: flex;
        align-items: center;
        gap: 10px;
        margin: 0;
        font-size: 1.25rem;
        color: #1a237e;
      }
    }
    .profile-content {
      padding: 0 16px 16px;
      min-width: 320px;
      max-width: 540px;
    }
    .tab-body {
      padding: 16px 4px 8px;
    }
    .avatar-section {
      display: flex;
      align-items: center;
      gap: 18px;
    }
    .avatar-preview {
      width: 80px;
      height: 80px;
      border-radius: 50%;
      overflow: hidden;
      flex-shrink: 0;
      border: 3px solid #e2e8f0;
      background: #f1f5f9;
    }
    .profile-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .avatar-fallback {
      width: 100%;
      height: 100%;
      background: #1a237e;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 1.7rem;
    }
    .upload-meta {
      display: flex;
      flex-direction: column;
      gap: 4px;
      h3 {
        margin: 0;
        font-size: 1.15rem;
        color: #1e293b;
      }
    }
    .institute-label {
      font-size: 0.8rem;
      color: #64748b;
    }
    .upload-btn-row {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-top: 6px;
      flex-wrap: wrap;
    }
    .upload-hint {
      font-size: 0.72rem;
      color: #94a3b8;
    }
    .my-3 {
      margin: 16px 0;
    }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 14px;
    }
    .info-item {
      display: flex;
      flex-direction: column;
      gap: 2px;
      &.full-span {
        grid-column: span 2;
      }
    }
    .info-label {
      font-size: 0.75rem;
      color: #64748b;
      font-weight: 600;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .info-value {
      font-size: 0.92rem;
      color: #1e293b;
      font-weight: 500;
    }
    .password-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-top: 4px;
    }
    .form-desc {
      color: #64748b;
      font-size: 0.85rem;
      margin: 0 0 8px;
    }
    .full-width {
      width: 100%;
    }
    .form-actions {
      display: flex;
      justify-content: flex-end;
      margin-top: 8px;
    }
    @media (max-width: 600px) {
      .avatar-section {
        flex-direction: column;
        align-items: flex-start;
      }
      .info-grid {
        grid-template-columns: 1fr;
      }
      .info-item.full-span {
        grid-column: span 1;
      }
    }
  `]
})
export class ProfileDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private profileService = inject(ProfileService);
  private authService = inject(AuthService);
  private snackBar = inject(MatSnackBar);

  profile = signal<UserProfile | null>(null);
  uploading = signal<boolean>(false);
  changingPassword = signal<boolean>(false);

  hideCurrent = true;
  hideNew = true;
  hideConfirm = true;

  passwordForm = this.fb.group({
    currentPassword: ['', [Validators.required]],
    newPassword: ['', [Validators.required, Validators.minLength(6)]],
    confirmPassword: ['', [Validators.required]]
  });

  get userInitials(): string {
    const name = this.profile()?.fullName || this.authService.currentUser()?.fullName || 'User';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  ngOnInit(): void {
    this.loadProfile();
  }

  loadProfile(): void {
    this.profileService.getMyProfile().subscribe({
      next: p => this.profile.set(p),
      error: () => this.snackBar.open('Failed to load profile details', 'Close', { duration: 3000 })
    });
  }

  getPhotoUrl(photoPath: string | undefined): string | null {
    return this.profileService.getPhotoUrl(photoPath, this.profile()?.instituteId);
  }

  onImgError(event: Event): void {
    const target = event.target as HTMLImageElement;
    target.style.display = 'none';
  }

  onFileSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    const file = input.files[0];
    if (file.size > 2 * 1024 * 1024) {
      this.snackBar.open('File size exceeds the 2MB limit.', 'Close', { duration: 4000 });
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowedTypes.includes(file.type)) {
      this.snackBar.open('Only JPG, PNG, and WebP images are permitted.', 'Close', { duration: 4000 });
      return;
    }

    this.uploading.set(true);
    this.profileService.uploadPhoto(file).subscribe({
      next: res => {
        this.uploading.set(false);
        this.snackBar.open('Profile photo updated successfully', 'Close', { duration: 3000 });
        this.loadProfile();
      },
      error: err => {
        this.uploading.set(false);
        this.snackBar.open(err.error?.message || 'Failed to upload photo', 'Close', { duration: 4000 });
      }
    });
  }

  changePassword(): void {
    if (this.passwordForm.invalid) return;

    const val = this.passwordForm.value;
    if (val.newPassword !== val.confirmPassword) {
      this.snackBar.open('New password and confirmation do not match.', 'Close', { duration: 4000 });
      return;
    }

    this.changingPassword.set(true);
    this.profileService.changePassword({
      currentPassword: val.currentPassword!,
      newPassword: val.newPassword!,
      confirmPassword: val.confirmPassword!
    }).subscribe({
      next: res => {
        this.changingPassword.set(false);
        this.snackBar.open(res.message || 'Password changed successfully', 'Close', { duration: 4000 });
        this.passwordForm.reset();
      },
      error: err => {
        this.changingPassword.set(false);
        this.snackBar.open(err.error?.message || 'Failed to update password', 'Close', { duration: 4000 });
      }
    });
  }
}
