import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatSliderModule } from '@angular/material/slider';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FaceAttendanceService, FaceSettings } from '../../core/services/face-attendance.service';

@Component({
  selector: 'app-face-settings',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatCardModule,
    MatSlideToggleModule,
    MatSliderModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="face-settings-container">
      <div class="page-header">
        <div>
          <h2>Face Attendance Settings & Privacy Policy</h2>
          <p class="subtitle">Configure AI facial verification thresholds, automated retention limits, and institution consent policies.</p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button color="primary" (click)="triggerCleanup()" [disabled]="loading || isSaving">
            <mat-icon>cleaning_services</mat-icon>
            Clean Expired Data
          </button>
        </div>
      </div>

      <div *ngIf="loading" class="loading-state">
        <mat-spinner diameter="44"></mat-spinner>
        <span>Loading face attendance configuration...</span>
      </div>

      <form [formGroup]="form" (ngSubmit)="saveSettings()" *ngIf="!loading">
        <!-- Master Enable Toggle -->
        <mat-card class="settings-card highlight-card">
          <mat-card-header>
            <mat-icon mat-card-avatar color="primary">face_retouching_natural</mat-icon>
            <mat-card-title>Face Attendance Module Status</mat-card-title>
            <mat-card-subtitle>Module is optional and disabled by default for your institute.</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content class="toggle-row">
            <div class="toggle-info">
              <h3>Enable Facial Attendance for Institute</h3>
              <p>When enabled, verified teachers can conduct rapid classroom attendance via device camera and facial embeddings matching enrolled students.</p>
            </div>
            <mat-slide-toggle formControlName="isEnabled" color="primary">
              {{ form.get('isEnabled')?.value ? 'ENABLED' : 'DISABLED' }}
            </mat-slide-toggle>
          </mat-card-content>
        </mat-card>

        <!-- Recognition & Confidence Thresholds -->
        <mat-card class="settings-card">
          <mat-card-header>
            <mat-icon mat-card-avatar color="accent">tune</mat-icon>
            <mat-card-title>Recognition Matching Thresholds</mat-card-title>
            <mat-card-subtitle>Cosine similarity thresholds used by the ArcFace ONNX inference engine.</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="slider-field">
              <div class="slider-header">
                <div>
                  <strong>Match Confidence Threshold (Green)</strong>
                  <div class="field-hint">Faces with similarity above this value are marked as confident matches. Recommended: 0.65</div>
                </div>
                <span class="value-badge">{{ form.get('matchThreshold')?.value | percent:'1.0-0' }} ({{ form.get('matchThreshold')?.value }})</span>
              </div>
              <mat-slider min="0.4" max="0.95" step="0.05" showTickMarks discrete class="full-width">
                <input matSliderThumb formControlName="matchThreshold">
              </mat-slider>
            </div>

            <div class="slider-field">
              <div class="slider-header">
                <div>
                  <strong>Low Confidence Threshold (Amber)</strong>
                  <div class="field-hint">Faces below Match Threshold but above this value are flagged for manual teacher confirmation. Recommended: 0.45</div>
                </div>
                <span class="value-badge">{{ form.get('lowConfidenceThreshold')?.value | percent:'1.0-0' }} ({{ form.get('lowConfidenceThreshold')?.value }})</span>
              </div>
              <mat-slider min="0.2" max="0.7" step="0.05" showTickMarks discrete class="full-width">
                <input matSliderThumb formControlName="lowConfidenceThreshold">
              </mat-slider>
            </div>

            <div *ngIf="form.hasError('thresholdError')" class="error-banner">
              <mat-icon>warning</mat-icon>
              <span>Low confidence threshold must be strictly less than match threshold.</span>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Data Retention & Privacy Notice -->
        <mat-card class="settings-card">
          <mat-card-header>
            <mat-icon mat-card-avatar color="primary">security</mat-icon>
            <mat-card-title>Data Retention & Consent Notice</mat-card-title>
            <mat-card-subtitle>GDPR / FERPA compliance settings and parental notice disclosure.</mat-card-subtitle>
          </mat-card-header>
          <mat-card-content>
            <div class="form-row">
              <mat-form-field appearance="outline" class="retention-field">
                <mat-label>Data Retention Period (Days)</mat-label>
                <input matInput type="number" formControlName="dataRetentionDays" min="30" max="1825">
                <mat-icon matSuffix>calendar_month</mat-icon>
                <mat-hint>Embeddings older than this window or belonging to deactivated students will be purged.</mat-hint>
              </mat-form-field>
            </div>

            <mat-form-field appearance="outline" class="full-width notice-textarea">
              <mat-label>Parent & Student Consent Notice Text</mat-label>
              <textarea matInput formControlName="consentNoticeText" rows="6" placeholder="Enter privacy notice displayed to parents and staff..."></textarea>
              <mat-hint>This disclosure is presented to guardians and staff before recording facial consent.</mat-hint>
            </mat-form-field>
          </mat-card-content>
        </mat-card>

        <div class="action-footer">
          <button mat-flat-button color="primary" type="submit" [disabled]="form.invalid || isSaving">
            <mat-icon *ngIf="!isSaving">save</mat-icon>
            <mat-spinner diameter="18" *ngIf="isSaving"></mat-spinner>
            <span>Save Settings</span>
          </button>
        </div>
      </form>

      <!-- Danger Zone -->
      <mat-card class="settings-card danger-card">
        <mat-card-header>
          <mat-icon mat-card-avatar color="warn">warning</mat-icon>
          <mat-card-title>Danger Zone</mat-card-title>
          <mat-card-subtitle>Irreversible institution-wide biometric data deletion.</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content class="danger-row">
          <div>
            <h4>Purge All Facial Biometric Embeddings</h4>
            <p>Permanently deletes all stored facial embeddings for all enrolled students in your institute. Raw photos are never stored. This action cannot be undone.</p>
          </div>
          <button mat-flat-button color="warn" (click)="confirmPurgeInstituteData()" [disabled]="isPurging">
            <mat-icon>delete_forever</mat-icon>
            <span>Purge All Face Data</span>
          </button>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .face-settings-container {
      max-width: 960px;
      margin: 0 auto;
      padding: 24px 16px;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .page-header h2 {
      margin: 0 0 4px 0;
      font-size: 1.5rem;
      font-weight: 700;
    }
    .subtitle {
      margin: 0;
      color: #64748b;
      font-size: 0.95rem;
    }
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 60px 0;
      color: #64748b;
    }
    .settings-card {
      border-radius: 12px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
      margin-bottom: 20px;
    }
    .highlight-card {
      border-left: 5px solid #2563eb;
    }
    .toggle-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 0;
      flex-wrap: wrap;
      gap: 16px;
    }
    .toggle-info h3 {
      margin: 0 0 4px 0;
      font-size: 1.05rem;
      font-weight: 600;
    }
    .toggle-info p {
      margin: 0;
      color: #64748b;
      font-size: 0.88rem;
      max-width: 650px;
    }
    .slider-field {
      padding: 12px 0 18px 0;
    }
    .slider-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 4px;
    }
    .field-hint {
      font-size: 0.82rem;
      color: #64748b;
      margin-top: 2px;
    }
    .value-badge {
      background: #eff6ff;
      color: #1d4ed8;
      font-weight: 700;
      font-size: 0.88rem;
      padding: 4px 10px;
      border-radius: 16px;
      border: 1px solid #bfdbfe;
    }
    .full-width {
      width: 100%;
    }
    .retention-field {
      width: 320px;
    }
    .notice-textarea {
      margin-top: 12px;
    }
    .error-banner {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #fef2f2;
      color: #dc2626;
      padding: 10px 14px;
      border-radius: 8px;
      font-size: 0.88rem;
      margin-top: 8px;
    }
    .action-footer {
      display: flex;
      justify-content: flex-end;
      margin-bottom: 24px;
    }
    .action-footer button {
      min-width: 160px;
      height: 44px;
      font-size: 0.95rem;
      font-weight: 600;
    }
    .danger-card {
      border: 1px solid #fecaca;
      background: #fff5f5;
    }
    .danger-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      padding: 8px 0;
    }
    .danger-row h4 {
      margin: 0 0 4px 0;
      color: #991b1b;
      font-weight: 600;
    }
    .danger-row p {
      margin: 0;
      color: #7f1d1d;
      font-size: 0.88rem;
      max-width: 600px;
    }
  `]
})
export class FaceSettingsComponent implements OnInit {
  private fb = inject(FormBuilder);
  private faceService = inject(FaceAttendanceService);
  private snackBar = inject(MatSnackBar);

  loading = true;
  isSaving = false;
  isPurging = false;

  form: FormGroup = this.fb.group({
    isEnabled: [false],
    matchThreshold: [0.65, [Validators.required, Validators.min(0.1), Validators.max(1.0)]],
    lowConfidenceThreshold: [0.45, [Validators.required, Validators.min(0.1), Validators.max(1.0)]],
    dataRetentionDays: [365, [Validators.required, Validators.min(1), Validators.max(1825)]],
    consentNoticeText: ['', [Validators.required, Validators.minLength(10)]]
  }, {
    validators: (group: FormGroup) => {
      const match = group.get('matchThreshold')?.value;
      const low = group.get('lowConfidenceThreshold')?.value;
      return (low >= match) ? { thresholdError: true } : null;
    }
  });

  ngOnInit(): void {
    this.loadSettings();
  }

  loadSettings(): void {
    this.loading = true;
    this.faceService.getSettings().subscribe({
      next: (settings) => {
        this.form.patchValue({
          isEnabled: settings.isEnabled,
          matchThreshold: settings.matchThreshold,
          lowConfidenceThreshold: settings.lowConfidenceThreshold,
          dataRetentionDays: settings.dataRetentionDays,
          consentNoticeText: settings.consentNoticeText
        });
        this.loading = false;
      },
      error: (err) => {
        this.loading = false;
        this.snackBar.open(err.error?.message || 'Failed to load face attendance settings', 'Close', { duration: 4000 });
      }
    });
  }

  saveSettings(): void {
    if (this.form.invalid) return;

    this.isSaving = true;
    this.faceService.updateSettings(this.form.value).subscribe({
      next: (updated) => {
        this.isSaving = false;
        this.snackBar.open('Face attendance settings updated successfully!', 'OK', { duration: 3000 });
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err.error?.message || 'Error updating settings', 'Close', { duration: 4000 });
      }
    });
  }

  triggerCleanup(): void {
    if (!confirm('Run automated retention cleanup? This will remove embeddings older than retention days or belonging to inactive students.')) {
      return;
    }

    this.faceService.cleanupExpired().subscribe({
      next: (res) => {
        this.snackBar.open(res.message, 'OK', { duration: 4000 });
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Failed to clean up expired data', 'Close', { duration: 4000 });
      }
    });
  }

  confirmPurgeInstituteData(): void {
    const confirmation = prompt('WARNING: You are about to permanently purge ALL face attendance embeddings for the entire institute. Type "PURGE" to confirm:');
    if (confirmation !== 'PURGE') {
      return;
    }

    this.isPurging = true;
    this.faceService.purgeInstituteFaceData().subscribe({
      next: (res) => {
        this.isPurging = false;
        this.snackBar.open(res.message, 'OK', { duration: 5000 });
      },
      error: (err) => {
        this.isPurging = false;
        this.snackBar.open(err.error?.message || 'Failed to purge face data', 'Close', { duration: 4000 });
      }
    });
  }
}
