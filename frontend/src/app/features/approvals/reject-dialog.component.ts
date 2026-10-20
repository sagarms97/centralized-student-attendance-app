import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { PendingApprovalUser } from '../../core/models/invite.models';

@Component({
  selector: 'app-reject-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon color="warn">person_off</mat-icon>
      <span>Reject Registration for {{ data.user.fullName }}</span>
    </h2>

    <mat-dialog-content>
      <p class="dialog-hint">
        Please specify a reason for rejecting this registration request. An email containing this reason will be dispatched to <strong>{{ data.user.email }}</strong>.
      </p>

      <form [formGroup]="form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Rejection Reason</mat-label>
          <textarea matInput formControlName="reason" rows="3" placeholder="e.g. Employee ID not found in human resources records."></textarea>
          @if (form.get('reason')?.hasError('required')) {
            <mat-error>Rejection reason is required</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="warn" [disabled]="form.invalid" (click)="confirm()">
        <mat-icon>cancel</mat-icon> Confirm Rejection
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.2rem;
      color: #c62828;
    }
    .dialog-hint {
      color: #64748b;
      font-size: 0.88rem;
      margin-bottom: 12px;
    }
    .full-width {
      width: 100%;
      min-width: 320px;
      max-width: 480px;
    }
  `]
})
export class RejectDialogComponent {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<RejectDialogComponent>);
  data: { user: PendingApprovalUser } = inject(MAT_DIALOG_DATA);

  form = this.fb.group({
    reason: ['', [Validators.required, Validators.minLength(3)]]
  });

  confirm(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value.reason);
  }
}
