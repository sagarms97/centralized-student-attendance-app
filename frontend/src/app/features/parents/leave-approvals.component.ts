import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTabsModule } from '@angular/material/tabs';
import { FormsModule } from '@angular/forms';
import { LeaveService } from '../../core/services/leave.service';
import { AuthService } from '../../core/services/auth.service';
import { LeaveRequestItem } from '../../core/models/leave.models';
import { SubmitLeaveDialogComponent } from './submit-leave-dialog.component';

@Component({
  selector: 'app-reject-leave-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, MatDialogModule, MatFormFieldModule, MatInputModule, MatButtonModule, MatIconModule],
  template: `
    <h2 mat-dialog-title>Reject Leave Request</h2>
    <mat-dialog-content>
      <p>Specify the reason or feedback for rejecting this leave request:</p>
      <mat-form-field appearance="outline" class="full-width">
        <mat-label>Rejection Reason / Remarks</mat-label>
        <textarea matInput [(ngModel)]="remarks" rows="3" placeholder="e.g. Exams scheduled during this period..."></textarea>
      </mat-form-field>
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="warn" [mat-dialog-close]="remarks">Confirm Reject</button>
    </mat-dialog-actions>
  `,
  styles: [`.full-width { width: 100%; margin-top: 8px; }`]
})
export class RejectLeaveModalComponent {
  remarks = '';
}

