import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { SubjectItem, ClassItem } from '../../core/models/academic.models';
import { AcademicService } from '../../core/services/academic.service';

@Component({
  selector: 'app-subject-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>{{ isEdit ? 'edit' : 'menu_book' }}</mat-icon>
      <span>{{ isEdit ? 'Edit Subject' : 'Add New Subject' }}</span>
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="subject-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Subject Name</mat-label>
          <input matInput formControlName="name" placeholder="e.g. Mathematics, Physics, History">
          @if (form.get('name')?.hasError('required')) {
            <mat-error>Subject name is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Subject Code</mat-label>
          <input matInput formControlName="code" placeholder="e.g. MATH101, PHY201">
          @if (form.get('code')?.hasError('required')) {
            <mat-error>Subject code is required</mat-error>
          }
        </mat-form-field>

        @if (!isEdit && classes.length > 0) {
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Assign to Classes (Optional)</mat-label>
            <mat-select formControlName="selectedClassIds" multiple>
              @for (c of classes; track c.id) {
                <mat-option [value]="c.id">{{ c.name }} ({{ c.sections }})</mat-option>
              }
            </mat-select>
            <mat-hint>You can configure default staff per class after saving</mat-hint>
          </mat-form-field>
        }
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="save()">
        <mat-icon>check</mat-icon> {{ isEdit ? 'Update Subject' : 'Create Subject' }}
      </button>
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
    .subject-form {
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
export class SubjectDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private dialogRef = inject(MatDialogRef<SubjectDialogComponent>);
  private academicService = inject(AcademicService);
  data: SubjectItem | null = inject(MAT_DIALOG_DATA, { optional: true });

  isEdit = !!this.data;
  classes: ClassItem[] = [];

  form = this.fb.group({
    name: [this.data?.name || '', [Validators.required]],
    code: [this.data?.code || '', [Validators.required]],
    selectedClassIds: [[] as number[]]
  });

  ngOnInit(): void {
    if (!this.isEdit) {
      this.academicService.getClasses().subscribe({
        next: cls => this.classes = cls
      });
    }
  }

  save(): void {
    if (this.form.invalid) return;
    const val = this.form.value;

    if (this.isEdit) {
      this.dialogRef.close({
        name: val.name!,
        code: val.code!
      });
    } else {
      const classAssignments = (val.selectedClassIds || []).map(cid => ({ classId: cid }));
      this.dialogRef.close({
        name: val.name!,
        code: val.code!,
        classAssignments: classAssignments.length ? classAssignments : undefined
      });
    }
  }
}
