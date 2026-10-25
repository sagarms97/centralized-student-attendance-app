import { Component, OnInit, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { AcademicService } from '../../core/services/academic.service';
import { ClassItem } from '../../core/models/academic.models';
import {
  FaceAttendanceService,
  StudentConsent,
  ClassConsentSummary
} from '../../core/services/face-attendance.service';

@Component({
  selector: 'app-face-consent',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatTableModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatProgressSpinnerModule,
    MatTabsModule
  ],
  template: `
    <div class="face-consent-container">
      <div class="page-header">
        <div>
          <h2>Student Face Attendance Consent & Roster</h2>
          <p class="subtitle">Record parental consent, review enrollment readiness, and manage biometric data compliance.</p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button color="primary" (click)="loadAllData()">
            <mat-icon>refresh</mat-icon>
            Refresh
          </button>
        </div>
      </div>

      <mat-tab-group>
        <!-- Tab 1: Class Roster & Consent Management -->
        <mat-tab label="Class Roster & Consent">
          <div class="tab-content">
            <!-- Filter Bar -->
            <div class="filter-bar">
              <mat-form-field appearance="outline" class="class-select">
                <mat-label>Select Class</mat-label>
                <mat-select [(value)]="selectedClassId" (selectionChange)="onClassChange($event.value)">
                  <mat-option *ngFor="let c of classes" [value]="c.id">
                    {{ c.name }} ({{ c.sections }})
                  </mat-option>
                </mat-select>
              </mat-form-field>

              <mat-form-field appearance="outline" class="search-input">
                <mat-label>Filter by student name or roll no</mat-label>
                <input matInput [(ngModel)]="searchQuery" (input)="applyFilter()" placeholder="Search...">
                <mat-icon matSuffix>search</mat-icon>
              </mat-form-field>
            </div>

            <!-- Stats Bar -->
            <div class="stats-grid" *ngIf="students.length > 0">
              <div class="stat-card">
                <div class="stat-value">{{ students.length }}</div>
                <div class="stat-label">Total Class Students</div>
              </div>
              <div class="stat-card green-stat">
                <div class="stat-value">{{ consentedCount }}</div>
                <div class="stat-label">Consented</div>
              </div>
              <div class="stat-card amber-stat">
                <div class="stat-value">{{ pendingCount }}</div>
                <div class="stat-label">Pending Consent</div>
              </div>
              <div class="stat-card red-stat">
                <div class="stat-value">{{ withdrawnCount }}</div>
                <div class="stat-label">Withdrawn / Declined</div>
              </div>
              <div class="stat-card blue-stat">
                <div class="stat-value">{{ enrolledCount }}</div>
                <div class="stat-label">Enrolled In Face Recognition</div>
              </div>
            </div>

            <!-- Loading Spinner -->
            <div *ngIf="loadingStudents" class="loading-state">
              <mat-spinner diameter="40"></mat-spinner>
              <span>Loading student consents...</span>
            </div>

            <!-- Students Table -->
            <mat-card class="table-card" *ngIf="!loadingStudents">
              <div class="table-header-row" *ngIf="filteredStudents.length > 0">
                <span class="table-title">Student Consent Status ({{ filteredStudents.length }} students)</span>
                <button mat-button color="warn" (click)="confirmDeleteClassData()" *ngIf="enrolledCount > 0">
                  <mat-icon>delete_sweep</mat-icon>
                  Delete Class Face Data
                </button>
              </div>

              <div class="empty-state" *ngIf="filteredStudents.length === 0 && !loadingStudents">
                <mat-icon>person_search</mat-icon>
                <p>No students found for this class filter.</p>
              </div>

              <div class="table-responsive" *ngIf="filteredStudents.length > 0">
                <table mat-table [dataSource]="filteredStudents" class="roster-table">
                  <!-- Roll No Column -->
                  <ng-container matColumnDef="rollNumber">
                    <th mat-header-cell *matHeaderCellDef>Roll No</th>
                    <td mat-cell *matCellDef="let s"><strong>{{ s.rollNumber }}</strong></td>
                  </ng-container>

                  <!-- Student Name Column -->
                  <ng-container matColumnDef="studentName">
                    <th mat-header-cell *matHeaderCellDef>Student Name</th>
                    <td mat-cell *matCellDef="let s">
                      <div class="name-cell">
                        <span class="primary-name">{{ s.studentName }}</span>
                        <span class="sec-badge">Sec {{ s.section }}</span>
                      </div>
                    </td>
                  </ng-container>

                  <!-- Status Column -->
                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>Consent Status</th>
                    <td mat-cell *matCellDef="let s">
                      <span class="status-badge" [ngClass]="s.status.toLowerCase()">
                        {{ s.status }}
                      </span>
                    </td>
                  </ng-container>

                  <!-- Consent Info Column -->
                  <ng-container matColumnDef="consentInfo">
                    <th mat-header-cell *matHeaderCellDef>Guardian & Date</th>
                    <td mat-cell *matCellDef="let s">
                      <div *ngIf="s.status === 'Consented'" class="consent-meta">
                        <span><strong>{{ s.consentGivenBy || 'Parent' }}</strong></span>
                        <small>{{ s.consentDate | date:'mediumDate' }}</small>
                      </div>
                      <div *ngIf="s.status === 'Withdrawn'" class="consent-meta withdrawn-meta">
                        <span>Withdrawn {{ s.withdrawnDate | date:'mediumDate' }}</span>
                        <small *ngIf="s.notes">{{ s.notes }}</small>
                      </div>
                      <span *ngIf="s.status === 'Pending'" class="text-muted">Awaiting consent</span>
                    </td>
                  </ng-container>

                  <!-- Enrolled Embeddings Column -->
                  <ng-container matColumnDef="enrolled">
                    <th mat-header-cell *matHeaderCellDef>Face Embeddings</th>
                    <td mat-cell *matCellDef="let s">
                      <span class="embedding-pill" [class.active-pill]="s.faceEmbeddingCount > 0">
                        {{ s.faceEmbeddingCount }} photos
                      </span>
                    </td>
                  </ng-container>

                  <!-- Actions Column -->
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef class="actions-header">Actions</th>
                    <td mat-cell *matCellDef="let s" class="actions-cell">
                      <!-- Record Consent Button -->
                      <button mat-stroked-button color="primary" size="small" *ngIf="s.status !== 'Consented'" (click)="openRecordModal(s)">
                        <mat-icon>check_circle</mat-icon>
                        Record Consent
                      </button>

                      <!-- Enroll Face Biometrics Button -->
                      <a mat-stroked-button color="primary" size="small" *ngIf="s.status === 'Consented'" [routerLink]="['/app/face-attendance/enrollment']" [queryParams]="{ studentId: s.studentId }">
                        <mat-icon>camera_front</mat-icon>
                        Enroll Face
                      </a>

                      <!-- Withdraw Consent Button -->
                      <button mat-button color="warn" size="small" *ngIf="s.status === 'Consented'" (click)="openWithdrawModal(s)">
                        <mat-icon>block</mat-icon>
                        Withdraw
                      </button>

                      <!-- Delete Individual Face Data Button -->
                      <button mat-icon-button color="warn" *ngIf="s.faceEmbeddingCount > 0" (click)="deleteStudentFace(s)" matTooltip="Delete student facial embeddings">
                        <mat-icon>delete_forever</mat-icon>
                      </button>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>
                </table>
              </div>
            </mat-card>
          </div>
        </mat-tab>

        <!-- Tab 2: Institution-Wide Summary -->
        <mat-tab label="All Classes Summary">
          <div class="tab-content">
            <mat-card class="table-card">
              <div class="table-header-row">
                <span class="table-title">Class-by-Class Face Attendance Consent Overview</span>
              </div>

              <div *ngIf="loadingSummary" class="loading-state">
                <mat-spinner diameter="40"></mat-spinner>
                <span>Loading summary breakdown...</span>
              </div>

              <div class="table-responsive" *ngIf="!loadingSummary">
                <table mat-table [dataSource]="summaryList" class="roster-table">
                  <ng-container matColumnDef="className">
                    <th mat-header-cell *matHeaderCellDef>Class</th>
                    <td mat-cell *matCellDef="let row"><strong>{{ row.className }}</strong></td>
                  </ng-container>

                  <ng-container matColumnDef="total">
                    <th mat-header-cell *matHeaderCellDef>Total Students</th>
                    <td mat-cell *matCellDef="let row">{{ row.totalStudents }}</td>
                  </ng-container>

                  <ng-container matColumnDef="consented">
                    <th mat-header-cell *matHeaderCellDef>Consented</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="badge green-badge">{{ row.consentedCount }}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="pending">
                    <th mat-header-cell *matHeaderCellDef>Pending</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="badge amber-badge">{{ row.pendingCount }}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="withdrawn">
                    <th mat-header-cell *matHeaderCellDef>Withdrawn</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="badge red-badge">{{ row.withdrawnCount }}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="enrolled">
                    <th mat-header-cell *matHeaderCellDef>Enrolled in Face AI</th>
                    <td mat-cell *matCellDef="let row">
                      <span class="badge blue-badge">{{ row.enrolledCount }}</span>
                    </td>
                  </ng-container>

                  <ng-container matColumnDef="action">
                    <th mat-header-cell *matHeaderCellDef>Action</th>
                    <td mat-cell *matCellDef="let row">
                      <button mat-button color="primary" (click)="switchToClass(row.classId)">
                        View Roster
                      </button>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="summaryColumns"></tr>
                  <tr mat-row *matRowDef="let row; columns: summaryColumns;"></tr>
                </table>
              </div>
            </mat-card>
          </div>
        </mat-tab>
      </mat-tab-group>

      <!-- Record Consent Modal / Overlay -->
      <div class="modal-overlay" *ngIf="activeModal === 'record'">
        <div class="modal-card">
          <div class="modal-header">
            <h3>Record Face Attendance Consent</h3>
            <button mat-icon-button (click)="closeModal()"><mat-icon>close</mat-icon></button>
          </div>
          <div class="modal-body">
            <p>Recording consent for <strong>{{ targetStudent?.studentName }}</strong> (Roll No: {{ targetStudent?.rollNumber }})</p>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Consent Given By (Parent / Legal Guardian Name)</mat-label>
              <input matInput [(ngModel)]="guardianName" placeholder="e.g. John Doe (Father)">
            </mat-form-field>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Additional Notes / Verification Reference (Optional)</mat-label>
              <textarea matInput [(ngModel)]="consentNotes" rows="3" placeholder="e.g. Physical consent form signed on file"></textarea>
            </mat-form-field>
          </div>
          <div class="modal-footer">
            <button mat-button (click)="closeModal()">Cancel</button>
            <button mat-flat-button color="primary" [disabled]="!guardianName.trim() || isSubmitting" (click)="submitConsent()">
              <mat-icon>check</mat-icon>
              Confirm Consent
            </button>
          </div>
        </div>
      </div>

      <!-- Withdraw Consent Modal / Overlay -->
      <div class="modal-overlay" *ngIf="activeModal === 'withdraw'">
        <div class="modal-card withdraw-card">
          <div class="modal-header">
            <h3 class="danger-title">Withdraw Facial Consent</h3>
            <button mat-icon-button (click)="closeModal()"><mat-icon>close</mat-icon></button>
          </div>
          <div class="modal-body">
            <div class="alert-box">
              <mat-icon>warning</mat-icon>
              <div>
                <strong>Immediate Data Purge Warning:</strong>
                <p>Withdrawing consent will immediately and permanently delete all stored facial biometric embeddings for <strong>{{ targetStudent?.studentName }}</strong>. This student will no longer be matched by the facial recognition camera.</p>
              </div>
            </div>
            <mat-form-field appearance="outline" class="full-width">
              <mat-label>Reason for withdrawal (Optional)</mat-label>
              <textarea matInput [(ngModel)]="withdrawReason" rows="3" placeholder="e.g. Parental opt-out requested via email"></textarea>
            </mat-form-field>
          </div>
          <div class="modal-footer">
            <button mat-button (click)="closeModal()">Cancel</button>
            <button mat-flat-button color="warn" [disabled]="isSubmitting" (click)="submitWithdrawal()">
              <mat-icon>delete_forever</mat-icon>
              Withdraw & Purge Face Data
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .face-consent-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 24px 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .page-header h2 {
      margin: 0 0 4px 0;
      font-size: 1.5rem;
      font-weight: 700;
    }
    .subtitle {
      margin: 0;
      color: #64748b;
      font-size: 0.95rem;
    }
    .tab-content {
      padding-top: 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .filter-bar {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
      align-items: center;
    }
    .class-select {
      min-width: 260px;
    }
    .search-input {
      flex: 1;
      min-width: 260px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
      gap: 14px;
    }
    .stat-card {
      background: white;
      border-radius: 10px;
      padding: 16px;
      border: 1px solid #e2e8f0;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    }
    .stat-value {
      font-size: 1.8rem;
      font-weight: 700;
      color: #1e293b;
    }
    .stat-label {
      font-size: 0.85rem;
      color: #64748b;
      margin-top: 4px;
    }
    .green-stat { border-top: 4px solid #16a34a; }
    .amber-stat { border-top: 4px solid #f59e0b; }
    .red-stat { border-top: 4px solid #dc2626; }
    .blue-stat { border-top: 4px solid #2563eb; }
    .table-card {
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06);
    }
    .table-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      border-bottom: 1px solid #e2e8f0;
      flex-wrap: wrap;
      gap: 12px;
    }
    .table-title {
      font-size: 1.05rem;
      font-weight: 600;
      color: #1e293b;
    }
    .table-responsive {
      overflow-x: auto;
    }
    .roster-table {
      width: 100%;
    }
    .name-cell {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .primary-name {
      font-weight: 600;
    }
    .sec-badge {
      font-size: 0.75rem;
      background: #f1f5f9;
      color: #475569;
      padding: 2px 6px;
      border-radius: 4px;
    }
    .status-badge {
      display: inline-block;
      font-size: 0.78rem;
      font-weight: 600;
      padding: 4px 10px;
      border-radius: 12px;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .status-badge.consented {
      background: #dcfce7;
      color: #15803d;
    }
    .status-badge.pending {
      background: #fef3c7;
      color: #b45309;
    }
    .status-badge.withdrawn, .status-badge.declined {
      background: #fee2e2;
      color: #b91c1c;
    }
    .consent-meta {
      display: flex;
      flex-direction: column;
      font-size: 0.85rem;
    }
    .consent-meta small {
      color: #64748b;
    }
    .withdrawn-meta {
      color: #b91c1c;
    }
    .embedding-pill {
      display: inline-block;
      font-size: 0.82rem;
      padding: 3px 8px;
      border-radius: 6px;
      background: #f1f5f9;
      color: #64748b;
    }
    .embedding-pill.active-pill {
      background: #dbeafe;
      color: #1d4ed8;
      font-weight: 600;
    }
    .actions-cell {
      display: flex;
      align-items: center;
      gap: 6px;
      white-space: nowrap;
    }
    .loading-state, .empty-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 12px;
      padding: 60px 0;
      color: #64748b;
    }
    .badge {
      display: inline-block;
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.85rem;
      font-weight: 600;
    }
    .green-badge { background: #dcfce7; color: #15803d; }
    .amber-badge { background: #fef3c7; color: #b45309; }
    .red-badge { background: #fee2e2; color: #b91c1c; }
    .blue-badge { background: #dbeafe; color: #1d4ed8; }
    .modal-overlay {
      position: fixed;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(0,0,0,0.5);
      display: flex;
      align-items: center;
      justify-content: center;
      z-index: 1000;
      padding: 16px;
    }
    .modal-card {
      background: white;
      border-radius: 12px;
      max-width: 520px;
      width: 100%;
      padding: 20px;
      box-shadow: 0 10px 25px rgba(0,0,0,0.2);
    }
    .modal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
    }
    .modal-header h3 {
      margin: 0;
      font-size: 1.15rem;
      font-weight: 600;
    }
    .danger-title {
      color: #dc2626;
    }
    .alert-box {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 8px;
      padding: 12px;
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
      color: #991b1b;
      font-size: 0.88rem;
    }
    .alert-box mat-icon {
      color: #dc2626;
      flex-shrink: 0;
    }
    .modal-footer {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      margin-top: 16px;
    }
    .full-width {
      width: 100%;
    }
  `]
})
export class FaceConsentComponent implements OnInit {
  private academicService = inject(AcademicService);
  private faceService = inject(FaceAttendanceService);
  private snackBar = inject(MatSnackBar);