@Component({
  selector: 'app-leave-approvals',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTableModule,
    MatDialogModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTabsModule
  ],
  template: `
    <div class="leaves-container">
      <div class="header-section">
        <div>
          <div class="title-row">
            <mat-icon class="icon">event_busy</mat-icon>
            <h1>Student Leave Requests</h1>
          </div>
          <p class="subtitle">
            @if (authService.isParent()) {
              Track and submit leave requests for your children
            } @else {
              Review and approve student leave requests for your assigned classes
            }
          </p>
        </div>

        @if (authService.isParent()) {
          <button mat-flat-button color="primary" (click)="openSubmitLeaveDialog()">
            <mat-icon>add</mat-icon> New Leave Request
          </button>
        }
      </div>

      <!-- Tabs for Status Filter -->
      <mat-card class="table-card">
        <mat-tab-group (selectedTabChange)="onTabChange($event.index)">
          <mat-tab label="All Requests"></mat-tab>
          <mat-tab>
            <ng-template mat-tab-label>
              <span>Pending</span>
              @if (pendingCount() > 0) {
                <span class="tab-badge">{{ pendingCount() }}</span>
              }
            </ng-template>
          </mat-tab>
          <mat-tab label="Approved"></mat-tab>
          <mat-tab label="Rejected"></mat-tab>
        </mat-tab-group>

        <div class="content-body">
          @if (loading()) {
            <div class="loading-state">
              <mat-spinner diameter="36"></mat-spinner>
              <p>Loading requests...</p>
            </div>
          } @else if (requests().length === 0) {
            <div class="empty-state">
              <mat-icon class="empty-icon">check_circle_outline</mat-icon>
              <h3>No {{ currentFilter() !== 'All' ? currentFilter() : '' }} Leave Requests Found</h3>
              <p>No student leave applications match this filter.</p>
            </div>
          } @else {
            <div class="requests-grid">
              @for (req of requests(); track req.id) {
                <div class="request-card" [class.border-pending]="req.status === 'Pending'">
                  <div class="card-header">
                    <div class="student-info">
                      <span class="student-name">{{ req.studentName }}</span>
                      <span class="roll-class">Roll: {{ req.rollNo }} | {{ req.className }}-{{ req.section }}</span>
                    </div>
                    <span class="status-badge" [ngClass]="getStatusClass(req.status)">
                      {{ req.status }}
                    </span>
                  </div>

                  <div class="card-meta">
                    <div class="meta-row">
                      <mat-icon class="meta-icon">date_range</mat-icon>
                      <span class="dates-text"><strong>{{ req.startDate }}</strong> to <strong>{{ req.endDate }}</strong></span>
                      <span class="days-badge">{{ req.daysCount }} {{ req.daysCount === 1 ? 'day' : 'days' }}</span>
                    </div>

                    <div class="meta-row">
                      <mat-icon class="meta-icon">person</mat-icon>
                      <span>Parent: <strong>{{ req.parentName }}</strong></span>
                      @if (req.parentPhone) {
                        <span class="phone-text">({{ req.parentPhone }})</span>
                      }
                    </div>
                  </div>

                  <div class="reason-box">
                    <strong>Reason:</strong> {{ req.reason }}
                  </div>

                  @if (req.reviewedByUserName || req.reviewRemarks) {
                    <div class="review-box">
                      <mat-icon class="review-icon">feedback</mat-icon>
                      <div>
                        <span>Reviewed by <strong>{{ req.reviewedByUserName }}</strong> on {{ req.reviewedAt | date:'mediumDate' }}</span>
                        @if (req.reviewRemarks) {
                          <p class="review-remarks">"{{ req.reviewRemarks }}"</p>
                        }
                      </div>
                    </div>
                  }

                  @if (!authService.isParent() && req.status === 'Pending') {
                    <div class="card-actions">
                      <button mat-flat-button color="primary" (click)="approve(req)" [disabled]="actionLoading() === req.id">
                        <mat-icon>check</mat-icon> Approve
                      </button>
                      <button mat-stroked-button color="warn" (click)="reject(req)" [disabled]="actionLoading() === req.id">
                        <mat-icon>close</mat-icon> Reject
                      </button>
                    </div>
                  }
                </div>
              }
            </div>
          }
        </div>
      </mat-card>
    </div>
  `,
  styles: [`
    .leaves-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 16px;
    }
    .header-section {
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
    .icon {
      font-size: 30px;
      width: 30px;
      height: 30px;
      color: #e91e63;
    }
    .subtitle {
      margin: 4px 0 0;
      color: #666;
      font-size: 14px;
    }
    .table-card {
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e0e0e0;
    }
    .tab-badge {
      background: #f44336;
      color: #fff;
      font-size: 11px;
      padding: 1px 6px;
      border-radius: 10px;
      margin-left: 6px;
      font-weight: 700;
    }
    .content-body {
      padding: 20px;
    }
    .loading-state, .empty-state {
      text-align: center;
      padding: 40px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      color: #777;
    }
    .empty-icon {
      font-size: 52px;
      width: 52px;
      height: 52px;
      color: #bdbdbd;
    }
    .requests-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(360px, 1fr));
      gap: 16px;
    }
    .request-card {
      border: 1px solid #e0e0e0;
      border-radius: 10px;
      padding: 16px;
      background: #fff;
      display: flex;
      flex-direction: column;
      gap: 12px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05);
      transition: all 0.2s ease;
    }
    .request-card:hover {
      box-shadow: 0 4px 12px rgba(0,0,0,0.08);
    }
    .border-pending {
      border-left: 4px solid #ff9800;
    }
    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      gap: 8px;
    }
    .student-info {
      display: flex;
      flex-direction: column;
    }
    .student-name {
      font-size: 16px;
      font-weight: 700;
      color: #222;
    }
    .roll-class {
      font-size: 12px;
      color: #666;
    }
    .status-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 10px;
      border-radius: 12px;
      text-transform: uppercase;
    }
    .status-pending { background: #fff8e1; color: #f57f17; }
    .status-approved { background: #e8f5e9; color: #2e7d32; }
    .status-rejected { background: #ffebee; color: #c62828; }

    .card-meta {
      display: flex;
      flex-direction: column;
      gap: 6px;
      font-size: 13px;
      color: #555;
    }
    .meta-row {
      display: flex;
      align-items: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .meta-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
      color: #777;
    }
    .days-badge {
      background: #e3f2fd;
      color: #1976d2;
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 600;
    }
    .phone-text {
      color: #888;
      font-size: 12px;
    }
    .reason-box {
      background: #f9f9f9;
      padding: 10px 12px;
      border-radius: 8px;
      font-size: 13px;
      color: #333;
      border: 1px solid #eee;
    }
    .review-box {
      background: #eef2ff;
      border-radius: 8px;
      padding: 10px 12px;
      display: flex;
      align-items: flex-start;
      gap: 8px;
      font-size: 12px;
      color: #3730a3;
    }
    .review-icon {
      font-size: 18px;
      width: 18px;
      height: 18px;
    }
    .review-remarks {
      margin: 4px 0 0;
      font-style: italic;
    }
    .card-actions {
      display: flex;
      gap: 8px;
      margin-top: 4px;
      padding-top: 10px;
      border-top: 1px dashed #eee;
    }
    @media (max-width: 600px) {
      .requests-grid {
        grid-template-columns: 1fr;
      }
    }
  `]
})
export class LeaveApprovalsComponent implements OnInit {
  leaveService = inject(LeaveService);
  authService = inject(AuthService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  loading = signal(true);
  requests = signal<LeaveRequestItem[]>([]);
  pendingCount = signal(0);
  currentFilter = signal<string>('All');
  actionLoading = signal<number | null>(null);

  filterTabs = ['All', 'Pending', 'Approved', 'Rejected'];

  ngOnInit(): void {
    this.loadData();
    this.refreshPendingCount();
  }

  onTabChange(index: number): void {
    this.currentFilter.set(this.filterTabs[index]);
    this.loadData();
  }

  refreshPendingCount(): void {
    this.leaveService.getPendingCount().subscribe({
      next: (count) => this.pendingCount.set(count),
      error: () => {}
    });
  }

  loadData(): void {
    this.loading.set(true);
    this.leaveService.getLeaves(this.currentFilter()).subscribe({
      next: (list) => {
        this.requests.set(list);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Failed to load leave requests.', 'Close', { duration: 3500 });
      }
    });
  }

  approve(req: LeaveRequestItem): void {
    this.actionLoading.set(req.id);
    this.leaveService.reviewLeave(req.id, {
      status: 'Approved',
      reviewRemarks: 'Approved by staff/admin'
    }).subscribe({
      next: () => {
        this.actionLoading.set(null);
        this.snackBar.open(`Leave for ${req.studentName} approved and attendance updated to OnLeave!`, 'Close', { duration: 4000 });
        this.loadData();
        this.refreshPendingCount();
      },
      error: (err) => {
        this.actionLoading.set(null);
        const msg = err.error?.message || 'Failed to approve leave.';
        this.snackBar.open(msg, 'Close', { duration: 4000 });
      }
    });
  }

  reject(req: LeaveRequestItem): void {
    const dialogRef = this.dialog.open(RejectLeaveModalComponent, { width: '450px' });
    dialogRef.afterClosed().subscribe((remarks: string | undefined) => {
      if (remarks !== undefined) {
        this.actionLoading.set(req.id);
        this.leaveService.reviewLeave(req.id, {
          status: 'Rejected',
          reviewRemarks: remarks || 'Rejected by staff/admin'
        }).subscribe({
          next: () => {
            this.actionLoading.set(null);
            this.snackBar.open(`Leave request for ${req.studentName} rejected.`, 'Close', { duration: 3500 });
            this.loadData();
            this.refreshPendingCount();
          },
          error: (err) => {
            this.actionLoading.set(null);
            const msg = err.error?.message || 'Failed to reject leave.';
            this.snackBar.open(msg, 'Close', { duration: 4000 });
          }
        });
      }
    });
  }

  openSubmitLeaveDialog(): void {
    this.leaveService.getMyChildren().subscribe({
      next: (children) => {
        const dialogRef = this.dialog.open(SubmitLeaveDialogComponent, {
          width: '500px',
          data: { children }
        });
        dialogRef.afterClosed().subscribe(res => {
          if (res) {
            this.loadData();
            this.refreshPendingCount();
          }
        });
      }
    });
  }

  getStatusClass(status: string): string {
    switch (status) {
      case 'Approved': return 'status-approved';
      case 'Rejected': return 'status-rejected';
      default: return 'status-pending';
    }
  }
}
