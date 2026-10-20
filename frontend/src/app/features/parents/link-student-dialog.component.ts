import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { StudentService } from '../../core/services/student.service';
import { Student } from '../../core/models/academic.models';
import { ParentItem } from '../../core/models/parent.models';

@Component({
  selector: 'app-link-student-dialog',
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
      <mat-icon>family_restroom</mat-icon>
      <span>Link Child to {{ data.parent.fullName }}</span>
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="link-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Select Student</mat-label>
          <mat-select formControlName="studentId">
            @for (s of unlinkedStudents; track s.id) {
              <mat-option [value]="s.id">
                {{ s.fullName }} (Roll: {{ s.rollNo }} - {{ s.className }} {{ s.section }})
              </mat-option>
            }
          </mat-select>
          @if (form.get('studentId')?.hasError('required')) {
            <mat-error>Please select a student</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Relationship</mat-label>
          <mat-select formControlName="relationship">
            <mat-option value="Father">Father</mat-option>
            <mat-option value="Mother">Mother</mat-option>
            <mat-option value="Guardian">Guardian</mat-option>
            <mat-option value="Other">Other</mat-option>
          </mat-select>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="save()">
        <mat-icon>link</mat-icon> Link Child
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 1.2rem;
      color: #1a237e;
      mat-icon { color: #1a237e; }
    }
    .link-form {
      display: flex;
      flex-direction: column;
      gap: 12px;
      min-width: 320px;
      max-width: 480px;
      padding-top: 8px;
    }
    .full-width { width: 100%; }
  `]
})
export class LinkStudentDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<LinkStudentDialogComponent>);
  private studentService = inject(StudentService);
  data: { parent: ParentItem } = inject(MAT_DIALOG_DATA);

  unlinkedStudents: Student[] = [];

  form = this.fb.group({
    studentId: [null as number | null, [Validators.required]],
    relationship: ['Father', [Validators.required]]
  });

  ngOnInit(): void {
    const alreadyLinkedIds = new Set(this.data.parent.linkedStudents.map(s => s.studentId));
    this.studentService.getAll({ pageSize: 150 }).subscribe({
      next: res => {
        this.unlinkedStudents = (res.items || []).filter(s => !alreadyLinkedIds.has(s.id));
      }
    });
  }

  save(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value);
  }
}