  classes: ClassItem[] = [];
  selectedClassId: number | null = null;

  students: StudentConsent[] = [];
  filteredStudents: StudentConsent[] = [];
  searchQuery = '';

  summaryList: ClassConsentSummary[] = [];

  loadingStudents = false;
  loadingSummary = false;
  isSubmitting = false;

  activeModal: 'record' | 'withdraw' | null = null;
  targetStudent: StudentConsent | null = null;
  guardianName = '';
  consentNotes = '';
  withdrawReason = '';

  displayedColumns: string[] = ['rollNumber', 'studentName', 'status', 'consentInfo', 'enrolled', 'actions'];
  summaryColumns: string[] = ['className', 'total', 'consented', 'pending', 'withdrawn', 'enrolled', 'action'];

  get consentedCount(): number {
    return this.students.filter(s => s.status === 'Consented').length;
  }

  get pendingCount(): number {
    return this.students.filter(s => s.status === 'Pending').length;
  }

  get withdrawnCount(): number {
    return this.students.filter(s => s.status === 'Withdrawn' || s.status === 'Declined').length;
  }

  get enrolledCount(): number {
    return this.students.filter(s => s.faceEmbeddingCount > 0).length;
  }

  ngOnInit(): void {
    this.loadAllData();
  }

  loadAllData(): void {
    this.loadClasses();
    this.loadSummary();
  }

