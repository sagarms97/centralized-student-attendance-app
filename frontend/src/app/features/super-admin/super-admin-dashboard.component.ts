import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTableModule } from '@angular/material/table';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { FormsModule } from '@angular/forms';
import { SuperAdminService } from '../../core/services/super-admin.service';
import { PlatformOverview, SuperAdminInstituteItem } from '../../core/models/super-admin.models';

@Component({
  selector: 'app-super-admin-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTableModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatProgressBarModule,
    MatProgressSpinnerModule,
    MatSnackBarModule
  ],
  template: `
    <div class="super-admin-container">
      <!-- Dashboard Top Header -->
      <div class="dashboard-header">
        <div>
          <div class="title-row">
            <mat-icon class="header-icon">admin_panel_settings</mat-icon>
            <h1>Super Admin Platform Dashboard</h1>
          </div>
          <p class="subtitle">Platform-wide overview, tenant institute management, and security audit tracking</p>
        </div>

        <div class="header-actions">
          <a mat-flat-button color="primary" routerLink="/app/super-admin/audit-logs">
            <mat-icon>security</mat-icon>
            <span>Audit Logs</span>
          </a>
        </div>
      </div>

      @if (loadingOverview()) {
        <div class="loading-state">
          <mat-spinner diameter="40"></mat-spinner>
          <p>Loading platform metrics...</p>
        </div>
      } @else {
        @if (overview(); as ov) {
        <!-- Platform KPI Metrics Grid -->
        <div class="metrics-grid">
          <!-- Total Institutes -->
          <mat-card class="metric-card border-blue">
            <mat-card-content>
              <div class="metric-header">
                <div class="icon-circle bg-blue">
                  <mat-icon>account_balance</mat-icon>
                </div>
                <div class="status-tags">
                  <span class="tag-active">{{ ov.activeInstitutes }} Active</span>
                  @if (ov.inactiveInstitutes > 0) {
                    <span class="tag-inactive">{{ ov.inactiveInstitutes }} Disabled</span>
                  }
                </div>
              </div>
              <div class="metric-body">
                <span class="metric-value">{{ ov.totalInstitutes }}</span>
                <span class="metric-label">Total Institutes</span>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Total Students -->
          <mat-card class="metric-card border-teal">
            <mat-card-content>
              <div class="metric-header">
                <div class="icon-circle bg-teal">
                  <mat-icon>school</mat-icon>
                </div>
              </div>
              <div class="metric-body">
                <span class="metric-value">{{ ov.totalStudents }}</span>
                <span class="metric-label">Enrolled Students</span>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Total Staff -->
          <mat-card class="metric-card border-indigo">
            <mat-card-content>
              <div class="metric-header">
                <div class="icon-circle bg-indigo">
                  <mat-icon>badge</mat-icon>
                </div>
              </div>
              <div class="metric-body">
                <span class="metric-value">{{ ov.totalStaff }}</span>
                <span class="metric-label">Faculty & Staff</span>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Total Parents -->
          <mat-card class="metric-card border-purple">
            <mat-card-content>
              <div class="metric-header">
                <div class="icon-circle bg-purple">
                  <mat-icon>family_restroom</mat-icon>
                </div>
              </div>
              <div class="metric-body">
                <span class="metric-value">{{ ov.totalParents }}</span>
                <span class="metric-label">Registered Parents</span>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Platform Attendance % -->
          <mat-card class="metric-card border-green">
            <mat-card-content>
              <div class="metric-header">
                <div class="icon-circle bg-green">
                  <mat-icon>fact_check</mat-icon>
                </div>
                <span class="recorded-count">{{ ov.totalAttendanceRecordedToday }} logged today</span>
              </div>
              <div class="metric-body">
                <span class="metric-value">{{ ov.todayAttendancePercent }}%</span>
                <span class="metric-label">Platform Attendance Today</span>
                <mat-progress-bar mode="determinate" [value]="ov.todayAttendancePercent" class="mt-2"></mat-progress-bar>
              </div>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Registration Trends Chart / Card -->
        <mat-card class="chart-card mt-3">
          <mat-card-header>
            <mat-card-title>
              <mat-icon class="mr-2">trending_up</mat-icon> Platform Registration Trend (Past 14 Days)
            </mat-card-title>
          </mat-card-header>
          <mat-card-content class="chart-content">
            <div class="bars-container">
              @for (item of ov.registrationTrends; track item.date) {
                <div class="bar-col">
                  <div class="bar-val">{{ item.count }}</div>
                  <div class="bar-visual" [style.height.px]="getBarHeight(item.count)"></div>
                  <span class="bar-label">{{ item.date.substring(5) }}</span>
                </div>
              }
            </div>
          </mat-card-content>
        </mat-card>

        <!-- Institutes Management Table Section -->
        <mat-card class="institutes-card mt-3">
          <mat-card-header class="table-header">
            <div>
              <mat-card-title>Registered Tenant Institutes</mat-card-title>
              <mat-card-subtitle>Search, inspect details, and toggle active status for institutes</mat-card-subtitle>
            </div>
          </mat-card-header>

          <mat-card-content>
            <!-- Search & Filters -->
            <div class="filter-row">
              <mat-form-field appearance="outline" class="search-input">
                <mat-label>Search institute name, code, or city...</mat-label>
                <input matInput [(ngModel)]="searchQuery" (keyup.enter)="loadInstitutes()" placeholder="e.g. MIT, Cambridge" />
                <mat-icon matSuffix (click)="loadInstitutes()" class="cursor-pointer">search</mat-icon>
              </mat-form-field>

              <mat-form-field appearance="outline" class="status-select">
                <mat-label>Status</mat-label>
                <mat-select [(ngModel)]="statusFilter" (selectionChange)="loadInstitutes()">
                  <mat-option value="All">All Statuses</mat-option>
                  <mat-option value="Active">Active Only</mat-option>
                  <mat-option value="Inactive">Disabled Only</mat-option>
                </mat-select>
              </mat-form-field>

              <button mat-stroked-button color="primary" (click)="loadInstitutes()">
                <mat-icon>refresh</mat-icon> Refresh List
              </button>
            </div>

            @if (loadingInstitutes()) {
              <div class="text-center py-4">
                <mat-spinner diameter="32"></mat-spinner>
              </div>
            } @else if (institutes().length === 0) {
              <div class="text-center py-4 text-muted">
                <mat-icon class="large-icon">business</mat-icon>
                <p>No institutes found matching the criteria.</p>
              </div>
            } @else {
              <div class="table-container">
                <table mat-table [dataSource]="institutes()" class="responsive-table">
                  <!-- Name & Code -->
                  <ng-container matColumnDef="name">
                    <th mat-header-cell *matHeaderCellDef>Institute</th>
                    <td mat-cell *matCellDef="let inst">
                      <div class="inst-info-cell">
                        <strong>{{ inst.name }}</strong>
                        <span class="code-tag">{{ inst.code }}</span>
                      </div>
                    </td>
                  </ng-container>

                  <!-- Location -->
                  <ng-container matColumnDef="location">
                    <th mat-header-cell *matHeaderCellDef>Location</th>
                    <td mat-cell *matCellDef="let inst">{{ inst.city }}, {{ inst.state }}</td>
                  </ng-container>

                  <!-- Counts -->
                  <ng-container matColumnDef="stats">
                    <th mat-header-cell *matHeaderCellDef>Strength (Staff / Students / Classes)</th>
                    <td mat-cell *matCellDef="let inst">
                      <div class="counts-cell">
                        <span title="Faculty" class="count-tag"><mat-icon inline>badge</mat-icon> {{ inst.staffCount }}</span>
                        <span title="Students" class="count-tag"><mat-icon inline>groups</mat-icon> {{ inst.studentCount }}</span>
                        <span title="Classes" class="count-tag"><mat-icon inline>meeting_room</mat-icon> {{ inst.classCount }}</span>
                      </div>
                    </td>
                  </ng-container>

                  <!-- Today Attendance -->
                  <ng-container matColumnDef="attendance">
                    <th mat-header-cell *matHeaderCellDef>Today's %</th>
                    <td mat-cell *matCellDef="let inst">
                      <span class="pct-pill" [class.pct-high]="inst.todayAttendancePercent >= 75" [class.pct-low]="inst.todayAttendancePercent < 75 && inst.todayAttendancePercent > 0">
                        {{ inst.todayAttendancePercent }}%
                      </span>
                    </td>
                  </ng-container>

                  <!-- Status -->
                  <ng-container matColumnDef="status">
                    <th mat-header-cell *matHeaderCellDef>Status</th>
                    <td mat-cell *matCellDef="let inst">
                      <span class="status-pill" [class.bg-active]="inst.isActive" [class.bg-inactive]="!inst.isActive">
                        {{ inst.isActive ? 'Active' : 'Disabled' }}
                      </span>
                    </td>
                  </ng-container>

                  <!-- Actions -->
                  <ng-container matColumnDef="actions">
                    <th mat-header-cell *matHeaderCellDef>Actions</th>
                    <td mat-cell *matCellDef="let inst">
                      <div class="action-buttons">
                        <a mat-flat-button color="primary" [routerLink]="['/app/super-admin/institutes', inst.id]">
                          <mat-icon>visibility</mat-icon>
                          <span>Drill Down</span>
                        </a>

                        <button
                          mat-stroked-button
                          [color]="inst.isActive ? 'warn' : 'accent'"
                          (click)="toggleStatus(inst)">
                          <mat-icon>{{ inst.isActive ? 'block' : 'check_circle' }}</mat-icon>
                          <span>{{ inst.isActive ? 'Disable' : 'Enable' }}</span>
                        </button>
                      </div>
                    </td>
                  </ng-container>

                  <tr mat-header-row *matHeaderRowDef="columns"></tr>
                  <tr mat-row *matRowDef="let row; columns: columns;"></tr>
                </table>
              </div>
            }
          </mat-card-content>
        </mat-card>

        <!-- Recent Audit Log Activity Preview -->
        <mat-card class="audit-preview-card mt-3">
          <mat-card-header class="table-header">
            <div>
              <mat-card-title>Recent Platform Audit Trail</mat-card-title>
              <mat-card-subtitle>Latest administrative access and tenant modifications</mat-card-subtitle>
            </div>
            <a mat-button color="primary" routerLink="/app/super-admin/audit-logs">
              <span>View Full Audit Log</span>
              <mat-icon>chevron_right</mat-icon>
            </a>
          </mat-card-header>

          <mat-card-content>
            <div class="audit-list">
              @for (log of ov.recentAuditLogs; track log.id) {
                <div class="audit-item">
                  <div class="audit-time-col">
                    <span class="audit-time">{{ log.timestamp | date:'short' }}</span>
                    <small class="audit-user">{{ log.userEmail }}</small>
                  </div>
                  <div class="audit-desc-col">
                    <span class="action-badge">{{ log.action }}</span>
                    <span class="audit-details">{{ log.details }}</span>
                  </div>
                  <div class="audit-target-col">
                    <span class="target-name">{{ log.instituteName }}</span>
                    <small class="ip-addr">{{ log.ipAddress || 'Internal' }}</small>
                  </div>
                </div>
              }
            </div>
          </mat-card-content>
        </mat-card>
        }
      }
    </div>
  `,
  styles: [`
    .super-admin-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 16px;
    }
    .dashboard-header {
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
    .header-icon {
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
    .loading-state {
      text-align: center;
      padding: 40px;
      color: #777;
    }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
      gap: 12px;
    }
    .metric-card {
      border-radius: 12px;
      border-left: 4px solid #ccc;
      box-shadow: 0 1px 6px rgba(0,0,0,0.06);
    }
    .border-blue { border-left-color: #2196f3; }
    .border-teal { border-left-color: #009688; }
    .border-indigo { border-left-color: #3f51b5; }
    .border-purple { border-left-color: #9c27b0; }
    .border-green { border-left-color: #4caf50; }

    .metric-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 12px;
    }
    .icon-circle {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .bg-blue { background: #e3f2fd; color: #1976d2; }
    .bg-teal { background: #e0f2f1; color: #00897b; }
    .bg-indigo { background: #e8eaf6; color: #3949ab; }
    .bg-purple { background: #f3e5f5; color: #8e24aa; }
    .bg-green { background: #e8f5e9; color: #2e7d32; }

    .status-tags {
      display: flex;
      flex-direction: column;
      gap: 2px;
      align-items: flex-end;
    }
    .tag-active {
      font-size: 11px;
      background: #e8f5e9;
      color: #2e7d32;
      padding: 2px 6px;
      border-radius: 6px;
      font-weight: 600;
    }
    .tag-inactive {
      font-size: 11px;
      background: #ffebee;
      color: #c62828;
      padding: 2px 6px;
      border-radius: 6px;
      font-weight: 600;
    }
    .metric-value {
      font-size: 26px;
      font-weight: 700;
      color: #222;
      display: block;
    }
    .metric-label {
      font-size: 13px;
      color: #666;
      font-weight: 500;
    }
    .recorded-count {
      font-size: 11px;
      color: #666;
    }

    .chart-card {
      border-radius: 12px;
      border: 1px solid #e2e8f0;
    }
    .chart-content {
      padding: 16px !important;
    }
    .bars-container {
      display: flex;
      align-items: flex-end;
      gap: 12px;
      height: 120px;
      padding-top: 10px;
      overflow-x: auto;
    }
    .bar-col {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 4px;
      flex: 1;
      min-width: 45px;
    }
    .bar-visual {
      width: 24px;
      background: linear-gradient(180deg, #3f51b5 0%, #7986cb 100%);
      border-radius: 4px 4px 0 0;
      min-height: 4px;
      transition: height 0.3s ease;
    }
    .bar-val { font-size: 11px; font-weight: 600; color: #444; }
    .bar-label { font-size: 10px; color: #888; }

    .institutes-card, .audit-preview-card {
      border-radius: 12px;
      border: 1px solid #e2e8f0;
    }
    .table-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px 8px;
    }
    .filter-row {
      display: flex;
      gap: 12px;
      align-items: center;
      margin-bottom: 16px;
      flex-wrap: wrap;
    }
    .search-input { flex: 1; min-width: 240px; }
    .status-select { min-width: 140px; }
    .cursor-pointer { cursor: pointer; }
    .table-container { overflow-x: auto; }

    .inst-info-cell {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .code-tag {
      font-size: 11px;
      background: #eef2ff;
      color: #3730a3;
      padding: 1px 6px;
      border-radius: 4px;
      width: fit-content;
      font-weight: 600;
    }
    .counts-cell {
      display: flex;
      gap: 8px;
    }
    .count-tag {
      display: flex;
      align-items: center;
      gap: 3px;
      font-size: 12px;
      color: #555;
    }
    .pct-pill {
      font-size: 12px;
      font-weight: 700;
      padding: 2px 8px;
      border-radius: 10px;
      background: #f0f0f0;
    }
    .pct-high { background: #e8f5e9; color: #2e7d32; }
    .pct-low { background: #ffebee; color: #c62828; }

    .status-pill {
      font-size: 11px;
      font-weight: 600;
      padding: 2px 8px;
      border-radius: 8px;
      text-transform: uppercase;
    }
    .bg-active { background: #e8f5e9; color: #2e7d32; }
    .bg-inactive { background: #ffebee; color: #c62828; }

    .action-buttons {
      display: flex;
      gap: 8px;
    }

    .audit-list {
      display: flex;
      flex-direction: column;
      gap: 8px;
    }
    .audit-item {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      border-radius: 8px;
      background: #f8fafc;
      border: 1px solid #edf2f7;
      flex-wrap: wrap;
      gap: 8px;
    }
    .audit-time-col { display: flex; flex-direction: column; min-width: 140px; }
    .audit-time { font-size: 12px; font-weight: 600; }
    .audit-user { font-size: 11px; color: #666; }
    .audit-desc-col { display: flex; align-items: center; gap: 8px; flex: 1; min-width: 200px; }
    .action-badge {
      font-size: 10px;
      font-weight: 700;
      background: #e2e8f0;
      color: #334155;
      padding: 2px 6px;
      border-radius: 4px;
      text-transform: uppercase;
    }
    .audit-details { font-size: 12px; color: #333; }
    .audit-target-col { display: flex; flex-direction: column; align-items: flex-end; min-width: 120px; }
    .target-name { font-size: 12px; font-weight: 500; }
    .ip-addr { font-size: 10px; color: #888; font-family: monospace; }

    .mt-2 { margin-top: 8px; }
    .mt-3 { margin-top: 16px; }
    .mr-2 { margin-right: 8px; }
    .large-icon { font-size: 48px; width: 48px; height: 48px; color: #bbb; }
  `]
})
export class SuperAdminDashboardComponent implements OnInit {
  private superAdminService = inject(SuperAdminService);
  private snackBar = inject(MatSnackBar);

