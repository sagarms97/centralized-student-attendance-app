import { Component, inject, OnInit, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatTabsModule } from '@angular/material/tabs';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTableModule } from '@angular/material/table';
import { MatDividerModule } from '@angular/material/divider';
import { LeaveService } from '../../core/services/leave.service';
import { AuthService } from '../../core/services/auth.service';
import {
  ParentChildOverview,
  ChildMonthlyCalendar,
  ChildDailyAttendance,
  LeaveRequestItem
} from '../../core/models/leave.models';
import { SubmitLeaveDialogComponent } from './submit-leave-dialog.component';

@Component({
  selector: 'app-parent-portal',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatProgressBarModule,
    MatTabsModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTableModule,
    MatDividerModule
  ],
  template: `
    <div class="parent-portal-container">
      <!-- Portal Top Header -->
      <div class="portal-header">
        <div>
          <div class="title-row">
            <mat-icon class="portal-icon">family_restroom</mat-icon>
            <h1>Parent Portal</h1>
          </div>
          <p class="subtitle">Monitor your child's attendance records, calendar, and manage leave requests</p>
        </div>

        <div class="header-actions">
          <button mat-flat-button color="primary" (click)="openSubmitLeaveDialog()" [disabled]="children().length === 0">
            <mat-icon>add_circle</mat-icon>
            <span>Request Leave</span>
          </button>
        </div>
      </div>

      <!-- Loading Spinner -->
      @if (loadingChildren()) {
        <div class="loading-state">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading children profiles...</p>
        </div>
      } @else if (children().length === 0) {
        <mat-card class="empty-card">
          <mat-card-content class="text-center">
            <mat-icon class="empty-icon">child_care</mat-icon>
            <h3>No Linked Children Found</h3>
            <p>Your parent account is active, but no student records are linked to your profile yet.</p>
            <p>Please contact your institute administrator to link your child to your account.</p>
          </mat-card-content>
        </mat-card>
      } @else {
        <!-- Children Switcher Chips -->
        @if (children().length > 1) {
          <div class="children-selector">
            <span class="selector-label">Select Child:</span>
            <div class="chips-row">
              @for (child of children(); track child.studentId) {
                <button
                  type="button"
                  class="child-chip"
                  [class.active-chip]="selectedChild()?.studentId === child.studentId"
                  (click)="selectChild(child)">
                  <mat-icon class="chip-avatar-icon">face</mat-icon>
                  <span class="chip-name">{{ child.fullName }}</span>
                  <span class="chip-class">{{ child.className }}-{{ child.section }}</span>
                </button>
              }
            </div>
          </div>
        }

        <!-- Active Child Profile Hero Card -->
        @if (selectedChild(); as child) {
          <mat-card class="child-hero-card">
            <mat-card-content class="hero-content">
              <div class="child-avatar-col">
                <div class="child-avatar">
                  {{ getInitials(child.fullName) }}
                </div>
              </div>

              <div class="child-info-col">
                <div class="name-status-row">
                  <h2>{{ child.fullName }}</h2>
                  <span class="relationship-badge">{{ child.relationship }}</span>
                  <span class="status-badge" [ngClass]="getStatusBadgeClass(child.todayStatus)">
                    Today: {{ child.todayStatus || 'Not Marked' }}
                  </span>
                </div>

                <div class="meta-row">
                  <span class="meta-item"><mat-icon>badge</mat-icon> Roll No: <strong>{{ child.rollNo }}</strong></span>
                  <span class="meta-item"><mat-icon>school</mat-icon> Class: <strong>{{ child.className }} (Section {{ child.section }})</strong></span>
                </div>

                <div class="attendance-progress-row">
                  <div class="progress-labels">
                    <span>Overall Attendance</span>
                    <strong class="percent-val">{{ child.attendancePercentage }}%</strong>
                  </div>
                  <mat-progress-bar
                    mode="determinate"
                    [value]="child.attendancePercentage"
                    [color]="child.attendancePercentage >= 75 ? 'primary' : 'warn'">
                  </mat-progress-bar>
                </div>
              </div>

              <div class="metrics-grid-col">
                <div class="stat-pill bg-green-light">
                  <span class="num">{{ child.presentSessions }}</span>
                  <span class="lbl">Present</span>
                </div>
                <div class="stat-pill bg-red-light">
                  <span class="num">{{ child.absentSessions }}</span>
                  <span class="lbl">Absent</span>
                </div>
                <div class="stat-pill bg-yellow-light">
                  <span class="num">{{ child.lateSessions }}</span>
                  <span class="lbl">Late</span>
                </div>
                <div class="stat-pill bg-purple-light">
                  <span class="num">{{ child.onLeaveSessions }}</span>
                  <span class="lbl">On Leave</span>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Main Tabs: Monthly Calendar & Leave Requests -->
          <mat-card class="content-card mt-3">
            <mat-tab-group animationDuration="200ms">
              <!-- Tab 1: Attendance Calendar View -->
              <mat-tab label="Attendance Calendar">
                <div class="tab-body">
                  <!-- Month Navigation Bar -->
                  <div class="month-nav-bar">
                    <button mat-icon-button (click)="previousMonth()" title="Previous Month">
                      <mat-icon>chevron_left</mat-icon>
                    </button>
                    <div class="month-display">
                      <mat-icon>calendar_month</mat-icon>
                      <h3>{{ currentMonthDisplay() }}</h3>
                    </div>
                    <button mat-icon-button (click)="nextMonth()" title="Next Month">
                      <mat-icon>chevron_right</mat-icon>
                    </button>
                  </div>

                  <!-- Month Stat Summary Cards -->
                  @if (calendarData(); as cal) {
                    <div class="month-stats-grid">
                      <div class="mini-stat-card border-blue">
                        <span class="mini-val">{{ cal.attendancePercentage }}%</span>
                        <span class="mini-lbl">Month Attendance</span>
                      </div>
                      <div class="mini-stat-card border-green">
                        <span class="mini-val">{{ cal.presentDays }}</span>
                        <span class="mini-lbl">Present Days</span>
                      </div>
                      <div class="mini-stat-card border-red">
                        <span class="mini-val">{{ cal.absentDays }}</span>
                        <span class="mini-lbl">Absent Days</span>
                      </div>
                      <div class="mini-stat-card border-yellow">
                        <span class="mini-val">{{ cal.lateDays }}</span>
                        <span class="mini-lbl">Late Days</span>
                      </div>
                      <div class="mini-stat-card border-purple">
                        <span class="mini-val">{{ cal.onLeaveDays }}</span>
                        <span class="mini-lbl">Approved Leaves</span>
                      </div>
                    </div>

                    <!-- Daily Grid / Calendar Days -->
                    <div class="calendar-section mt-3">
                      <h4>Recorded School Days</h4>

                      @if (cal.days.length === 0) {
                        <div class="no-days-alert">
                          <mat-icon>info</mat-icon>
                          <span>No attendance recorded yet for this month.</span>
                        </div>
                      } @else {
                        <div class="days-grid">
                          @for (day of cal.days; track day.date) {
                            <div
                              class="day-card"
                              [class.day-selected]="selectedDay()?.date === day.date"
                              [ngClass]="getDayCardClass(day)"
                              (click)="selectDay(day)">
                              <div class="day-header">
                                <span class="day-num">{{ formatDayNum(day.date) }}</span>
                                <span class="day-dow">{{ day.dayOfWeek.substring(0, 3) }}</span>
                              </div>
                              <div class="day-status-pill">
                                {{ day.status }}
                              </div>
                              @if (day.periods.length > 0) {
                                <span class="period-count">{{ day.periods.length }} periods</span>
                              }
                            </div>
                          }
                        </div>
                      }
                    </div>

                    <!-- Selected Day Period Breakdown -->
                    @if (selectedDay(); as day) {
                      <div class="period-breakdown-card mt-3">
                        <div class="breakdown-header">
                          <div class="breakdown-title">
                            <mat-icon>schedule</mat-icon>
                            <span>Period Breakdown for <strong>{{ day.date }} ({{ day.dayOfWeek }})</strong></span>
                          </div>
                          <span class="status-badge" [ngClass]="getStatusBadgeClass(day.status)">
                            Overall: {{ day.status }}
                          </span>
                        </div>

                        @if (day.isLeave) {
                          <div class="leave-notice">
                            <mat-icon>beach_access</mat-icon>
                            <span>Approved Excused Leave: <em>"{{ day.leaveReason }}"</em></span>
                          </div>
                        }

                        @if (day.periods.length === 0) {
                          <p class="text-muted p-3">No specific period slots recorded for this date.</p>
                        } @else {
                          <div class="periods-list">
                            @for (p of day.periods; track p.periodId) {
                              <div class="period-item">
                                <div class="period-time-col">
                                  <strong>{{ p.periodName }}</strong>
                                  <small>{{ p.timeRange }}</small>
                                </div>
                                <div class="period-subj-col">
                                  <span class="subj-name">{{ p.subjectName }}</span>
                                  <small class="staff-name"><mat-icon inline>person</mat-icon> {{ p.staffName }}</small>
                                </div>
                                <div class="period-status-col">
                                  <span class="status-chip" [ngClass]="getStatusBadgeClass(p.status)">
                                    {{ p.status }}
                                  </span>
                                  @if (p.remarks) {
                                    <small class="remarks-text">{{ p.remarks }}</small>
                                  }
                                </div>
                              </div>
                            }
                          </div>
                        }
                      </div>
                    }
                  }
                </div>
              </mat-tab>

              <!-- Tab 2: Leave Requests History -->
              <mat-tab label="Leave Requests">
                <div class="tab-body">
                  <div class="leaves-tab-header">
                    <h3>Leave Requests for {{ selectedChild()?.fullName }}</h3>
                    <button mat-stroked-button color="primary" (click)="openSubmitLeaveDialog()">
                      <mat-icon>add</mat-icon> New Leave Request
                    </button>
                  </div>

                  @if (loadingLeaves()) {
                    <div class="text-center p-4">
                      <mat-spinner diameter="30"></mat-spinner>
                    </div>
                  } @else if (childLeaves().length === 0) {
                    <div class="empty-leaves">
                      <mat-icon class="empty-icon-sub">event_available</mat-icon>
                      <p>No leave requests submitted yet for this child.</p>
                    </div>
                  } @else {
                    <div class="leaves-list">
                      @for (leave of childLeaves(); track leave.id) {
                        <div class="leave-item-card">
                          <div class="leave-card-top">
                            <div class="leave-dates">
                              <mat-icon>date_range</mat-icon>
                              <strong>{{ leave.startDate }} to {{ leave.endDate }}</strong>
                              <span class="duration-pill">{{ leave.daysCount }} {{ leave.daysCount === 1 ? 'day' : 'days' }}</span>
                            </div>

                            <span class="status-pill" [ngClass]="getLeaveStatusClass(leave.status)">
                              {{ leave.status }}
                            </span>
                          </div>

                          <div class="leave-reason-text">
                            <strong>Reason:</strong> {{ leave.reason }}
                          </div>

                          @if (leave.reviewRemarks || leave.reviewedByUserName) {
                            <div class="reviewer-feedback">
                              <mat-icon inline>rate_review</mat-icon>
                              <span>
                                Reviewed by <strong>{{ leave.reviewedByUserName || 'Staff/Admin' }}</strong>:
                                <em>{{ leave.reviewRemarks || 'No additional remarks' }}</em>
                              </span>
                            </div>
                          }

                          <div class="leave-card-footer">
                            <small class="text-muted">Submitted on {{ leave.createdAt | date:'mediumDate' }}</small>
                          </div>
                        </div>
                      }
                    </div>
                  }
                </div>
              </mat-tab>
            </mat-tab-group>
          </mat-card>
        }
      }
    </div>
  `,
  styles: [`
    .parent-portal-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 16px;
    }
    .portal-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .title-row {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .title-row h1 {
      margin: 0;
      font-size: 24px;
      font-weight: 600;
    }
    .portal-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #3f51b5;
    }
    .subtitle {
      margin: 4px 0 0;
      color: #666;
      font-size: 14px;
    }
    .loading-state, .empty-card {
      padding: 40px;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .empty-icon {
      font-size: 56px;
      width: 56px;
      height: 56px;
      color: #9e9e9e;
    }
    .children-selector {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .selector-label {
      font-weight: 500;
      color: #555;
    }
    .chips-row {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .child-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 8px 16px;
      border-radius: 20px;
      border: 1px solid #ddd;
      background: #fff;
      cursor: pointer;
      font-size: 13px;
      transition: all 0.2s ease;
    }
    .child-chip:hover {
      background: #f5f5f5;
    }
    .child-chip.active-chip {
      background: #3f51b5;
      color: #fff;
      border-color: #3f51b5;
    }
    .child-chip.active-chip .chip-avatar-icon {
      color: #fff;
    }
    .chip-avatar-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #666;
    }
    .chip-name {
      font-weight: 600;
    }
    .chip-class {
      font-size: 11px;
      opacity: 0.85;
    }
    .child-hero-card {
      border-radius: 12px;
      box-shadow: 0 3px 12px rgba(0,0,0,0.08);
      background: linear-gradient(135deg, #ffffff 0%, #f9faff 100%);
      border: 1px solid #e0e7ff;
    }
    .hero-content {
      display: flex;
      gap: 20px;
      padding: 20px;
      flex-wrap: wrap;
      align-items: center;
    }
    .child-avatar {
      width: 68px;
      height: 68px;
      border-radius: 50%;
      background: #3f51b5;
      color: #fff;
      font-size: 24px;
      font-weight: 700;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 10px rgba(63, 81, 181, 0.3);
    }
    .child-info-col {
      flex: 1;
      min-width: 250px;
    }
    .name-status-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .name-status-row h2 {
      margin: 0;
      font-size: 20px;
      font-weight: 700;
    }
    .relationship-badge {
      background: #e3f2fd;
      color: #0288d1;
      font-size: 12px;
      padding: 3px 8px;
      border-radius: 12px;
      font-weight: 500;
    }
    .status-badge {
      font-size: 12px;
      padding: 3px 10px;
      border-radius: 12px;
      font-weight: 600;
    }
    .meta-row {
      display: flex;
      gap: 16px;
      margin: 8px 0;
      color: #555;
      font-size: 13px;
      flex-wrap: wrap;
    }
    .meta-item {
      display: flex;
      align-items: center;
      gap: 4px;
    }
    .meta-item mat-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #777;
    }
    .attendance-progress-row {
      margin-top: 10px;
      max-width: 450px;
    }
    .progress-labels {
      display: flex;
      justify-content: space-between;
      font-size: 12px;
      margin-bottom: 4px;
      color: #555;
    }
    .percent-val {
      font-size: 14px;
      color: #333;
    }
    .metrics-grid-col {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 8px;
      min-width: 180px;
    }
    .stat-pill {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 8px 12px;
      border-radius: 8px;
      text-align: center;
    }
    .stat-pill .num {
      font-size: 18px;
      font-weight: 700;
    }
    .stat-pill .lbl {
      font-size: 11px;
      text-transform: uppercase;
      opacity: 0.8;
    }
    .bg-green-light { background: #e8f5e9; color: #2e7d32; }
    .bg-red-light { background: #ffebee; color: #c62828; }
    .bg-yellow-light { background: #fff8e1; color: #f57f17; }
    .bg-purple-light { background: #f3e5f5; color: #7b1fa2; }

    .content-card {
      border-radius: 12px;
      overflow: hidden;
    }
    .tab-body {
      padding: 20px 16px;
    }
    .month-nav-bar {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 16px;
      margin-bottom: 16px;
    }
    .month-display {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .month-display h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }
    .month-stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 10px;
      margin-bottom: 20px;
    }
    .mini-stat-card {
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 12px 8px;
      background: #fbfbfb;
      border-radius: 8px;
      border-bottom: 3px solid #ccc;
    }
    .mini-val {
      font-size: 18px;
      font-weight: 700;
    }
    .mini-lbl {
      font-size: 11px;
      color: #666;
    }
    .border-blue { border-bottom-color: #2196f3; }
    .border-green { border-bottom-color: #4caf50; }
    .border-red { border-bottom-color: #f44336; }
    .border-yellow { border-bottom-color: #ff9800; }
    .border-purple { border-bottom-color: #9c27b0; }

    .calendar-section h4 {
      margin: 0 0 12px;
      font-size: 15px;
      font-weight: 600;
      color: #444;
    }
    .days-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(110px, 1fr));
      gap: 10px;
    }
    .day-card {
      padding: 10px;
      border-radius: 10px;
      border: 1px solid #e0e0e0;
      background: #fff;
      cursor: pointer;
      transition: all 0.2s ease;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .day-card:hover {
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
      transform: translateY(-1px);
    }
    .day-card.day-selected {
      border: 2px solid #3f51b5;
      box-shadow: 0 0 0 2px rgba(63, 81, 181, 0.2);
    }
    .day-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    .day-num {
      font-size: 16px;
      font-weight: 700;
    }
    .day-dow {
      font-size: 11px;
      color: #777;
    }
    .day-status-pill {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 6px;
      border-radius: 4px;
      text-align: center;
    }
    .period-count {
      font-size: 10px;
      color: #888;
      text-align: center;
    }

    .day-card-present { border-left: 4px solid #4caf50; }
    .day-card-present .day-status-pill { background: #e8f5e9; color: #2e7d32; }

    .day-card-absent { border-left: 4px solid #f44336; }
    .day-card-absent .day-status-pill { background: #ffebee; color: #c62828; }

    .day-card-late { border-left: 4px solid #ff9800; }
    .day-card-late .day-status-pill { background: #fff8e1; color: #f57f17; }

    .day-card-leave { border-left: 4px solid #9c27b0; }
    .day-card-leave .day-status-pill { background: #f3e5f5; color: #7b1fa2; }

    .day-card-partial { border-left: 4px solid #2196f3; }
    .day-card-partial .day-status-pill { background: #e3f2fd; color: #0288d1; }

    .period-breakdown-card {
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      padding: 16px;
      background: #fafafa;
    }
    .breakdown-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .breakdown-title {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #333;
    }
    .leave-notice {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 14px;
      background: #f3e5f5;
      color: #7b1fa2;
      border-radius: 8px;
      margin-bottom: 12px;
      font-size: 13px;
    }
    .periods-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .period-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 10px 14px;
      background: #fff;
      border-radius: 8px;
      border: 1px solid #e9e9e9;
      flex-wrap: wrap;
      gap: 10px;
    }
    .period-time-col {
      display: flex;
      flex-direction: column;
      min-width: 100px;
    }
    .period-subj-col {
      display: flex;
      flex-direction: column;
      flex: 1;
      min-width: 150px;
    }
    .subj-name {
      font-weight: 600;
      color: #333;
    }
    .staff-name {
      color: #666;
      display: flex;
      align-items: center;
      gap: 3px;
    }
    .period-status-col {
      display: flex;
      flex-direction: column;
      align-items: flex-end;
      gap: 2px;
    }
    .status-chip {
      padding: 3px 10px;
      border-radius: 12px;
      font-size: 11px;
      font-weight: 600;
    }
    .remarks-text {
      font-size: 11px;
      color: #666;
      font-style: italic;
    }

    .leaves-tab-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .leaves-tab-header h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
    .empty-leaves {
      text-align: center;
      padding: 30px;
      color: #888;
    }
    .empty-icon-sub {
      font-size: 44px;
      width: 44px;
      height: 44px;
      color: #ccc;
    }
    .leaves-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .leave-item-card {
      padding: 14px 18px;
      border-radius: 10px;
      border: 1px solid #e0e0e0;
      background: #fff;
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .leave-card-top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
    }
    .leave-dates {
      display: flex;
      align-items: center;
      gap: 8px;
      color: #333;
      font-size: 14px;
    }
    .duration-pill {
      background: #f0f0f0;
      color: #555;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 500;
    }
    .status-pill {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 12px;
      text-transform: uppercase;
    }
    .leave-status-pending { background: #fff8e1; color: #f57f17; }
    .leave-status-approved { background: #e8f5e9; color: #2e7d32; }
    .leave-status-rejected { background: #ffebee; color: #c62828; }

    .leave-reason-text {
      font-size: 13px;
      color: #444;
    }
    .reviewer-feedback {
      background: #f5f5f5;
      padding: 8px 12px;
      border-radius: 6px;
      font-size: 12px;
      color: #444;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .leave-card-footer {
      border-top: 1px dashed #eee;
      padding-top: 6px;
    }

    .no-days-alert {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 16px;
      background: #f5f5f5;
      border-radius: 8px;
      color: #666;
    }
    .mt-3 { margin-top: 16px; }

    @media (max-width: 600px) {
      .hero-content {
        flex-direction: column;
        align-items: flex-start;
      }
      .metrics-grid-col {
        width: 100%;
        grid-template-columns: repeat(4, 1fr);
      }
      .days-grid {
        grid-template-columns: repeat(2, 1fr);
      }
    }
  `]
})
export class ParentPortalComponent implements OnInit {
  private leaveService = inject(LeaveService);
  private authService = inject(AuthService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  loadingChildren = signal(true);
  children = signal<ParentChildOverview[]>([]);
  selectedChild = signal<ParentChildOverview | null>(null);

  // Calendar
  currentYear = signal(new Date().getFullYear());
  currentMonth = signal(new Date().getMonth() + 1); // 1-12
  calendarData = signal<ChildMonthlyCalendar | null>(null);
  selectedDay = signal<ChildDailyAttendance | null>(null);

  // Leaves
  loadingLeaves = signal(false);
  childLeaves = signal<LeaveRequestItem[]>([]);

  currentMonthDisplay = computed(() => {
    const d = new Date(this.currentYear(), this.currentMonth() - 1, 1);
    return d.toLocaleString('default', { month: 'long', year: 'numeric' });
  });

  ngOnInit(): void {
    this.loadChildren();
  }

  loadChildren(): void {
    this.loadingChildren.set(true);
    this.leaveService.getMyChildren().subscribe({
      next: (list) => {
        this.children.set(list);
        this.loadingChildren.set(false);
        if (list.length > 0) {
          this.selectChild(list[0]);
        }
      },
      error: () => {
        this.loadingChildren.set(false);
        this.snackBar.open('Failed to load children profiles.', 'Close', { duration: 3500 });
      }
    });
  }

  selectChild(child: ParentChildOverview): void {
    this.selectedChild.set(child);
    this.selectedDay.set(null);
    this.loadCalendar();
    this.loadLeaves();
  }

  loadCalendar(): void {
    const child = this.selectedChild();
    if (!child) return;

    const monthStr = `${this.currentYear()}-${String(this.currentMonth()).padStart(2, '0')}`;
    this.leaveService.getChildAttendance(child.studentId, monthStr).subscribe({
      next: (cal) => {
        this.calendarData.set(cal);
        if (cal.days.length > 0) {
          // Select today's date if present, or first day
          const todayStr = new Date().toISOString().substring(0, 10);
          const match = cal.days.find(d => d.date === todayStr);
          this.selectedDay.set(match || cal.days[cal.days.length - 1]);
        } else {
          this.selectedDay.set(null);
        }
      },
      error: () => {
        this.snackBar.open('Failed to load attendance calendar.', 'Close', { duration: 3000 });
      }
    });
  }

  loadLeaves(): void {
    const child = this.selectedChild();
    if (!child) return;

    this.loadingLeaves.set(true);
    this.leaveService.getLeaves('All', child.studentId).subscribe({
      next: (leaves) => {
        this.childLeaves.set(leaves);
        this.loadingLeaves.set(false);
      },
      error: () => {
        this.loadingLeaves.set(false);
      }
    });
  }

  previousMonth(): void {
    let m = this.currentMonth() - 1;
    let y = this.currentYear();
    if (m < 1) {
      m = 12;
      y--;
    }
    this.currentMonth.set(m);
    this.currentYear.set(y);
    this.loadCalendar();
  }

  nextMonth(): void {
    let m = this.currentMonth() + 1;
    let y = this.currentYear();
    if (m > 12) {
      m = 1;
      y++;
    }
    this.currentMonth.set(m);
    this.currentYear.set(y);
    this.loadCalendar();
  }

  selectDay(day: ChildDailyAttendance): void {
    this.selectedDay.set(day);
  }

  openSubmitLeaveDialog(): void {
    const dialogRef = this.dialog.open(SubmitLeaveDialogComponent, {
      width: '500px',
      data: {
        children: this.children(),
        selectedStudentId: this.selectedChild()?.studentId
      }
    });

    dialogRef.afterClosed().subscribe(res => {
      if (res) {
        this.loadLeaves();
        this.loadCalendar();
      }
    });
  }

  getInitials(name: string): string {
    if (!name) return 'S';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  }

  formatDayNum(dateStr: string): string {
    if (!dateStr) return '';
    return dateStr.substring(8, 10);
  }

  getDayCardClass(day: ChildDailyAttendance): string {
    if (day.isLeave || day.status === 'OnLeave') return 'day-card-leave';
    if (day.status === 'Present') return 'day-card-present';
    if (day.status === 'Absent') return 'day-card-absent';
    if (day.status === 'Late') return 'day-card-late';
    return 'day-card-partial';
  }

  getStatusBadgeClass(status?: string): string {
    switch (status) {
      case 'Present': return 'bg-green-light';
      case 'Absent': return 'bg-red-light';
      case 'Late': return 'bg-yellow-light';
      case 'On Leave':
      case 'OnLeave': return 'bg-purple-light';
      default: return 'bg-gray';
    }
  }

  getLeaveStatusClass(status: string): string {
    switch (status) {
      case 'Approved': return 'leave-status-approved';
      case 'Rejected': return 'leave-status-rejected';
      default: return 'leave-status-pending';
    }
  }
}
