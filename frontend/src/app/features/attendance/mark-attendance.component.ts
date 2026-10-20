import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRadioModule } from '@angular/material/radio';
import { AttendanceService } from '../../core/services/attendance.service';
import { AuthService } from '../../core/services/auth.service';
import { StaffDailyScheduleItem, AttendanceSheet, StudentAttendanceItem } from '../../core/models/attendance.models';

@Component({
  selector: 'app-mark-attendance',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatTableModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatRadioModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Daily Attendance Marking</h1>
          <p class="subtitle">Record student attendance for assigned periods</p>
        </div>

        <div class="date-picker-box">
          <mat-form-field appearance="outline" class="date-field">
            <mat-label>Selected Date</mat-label>
            <input matInput type="date" [(ngModel)]="selectedDate" (change)="onDateChange()">
          </mat-form-field>
          <button mat-stroked-button (click)="setToday()">
            <mat-icon>today</mat-icon> Today
          </button>
        </div>
      </div>

      <!-- Schedule Cards for Today -->
      <div class="schedule-section">
        <h2>Your Periods for {{ selectedDate }}</h2>

        @if (schedule().length === 0) {
          <mat-card class="empty-card">
            <mat-card-content>
              <mat-icon class="empty-icon">event_available</mat-icon>
              <h3>No Teaching Slots Scheduled</h3>
              <p>You have no periods assigned on this day.</p>
            </mat-card-content>
          </mat-card>
        } @else {
          <div class="cards-grid">
            @for (slot of schedule(); track slot.timetableEntryId) {
              <mat-card class="period-slot-card"
                        [class.selected-card]="selectedSlot()?.timetableEntryId === slot.timetableEntryId"
                        (click)="selectSlot(slot)">
                <mat-card-content>
                  <div class="card-top">
                    <span class="period-tag">{{ slot.periodName }}</span>
                    <span class="time-tag">{{ slot.timeRange }}</span>
                  </div>

                  <h3 class="subject-title">{{ slot.subjectName }}</h3>
                  <div class="class-title">{{ slot.className }} - Section {{ slot.section }}</div>

                  @if (slot.isSubstitutedForMe) {
                    <div class="sub-alert sub-for-me">
                      <mat-icon>swap_horiz</mat-icon>
                      <span>Subbing for Prof. {{ slot.substituteStaffName }}</span>
                    </div>
                  }

                  @if (slot.isHandedOverToOther) {
                    <div class="sub-alert handed-over">
                      <mat-icon>handshake</mat-icon>
                      <span>Covered by Prof. {{ slot.substituteStaffName }}</span>
                    </div>
                  }

                  <div class="card-bottom">
                    @if (slot.isAttendanceMarked) {
                      <div class="status-summary marked">
                        <mat-icon>check_circle</mat-icon>
                        <span>Marked ({{ slot.presentCount }}/{{ slot.totalStudents }} Present)</span>
                      </div>
                    } @else {
                      <div class="status-summary pending">
                        <mat-icon>pending</mat-icon>
                        <span>Pending Attendance</span>
                      </div>
                    }
                  </div>
                </mat-card-content>
              </mat-card>
            }
          </div>
        }
      </div>

      <!-- Detailed Attendance Sheet Form -->
      @if (activeSheet(); as sheet) {
        <mat-card class="sheet-card mt-4">
          <div class="sheet-header">
            <div class="sheet-title-info">
              <h2>{{ sheet.className }} Section {{ sheet.section }} - {{ sheet.subjectName }}</h2>
              <span class="sheet-meta">Date: {{ sheet.date }} | {{ sheet.periodName }}</span>
            </div>

            <div class="sheet-actions">
              @if (sheet.isEditable) {
                <button mat-stroked-button color="primary" (click)="markAllPresent()">
                  <mat-icon>done_all</mat-icon> Mark All Present
                </button>
                <button mat-flat-button color="primary" [disabled]="isSubmitting()" (click)="submitAttendance()">
                  <mat-icon>save</mat-icon>
                  <span>{{ isSubmitting() ? 'Submitting...' : 'Submit Attendance' }}</span>
                </button>
              } @else {
                <div class="locked-badge">
                  <mat-icon>lock</mat-icon> Locked (Past date or view-only)
                </div>
              }
            </div>
          </div>

          <div class="summary-chips">
            <div class="chip chip-present">Present: {{ countByStatus('Present') }}</div>
            <div class="chip chip-absent">Absent: {{ countByStatus('Absent') }}</div>
            <div class="chip chip-late">Late: {{ countByStatus('Late') }}</div>
            <div class="chip chip-total">Total: {{ sheet.students.length }}</div>
          </div>

          <table mat-table [dataSource]="sheet.students" class="attendance-table">
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

            <!-- Status Selector -->
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Attendance Status</th>
              <td mat-cell *matCellDef="let s">
                <div class="status-btn-group">
                  <button type="button"
                          class="status-btn btn-present"
                          [class.active]="s.status === 'Present'"
                          [disabled]="!sheet.isEditable"
                          (click)="s.status = 'Present'">
                    <mat-icon>check</mat-icon> Present
                  </button>
                  <button type="button"
                          class="status-btn btn-absent"
                          [class.active]="s.status === 'Absent'"
                          [disabled]="!sheet.isEditable"
                          (click)="s.status = 'Absent'">
                    <mat-icon>close</mat-icon> Absent
                  </button>
                  <button type="button"
                          class="status-btn btn-late"
                          [class.active]="s.status === 'Late'"
                          [disabled]="!sheet.isEditable"
                          (click)="s.status = 'Late'">
                    <mat-icon>alarm</mat-icon> Late
                  </button>
                </div>
              </td>
            </ng-container>

            <!-- Remarks -->
            <ng-container matColumnDef="remarks">
              <th mat-header-cell *matHeaderCellDef>Remarks</th>
              <td mat-cell *matCellDef="let s">
                <input type="text"
                       class="remarks-input"
                       [(ngModel)]="s.remarks"
                       [disabled]="!sheet.isEditable"
                       placeholder="Optional remarks...">
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="columns"></tr>
            <tr mat-row *matRowDef="let row; columns: columns;" [class.absent-row]="row.status === 'Absent'"></tr>
          </table>
        </mat-card>
      }
    </div>
  `,
  styles: [`
    .subtitle { color: #666; margin: 4px 0 0 0; }
    .date-picker-box {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .date-field { margin-bottom: -1.25em; width: 170px; }
    .schedule-section {
      margin-top: 20px;
      h2 { font-size: 1.25rem; color: #1a237e; margin-bottom: 16px; }
    }
    .cards-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
      gap: 16px;
    }
    .period-slot-card {
      border-radius: 12px;
      cursor: pointer;
      border: 2px solid transparent;
      transition: all 0.2s ease;
      &:hover { border-color: #7986cb; transform: translateY(-2px); }
      &.selected-card { border-color: #1a237e; background: #f8fafc; }
    }
    .card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .period-tag {
      background: #1a237e;
      color: white;
      padding: 3px 8px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 700;
    }
    .time-tag { font-size: 0.8rem; color: #64748b; }
    .subject-title { margin: 4px 0; color: #1e293b; font-size: 1.1rem; }
    .class-title { font-weight: 500; color: #00796b; font-size: 0.9rem; margin-bottom: 12px; }
    .sub-alert {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 4px 8px;
      border-radius: 6px;
      font-size: 0.75rem;
      font-weight: 600;
      margin-bottom: 10px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &.sub-for-me { background: #dcfce7; color: #15803d; }
      &.handed-over { background: #fee2e2; color: #b91c1c; }
    }
    .card-bottom {
      border-top: 1px solid #f1f5f9;
      padding-top: 10px;
    }
    .status-summary {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
      &.marked { color: #16a34a; }
      &.pending { color: #ea580c; }
    }
    .sheet-card {
      border-radius: 12px;
      padding: 24px;
    }
    .sheet-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
      margin-bottom: 16px;
      h2 { margin: 0; color: #1a237e; }
      .sheet-meta { color: #64748b; font-size: 0.9rem; }
    }
    .sheet-actions { display: flex; gap: 12px; align-items: center; }
    .locked-badge {
      display: flex;
      align-items: center;
      gap: 6px;
      background: #f1f5f9;
      color: #64748b;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.85rem;
      font-weight: 500;
    }
    .summary-chips {
      display: flex;
      gap: 12px;
      margin-bottom: 16px;
    }
    .chip {
      padding: 4px 12px;
      border-radius: 16px;
      font-size: 0.8rem;
      font-weight: 700;
      &.chip-present { background: #dcfce7; color: #15803d; }
      &.chip-absent { background: #fee2e2; color: #b91c1c; }
      &.chip-late { background: #fef3c7; color: #b45309; }
      &.chip-total { background: #e2e8f0; color: #334155; }
    }
    .attendance-table { width: 100%; }
    .roll-pill { font-family: monospace; font-weight: 700; color: #1a237e; background: #e8eaf6; padding: 2px 6px; border-radius: 4px; }
    .status-btn-group { display: flex; gap: 6px; }
    .status-btn {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: 1px solid #cbd5e1;
      background: white;
      padding: 6px 12px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 0.8rem;
      font-weight: 600;
      color: #64748b;
      transition: all 0.15s;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }

      &.btn-present.active { background: #22c55e; color: white; border-color: #16a34a; }
      &.btn-absent.active { background: #ef4444; color: white; border-color: #dc2626; }
      &.btn-late.active { background: #f59e0b; color: white; border-color: #d97706; }
    }
    .remarks-input {
      border: 1px solid #cbd5e1;
      border-radius: 6px;
      padding: 6px 10px;
      width: 100%;
      max-width: 250px;
      font-size: 0.85rem;
    }
    .absent-row { background: #fff5f5; }
    .empty-card { text-align: center; padding: 36px; border-radius: 12px; }
    .empty-icon { font-size: 48px; width: 48px; height: 48px; color: #cbd5e1; }
    .mt-4 { margin-top: 24px; }
  `]
})
export class MarkAttendanceComponent implements OnInit {
  authService = inject(AuthService);
  private attendanceService = inject(AttendanceService);
  private snackBar = inject(MatSnackBar);

  selectedDate: string = new Date().toISOString().substring(0, 10);
  schedule = signal<StaffDailyScheduleItem[]>([]);
  selectedSlot = signal<StaffDailyScheduleItem | null>(null);
  activeSheet = signal<AttendanceSheet | null>(null);
  isSubmitting = signal(false);

  columns = ['rollNo', 'name', 'status', 'remarks'];

  ngOnInit(): void {
    this.loadDailySchedule();
  }

  setToday(): void {
    this.selectedDate = new Date().toISOString().substring(0, 10);
    this.loadDailySchedule();
  }

  onDateChange(): void {
    this.loadDailySchedule();
  }

  loadDailySchedule(): void {
    this.attendanceService.getMySchedule(this.selectedDate).subscribe({
      next: (slots) => {
        this.schedule.set(slots);
        if (slots.length > 0) {
          this.selectSlot(slots[0]);
        } else {
          this.activeSheet.set(null);
          this.selectedSlot.set(null);
        }
      },
      error: () => this.snackBar.open('Failed to load schedule', 'Close', { duration: 3000 })
    });
  }

  selectSlot(slot: StaffDailyScheduleItem): void {
    this.selectedSlot.set(slot);
    this.attendanceService.getAttendanceSheet(slot.timetableEntryId, this.selectedDate).subscribe({
      next: (sheet) => this.activeSheet.set(sheet),
      error: () => this.snackBar.open('Failed to load attendance sheet', 'Close', { duration: 3000 })
    });
  }

  markAllPresent(): void {
    const sheet = this.activeSheet();
    if (!sheet) return;
    sheet.students.forEach(s => s.status = 'Present');
  }

  countByStatus(status: 'Present' | 'Absent' | 'Late'): number {
    return this.activeSheet()?.students.filter(s => s.status === status).length || 0;
  }

  submitAttendance(): void {
    const sheet = this.activeSheet();
    if (!sheet) return;

    this.isSubmitting.set(true);
    this.attendanceService.submitAttendance({
      timetableEntryId: sheet.timetableEntryId,
      periodId: sheet.periodId,
      date: sheet.date,
      records: sheet.students
    }).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.snackBar.open(res.message || 'Attendance saved successfully!', 'Close', { duration: 3000 });
        this.loadDailySchedule();
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.snackBar.open(err.error?.message || 'Failed to submit attendance', 'Close', { duration: 4000 });
      }
    });
  }
}
