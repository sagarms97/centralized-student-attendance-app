import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { Student, ClassItem } from '../../core/models/academic.models';
import { AcademicService } from '../../core/services/academic.service';

@Component({
  selector: 'app-student-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ isEdit ? 'edit' : 'person_add' }}</mat-icon>
      <span>{{ isEdit ? 'Edit Student Details' : 'Enroll New Student' }}</span>
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Roll Number / Student ID</mat-label>
          <input matInput formControlName="rollNo" placeholder="e.g. 2026-CS-001">
          @if (form.get('rollNo')?.hasError('required')) {
            <mat-error>Roll number is required</mat-error>
          }
        </mat-form-field>

        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>First Name</mat-label>
            <input matInput formControlName="firstName" placeholder="John">
            @if (form.get('firstName')?.hasError('required')) {
              <mat-error>First name is required</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Last Name</mat-label>
            <input matInput formControlName="lastName" placeholder="Smith">
            @if (form.get('lastName')?.hasError('required')) {
              <mat-error>Last name is required</mat-error>
            }
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-2">
            <mat-label>Class / Grade</mat-label>
            <mat-select formControlName="classId" (selectionChange)="onClassChange($event.value)">
              @for (c of classes(); track c.id) {
                <mat-option [value]="c.id">{{ c.name }}</mat-option>
              }
            </mat-select>
            @if (form.get('classId')?.hasError('required')) {
              <mat-error>Class is required</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Section</mat-label>
            <mat-select formControlName="section">
              @for (s of availableSections(); track s) {
                <mat-option [value]="s">{{ s }}</mat-option>
              }
            </mat-select>
            @if (form.get('section')?.hasError('required')) {
              <mat-error>Section is required</mat-error>
            }
          </mat-form-field>
        </div>

        <div class="form-row">
          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Parent / Guardian Phone</mat-label>
            <input matInput formControlName="parentPhone" placeholder="+1 234-567-8901">
            @if (form.get('parentPhone')?.hasError('required')) {
              <mat-error>Phone is required</mat-error>
            }
          </mat-form-field>

          <mat-form-field appearance="outline" class="flex-1">
            <mat-label>Student Email (Optional)</mat-label>
            <input matInput type="email" formControlName="email" placeholder="john@example.com">
          </mat-form-field>
        </div>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="save()">
        {{ isEdit ? 'Save Changes' : 'Enroll Student' }}
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
    .form-row { display: flex; gap: 16px; }
    .flex-1 { flex: 1; }
    .flex-2 { flex: 2; }
    .full-width { width: 100%; }
    h2 { display: flex; align-items: center; gap: 10px; color: #1a237e; }
  `]
})
export class StudentDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private academicService = inject(AcademicService);
  dialogRef = inject(MatDialogRef<StudentDialogComponent>);
  data: Student | undefined = inject(MAT_DIALOG_DATA);

  isEdit = !!this.data;
  classes = signal<ClassItem[]>([]);
  availableSections = signal<string[]>(['A', 'B', 'C', 'D']);

  form = this.fb.group({
    rollNo: [this.data?.rollNo || '', Validators.required],
    firstName: [this.data?.firstName || '', Validators.required],
    lastName: [this.data?.lastName || '', Validators.required],
    classId: [this.data?.classId || null, Validators.required],
    section: [this.data?.section || 'A', Validators.required],
    parentPhone: [this.data?.parentPhone || '', Validators.required],
    email: [this.data?.email || '', [Validators.email]]
  });

  ngOnInit(): void {
    this.academicService.getClasses().subscribe((res) => {
      this.classes.set(res);
      if (this.data?.classId) {
        this.onClassChange(this.data.classId);
      }
    });
  }

  onClassChange(classId: number): void {
    const cls = this.classes().find(c => c.id === classId);
    if (cls && cls.sections) {
      this.availableSections.set(cls.sections.split(',').map(s => s.trim()));
    } else {
      this.availableSections.set(['A', 'B', 'C']);
    }
  }

  save(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value);
  }
}
