import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Staff } from '../../core/models/academic.models';

@Component({
  selector: 'app-staff-dialog',
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
      <mat-icon>{{ isEdit ? 'edit' : 'person_add' }}</mat-icon>
      <span>{{ isEdit ? 'Edit Staff Member' : 'Register New Staff Member' }}</span>
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Employee ID</mat-label>
            <input matInput formControlName="employeeId" placeholder="EMP-001">
            @if (form.get('employeeId')?.hasError('required')) {
              <mat-error>Employee ID is required</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-2">
            <mat-label>Full Name</mat-label>
            <input matInput formControlName="fullName" placeholder="Prof. Jane Doe">
            @if (form.get('fullName')?.hasError('required')) {
              <mat-error>Name is required</mat-error>
            }
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Email Address</mat-label>
            <input matInput type="email" formControlName="email" placeholder="jane@college.edu">
            @if (form.get('email')?.hasError('required')) {
              <mat-error>Email is required</mat-error>
            }
            @if (form.get('email')?.hasError('email')) {
              <mat-error>Invalid email format</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Phone Number</mat-label>
            <input matInput formControlName="phone" placeholder="+1 234-567-8901">
            @if (form.get('phone')?.hasError('required')) {
              <mat-error>Phone is required</mat-error>
            }
          </mat-form-field>
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Subject Specialization / Department</mat-label>
          <input matInput formControlName="subjectSpecialization" placeholder="e.g. Mathematics, Computer Science">
        </mat-form-field>

        @if (!isEdit) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Initial Login Password</mat-label>
            <input matInput formControlName="initialPassword" placeholder="Default: Staff@123456">
            <mat-hint>Auto-creates a Staff login account with this password</mat-hint>
            @if (form.get('initialPassword')?.hasError('required')) {
              <mat-error>Initial password is required</mat-error>
            }
          </mat-form-field>
        }
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="save()">
        {{ isEdit ? 'Save Changes' : 'Create Staff & Login' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 500px;
      padding-top: 10px;
    }
    .form-row {
      display: flex;
      gap: 16px;
    }
    .flex-1 { flex: 1; }
    .flex-2 { flex: 2; }
    .full-width { width: 100%; }
    h2 {
      display: flex;
      align-items: center;
      gap: 10px;
      color: #1a237e;
    }
  `]
})
export class StaffDialogComponent {
  private fb = inject(FormBuilder);
  dialogRef = inject(MatDialogRef<StaffDialogComponent>);
  data: Staff | undefined = inject(MAT_DIALOG_DATA);

  isEdit = !!this.data;

  form = this.fb.group({
    employeeId: [{ value: this.data?.employeeId || '', disabled: this.isEdit }, Validators.required],
    fullName: [this.data?.fullName || '', Validators.required],
    email: [this.data?.email || '', [Validators.required, Validators.email]],
    phone: [this.data?.phone || '', Validators.required],
    subjectSpecialization: [this.data?.subjectSpecialization || ''],
    initialPassword: [this.isEdit ? '' : 'Staff@123456', this.isEdit ? [] : [Validators.required, Validators.minLength(6)]]
  });

  save(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.getRawValue());
  }
}
