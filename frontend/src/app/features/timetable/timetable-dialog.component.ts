import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { AcademicService } from '../../core/services/academic.service';
import { StaffService } from '../../core/services/staff.service';
import { SubjectItem, Staff } from '../../core/models/academic.models';

export interface TimetableDialogData {
  classId: number;
  className: string;
  section: string;
  dayOfWeek: number;
  dayName: string;
  periodId: number;
  periodName: string;
}

@Component({
  selector: 'app-timetable-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon color="primary">add_alarm</mat-icon>
      <span>Assign Timetable Slot</span>
    </h2>

    <mat-dialog-content>
      <div class="slot-summary">
        <div><strong>Class:</strong> {{ data.className }} - Section {{ data.section }}</div>
        <div><strong>Day:</strong> {{ data.dayName }}</div>
        <div><strong>Period:</strong> {{ data.periodName }}</div>
      </div>

      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Subject</mat-label>
          <mat-select formControlName="subjectId">
            @for (s of subjects(); track s.id) {
              <mat-option [value]="s.id">{{ s.name }} ({{ s.code }})</mat-option>
            }
          </mat-select>
          @if (form.get('subjectId')?.hasError('required')) {
            <mat-error>Subject is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Teaching Staff Member</mat-label>
          <mat-select formControlName="staffId">
            @for (st of staffList(); track st.id) {
              <mat-option [value]="st.id">
                {{ st.fullName }} ({{ st.employeeId }})
                @if (st.subjectSpecialization) {
                  - {{ st.subjectSpecialization }}
                }
              </mat-option>
            }
          </mat-select>
          @if (form.get('staffId')?.hasError('required')) {
            <mat-error>Staff member is required</mat-error>
          }
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="save()">
        Save Slot Assignment
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .slot-summary {
      background: #f1f5f9;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 16px;
      display: flex;
      gap: 20px;
      font-size: 0.9rem;
      color: #1e293b;
    }
    .dialog-form {
      min-width: 440px;
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .full-width { width: 100%; }
    h2 { display: flex; align-items: center; gap: 8px; color: #1a237e; }
  `]
})
export class TimetableDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private academicService = inject(AcademicService);
  private staffService = inject(StaffService);
  dialogRef = inject(MatDialogRef<TimetableDialogComponent>);
  data: TimetableDialogData = inject(MAT_DIALOG_DATA);

  subjects = signal<SubjectItem[]>([]);
  staffList = signal<Staff[]>([]);

  form = this.fb.group({
    subjectId: [null as number | null, Validators.required],
    staffId: [null as number | null, Validators.required]
  });

  ngOnInit(): void {
    this.academicService.getSubjects().subscribe(res => this.subjects.set(res));
    this.staffService.getAll(false).subscribe(res => this.staffList.set(res.filter(s => s.isActive)));
  }

  save(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value);
  }
}
