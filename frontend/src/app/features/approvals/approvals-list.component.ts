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
import { ApprovalService } from '../../core/services/approval.service';
import { PendingApprovalUser } from '../../core/models/invite.models';
import { RejectDialogComponent } from './reject-dialog.component';

@Component({
  selector: 'app-approvals-list',
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
          <h1>Registration Approvals</h1>
          <p class="subtitle">Review and approve self-registered staff and parent accounts</p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button color="primary" (click)="loadPending()">
            <mat-icon>refresh</mat-icon> Refresh
          </button>
        </div>
      </div>

      <!-- Desktop Table View -->
      <mat-card class="table-card desktop-table-card">
        <mat-card-content class="p-0">
          <table mat-table [dataSource]="pendingUsers()" class="approvals-table">
            <!-- User Column -->
            <ng-container matColumnDef="user">
              <th mat-header-cell *matHeaderCellDef>Applicant Profile</th>
              <td mat-cell *matCellDef="let u">
                <div class="user-cell">
                  <div class="avatar" [class.staff-avatar]="u.role === 'Staff'" [class.parent-avatar]="u.role === 'Parent'">
                    {{ getInitials(u.fullName) }}
                  </div>
                  <div class="user-meta">
                    <span class="user-name">{{ u.fullName }}</span>
                    <span class="user-contact">{{ u.email }} • {{ u.phone }}</span>
                  </div>
                </div>
              </td>
            </ng-container>

            <!-- Role Column -->
            <ng-container matColumnDef="role">
              <th mat-header-cell *matHeaderCellDef>Role</th>
              <td mat-cell *matCellDef="let u">
                <span class="badge" [class.badge-staff]="u.role === 'Staff'" [class.badge-parent]="u.role === 'Parent'">
                  {{ u.role }}
                </span>
              </td>
            </ng-container>

            <!-- Details Column -->
            <ng-container matColumnDef="details">
              <th mat-header-cell *matHeaderCellDef>Registration Details</th>
              <td mat-cell *matCellDef="let u">
                @if (u.role === 'Staff') {
                  <div class="detail-row">
                    @if (u.employeeId) {
                      <span class="detail-tag"><mat-icon>badge</mat-icon> ID: {{ u.employeeId }}</span>
                    }
                    @if (u.subjectSpecialization) {
                      <span class="detail-tag"><mat-icon>school</mat-icon> {{ u.subjectSpecialization }}</span>
                    }
                  </div>
                } @else if (u.role === 'Parent') {
                  <div class="detail-row">
                    @if (u.linkedStudents.length > 0) {
                      <span class="detail-tag"><mat-icon>family_restroom</mat-icon> {{ u.linkedStudents.join(', ') }}</span>
                    } @else {
                      <span class="text-muted">No child mapped yet</span>
                    }
                  </div>
                }
              </td>
            </ng-container>

            <!-- Submitted Date Column -->
            <ng-container matColumnDef="submitted">
              <th mat-header-cell *matHeaderCellDef>Submitted</th>
              <td mat-cell *matCellDef="let u">
                <span class="date-txt">{{ u.createdAt | date:'mediumDate' }}</span>
              </td>
            </ng-container>

            <!-- Actions Column -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="actions-header">Actions</th>
              <td mat-cell *matCellDef="let u" class="actions-cell">
                <button mat-flat-button color="primary" class="action-btn" (click)="approve(u)">
                  <mat-icon>check_circle</mat-icon> Approve
                </button>
                <button mat-stroked-button color="warn" (click)="reject(u)">
                  <mat-icon>cancel</mat-icon> Reject
                </button>
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>

            <tr class="mat-row empty-row" *matNoDataRow>
              <td class="mat-cell" colspan="5">
                <div class="empty-state">
                  <mat-icon>task_alt</mat-icon>
                  <p>All clear! There are no pending registrations waiting for approval.</p>
                </div>
              </td>
            </tr>
          </table>
        </mat-card-content>
      </mat-card>

      <!-- Mobile Card List View -->
      <div class="mobile-card-list">
        @for (u of pendingUsers(); track u.userId) {
          <mat-card class="approval-mobile-card">
            <mat-card-header>
              <div mat-card-avatar class="avatar" [class.staff-avatar]="u.role === 'Staff'" [class.parent-avatar]="u.role === 'Parent'">
                {{ getInitials(u.fullName) }}
              </div>
              <mat-card-title>{{ u.fullName }}</mat-card-title>
              <mat-card-subtitle>{{ u.email }} • {{ u.phone }}</mat-card-subtitle>
              <span class="spacer"></span>
              <span class="badge" [class.badge-staff]="u.role === 'Staff'" [class.badge-parent]="u.role === 'Parent'">
                {{ u.role }}
              </span>
            </mat-card-header>

            <mat-card-content class="mobile-body">
              @if (u.role === 'Staff') {
                <div class="mobile-tags">
                  @if (u.employeeId) { <span>EMP ID: {{ u.employeeId }}</span> }
                  @if (u.subjectSpecialization) { <span>{{ u.subjectSpecialization }}</span> }
                </div>
              } @else if (u.role === 'Parent') {
                <div class="mobile-tags">
                  @if (u.linkedStudents.length > 0) {
                    <span>Children: {{ u.linkedStudents.join(', ') }}</span>
                  }
                </div>
              }
              <div class="mobile-date">Submitted: {{ u.createdAt | date:'mediumDate' }}</div>
            </mat-card-content>

            <mat-card-actions align="end" class="mobile-actions">
              <button mat-stroked-button color="warn" (click)="reject(u)">
                <mat-icon>cancel</mat-icon> Reject
              </button>
              <button mat-flat-button color="primary" (click)="approve(u)">
                <mat-icon>check_circle</mat-icon> Approve
              </button>
            </mat-card-actions>
          </mat-card>
        } @empty {
          <div class="empty-state">
            <mat-icon>task_alt</mat-icon>
            <p>No pending registrations.</p>
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
    .table-card {
      background: white;
      border-radius: 8px;
      overflow: hidden;
    }
    .p-0 { padding: 0 !important; }
    .approvals-table {
      width: 100%;
    }
    .user-cell {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
    }
    .avatar {
      width: 38px;
      height: 38px;
      border-radius: 50%;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.85rem;
      flex-shrink: 0;
      &.staff-avatar { background: #004d40; }
      &.parent-avatar { background: #6a1b9a; }
    }
    .user-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .user-name {
      font-weight: 600;
      color: #1e293b;
      font-size: 0.95rem;
    }
    .user-contact {
      font-size: 0.8rem;
      color: #64748b;
    }
    .detail-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .detail-tag {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      background: #f1f5f9;
      padding: 2px 8px;
      border-radius: 6px;
      font-size: 0.8rem;
      color: #334155;
      mat-icon { font-size: 14px; width: 14px; height: 14px; color: #64748b; }
    }
    .text-muted {
      color: #94a3b8;
      font-style: italic;
      font-size: 0.85rem;
    }
    .date-txt {
      font-size: 0.85rem;
      color: #64748b;
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
      mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 8px; color: #4caf50; }
    }
    .mobile-card-list {
      display: none;
      flex-direction: column;
      gap: 16px;
    }
    .approval-mobile-card {
      border-radius: 12px;
    }
    .mobile-body {
      padding-top: 12px;
    }
    .mobile-tags {
      font-size: 0.85rem;
      color: #334155;
      margin-bottom: 6px;
    }
    .mobile-date {
      font-size: 0.78rem;
      color: #94a3b8;
    }
    .mobile-actions {
      display: flex;
      gap: 8px;
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
export class ApprovalsListComponent implements OnInit {
  private approvalService = inject(ApprovalService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  pendingUsers = signal<PendingApprovalUser[]>([]);
  displayedColumns = ['user', 'role', 'details', 'submitted', 'actions'];

  ngOnInit(): void {
    this.loadPending();
  }

  loadPending(): void {
    this.approvalService.getPendingApprovals().subscribe({
      next: data => this.pendingUsers.set(data),
      error: () => this.snackBar.open('Failed to load pending registrations', 'Close', { duration: 3000 })
    });
  }

  getInitials(name: string): string {
    if (!name) return 'U';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  approve(user: PendingApprovalUser): void {
    if (!confirm(`Approve registration for ${user.fullName} (${user.role})?`)) return;

    this.approvalService.approveUser(user.userId).subscribe({
      next: res => {
        this.snackBar.open(res.message || 'User approved successfully', 'Close', { duration: 3000 });
        this.loadPending();
      },
      error: err => {
        this.snackBar.open(err.error?.message || 'Failed to approve user', 'Close', { duration: 4000 });
      }
    });
  }

  reject(user: PendingApprovalUser): void {
    const ref = this.dialog.open(RejectDialogComponent, {
      width: '460px',
      data: { user }
    });

    ref.afterClosed().subscribe((reason: string | undefined) => {
      if (reason) {
        this.approvalService.rejectUser(user.userId, reason).subscribe({
          next: res => {
            this.snackBar.open(res.message || 'Registration rejected', 'Close', { duration: 3000 });
            this.loadPending();
          },
          error: err => {
            this.snackBar.open(err.error?.message || 'Failed to reject registration', 'Close', { duration: 4000 });
          }
        });
      }
    });
  }
}
