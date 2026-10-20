import { Component, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogModule, MatDialogRef, MAT_DIALOG_DATA } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { SubjectItem, ClassItem, Staff } from '../../core/models/academic.models';
import { AcademicService } from '../../core/services/academic.service';
import { StaffService } from '../../core/services/staff.service';

interface ClassRowSelection {
  classItem: ClassItem;
  selected: boolean;
  defaultStaffId: number | null;
}

@Component({
  selector: 'app-class-assign-dialog',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatCheckboxModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon>domain</mat-icon>
      <span>Assign {{ data.subject.name }} ({{ data.subject.code }}) to Classes</span>
    </h2>

    <mat-dialog-content>
      <p class="dialog-subtitle">
        Select which classes will study this subject and optionally specify a default teacher.
      </p>

      <div class="class-list">
        @for (row of classRows; track row.classItem.id) {
          <div class="class-assign-row" [class.row-selected]="row.selected">
            <div class="class-checkbox">
              <mat-checkbox [(ngModel)]="row.selected">
                <strong>{{ row.classItem.name }}</strong>
                <span class="sections-badge">({{ row.classItem.sections }})</span>
              </mat-checkbox>
            </div>

            <div class="staff-select-container" [class.disabled-select]="!row.selected">
              <mat-form-field appearance="outline" density="compact" class="compact-select">
                <mat-label>Default Teacher (Optional)</mat-label>
                <mat-select [(ngModel)]="row.defaultStaffId" [disabled]="!row.selected">
                  <mat-option [value]="null">-- None / Any Staff --</mat-option>
                  @for (st of staffMembers; track st.id) {
                    <mat-option [value]="st.id">{{ st.fullName }} ({{ st.employeeId }})</mat-option>
                  }
                </mat-select>
              </mat-form-field>
            </div>
          </div>
        } @empty {
          <p class="no-data-msg">No classes available in this institute yet.</p>
        }
      </div>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" (click)="save()">
        <mat-icon>save</mat-icon> Save Class Assignments
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
    .dialog-subtitle {
      color: #64748b;
      font-size: 0.85rem;
      margin: 0 0 16px;
    }
    .class-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-height: 400px;
      overflow-y: auto;
      padding-right: 4px;
    }
    .class-assign-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      padding: 8px 12px;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
      background: #ffffff;
      transition: all 0.15s ease-in-out;
      &.row-selected {
        border-color: #3f51b5;
        background: #f8faff;
      }
    }
    .class-checkbox {
      flex: 1;
      display: flex;
      align-items: center;
    }
    .sections-badge {
      font-size: 0.75rem;
      color: #64748b;
      margin-left: 6px;
    }
    .staff-select-container {
      width: 230px;
      &.disabled-select {
        opacity: 0.5;
        pointer-events: none;
      }
    }
    .compact-select {
      width: 100%;
      margin-bottom: -1.25em;
    }
    .no-data-msg {
      color: #94a3b8;
      font-style: italic;
      padding: 16px 0;
    }
    @media (max-width: 600px) {
      .class-assign-row {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }
      .staff-select-container {
        width: 100%;
      }
    }
  `]
})
export class ClassAssignDialogComponent implements OnInit {
  private dialogRef = inject(MatDialogRef<ClassAssignDialogComponent>);
  private academicService = inject(AcademicService);
  private staffService = inject(StaffService);
  data: { subject: SubjectItem } = inject(MAT_DIALOG_DATA);

  classRows: ClassRowSelection[] = [];
  staffMembers: Staff[] = [];

  ngOnInit(): void {
    const assignedMap = new Map<number, number | null>();
    (this.data.subject.assignedClasses || []).forEach(ac => {
      assignedMap.set(ac.classId, ac.defaultStaffId || null);
    });

    this.staffService.getAll().subscribe({
      next: staff => this.staffMembers = staff
    });

    this.academicService.getClasses().subscribe({
      next: classes => {
        this.classRows = classes.map(c => ({
          classItem: c,
          selected: assignedMap.has(c.id),
          defaultStaffId: assignedMap.get(c.id) ?? null
        }));
      }
    });
  }

  save(): void {
    const assignments = this.classRows
      .filter(r => r.selected)
      .map(r => ({
        classId: r.classItem.id,
        defaultStaffId: r.defaultStaffId || undefined
      }));

    this.dialogRef.close(assignments);
  }
}