  loadClasses(): void {
    this.academicService.getClasses().subscribe({
      next: (res) => {
        this.classes = res;
        if (this.classes.length > 0 && !this.selectedClassId) {
          const firstId = this.classes[0].id;
          this.selectedClassId = firstId;
          this.loadStudentsForClass(firstId);
        }
      },
      error: (err) => {
        this.snackBar.open('Failed to load classes', 'Close', { duration: 3000 });
      }
    });
  }

  loadSummary(): void {
    this.loadingSummary = true;
    this.faceService.getConsentSummary().subscribe({
      next: (res) => {
        this.summaryList = res;
        this.loadingSummary = false;
      },
      error: (err) => {
        this.loadingSummary = false;
      }
    });
  }

  onClassChange(classId: number): void {
    this.selectedClassId = classId;
    this.loadStudentsForClass(classId);
  }

  loadStudentsForClass(classId: number): void {
    this.loadingStudents = true;
    this.faceService.getClassConsents(classId).subscribe({
      next: (res) => {
        this.students = res;
        this.applyFilter();
        this.loadingStudents = false;
      },
      error: (err) => {
        this.loadingStudents = false;
        this.snackBar.open(err.error?.message || 'Failed to load students for class', 'Close', { duration: 3000 });
      }
    });
  }

