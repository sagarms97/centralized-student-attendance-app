import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { ParentItem } from '../../core/models/parent.models';
import { StudentService } from '../../core/services/student.service';
import { Student } from '../../core/models/academic.models';

@Component({
  selector: 'app-parent-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatCheckboxModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ isEdit ? 'edit' : 'person_add' }}</mat-icon>
      <span>{{ isEdit ? 'Edit Parent Profile' : 'Register New Parent' }}</span>
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Full Name</mat-label>
            <input matInput formControlName="fullName" placeholder="Parent / Guardian Name">
            @if (form.get('fullName')?.hasError('required')) {
              <mat-error>Name is required</mat-error>
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

        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Email Address</mat-label>
            <input matInput type="email" formControlName="email" placeholder="parent@example.com">
            @if (form.get('email')?.hasError('required')) {
              <mat-error>Email is required</mat-error>
            }
            @if (form.get('email')?.hasError('email')) {
              <mat-error>Valid email is required</mat-error>
            }
          </mat-form-field>

          @if (!isEdit) {
            <mat-form-field appearance="outline" class="flex-1">
              <mat-label>Initial Login Password</mat-label>
              <input matInput formControlName="initialPassword" placeholder="Default: Parent@123456">
              <mat-hint>Auto-creates a Parent login account</mat-hint>
            </mat-form-field>
          }
        </div>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Home Address</mat-label>
          <textarea matInput formControlName="address" rows="2" placeholder="Residential address"></textarea>
        </mat-form-field>

        @if (!isEdit) {
          <div class="student-linking-section">
            <div class="section-title">
              <mat-icon>family_restroom</mat-icon>
              <span>Link Student / Ward (Optional)</span>
            </div>

            <div class="form-row">
              <mat-form-field appearance="outline" class="flex-2">
                <mat-label>Select Student</mat-label>
                <mat-select formControlName="selectedStudentId">
                  <mat-option [value]="null">-- None (Link later) --</mat-option>
                  @for (s of availableStudents; track s.id) {
                    <mat-option [value]="s.id">
                      {{ s.fullName }} (Roll: {{ s.rollNo }} - {{ s.className }} {{ s.section }})
                    </mat-option>
                  }
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="flex-1">
                <mat-label>Relationship</mat-label>
                <mat-select formControlName="relationship">
                  <mat-option value="Father">Father</mat-option>
                  <mat-option value="Mother">Mother</mat-option>
                  <mat-option value="Guardian">Guardian</mat-option>
                  <mat-option value="Other">Other</mat-option>
                </mat-select>
              </mat-form-field>
            </div>
          </div>
        }

        @if (isEdit) {
          <div class="checkbox-row">
            <mat-checkbox formControlName="isActive">Active Parent Account</mat-checkbox>
          </div>
        }
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="save()">
        <mat-icon>check</mat-icon> {{ isEdit ? 'Save Changes' : 'Create Parent' }}
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-bottom: 16px;
      font-size: 1.25rem;
      color: #1a237e;
      mat-icon { color: #1a237e; }
    }
    .dialog-form {
      display: flex;
      flex-direction: column;
      gap: 8px;
      min-width: 320px;
      max-width: 580px;
      padding-top: 8px;
    }
    .form-row {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
    }
    .flex-1 { flex: 1 1 200px; }
    .flex-2 { flex: 2 1 250px; }
    .full-width { width: 100%; }
    .student-linking-section {
      background: #f8fafc;
      border: 1px dashed #cbd5e1;
      border-radius: 8px;
      padding: 12px 14px 4px;
      margin-top: 4px;
      margin-bottom: 8px;
    }
    .section-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;
      font-weight: 600;
      color: #475569;
      margin-bottom: 10px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #64748b; }
    }
    .checkbox-row {
      padding: 8px 0;
    }
    @media (max-width: 600px) {
      .form-row {
        flex-direction: column;
        gap: 0;
      }
      .flex-1, .flex-2 {
        width: 100%;
        flex: 1 1 auto;
      }
    }
  `]
})
export class ParentDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<ParentDialogComponent>);
  private studentService = inject(StudentService);
  data: ParentItem | null = inject(MAT_DIALOG_DATA, { optional: true });

  isEdit = !!this.data;
  availableStudents: Student[] = [];

  form = this.fb.group({
    fullName: [this.data?.fullName || '', [Validators.required]],
    email: [this.data?.email || '', [Validators.required, Validators.email]],
    phone: [this.data?.phone || '', [Validators.required]],
    address: [this.data?.address || ''],
    initialPassword: ['Parent@123456'],
    selectedStudentId: [null as number | null],
    relationship: ['Father'],
    isActive: [this.data?.isActive ?? true]
  });

  ngOnInit(): void {
    if (!this.isEdit) {
      this.studentService.getAll({ pageSize: 150 }).subscribe({
        next: res => {
          this.availableStudents = res.items || [];
        },
        error: () => {
          this.availableStudents = [];
        }
      });
    }
  }

  save(): void {
    if (this.form.invalid) return;
    const val = this.form.value;

    if (this.isEdit) {
      this.dialogRef.close({
        fullName: val.fullName!,
        email: val.email!,
        phone: val.phone!,
        address: val.address || undefined,
        isActive: val.isActive ?? true
      });
    } else {
      const linkedStudents: { studentId: number; relationship: string }[] = [];
      if (val.selectedStudentId) {
        linkedStudents.push({
          studentId: val.selectedStudentId,
          relationship: val.relationship || 'Parent'
        });
      }

      this.dialogRef.close({
        fullName: val.fullName!,
        email: val.email!,
        phone: val.phone!,
        address: val.address || undefined,
        initialPassword: val.initialPassword || 'Parent@123456',
        linkedStudents: linkedStudents.length ? linkedStudents : undefined
      });
    }
  }
}
