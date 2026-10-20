import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { InviteService } from '../../core/services/invite.service';
import { SendInviteResponse } from '../../core/models/invite.models';

@Component({
  selector: 'app-invite-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule,
    MatSnackBarModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon color="primary">forward_to_inbox</mat-icon>
      <span>{{ generatedResponse ? 'Invitation Dispatched' : 'Send Registration Invite' }}</span>
    </h2>

    <mat-dialog-content>
      @if (generatedResponse) {
        <div class="success-box">
          <div class="success-banner">
            <mat-icon>check_circle</mat-icon>
            <div>
              <strong>Invitation Sent Successfully!</strong>
              <p>An email with registration instructions has been sent to <strong>{{ generatedResponse.email }}</strong>.</p>
            </div>
          </div>

          <div class="link-share-box">
            <label class="share-label">Sharable Registration Link (WhatsApp / SMS):</label>
            <div class="link-field-row">
              <input type="text" readonly [value]="generatedResponse.inviteLink" class="readonly-link-input" #linkInput>
              <button mat-flat-button color="primary" (click)="copyLink(generatedResponse.inviteLink)">
                <mat-icon>content_copy</mat-icon> Copy Link
              </button>
            </div>
            <small class="expiry-hint">This link is single-use and will expire in 7 days.</small>
          </div>
        </div>
      } @else {
        <p class="dialog-desc">
          Invite a staff member or parent to self-register. They will receive a unique link to set their password and verify their contact via OTP.
        </p>

        <form [formGroup]="form" class="invite-form">
          <div class="form-row">
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Role</mat-label>
              <mat-select formControlName="role">
                <mat-option value="Staff">Staff Member</mat-option>
                <mat-option value="Parent">Parent / Guardian</mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline" class="flex-2">
              <mat-label>Full Name</mat-label>
              <input matInput formControlName="fullName" placeholder="e.g. John Doe">
              @if (form.get('fullName')?.hasError('required')) {
                <mat-error>Name is required</mat-error>
              }
            </mat-form-field>
          </div>

          <div class="form-row">
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Email Address</mat-label>
              <input matInput type="email" formControlName="email" placeholder="user@example.com">
              @if (form.get('email')?.hasError('required')) {
                <mat-error>Email is required</mat-error>
              }
              @if (form.get('email')?.hasError('email')) {
                <mat-error>Valid email is required</mat-error>
              }
            </mat-form-field>

            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Phone Number</mat-label>
              <input matInput formControlName="phone" placeholder="+1 234-567-8900">
              @if (form.get('phone')?.hasError('required')) {
                <mat-error>Phone is required</mat-error>
              }
            </mat-form-field>
          </div>

          @if (form.get('role')?.value === 'Staff') {
            <div class="form-row">
              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>Employee ID (Optional)</mat-label>
                <input matInput formControlName="employeeId" placeholder="EMP-101">
              </mat-form-field>

              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>Subject / Specialization (Optional)</mat-label>
                <input matInput formControlName="subjectSpecialization" placeholder="e.g. Science">
              </mat-form-field>
            </div>
          }
        </form>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      @if (generatedResponse) {
        <button mat-flat-button color="primary" mat-dialog-close>Done</button>
      } @else {
        <button mat-button mat-dialog-close>Cancel</button>
        <button mat-flat-button color="primary" [disabled]="form.invalid || sending" (click)="sendInvite()">
          <mat-icon>{{ sending ? 'hourglass_top' : 'send' }}</mat-icon>
          {{ sending ? 'Sending...' : 'Send Invite' }}
        </button>
      }
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.25rem;
      color: #1a237e;
      mat-icon { color: #1a237e; }
    }
    .dialog-desc {
      color: #64748b;
      font-size: 0.85rem;
      margin: 0 0 16px;
    }
    .invite-form {
      display: flex;
      flex-direction: column;
      gap: 10px;
      min-width: 320px;
      max-width: 520px;
      padding-top: 4px;
    }
    .form-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .flex-1 { flex: 1 1 180px; }
    .flex-2 { flex: 2 1 240px; }
    .success-box {
      min-width: 320px;
      max-width: 520px;
      padding-top: 8px;
    }
    .success-banner {
      display: flex;
      align-items: flex-start;
      gap: 12px;
      background: #e8f5e9;
      color: #2e7d32;
      border: 1px solid #a5d6a7;
      padding: 14px;
      border-radius: 8px;
      margin-bottom: 20px;
      mat-icon { font-size: 26px; width: 26px; height: 26px; color: #2e7d32; flex-shrink: 0; }
      p { margin: 4px 0 0; font-size: 0.88rem; }
    }
    .link-share-box {
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      padding: 16px;
    }
    .share-label {
      font-size: 0.82rem;
      font-weight: 600;
      color: #475569;
      display: block;
      margin-bottom: 8px;
    }
    .link-field-row {
      display: flex;
      gap: 10px;
      align-items: center;
    }
    .readonly-link-input {
      flex: 1;
      height: 40px;
      padding: 8px 12px;
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      background: #ffffff;
      font-size: 0.82rem;
      color: #1e293b;
      outline: none;
    }
    .expiry-hint {
      display: block;
      margin-top: 8px;
      font-size: 0.75rem;
      color: #94a3b8;
    }
    @media (max-width: 600px) {
      .form-row {
        flex-direction: column;
        gap: 0;
      }
      .link-field-row {
        flex-direction: column;
        align-items: stretch;
      }
    }
  `]
})
export class InviteDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<InviteDialogComponent>);
  private inviteService = inject(InviteService);
  private snackBar = inject(MatSnackBar);
  data: { role?: 'Staff' | 'Parent' } = inject(MAT_DIALOG_DATA, { optional: true }) || {};

  sending = false;
  generatedResponse: SendInviteResponse | null = null;

  form = this.fb.group({
    role: [this.data.role || 'Staff', [Validators.required]],
    fullName: ['', [Validators.required]],
    email: ['', [Validators.required, Validators.email]],
    phone: ['', [Validators.required]],
    employeeId: [''],
    subjectSpecialization: ['']
  });

  ngOnInit(): void {}

  sendInvite(): void {
    if (this.form.invalid) return;
    this.sending = true;
    const val = this.form.value;

    this.inviteService.sendInvite({
      role: val.role as 'Staff' | 'Parent',
      fullName: val.fullName!,
      email: val.email!,
      phone: val.phone!,
      employeeId: val.employeeId || undefined,
      subjectSpecialization: val.subjectSpecialization || undefined
    }).subscribe({
      next: res => {
        this.sending = false;
        this.generatedResponse = res;
      },
      error: err => {
        this.sending = false;
        this.snackBar.open(err.error?.message || 'Failed to send invite', 'Close', { duration: 4000 });
      }
    });
  }

  copyLink(link: string): void {
    navigator.clipboard.writeText(link).then(() => {
      this.snackBar.open('Invite link copied to clipboard!', 'Close', { duration: 3000 });
    });
  }
}
