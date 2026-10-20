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
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { SubjectService, CreateSubjectRequest, UpdateSubjectRequest } from '../../core/services/subject.service';
import { SubjectItem } from '../../core/models/academic.models';
import { SubjectDialogComponent } from './subject-dialog.component';
import { ClassAssignDialogComponent } from './class-assign-dialog.component';

@Component({
  selector: 'app-subjects-list',
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
    MatChipsModule,
    MatTooltipModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Subject Management</h1>
          <p class="subtitle">Create academic subjects, map them to classes, and assign default staff</p>
        </div>
        <div class="header-actions">
          <button mat-flat-button color="primary" (click)="openAddDialog()">
            <mat-icon>add</mat-icon> Add Subject
          </button>
        </div>
      </div>

      <!-- Search & Stats Card -->
      <mat-card class="search-card">
        <mat-card-content>
          <div class="search-bar">
            <mat-form-field appearance="outline" class="search-field">
              <mat-label>Search Subjects</mat-label>
              <input matInput [(ngModel)]="searchTerm" placeholder="Search by subject name or code...">
              <mat-icon matPrefix>search</mat-icon>
              @if (searchTerm) {
                <button mat-icon-button matSuffix (click)="searchTerm = ''">
                  <mat-icon>clear</mat-icon>
                </button>
              }
            </mat-form-field>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Desktop Table View -->
      <mat-card class="table-card desktop-table-card">
        <mat-card-content class="p-0">
          <table mat-table [dataSource]="filteredSubjects" class="subjects-table">
            <!-- Subject Column -->
            <ng-container matColumnDef="subject">
              <th mat-header-cell *matHeaderCellDef>Subject</th>
              <td mat-cell *matCellDef="let s">
                <div class="subject-cell">
                  <div class="subject-icon-box">
                    <mat-icon>menu_book</mat-icon>
                  </div>
                  <div class="subject-meta">
                    <span class="subject-name">{{ s.name }}</span>
                    <span class="subject-code">{{ s.code }}</span>
                  </div>
                </div>
              </td>
            </ng-container>

            <!-- Assigned Classes Column -->
            <ng-container matColumnDef="classes">
              <th mat-header-cell *matHeaderCellDef>Assigned Classes & Default Teachers</th>
              <td mat-cell *matCellDef="let s">
                @if (s.assignedClasses && s.assignedClasses.length > 0) {
                  <div class="classes-chip-list">
                    @for (c of s.assignedClasses; track c.classSubjectId) {
                      <span class="class-chip">
                        <mat-icon class="class-chip-icon">domain</mat-icon>
                        <span class="class-name-txt">{{ c.className }}</span>
                        @if (c.defaultStaffName) {
                          <span class="staff-badge">
                            <mat-icon>person</mat-icon> {{ c.defaultStaffName }}
                          </span>
                        }
                      </span>
                    }
                  </div>
                } @else {
                  <span class="no-assigned-txt">No classes assigned yet</span>
                }
              </td>
            </ng-container>

            <!-- Actions Column -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="actions-header">Actions</th>
              <td mat-cell *matCellDef="let s" class="actions-cell">
                <button mat-stroked-button color="primary" class="action-btn" (click)="openAssignClassesDialog(s)">
                  <mat-icon>domain_add</mat-icon> Assign Classes
                </button>
                <button mat-icon-button color="primary" matTooltip="Edit Subject" (click)="openEditDialog(s)">
                  <mat-icon>edit</mat-icon>
                </button>
                <button mat-icon-button color="warn" matTooltip="Delete Subject" (click)="deleteSubject(s)">
                  <mat-icon>delete</mat-icon>
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>

            <tr class="mat-row empty-row" *matNoDataRow>
              <td class="mat-cell" colspan="3">
                <div class="empty-state">
                  <mat-icon>menu_book</mat-icon>
                  <p>No subjects found.</p>
                </div>
              </td>
            </tr>
          </table>
        </mat-card-content>
      </mat-card>

      <!-- Mobile Card List View -->
      <div class="mobile-card-list">
        @for (s of filteredSubjects; track s.id) {
          <mat-card class="subject-mobile-card">
            <mat-card-header>
              <div mat-card-avatar class="subject-icon-box">
                <mat-icon>menu_book</mat-icon>
              </div>
              <mat-card-title>{{ s.name }}</mat-card-title>
              <mat-card-subtitle>{{ s.code }}</mat-card-subtitle>
              <span class="spacer"></span>
              <span class="badge badge-staff">
                {{ s.assignedClasses?.length || 0 }} Classes
              </span>
            </mat-card-header>

            <mat-card-content class="mobile-card-body">
              <div class="mobile-section-label">
                <mat-icon>domain</mat-icon>
                <strong>Assigned Classes & Teachers</strong>
              </div>

              @if (s.assignedClasses && s.assignedClasses.length > 0) {
                <div class="classes-chip-list">
                  @for (c of s.assignedClasses; track c.classSubjectId) {
                    <div class="class-chip mobile-chip">
                      <span class="class-name-txt">{{ c.className }}</span>
                      @if (c.defaultStaffName) {
                        <span class="staff-badge">
                          <mat-icon>person</mat-icon> {{ c.defaultStaffName }}
                        </span>
                      }
                    </div>
                  }
                </div>
              } @else {
                <p class="no-assigned-txt">No classes assigned yet.</p>
              }
            </mat-card-content>

            <mat-card-actions align="end" class="mobile-card-actions">
              <button mat-stroked-button color="primary" (click)="openAssignClassesDialog(s)">
                <mat-icon>domain_add</mat-icon> Classes
              </button>
              <button mat-icon-button color="primary" (click)="openEditDialog(s)">
                <mat-icon>edit</mat-icon>
              </button>
              <button mat-icon-button color="warn" (click)="deleteSubject(s)">
                <mat-icon>delete</mat-icon>
              </button>
            </mat-card-actions>
          </mat-card>
        } @empty {
          <div class="empty-state">
            <mat-icon>menu_book</mat-icon>
            <p>No subjects found.</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .subtitle {
      color: #64748b;
      margin: 4px 0 0;
      font-size: 0.9rem;
    }
    .search-card {
      margin-bottom: 20px;
    }
    .search-bar {
      display: flex;
      gap: 12px;
      align-items: center;
    }
    .search-field {
      flex: 1;
      margin-bottom: -1.25em;
    }
    .table-card {
      background: white;
      border-radius: 8px;
      overflow: hidden;
    }
    .p-0 { padding: 0 !important; }
    .subjects-table {
      width: 100%;
    }
    .subject-cell {
      display: flex;
      align-items: center;
      gap: 14px;
      padding: 12px 0;
    }
    .subject-icon-box {
      width: 40px;
      height: 40px;
      border-radius: 8px;
      background: #e8eaf6;
      color: #1a237e;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      mat-icon { font-size: 22px; width: 22px; height: 22px; }
    }
    .subject-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .subject-name {
      font-weight: 600;
      color: #1e293b;
      font-size: 0.95rem;
    }
    .subject-code {
      font-size: 0.78rem;
      font-weight: 700;
      color: #3b82f6;
      letter-spacing: 0.5px;
    }
    .classes-chip-list {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      padding: 6px 0;
    }
    .class-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #f1f5f9;
      border: 1px solid #cbd5e1;
      border-radius: 16px;
      padding: 3px 10px;
      font-size: 0.8rem;
      color: #334155;
    }
    .class-chip-icon {
      font-size: 15px;
      width: 15px;
      height: 15px;
      color: #64748b;
    }
    .staff-badge {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      background: #e0f2f1;
      color: #004d40;
      padding: 1px 6px;
      border-radius: 10px;
      font-size: 0.72rem;
      font-weight: 600;
      mat-icon { font-size: 13px; width: 13px; height: 13px; }
    }
    .no-assigned-txt {
      color: #94a3b8;
      font-style: italic;
      font-size: 0.85rem;
    }
    .actions-header {
      text-align: right;
    }
    .actions-cell {
      text-align: right;
      white-space: nowrap;
    }
    .action-btn {
      margin-right: 8px;
    }
    .empty-state {
      text-align: center;
      padding: 48px 16px;
      color: #94a3b8;
      mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 8px; }
    }
    .mobile-card-list {
      display: none;
      flex-direction: column;
      gap: 16px;
    }
    .subject-mobile-card {
      border-radius: 12px;
    }
    .mobile-card-body {
      padding-top: 12px;
    }
    .mobile-section-label {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.82rem;
      color: #475569;
      margin-bottom: 8px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; color: #64748b; }
    }
    .mobile-chip {
      width: 100%;
      justify-content: space-between;
      border-radius: 8px;
    }

    @media (max-width: 768px) {
      .desktop-table-card {
        display: none;
      }
      .mobile-card-list {
        display: flex;
      }
    }
  `]
})
export class SubjectsListComponent implements OnInit {
  private subjectService = inject(SubjectService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  subjects = signal<SubjectItem[]>([]);
  searchTerm = '';
  displayedColumns = ['subject', 'classes', 'actions'];

  get filteredSubjects(): SubjectItem[] {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) return this.subjects();
    return this.subjects().filter(s =>
      s.name.toLowerCase().includes(term) || s.code.toLowerCase().includes(term)
    );
  }

  ngOnInit(): void {
    this.loadSubjects();
  }

  loadSubjects(): void {
    this.subjectService.getAll().subscribe({
      next: data => this.subjects.set(data),
      error: () => this.snackBar.open('Failed to load subjects', 'Close', { duration: 3000 })
    });
  }

  openAddDialog(): void {
    const ref = this.dialog.open(SubjectDialogComponent, { width: '480px' });
    ref.afterClosed().subscribe((res: CreateSubjectRequest | undefined) => {
      if (res) {
        this.subjectService.create(res).subscribe({
          next: () => {
            this.snackBar.open('Subject created successfully', 'Close', { duration: 3000 });
            this.loadSubjects();
          },
          error: err => {
            this.snackBar.open(err.error?.message || 'Failed to create subject', 'Close', { duration: 4000 });
          }
        });
      }
    });
  }

  openEditDialog(subject: SubjectItem): void {
    const ref = this.dialog.open(SubjectDialogComponent, {
      width: '480px',
      data: subject
    });
    ref.afterClosed().subscribe((res: UpdateSubjectRequest | undefined) => {
      if (res) {
        this.subjectService.update(subject.id, res).subscribe({
          next: () => {
            this.snackBar.open('Subject updated successfully', 'Close', { duration: 3000 });
            this.loadSubjects();
          },
          error: err => {
            this.snackBar.open(err.error?.message || 'Failed to update subject', 'Close', { duration: 4000 });
          }
        });
      }
    });
  }

  openAssignClassesDialog(subject: SubjectItem): void {
    const ref = this.dialog.open(ClassAssignDialogComponent, {
      width: '540px',
      data: { subject }
    });
    ref.afterClosed().subscribe((assignments: { classId: number; defaultStaffId?: number }[] | undefined) => {
      if (assignments) {
        this.subjectService.assignClasses(subject.id, assignments).subscribe({
          next: () => {
            this.snackBar.open('Class assignments updated', 'Close', { duration: 3000 });
            this.loadSubjects();
          },
          error: err => {
            this.snackBar.open(err.error?.message || 'Failed to assign classes', 'Close', { duration: 4000 });
          }
        });
      }
    });
  }

  deleteSubject(subject: SubjectItem): void {
    if (!confirm(`Are you sure you want to delete subject "${subject.name}"?`)) return;
    this.subjectService.delete(subject.id).subscribe({
      next: () => {
        this.snackBar.open('Subject deleted successfully', 'Close', { duration: 3000 });
        this.loadSubjects();
      },
      error: err => {
        this.snackBar.open(err.error?.message || 'Failed to delete subject', 'Close', { duration: 4000 });
      }
    });
  }
}
