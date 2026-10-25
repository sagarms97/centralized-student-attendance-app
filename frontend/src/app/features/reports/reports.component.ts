import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatSliderModule } from '@angular/material/slider';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ReportService } from '../../core/services/report.service';
import { AcademicService } from '../../core/services/academic.service';
import { ClassItem, SubjectItem } from '../../core/models/academic.models';
import { StudentAttendanceSummary, DailyAttendanceReportItem, ClassSummary } from '../../core/models/report.models';

@Component({
  selector: 'app-reports',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatTabsModule,
    MatTableModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatSliderModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatTooltipModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Attendance Reports & Analytics</h1>
          <p class="subtitle">Comprehensive attendance summaries, defaulter lists, and exports</p>
        </div>
        <div class="export-actions">
          <button mat-stroked-button color="primary" (click)="exportToExcel()">
            <mat-icon>table_view</mat-icon> Export to Excel
          </button>
          <button mat-flat-button color="primary" (click)="exportToPdf()">
            <mat-icon>picture_as_pdf</mat-icon> Export Report (PDF)
          </button>
        </div>
      </div>

      <!-- Filters Bar -->
      <mat-card class="filter-card">
        <mat-card-content class="filter-row">
          <mat-form-field appearance="outline" class="filter-item">
            <mat-label>Class</mat-label>
            <mat-select [(ngModel)]="selectedClassId" (selectionChange)="onFilterChanged()">
              <mat-option [value]="null">All Classes</mat-option>
              @for (c of classes(); track c.id) {
                <mat-option [value]="c.id">{{ c.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-item">
            <mat-label>Section</mat-label>
            <mat-select [(ngModel)]="selectedSection" (selectionChange)="onFilterChanged()">
              <mat-option value="">All Sections</mat-option>
              <mat-option value="A">Section A</mat-option>
              <mat-option value="B">Section B</mat-option>
              <mat-option value="C">Section C</mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-item">
            <mat-label>Subject</mat-label>
            <mat-select [(ngModel)]="selectedSubjectId" (selectionChange)="onFilterChanged()">
              <mat-option [value]="null">All Subjects</mat-option>
              @for (s of subjects(); track s.id) {
                <mat-option [value]="s.id">{{ s.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <div class="threshold-slider-box">
            <div class="slider-header">
              <span>Defaulter Cutoff:</span>
              <strong>{{ defaulterThreshold }}%</strong>
            </div>
            <mat-slider min="40" max="95" step="5" discrete>
              <input matSliderThumb [(ngModel)]="defaulterThreshold" (change)="onFilterChanged()">
            </mat-slider>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Reports Tabs -->
      <mat-card class="tabs-card mt-3">
        <mat-tab-group>
          <!-- Tab 1: Student Wise & Defaulters -->
          <mat-tab>
            <ng-template matTabLabel>
              <mat-icon class="tab-icon">person_search</mat-icon>
              <span>Student Attendance & Defaulters</span>
            </ng-template>

            <div class="tab-body">
              <div class="metrics-summary">
                <div class="metric-box bg-light">
                  <span class="m-val">{{ studentSummaries().length }}</span>
                  <span class="m-lbl">Evaluated Students</span>
                </div>
                <div class="metric-box bg-red">
                  <span class="m-val">{{ defaultersCount() }}</span>
                  <span class="m-lbl">Defaulters (&lt; {{ defaulterThreshold }}%)</span>
                </div>
              </div>

              <table mat-table [dataSource]="studentSummaries()" class="full-width">
                <!-- Roll No -->
                <ng-container matColumnDef="rollNo">
                  <th mat-header-cell *matHeaderCellDef>Roll No</th>
                  <td mat-cell *matCellDef="let s">
                    <span class="roll-pill">{{ s.rollNo }}</span>
                  </td>
                </ng-container>

                <!-- Name -->
                <ng-container matColumnDef="name">
                  <th mat-header-cell *matHeaderCellDef>Student Name</th>
                  <td mat-cell *matCellDef="let s">
                    <strong>{{ s.fullName }}</strong>
                  </td>
                </ng-container>

                <!-- Class -->
                <ng-container matColumnDef="class">
                  <th mat-header-cell *matHeaderCellDef>Class & Section</th>
                  <td mat-cell *matCellDef="let s">{{ s.className }} - {{ s.section }}</td>
                </ng-container>

                <!-- Conducted -->
                <ng-container matColumnDef="total">
                  <th mat-header-cell *matHeaderCellDef>Total Sessions</th>
                  <td mat-cell *matCellDef="let s">{{ s.totalSessions }}</td>
                </ng-container>

                <!-- Present -->
                <ng-container matColumnDef="present">
                  <th mat-header-cell *matHeaderCellDef>Present</th>
                  <td mat-cell *matCellDef="let s">
                    <span class="badge-count badge-present">{{ s.presentSessions }}</span>
                  </td>
                </ng-container>

                <!-- Absent -->
                <ng-container matColumnDef="absent">
                  <th mat-header-cell *matHeaderCellDef>Absent</th>
                  <td mat-cell *matCellDef="let s">
                    <span class="badge-count badge-absent">{{ s.absentSessions }}</span>
                  </td>
                </ng-container>

                <!-- Source Breakdown -->
                <ng-container matColumnDef="sourceBreakdown">
                  <th mat-header-cell *matHeaderCellDef>Source Breakdown</th>
                  <td mat-cell *matCellDef="let s">
                    <div class="source-pills">
                      <span class="pill-face" *ngIf="(s.faceVerifiedSessions || 0) > 0" [matTooltip]="(s.faceVerifiedSessions || 0) + ' sessions verified by Face Recognition'">
                        <mat-icon class="source-mini-icon">face</mat-icon> {{ s.faceVerifiedSessions }} Face
                      </span>
                      <span class="pill-manual" *ngIf="(s.manualSessions || 0) > 0" [matTooltip]="(s.manualSessions || 0) + ' sessions marked manually'">
                        <mat-icon class="source-mini-icon">edit</mat-icon> {{ s.manualSessions }} Manual
                      </span>
                      <span *ngIf="!s.faceVerifiedSessions && !s.manualSessions" class="text-muted">-</span>
                    </div>
                  </td>
                </ng-container>

                <!-- Percentage -->
                <ng-container matColumnDef="percentage">
                  <th mat-header-cell *matHeaderCellDef>Attendance %</th>
                  <td mat-cell *matCellDef="let s">
                    <div class="percent-cell">
                      <strong [class.text-danger]="s.isDefaulter">{{ s.attendancePercentage }}%</strong>
                      <mat-progress-bar mode="determinate"
                                        [value]="s.attendancePercentage"
                                        [class.warn-bar]="s.isDefaulter"
                                        class="percent-bar">
                      </mat-progress-bar>
                    </div>
                  </td>
                </ng-container>

                <!-- Status -->
                <ng-container matColumnDef="status">
                  <th mat-header-cell *matHeaderCellDef>Standing</th>
                  <td mat-cell *matCellDef="let s">
                    @if (s.isDefaulter) {
                      <span class="badge badge-absent" matTooltip="Below required {{ defaulterThreshold }}% attendance">
                        <mat-icon class="badge-icon">warning</mat-icon> DEFAULTER
                      </span>
                    } @else {
                      <span class="badge badge-approved">
                        <mat-icon class="badge-icon">check_circle</mat-icon> Good Standing
                      </span>
                    }
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="studentColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: studentColumns;" [class.defaulter-row]="row.isDefaulter"></tr>

                <tr class="mat-row" *matNoDataRow>
                  <td class="mat-cell empty-state" colspan="9">
                    <p>No student attendance records found for criteria.</p>
                  </td>
                </tr>
              </table>
            </div>
          </mat-tab>

          <!-- Tab 2: Daily Conducted Sessions Breakdown -->
          <mat-tab>
            <ng-template matTabLabel>
              <mat-icon class="tab-icon">event_note</mat-icon>
              <span>Daily Class Sessions</span>
            </ng-template>

            <div class="tab-body">
              <table mat-table [dataSource]="dailyReports()" class="full-width">
                <ng-container matColumnDef="date">
                  <th mat-header-cell *matHeaderCellDef>Date</th>
                  <td mat-cell *matCellDef="let d">{{ d.date }}</td>
                </ng-container>

                <ng-container matColumnDef="class">
                  <th mat-header-cell *matHeaderCellDef>Class & Section</th>
                  <td mat-cell *matCellDef="let d">{{ d.className }} - {{ d.section }}</td>
                </ng-container>

                <ng-container matColumnDef="period">
                  <th mat-header-cell *matHeaderCellDef>Period</th>
                  <td mat-cell *matCellDef="let d"><strong>{{ d.periodName }}</strong></td>
                </ng-container>

                <ng-container matColumnDef="subject">
                  <th mat-header-cell *matHeaderCellDef>Subject</th>
                  <td mat-cell *matCellDef="let d">{{ d.subjectName }}</td>
                </ng-container>

                <ng-container matColumnDef="staff">
                  <th mat-header-cell *matHeaderCellDef>Faculty</th>
                  <td mat-cell *matCellDef="let d">{{ d.staffName }}</td>
                </ng-container>

                <ng-container matColumnDef="source">
                  <th mat-header-cell *matHeaderCellDef>Source</th>
                  <td mat-cell *matCellDef="let d">
                    @if (d.source === 'Face') {
                      <span class="badge-source-face" [matTooltip]="'100% Face Verified' + (d.averageFaceConfidence ? ' (' + d.averageFaceConfidence + '% avg confidence)' : '')">
                        <mat-icon class="source-mini-icon">face</mat-icon> Face
                      </span>
                    } @else if (d.source === 'Mixed') {
                      <span class="badge-source-mixed" [matTooltip]="d.faceVerifiedCount + ' via Face, ' + d.manualCount + ' Manual'">
                        <mat-icon class="source-mini-icon">hub</mat-icon> Mixed
                      </span>
                    } @else {
                      <span class="badge-source-manual">
                        <mat-icon class="source-mini-icon">edit</mat-icon> Manual
                      </span>
                    }
                  </td>
                </ng-container>

                <ng-container matColumnDef="turnout">
                  <th mat-header-cell *matHeaderCellDef>Present / Total</th>
                  <td mat-cell *matCellDef="let d">{{ d.presentCount }} / {{ d.totalStudents }}</td>
                </ng-container>

                <ng-container matColumnDef="percentage">
                  <th mat-header-cell *matHeaderCellDef>Turnout %</th>
                  <td mat-cell *matCellDef="let d">
                    <strong>{{ d.attendancePercentage }}%</strong>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="dailyColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: dailyColumns;"></tr>

                <tr class="mat-row" *matNoDataRow>
                  <td class="mat-cell empty-state" colspan="8">
                    <p>No conducted sessions found.</p>
                  </td>
                </tr>
              </table>
            </div>
          </mat-tab>

          <!-- Tab 3: Class Summary -->
          <mat-tab>
            <ng-template matTabLabel>
              <mat-icon class="tab-icon">bar_chart</mat-icon>
              <span>Class Overall Summary</span>
            </ng-template>

            <div class="tab-body">
              <table mat-table [dataSource]="classSummaries()" class="full-width">
                <ng-container matColumnDef="className">
                  <th mat-header-cell *matHeaderCellDef>Class</th>
                  <td mat-cell *matCellDef="let c"><strong>{{ c.className }}</strong></td>
                </ng-container>

                <ng-container matColumnDef="section">
                  <th mat-header-cell *matHeaderCellDef>Section</th>
                  <td mat-cell *matCellDef="let c">Section {{ c.section }}</td>
                </ng-container>

                <ng-container matColumnDef="enrolled">
                  <th mat-header-cell *matHeaderCellDef>Enrolled Students</th>
                  <td mat-cell *matCellDef="let c">{{ c.totalEnrolled }}</td>
                </ng-container>

                <ng-container matColumnDef="sessions">
                  <th mat-header-cell *matHeaderCellDef>Conducted Sessions</th>
                  <td mat-cell *matCellDef="let c">{{ c.totalSessionsConducted }}</td>
                </ng-container>

                <ng-container matColumnDef="average">
                  <th mat-header-cell *matHeaderCellDef>Average Attendance %</th>
                  <td mat-cell *matCellDef="let c">
                    <strong>{{ c.averageAttendancePercentage }}%</strong>
                  </td>
                </ng-container>

                <tr mat-header-row *matHeaderRowDef="classColumns"></tr>
                <tr mat-row *matRowDef="let row; columns: classColumns;"></tr>
              </table>
            </div>
          </mat-tab>
        </mat-tab-group>
      </mat-card>
    </div>
  `,
  styles: [`
    .subtitle { color: #666; margin: 4px 0 0 0; }
    .export-actions { display: flex; gap: 12px; }
    .filter-card { border-radius: 12px; }
    .filter-row {
      display: flex;
      gap: 16px;
      align-items: center;
      padding: 12px 16px !important;
      flex-wrap: wrap;
    }
    .filter-item { min-width: 170px; margin-bottom: -1.25em; }
    .threshold-slider-box {
      display: flex;
      flex-direction: column;
      min-width: 200px;
      .slider-header {
        display: flex;
        justify-content: space-between;
        font-size: 0.8rem;
        color: #334155;
      }
    }
    .tabs-card { border-radius: 12px; overflow: hidden; }
    .tab-icon { margin-right: 6px; font-size: 18px; width: 18px; height: 18px; }
    .tab-body { padding: 20px; }
    .metrics-summary {
      display: flex;
      gap: 16px;
      margin-bottom: 20px;
    }
    .metric-box {
      padding: 12px 20px;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      .m-val { font-size: 1.5rem; font-weight: 700; }
      .m-lbl { font-size: 0.8rem; }
      &.bg-light { background: #f1f5f9; color: #1e293b; }
      &.bg-red { background: #fee2e2; color: #b91c1c; }
    }
    .full-width { width: 100%; }
    .roll-pill { font-family: monospace; font-weight: 700; color: #1a237e; background: #e8eaf6; padding: 2px 6px; border-radius: 4px; }
    .badge-count {
      padding: 2px 8px;
      border-radius: 10px;
      font-size: 0.8rem;
      font-weight: 700;
    }
    .percent-cell {
      display: flex;
      flex-direction: column;
      gap: 4px;
      min-width: 100px;
    }
    .percent-bar { height: 6px; border-radius: 3px; }
    .warn-bar { --mdc-linear-progress-active-indicator-color: #ef4444; }
    .text-danger { color: #dc2626; }
    .defaulter-row { background: #fff5f5; }
    .badge-icon { font-size: 14px; width: 14px; height: 14px; margin-right: 4px; }
    .mt-3 { margin-top: 16px; }
    .empty-state { text-align: center; padding: 36px; color: #94a3b8; }
    .source-pills { display: flex; gap: 4px; flex-wrap: wrap; }
    .pill-face {
      background: #ede9fe;
      color: #6d28d9;
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .pill-manual {
      background: #f1f5f9;
      color: #475569;
      font-size: 0.75rem;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 500;
      display: inline-flex;
      align-items: center;
      gap: 3px;
    }
    .badge-source-face {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 12px;
      background: #ede9fe;
      color: #6d28d9;
      font-weight: 600;
      font-size: 0.8rem;
    }
    .badge-source-mixed {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 12px;
      background: #fef3c7;
      color: #b45309;
      font-weight: 600;
      font-size: 0.8rem;
    }
    .badge-source-manual {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 4px 10px;
      border-radius: 12px;
      background: #f1f5f9;
      color: #64748b;
      font-weight: 500;
      font-size: 0.8rem;
    }
    .source-mini-icon { font-size: 13px; width: 13px; height: 13px; }
  `]
})
export class ReportsComponent implements OnInit {
  private reportService = inject(ReportService);
  private academicService = inject(AcademicService);
  private snackBar = inject(MatSnackBar);

  classes = signal<ClassItem[]>([]);
  subjects = signal<SubjectItem[]>([]);

  selectedClassId: number | null = null;
  selectedSection = '';
  selectedSubjectId: number | null = null;
  defaulterThreshold = 75;

  studentColumns = ['rollNo', 'name', 'class', 'total', 'present', 'absent', 'sourceBreakdown', 'percentage', 'status'];
  dailyColumns = ['date', 'class', 'period', 'subject', 'staff', 'source', 'turnout', 'percentage'];
  classColumns = ['className', 'section', 'enrolled', 'sessions', 'average'];

  studentSummaries = signal<StudentAttendanceSummary[]>([]);
  dailyReports = signal<DailyAttendanceReportItem[]>([]);
  classSummaries = signal<ClassSummary[]>([]);

  ngOnInit(): void {
    this.academicService.getClasses().subscribe(res => this.classes.set(res));
    this.academicService.getSubjects().subscribe(res => this.subjects.set(res));
    this.loadAllReports();
  }

  onFilterChanged(): void {
    this.loadAllReports();
  }

  loadAllReports(): void {
    this.reportService.getStudentReport({
      classId: this.selectedClassId || undefined,
      section: this.selectedSection || undefined,
      subjectId: this.selectedSubjectId || undefined,
      defaulterThreshold: this.defaulterThreshold
    }).subscribe(res => this.studentSummaries.set(res));

    this.reportService.getDailyReport({
      classId: this.selectedClassId || undefined,
      subjectId: this.selectedSubjectId || undefined
    }).subscribe(res => this.dailyReports.set(res));

    this.reportService.getClassSummary().subscribe(res => this.classSummaries.set(res));
  }

  defaultersCount(): number {
    return this.studentSummaries().filter(s => s.isDefaulter).length;
  }

  exportToExcel(): void {
    this.reportService.exportExcel(this.selectedClassId || undefined, this.selectedSection || undefined, this.defaulterThreshold).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Student_Attendance_Report_${new Date().toISOString().substring(0, 10)}.xlsx`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.snackBar.open('Excel export failed', 'Close', { duration: 3000 })
    });
  }

  exportToPdf(): void {
    this.reportService.exportPdf(this.selectedClassId || undefined, this.selectedSection || undefined, this.defaulterThreshold).subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `Student_Attendance_Report_${new Date().toISOString().substring(0, 10)}.html`;
        a.click();
        window.URL.revokeObjectURL(url);
      },
      error: () => this.snackBar.open('PDF / Report export failed', 'Close', { duration: 3000 })
    });
  }
}
