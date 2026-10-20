import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { StudentService } from '../../core/services/student.service';
import { AcademicService } from '../../core/services/academic.service';
import { Student, ClassItem, SubjectItem } from '../../core/models/academic.models';
import { StudentDialogComponent } from './student-dialog.component';
import { StudentImportDialogComponent } from './student-import-dialog.component';

@Component({
  selector: 'app-student-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatPaginatorModule,
    MatTooltipModule,
    MatExpansionModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Student Management</h1>
          <p class="subtitle">Enroll, manage, and bulk import students</p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button color="primary" (click)="openImportDialog()">
            <mat-icon>upload_file</mat-icon> Bulk Import Excel
          </button>
          <button mat-flat-button color="primary" (click)="openAddDialog()">
            <mat-icon>person_add</mat-icon> Enroll Student
          </button>
        </div>
      </div>

      <!-- Quick Setup: Academic Classes & Subjects Accordion -->
      <mat-accordion class="setup-accordion">
        <mat-expansion-panel>
          <mat-expansion-panel-header>
            <mat-panel-title>
              <mat-icon class="mr-2">settings_suggest</mat-icon> Manage Classes & Subjects
            </mat-panel-title>
            <mat-panel-description>
              {{ classes().length }} Classes, {{ subjects().length }} Subjects configured
            </mat-panel-description>
          </mat-expansion-panel-header>

          <div class="setup-grid">
            <!-- Classes Box -->
            <div class="setup-col">
              <h3>Academic Classes</h3>
              <div class="inline-add">
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Class Name</mat-label>
                  <input matInput [(ngModel)]="newClassName" placeholder="e.g. Grade 10">
                </mat-form-field>
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Sections</mat-label>
                  <input matInput [(ngModel)]="newClassSections" placeholder="A,B,C">
                </mat-form-field>
                <button mat-flat-button color="accent" (click)="addClass()">
                  <mat-icon>add</mat-icon> Add
                </button>
              </div>
              <div class="tags-container">
                @for (c of classes(); track c.id) {
                  <span class="chip-item">
                    <strong>{{ c.name }}</strong> ({{ c.sections }})
                    <mat-icon class="close-icon" (click)="deleteClass(c.id)">close</mat-icon>
                  </span>
                }
              </div>
            </div>

            <!-- Subjects Box -->
            <div class="setup-col">
              <h3>Subjects</h3>
              <div class="inline-add">
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Subject Name</mat-label>
                  <input matInput [(ngModel)]="newSubjectName" placeholder="Mathematics">
                </mat-form-field>
                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Code</mat-label>
                  <input matInput [(ngModel)]="newSubjectCode" placeholder="MATH101">
                </mat-form-field>
                <button mat-flat-button color="accent" (click)="addSubject()">
                  <mat-icon>add</mat-icon> Add
                </button>
              </div>
              <div class="tags-container">
                @for (s of subjects(); track s.id) {
                  <span class="chip-item">
                    <strong>{{ s.name }}</strong> [{{ s.code }}]
                    <mat-icon class="close-icon" (click)="deleteSubject(s.id)">close</mat-icon>
                  </span>
                }
              </div>
            </div>
          </div>
        </mat-expansion-panel>
      </mat-accordion>

      <!-- Filter Bar -->
      <mat-card class="filter-card mt-3">
        <mat-card-content class="filter-content">
          <mat-form-field appearance="outline" class="filter-item">
            <mat-label>Filter by Class</mat-label>
            <mat-select [(ngModel)]="selectedClassId" (selectionChange)="onFilterChange()">
              <mat-option [value]="null">All Classes</mat-option>
              @for (c of classes(); track c.id) {
                <mat-option [value]="c.id">{{ c.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-item">
            <mat-label>Section</mat-label>
            <mat-select [(ngModel)]="selectedSection" (selectionChange)="onFilterChange()">
              <mat-option value="">All Sections</mat-option>
              <mat-option value="A">Section A</mat-option>
              <mat-option value="B">Section B</mat-option>
              <mat-option value="C">Section C</mat-option>
              <mat-option value="D">Section D</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-item search-box">
            <mat-label>Search Students</mat-label>
            <input matInput [(ngModel)]="searchTerm" (keyup.enter)="onFilterChange()" placeholder="Roll no, name, phone...">
            <mat-icon matSuffix (click)="onFilterChange()" class="cursor-pointer">search</mat-icon>
          </mat-form-field>

          <button mat-stroked-button (click)="resetFilters()">
            <mat-icon>clear</mat-icon> Reset
          </button>
        </mat-card-content>
      </mat-card>

      <!-- Students Table -->
      <mat-card class="table-card mt-3">
        <table mat-table [dataSource]="students()" class="full-width">
          <!-- Roll No Column -->
          <ng-container matColumnDef="rollNo">
            <th mat-header-cell *matHeaderCellDef>Roll No</th>
            <td mat-cell *matCellDef="let s">
              <span class="roll-badge">{{ s.rollNo }}</span>
            </td>
          </ng-container>

          <!-- Name Column -->
          <ng-container matColumnDef="name">
            <th mat-header-cell *matHeaderCellDef>Student Name</th>
            <td mat-cell *matCellDef="let s">
              <strong>{{ s.fullName }}</strong>
            </td>
          </ng-container>

          <!-- Class Column -->
          <ng-container matColumnDef="class">
            <th mat-header-cell *matHeaderCellDef>Class & Section</th>
            <td mat-cell *matCellDef="let s">
              <span class="class-tag">{{ s.className }} - {{ s.section }}</span>
            </td>
          </ng-container>

          <!-- Parent Phone Column -->
          <ng-container matColumnDef="phone">
            <th mat-header-cell *matHeaderCellDef>Parent Phone</th>
            <td mat-cell *matCellDef="let s">{{ s.parentPhone }}</td>
          </ng-container>

          <!-- Email Column -->
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>Email</th>
            <td mat-cell *matCellDef="let s">{{ s.email || '-' }}</td>
          </ng-container>

          <!-- Status Column -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let s">
              <span class="badge" [ngClass]="s.isActive ? 'badge-approved' : 'badge-absent'">
                {{ s.isActive ? 'Active' : 'Inactive' }}
              </span>
            </td>
          </ng-container>

          <!-- Actions Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Actions</th>
            <td mat-cell *matCellDef="let s">
              <button mat-icon-button color="primary" matTooltip="Edit Student" (click)="openEditDialog(s)">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" matTooltip="Deactivate" (click)="deactivate(s)">
                <mat-icon>delete_outline</mat-icon>
              </button>
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;"></tr>

          <tr class="mat-row" *matNoDataRow>
            <td class="mat-cell empty-state" colspan="7">
              <mat-icon>school</mat-icon>
              <p>No students enrolled matching current filters.</p>
            </td>
          </tr>
        </table>

        <mat-paginator
          [length]="totalCount()"
          [pageSize]="pageSize"
          [pageSizeOptions]="[10, 25, 50, 100]"
          (page)="onPageChange($event)">
        </mat-paginator>
      </mat-card>
    </div>
  `,
  styles: [`
    .subtitle { color: #666; margin: 4px 0 0 0; }
    .header-actions { display: flex; gap: 12px; }
    .setup-accordion { margin-bottom: 8px; }
    .setup-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 24px; padding: 12px 0; }
    .setup-col { h3 { margin: 0 0 10px 0; font-size: 1rem; color: #1a237e; } }
    .inline-add { display: flex; gap: 10px; align-items: center; margin-bottom: 12px; }
    .tags-container { display: flex; flex-wrap: wrap; gap: 8px; max-height: 120px; overflow-y: auto; }
    .chip-item {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 10px;
      background: #e8eaf6;
      border-radius: 16px;
      font-size: 0.8rem;
      color: #1a237e;
      .close-icon { font-size: 14px; width: 14px; height: 14px; cursor: pointer; color: #7986cb; &:hover { color: #d32f2f; } }
    }
    .filter-card { border-radius: 12px; }
    .filter-content {
      display: flex;
      gap: 16px;
      align-items: center;
      flex-wrap: wrap;
      padding: 12px 16px !important;
    }
    .filter-item { min-width: 180px; margin-bottom: -1.25em; }
    .search-box { flex: 1; min-width: 240px; }
    .cursor-pointer { cursor: pointer; }
    .table-card { border-radius: 12px; overflow: hidden; }
    .full-width { width: 100%; }
    .roll-badge { font-family: monospace; font-weight: 700; color: #1a237e; background: #e8eaf6; padding: 3px 8px; border-radius: 6px; }
    .class-tag { font-weight: 500; color: #004d40; }
    .mt-3 { margin-top: 16px; }
    .mr-2 { margin-right: 8px; }
    .empty-state { text-align: center; padding: 48px; color: #999; mat-icon { font-size: 48px; width: 48px; height: 48px; } }
  `]
})
export class StudentListComponent implements OnInit {
  private studentService = inject(StudentService);
  private academicService = inject(AcademicService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  columns = ['rollNo', 'name', 'class', 'phone', 'email', 'status', 'actions'];

  students = signal<Student[]>([]);
  totalCount = signal(0);
  page = 1;
  pageSize = 50;

  classes = signal<ClassItem[]>([]);
  subjects = signal<SubjectItem[]>([]);

  selectedClassId: number | null = null;
  selectedSection = '';
  searchTerm = '';

  newClassName = '';
  newClassSections = 'A,B';
  newSubjectName = '';
  newSubjectCode = '';

  ngOnInit(): void {
    this.loadAcademicData();
    this.loadStudents();
  }

  loadAcademicData(): void {
    this.academicService.getClasses().subscribe(res => this.classes.set(res));
    this.academicService.getSubjects().subscribe(res => this.subjects.set(res));
  }

  loadStudents(): void {
    this.studentService.getAll({
      classId: this.selectedClassId || undefined,
      section: this.selectedSection || undefined,
      search: this.searchTerm || undefined,
      page: this.page,
      pageSize: this.pageSize
    }).subscribe({
      next: (res) => {
        this.students.set(res.items);
        this.totalCount.set(res.totalCount);
      },
      error: () => this.snackBar.open('Failed to load students', 'Close', { duration: 3000 })
    });
  }

  onFilterChange(): void {
    this.page = 1;
    this.loadStudents();
  }

  resetFilters(): void {
    this.selectedClassId = null;
    this.selectedSection = '';
    this.searchTerm = '';
    this.page = 1;
    this.loadStudents();
  }

  onPageChange(event: PageEvent): void {
    this.page = event.pageIndex + 1;
    this.pageSize = event.pageSize;
    this.loadStudents();
  }

  openAddDialog(): void {
    const ref = this.dialog.open(StudentDialogComponent, { width: '560px' });
    ref.afterClosed().subscribe((res) => {
      if (res) {
        this.studentService.create(res).subscribe({
          next: () => {
            this.snackBar.open('Student enrolled successfully!', 'Close', { duration: 3000 });
            this.loadStudents();
          },
          error: (err) => this.snackBar.open(err.error?.message || 'Enrollment failed', 'Close', { duration: 4000 })
        });
      }
    });
  }

  openEditDialog(student: Student): void {
    const ref = this.dialog.open(StudentDialogComponent, { width: '560px', data: student });
    ref.afterClosed().subscribe((res) => {
      if (res) {
        this.studentService.update(student.id, res).subscribe({
          next: () => {
            this.snackBar.open('Student updated successfully!', 'Close', { duration: 3000 });
            this.loadStudents();
          },
          error: (err) => this.snackBar.open(err.error?.message || 'Update failed', 'Close', { duration: 4000 })
        });
      }
    });
  }

  openImportDialog(): void {
    const ref = this.dialog.open(StudentImportDialogComponent, { width: '850px' });
    ref.afterClosed().subscribe((res) => {
      if (res) {
        this.snackBar.open(res.message || 'Import completed!', 'Close', { duration: 4000 });
        this.loadStudents();
      }
    });
  }

  deactivate(student: Student): void {
    if (confirm(`Are you sure you want to deactivate ${student.fullName}?`)) {
      this.studentService.deactivate(student.id).subscribe({
        next: () => {
          this.snackBar.open('Student deactivated', 'Close', { duration: 3000 });
          this.loadStudents();
        },
        error: () => this.snackBar.open('Failed to deactivate student', 'Close', { duration: 3000 })
      });
    }
  }

  addClass(): void {
    if (!this.newClassName.trim()) return;
    this.academicService.createClass(this.newClassName.trim(), this.newClassSections.trim() || 'A,B').subscribe({
      next: () => {
        this.newClassName = '';
        this.loadAcademicData();
        this.snackBar.open('Class added successfully', 'Close', { duration: 2500 });
      },
      error: (err) => this.snackBar.open(err.error?.message || 'Failed to add class', 'Close', { duration: 3000 })
    });
  }

  deleteClass(id: number): void {
    if (confirm('Delete this class?')) {
      this.academicService.deleteClass(id).subscribe(() => this.loadAcademicData());
    }
  }

  addSubject(): void {
    if (!this.newSubjectName.trim() || !this.newSubjectCode.trim()) return;
    this.academicService.createSubject(this.newSubjectName.trim(), this.newSubjectCode.trim()).subscribe({
      next: () => {
        this.newSubjectName = '';
        this.newSubjectCode = '';
        this.loadAcademicData();
        this.snackBar.open('Subject added successfully', 'Close', { duration: 2500 });
      },
      error: (err) => this.snackBar.open(err.error?.message || 'Failed to add subject', 'Close', { duration: 3000 })
    });
  }

  deleteSubject(id: number): void {
    if (confirm('Delete this subject?')) {
      this.academicService.deleteSubject(id).subscribe(() => this.loadAcademicData());
    }
  }
}