  applyFilter(): void {
    const q = this.searchQuery.trim().toLowerCase();
    if (!q) {
      this.filteredStudents = [...this.students];
      return;
    }
    this.filteredStudents = this.students.filter(s =>
      s.studentName.toLowerCase().includes(q) ||
      s.rollNumber.toLowerCase().includes(q)
    );
  }

  switchToClass(classId: number): void {
    this.selectedClassId = classId;
    this.loadStudentsForClass(classId);
  }

  openRecordModal(student: StudentConsent): void {
    this.targetStudent = student;
    this.guardianName = student.consentGivenBy || '';
    this.consentNotes = student.notes || '';
    this.activeModal = 'record';
  }

  openWithdrawModal(student: StudentConsent): void {
    this.targetStudent = student;
    this.withdrawReason = '';
    this.activeModal = 'withdraw';
  }

  closeModal(): void {
    this.activeModal = null;
    this.targetStudent = null;
    this.guardianName = '';
    this.consentNotes = '';
    this.withdrawReason = '';
  }

  submitConsent(): void {
    if (!this.targetStudent || !this.guardianName.trim()) return;

    this.isSubmitting = true;
    this.faceService.recordConsent({
      studentId: this.targetStudent.studentId,
      consentGivenBy: this.guardianName.trim(),
      notes: this.consentNotes.trim()
    }).subscribe({
      next: (updated) => {
        this.isSubmitting = false;
        this.snackBar.open(`Consent recorded for ${updated.studentName}`, 'OK', { duration: 3000 });
        this.closeModal();
        if (this.selectedClassId) {
          this.loadStudentsForClass(this.selectedClassId);
          this.loadSummary();
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.snackBar.open(err.error?.message || 'Failed to record consent', 'Close', { duration: 4000 });
      }
    });
  }

  submitWithdrawal(): void {
    if (!this.targetStudent) return;

    this.isSubmitting = true;
    this.faceService.withdrawConsent({
      studentId: this.targetStudent.studentId,
      reason: this.withdrawReason.trim()
    }).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.snackBar.open(`Consent withdrawn and facial data purged for ${this.targetStudent?.studentName}`, 'OK', { duration: 4000 });
        this.closeModal();
        if (this.selectedClassId) {
          this.loadStudentsForClass(this.selectedClassId);
          this.loadSummary();
        }
      },
      error: (err) => {
        this.isSubmitting = false;
        this.snackBar.open(err.error?.message || 'Failed to withdraw consent', 'Close', { duration: 4000 });
      }
    });
  }

  deleteStudentFace(student: StudentConsent): void {
    if (!confirm(`Permanently delete stored face embeddings for ${student.studentName}?`)) {
      return;
    }

    this.faceService.deleteStudentFaceData(student.studentId).subscribe({
      next: (res) => {
        this.snackBar.open(res.message, 'OK', { duration: 3000 });
        if (this.selectedClassId) {
          this.loadStudentsForClass(this.selectedClassId);
          this.loadSummary();
        }
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Failed to delete student face data', 'Close', { duration: 4000 });
      }
    });
  }

  confirmDeleteClassData(): void {
    if (!this.selectedClassId) return;

    const selectedClass = this.classes.find(c => c.id === this.selectedClassId);
    const className = selectedClass?.name || 'this class';

    if (!confirm(`Permanently delete all face recognition embeddings for all students in ${className}?`)) {
      return;
    }

    this.faceService.deleteClassFaceData(this.selectedClassId).subscribe({
      next: (res) => {
        this.snackBar.open(res.message, 'OK', { duration: 4000 });
        if (this.selectedClassId) {
          this.loadStudentsForClass(this.selectedClassId);
          this.loadSummary();
        }
      },
      error: (err) => {
        this.snackBar.open(err.error?.message || 'Failed to delete class face data', 'Close', { duration: 4000 });
      }
    });
  }
}
