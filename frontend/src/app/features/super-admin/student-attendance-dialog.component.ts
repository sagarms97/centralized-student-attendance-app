import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { SuperAdminService } from '../../core/services/super-admin.service';
import { SuperAdminStudentAttendanceHistory } from '../../core/models/super-admin.models';

export interface StudentAttendanceDialogData {
  studentId: number;
  studentName?: string;
}

@Component({
  selector: 'app-student-attendance-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatProgressSpinnerModule,
    MatProgressBarModule
  ],
  template: `
    <div class="dialog-container">
      <div class="dialog-header">
        <div>
          <h2 mat-dialog-title class="m-0">Student Attendance Drill-Down</h2>
          @if (history(); as h) {
            <p class="subtitle m-0">
              <strong>{{ h.fullName }}</strong> (Roll: {{ h.rollNo }}) &bull; {{ h.className }} - Section {{ h.section }} &bull; <em>{{ h.instituteName }}</em>
            </p>
          }
        </div>
        <button mat-icon-button mat-dialog-close class="close-btn" aria-label="Close dialog">
          <mat-icon>close</mat-icon>
        </button>
      </div>

      <mat-dialog-content class="dialog-content">
        @if (loading()) {
          <div class="loading-state">
            <mat-spinner diameter="36"></mat-spinner>
            <p>Fetching student attendance history...</p>
          </div>
        } @else {
          @if (history(); as h) {
          <!-- Attendance Overview Stats -->
          <div class="stats-banner">
            <div class="pct-box">
              <span class="pct-num">{{ h.attendancePercentage }}%</span>
              <span class="pct-label">Overall Attendance</span>
            </div>

            <div class="stat-counts">
              <div class="count-pill bg-green">
                <strong>{{ h.presentSessions }}</strong>
                <span>Present</span>
              </div>
              <div class="count-pill bg-red">
                <strong>{{ h.absentSessions }}</strong>
                <span>Absent</span>
              </div>
              <div class="count-pill bg-yellow">
                <strong>{{ h.lateSessions }}</strong>
                <span>Late</span>
              </div>
              <div class="count-pill bg-purple">
                <strong>{{ h.onLeaveSessions }}</strong>
                <span>On Leave</span>
              </div>
              <div class="count-pill bg-blue">
                <strong>{{ h.totalSessions }}</strong>
                <span>Total</span>
              </div>
            </div>
          </div>

          <!-- History Records List -->
          <div class="records-section mt-3">
            <h4>Attendance Log ({{ h.records.length }} recorded sessions)</h4>

            @if (h.records.length === 0) {
              <div class="empty-records">
                <mat-icon>event_busy</mat-icon>
                <span>No attendance records found for this student.</span>
              </div>
            } @else {
              <div class="records-list">
                @for (r of h.records; track $index) {
                  <div class="record-item" [class.border-present]="r.status === 'Present'" [class.border-absent]="r.status === 'Absent'" [class.border-late]="r.status === 'Late'" [class.border-leave]="r.status === 'OnLeave'">
                    <div class="rec-date-col">
                      <span class="rec-date">{{ r.date }}</span>
                      <small class="rec-period">{{ r.periodName }} ({{ r.timeRange }})</small>
                    </div>

                    <div class="rec-subj-col">
                      <strong class="subj-name">{{ r.subjectName }}</strong>
                      <small class="staff-name"><mat-icon inline>person</mat-icon> {{ r.staffName }}</small>
                    </div>

                    <div class="rec-status-col">
                      <span class="status-chip" [ngClass]="getStatusClass(r.status)">
                        {{ r.status }}
                      </span>
                      @if (r.remarks) {
                        <small class="remarks-text">{{ r.remarks }}</small>
                      }
                    </div>
                  </div>
                }
              </div>
            }
          </div>
          }
        }
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button mat-dialog-close>Close</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .dialog-container {
      min-width: 320px;
      max-width: 680px;
    }
    .dialog-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      padding: 16px 20px 8px;
    }
    .dialog-header h2 {
      font-size: 20px;
      font-weight: 600;
    }
    .subtitle {
      font-size: 13px;
      color: #666;
      margin-top: 4px;
    }
    .dialog-content {
      max-height: 70vh;
      overflow-y: auto;
      padding: 12px 20px !important;
    }
    .loading-state {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 40px;
      color: #777;
    }
    .stats-banner {
      display: flex;
      align-items: center;
      gap: 20px;
      padding: 16px;
      background: #f8fafc;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      flex-wrap: wrap;
    }
    .pct-box {
      display: flex;
      flex-direction: column;
      align-items: center;
      min-width: 100px;
    }
    .pct-num {
      font-size: 28px;
      font-weight: 700;
      color: #1a237e;
    }
    .pct-label {
      font-size: 11px;
      color: #666;
      text-transform: uppercase;
    }
    .stat-counts {
      display: flex;
      gap: 8px;
      flex: 1;
      flex-wrap: wrap;
    }
    .count-pill {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 6px 12px;
      border-radius: 8px;
      min-width: 60px;
    }
    .count-pill strong { font-size: 16px; }
    .count-pill span { font-size: 10px; text-transform: uppercase; }
    .bg-green { background: #e8f5e9; color: #2e7d32; }
    .bg-red { background: #ffebee; color: #c62828; }
    .bg-yellow { background: #fff8e1; color: #f57f17; }
    .bg-purple { background: #f3e5f5; color: #7b1fa2; }
    .bg-blue { background: #e3f2fd; color: #1565c0; }

    .records-section h4 {
      margin: 0 0 10px;
      font-size: 14px;
      font-weight: 600;
      color: #444;
    }
    .empty-records {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 20px;
      background: #f9f9f9;
      border-radius: 8px;
      color: #888;
    }
    .records-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .record-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: #fff;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      flex-wrap: wrap;
      gap: 10px;
    }
    .border-present { border-left: 4px solid #4caf50; }
    .border-absent { border-left: 4px solid #f44336; }
    .border-late { border-left: 4px solid #ff9800; }
    .border-leave { border-left: 4px solid #9c27b0; }

    .rec-date-col {
      display: flex;
      flex-direction: column;
      min-width: 140px;
    }
    .rec-date { font-weight: 600; font-size: 13px; }
    .rec-period { font-size: 11px; color: #666; }

    .rec-subj-col {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 130px;
    }
    .subj-name { font-size: 13px; color: #333; }
    .staff-name { font-size: 11px; color: #777; display: flex; align-items: center; gap: 3px; }

    .rec-status-col {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
    }
    .status-chip {
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }
    .remarks-text {
      font-size: 11px;
      color: #666;
      font-style: italic;
    }
    .mt-3 { margin-top: 16px; }
  `]
})
export class StudentAttendanceDialogComponent implements OnInit {
  dialogRef = inject(MatDialogRef<StudentAttendanceDialogComponent>);
  data: StudentAttendanceDialogData = inject(MAT_DIALOG_DATA);
  private superAdminService = inject(SuperAdminService);

  loading = signal(true);
  history = signal<SuperAdminStudentAttendanceHistory | null>(null);

  ngOnInit(): void {
    this.superAdminService.getStudentAttendanceHistory(this.data.studentId).subscribe({
      next: (res) => {
        this.history.set(res);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Present': return 'bg-green';
      case 'Absent': return 'bg-red';
      case 'Late': return 'bg-yellow';
      case 'OnLeave': return 'bg-purple';
      default: return 'bg-blue';
    }
  }
}