  loadingOverview = signal(true);
  loadingInstitutes = signal(false);
  overview = signal<PlatformOverview | null>(null);
  institutes = signal<SuperAdminInstituteItem[]>([]);

  searchQuery = '';
  statusFilter = 'All';

  columns = ['name', 'location', 'stats', 'attendance', 'status', 'actions'];

  ngOnInit(): void {
    this.loadOverview();
    this.loadInstitutes();
  }

  loadOverview(): void {
    this.loadingOverview.set(true);
    this.superAdminService.getPlatformOverview().subscribe({
      next: (res) => {
        this.overview.set(res);
        this.loadingOverview.set(false);
      },
      error: () => {
        this.loadingOverview.set(false);
        this.snackBar.open('Failed to load platform metrics.', 'Close', { duration: 3500 });
      }
    });
  }

  loadInstitutes(): void {
    this.loadingInstitutes.set(true);
    this.superAdminService.getInstitutes(this.searchQuery, this.statusFilter).subscribe({
      next: (list) => {
        this.institutes.set(list);
        this.loadingInstitutes.set(false);
      },
      error: () => {
        this.loadingInstitutes.set(false);
        this.snackBar.open('Failed to load institutes list.', 'Close', { duration: 3500 });
      }
    });
  }

  toggleStatus(inst: SuperAdminInstituteItem): void {
    const newStatus = !inst.isActive;
    const action = newStatus ? 'enable' : 'disable';
    if (!confirm(`Are you sure you want to ${action} ${inst.name}?`)) return;

    this.superAdminService.toggleInstituteStatus(inst.id, newStatus).subscribe({
      next: () => {
        inst.isActive = newStatus;
        this.snackBar.open(`Institute ${newStatus ? 'enabled' : 'disabled'} successfully.`, 'Close', { duration: 3000 });
        this.loadOverview();
      },
      error: () => {
        this.snackBar.open('Failed to update institute status.', 'Close', { duration: 3500 });
      }
    });
  }

  getBarHeight(count: number): number {
    if (!count) return 4;
    return Math.min(80, Math.max(10, count * 15));
  }
}
