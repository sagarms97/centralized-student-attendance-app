import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormGroup, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { LeaveService } from '../../core/services/leave.service';
import { ParentChildOverview } from '../../core/models/leave.models';

export interface SubmitLeaveDialogData {
  children: ParentChildOverview[];
  selectedStudentId?: number;
}

@Component({
  selector: 'app-submit-leave-dialog',
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
    MatSnackBarModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div class="header-icon">
          <mat-icon>event_note</mat-icon>
        </div>
        <div>
          <h2 mat-dialog-title class="m-0">Submit Leave Request</h2>
          <p class="subtitle m-0">Request excused absence for your child</p>
        </div>
      </div>

      <form [formGroup]="form" (ngSubmit)="onSubmit()">
        <mat-dialog-content class="dialog-content">
          <div class="form-grid">
            <!-- Student Selector -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Select Child / Student</mat-label>
              <mat-select formControlName="studentId" required>
                @for (child of data.children; track child.studentId) {
                  <mat-option [value]="child.studentId">
                    {{ child.fullName }} (Roll: {{ child.rollNo }} - {{ child.className }} {{ child.section }})
                  </mat-option>
                }
              </mat-select>
              <mat-error *ngIf="form.get('studentId')?.hasError('required')">
                Please select a child.
              </mat-error>
            </mat-form-field>

            <!-- Date Range: Start Date & End Date -->
            <div class="date-row">
              <mat-form-field appearance="outline" class="half-width">
                <mat-label>Start Date</mat-label>
                <input matInput type="date" formControlName="startDate" required />
                <mat-icon matSuffix>calendar_today</mat-icon>
                <mat-error *ngIf="form.get('startDate')?.hasError('required')">
                  Start date is required.
                </mat-error>
              </mat-form-field>

              <mat-form-field appearance="outline" class="half-width">
                <mat-label>End Date</mat-label>
                <input matInput type="date" formControlName="endDate" required />
                <mat-icon matSuffix>event</mat-icon>
                <mat-error *ngIf="form.get('endDate')?.hasError('required')">
                  End date is required.
                </mat-error>
              </mat-form-field>
            </div>

            <!-- Reason -->
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Reason for Leave</mat-label>
              <textarea
                matInput
                rows="3"
                formControlName="reason"
                placeholder="e.g. Medical illness, family emergency, travel..."
                required></textarea>
              <mat-hint>Provide a clear reason for the class teacher or admin to review.</mat-hint>
              <mat-error *ngIf="form.get('reason')?.hasError('required')">
                Reason is required.
              </mat-error>
              <mat-error *ngIf="form.get('reason')?.hasError('minlength')">
                Reason must be at least 3 characters.
              </mat-error>
            </mat-form-field>
          </div>
        </mat-dialog-content>

        <mat-dialog-actions align="end" class="dialog-actions">
          <button mat-button type="button" (click)="dialogRef.close(false)" [disabled]="submitting()">
            Cancel
          </button>
          <button
            mat-flat-button
            color="primary"
            type="submit"
            [disabled]="form.invalid || submitting()">
            @if (submitting()) {
              <mat-spinner diameter="18" class="inline-spinner"></mat-spinner>
              <span>Submitting...</span>
            } @else {
              <ng-container>
                <mat-icon>send</mat-icon>
                <span>Submit Request</span>
              </ng-container>
            }
          </button>
        </mat-dialog-actions>
      </form>
    </div>
  `,
  styles: [`
    .dialog-container {
      min-width: 320px;
      max-width: 520px;
      padding: 8px;
    }
    .dialog-header {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 16px 8px;
    }
    .header-icon {
      width: 44px;
      height: 44px;
      border-radius: 12px;
      background: #ede7f6;
      color: #673ab7;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .subtitle {
      font-size: 13px;
      color: #666;
    }
    .dialog-content {
      padding-top: 12px !important;
    }
    .form-grid {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .date-row {
      display: flex;
      gap: 12px;
    }
    .half-width {
      flex: 1;
    }
    .full-width {
      width: 100%;
    }
    .dialog-actions {
      padding: 12px 16px 16px;
      gap: 8px;
    }
    .inline-spinner {
      display: inline-block;
      margin-right: 8px;
    }
    @media (max-width: 600px) {
      .date-row {
        flex-direction: column;
        gap: 0;
      }
    }
  `]
})
export class SubmitLeaveDialogComponent implements OnInit {
  dialogRef = inject(MatDialogRef<SubmitLeaveDialogComponent>);
  data: SubmitLeaveDialogData = inject(MAT_DIALOG_DATA);
  private fb = inject(FormBuilder);
  private leaveService = inject(LeaveService);
  private snackBar = inject(MatSnackBar);

  submitting = signal(false);
  form!: FormGroup;

  ngOnInit(): void {
    const today = new Date().toISOString().substring(0, 10);
    const initialStudentId = this.data.selectedStudentId || (this.data.children.length > 0 ? this.data.children[0].studentId : null);

    this.form = this.fb.group({
      studentId: [initialStudentId, [Validators.required]],
      startDate: [today, [Validators.required]],
      endDate: [today, [Validators.required]],
      reason: ['', [Validators.required, Validators.minLength(3), Validators.maxLength(500)]]
    });
  }

  onSubmit(): void {
    if (this.form.invalid) return;

    const val = this.form.value;
    if (val.endDate < val.startDate) {
      this.snackBar.open('End date cannot be earlier than start date.', 'Close', { duration: 3500 });
      return;
    }

    this.submitting.set(true);

    this.leaveService.createLeave({
      studentId: val.studentId,
      startDate: val.startDate,
      endDate: val.endDate,
      reason: val.reason
    }).subscribe({
      next: (created) => {
        this.submitting.set(false);
        this.snackBar.open('Leave request submitted successfully!', 'Close', { duration: 3000 });
        this.dialogRef.close(created);
      },
      error: (err) => {
        this.submitting.set(false);
        const msg = err.error?.message || 'Failed to submit leave request.';
        this.snackBar.open(msg, 'Close', { duration: 4000 });
      }
    });
  }
}
