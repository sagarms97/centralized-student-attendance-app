import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { FormsModule } from '@angular/forms';
import { SuperAdminService } from '../../core/services/super-admin.service';
import { AuditLogItem } from '../../core/models/super-admin.models';

@Component({
  selector: 'app-audit-logs',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatProgressSpinnerModule
  ],
  template: `
    <div class="audit-logs-container">
      <div class="header-section">
        <div>
          <div class="title-row">
            <mat-icon class="icon">security</mat-icon>
            <h1>Security & Access Audit Logs</h1>
          </div>
          <p class="subtitle">Complete audit trail of all platform-wide administrative operations and tenant data access</p>
        </div>

        <a mat-button routerLink="/app/super-admin" class="back-link">
          <mat-icon>dashboard</mat-icon> Dashboard
        </a>
      </div>

      <mat-card class="content-card">
        <div class="filter-bar">
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search logs by action, admin email, or details...</mat-label>
            <input matInput [(ngModel)]="searchTerm" (keyup.enter)="loadLogs()" placeholder="e.g. ViewInstituteDetails, admin@..." />
            <mat-icon matSuffix (click)="loadLogs()" class="clickable-icon">search</mat-icon>
          </mat-form-field>
          <button mat-stroked-button color="primary" (click)="loadLogs()">
            <mat-icon>refresh</mat-icon> Refresh
          </button>
        </div>

        @if (loading()) {
          <div class="loading-state">
            <mat-spinner diameter="36"></mat-spinner>
            <p>Loading security audit logs...</p>
          </div>
        } @else if (logs().length === 0) {
          <div class="empty-state">
            <mat-icon class="empty-icon">verified_user</mat-icon>
            <p>No audit logs found matching your search criteria.</p>
          </div>
        } @else {
          <div class="table-container">
            <table mat-table [dataSource]="logs()" class="responsive-table">
              <!-- Timestamp -->
              <ng-container matColumnDef="timestamp">
                <th mat-header-cell *matHeaderCellDef>Date & Time</th>
                <td mat-cell *matCellDef="let log">
                  <strong>{{ log.timestamp | date:'medium' }}</strong>
                </td>
              </ng-container>

              <!-- Admin User -->
              <ng-container matColumnDef="userEmail">
                <th mat-header-cell *matHeaderCellDef>Admin User</th>
                <td mat-cell *matCellDef="let log">
                  <span class="user-pill">{{ log.userEmail }}</span>
                </td>
              </ng-container>

              <!-- Action -->
              <ng-container matColumnDef="action">
                <th mat-header-cell *matHeaderCellDef>Action</th>
                <td mat-cell *matCellDef="let log">
                  <span class="action-badge" [ngClass]="getActionBadgeClass(log.action)">
                    {{ log.action }}
                  </span>
                </td>
              </ng-container>

              <!-- Target / Institute -->
              <ng-container matColumnDef="institute">
                <th mat-header-cell *matHeaderCellDef>Target Institute</th>
                <td mat-cell *matCellDef="let log">
                  {{ log.instituteName || 'Platform Wide' }}
                </td>
              </ng-container>

              <!-- Details -->
              <ng-container matColumnDef="details">
                <th mat-header-cell *matHeaderCellDef>Operation Details</th>
                <td mat-cell *matCellDef="let log" class="details-cell">
                  {{ log.details }}
                </td>
              </ng-container>

              <!-- IP Address -->
              <ng-container matColumnDef="ipAddress">
                <th mat-header-cell *matHeaderCellDef>IP Address</th>
                <td mat-cell *matCellDef="let log">
                  <small class="ip-text">{{ log.ipAddress || 'Internal' }}</small>
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns;"></tr>
            </table>
          </div>
        }
      </mat-card>
    </div>
  `,
  styles: [`
    .audit-logs-container {
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
      font-size: 32px;
      width: 32px;
      height: 32px;
      color: #1a237e;
    }
    .subtitle {
      margin: 4px 0 0;
      color: #666;
      font-size: 14px;
    }
    .content-card {
      border-radius: 12px;
      overflow: hidden;
      border: 1px solid #e2e8f0;
      padding: 16px;
    }
    .filter-bar {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .search-field {
      flex: 1;
      min-width: 280px;
    }
    .clickable-icon {
      cursor: pointer;
    }
    .loading-state, .empty-state {
      text-align: center;
      padding: 40px;
      color: #777;
    }
    .empty-icon {
      font-size: 56px;
      width: 56px;
      height: 56px;
      color: #4caf50;
    }
    .table-container {
      overflow-x: auto;
    }
    .user-pill {
      background: #eef2ff;
      color: #3730a3;
      padding: 2px 8px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 500;
    }
    .action-badge {
      font-size: 11px;
      font-weight: 600;
      padding: 3px 8px;
      border-radius: 10px;
      text-transform: uppercase;
    }
    .badge-view { background: #e3f2fd; color: #1565c0; }
    .badge-toggle { background: #fff8e1; color: #f57f17; }
    .badge-drill { background: #f3e5f5; color: #7b1fa2; }
    .badge-default { background: #f5f5f5; color: #424242; }
    .details-cell {
      max-width: 350px;
      font-size: 13px;
      color: #333;
    }
    .ip-text {
      color: #888;
      font-family: monospace;
    }
  `]
})
export class AuditLogsComponent implements OnInit {
  private superAdminService = inject(SuperAdminService);

  loading = signal(true);
  logs = signal<AuditLogItem[]>([]);
  searchTerm = '';

  columns = ['timestamp', 'userEmail', 'action', 'institute', 'details', 'ipAddress'];

  ngOnInit(): void {
    this.loadLogs();
  }

  loadLogs(): void {
    this.loading.set(true);
    this.superAdminService.getAuditLogs(this.searchTerm).subscribe({
      next: (data) => {
        this.logs.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
      }
    });
  }

  getActionBadgeClass(action: string): string {
    if (action.includes('View') || action.includes('List')) return 'badge-view';
    if (action.includes('Toggle') || action.includes('Status')) return 'badge-toggle';
    if (action.includes('DrillDown')) return 'badge-drill';
    return 'badge-default';
  }
}
