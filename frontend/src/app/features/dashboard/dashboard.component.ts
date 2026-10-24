import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { AuthService } from '../../core/services/auth.service';
import { environment } from '../../../environments/environment';

interface DashboardStats {
  todayAttendancePercent: number;
  totalPresentToday: number;
  totalAbsentToday: number;
  totalStudents: number;
  totalStaff: number;
  pendingSwapsCount: number;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatProgressBarModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Welcome, {{ authService.currentUser()?.fullName }}</h1>
          <p class="subtitle">Institute Overview & Attendance Monitoring</p>
        </div>
        <div class="quick-actions">
          @if (authService.isAdmin()) {
            <a mat-stroked-button color="primary" routerLink="/app/students">
              <mat-icon>person_add</mat-icon> Manage Students
            </a>
            <a mat-flat-button color="primary" routerLink="/app/timetable">
              <mat-icon>schedule</mat-icon> Timetable
            </a>
          } @else {
            <a mat-flat-button color="primary" routerLink="/app/attendance">
              <mat-icon>fact_check</mat-icon> Mark Today's Attendance
            </a>
          }
        </div>
      </div>

      <!-- Metric Cards Grid -->
      <div class="stats-grid">
        <mat-card class="stat-card primary-border">
          <mat-card-content>
            <div class="stat-icon-wrapper bg-blue">
              <mat-icon>how_to_reg</mat-icon>
            </div>
            <div class="stat-details">
              <span class="stat-label">Today's Attendance</span>
              <span class="stat-value">{{ stats().todayAttendancePercent }}%</span>
              <mat-progress-bar mode="determinate" [value]="stats().todayAttendancePercent" class="mt-2"></mat-progress-bar>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card warn-border">
          <mat-card-content>
            <div class="stat-icon-wrapper bg-red">
              <mat-icon>person_off</mat-icon>
            </div>
            <div class="stat-details">
              <span class="stat-label">Absentees Today</span>
              <span class="stat-value">{{ stats().totalAbsentToday }}</span>
              <span class="stat-sub">Across all recorded classes</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card accent-border">
          <mat-card-content>
            <div class="stat-icon-wrapper bg-teal">
              <mat-icon>groups</mat-icon>
            </div>
            <div class="stat-details">
              <span class="stat-label">Total Enrolled Students</span>
              <span class="stat-value">{{ stats().totalStudents }}</span>
              <span class="stat-sub">Active enrollments</span>
            </div>
          </mat-card-content>
        </mat-card>

        <mat-card class="stat-card orange-border">
          <mat-card-content>
            <div class="stat-icon-wrapper bg-orange">
              <mat-icon>swap_calls</mat-icon>
            </div>
            <div class="stat-details">
              <span class="stat-label">Pending Period Swaps</span>
              <span class="stat-value">{{ stats().pendingSwapsCount }}</span>
              <span class="stat-sub">Awaiting confirmation</span>
            </div>
          </mat-card-content>
        </mat-card>
      </div>

      <!-- Quick Shortcuts / Overview Banner -->
      <div class="banner-card mt-4">
        <mat-card>
          <mat-card-content class="info-banner">
            <div class="info-text">
              <h2>Multi-Tenant Architecture Active</h2>
              <p>Your workspace is strictly isolated under <strong>{{ authService.currentInstitute()?.name }}</strong> (Code: <code>{{ authService.currentInstitute()?.code }}</code>). All queries automatically apply EF Core tenant filters.</p>
            </div>
            <div class="banner-actions">
              <a mat-raised-button color="accent" routerLink="/app/reports">
                <mat-icon>analytics</mat-icon> View Analytics & Defaulters
              </a>
            </div>
          </mat-card-content>
        </mat-card>
      </div>
    </div>
  `,
  styles: [`
    .subtitle {
      color: #666;
      margin: 4px 0 0 0;
      font-size: 0.95rem;
    }
    .quick-actions {
      display: flex;
      gap: 12px;
    }
    .stats-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
      gap: 20px;
      margin-top: 20px;
    }
    .stat-card {
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      border-top: 4px solid transparent;
      &.primary-border { border-top-color: #1a237e; }
      &.warn-border { border-top-color: #d32f2f; }
      &.accent-border { border-top-color: #00796b; }
      &.orange-border { border-top-color: #f57c00; }

      mat-card-content {
        display: flex;
        align-items: center;
        gap: 16px;
        padding: 20px 16px !important;
      }
    }
    .stat-icon-wrapper {
      width: 52px;
      height: 52px;
      border-radius: 12px;
      display: flex;
      align-items: center;
      justify-content: center;
      flex-shrink: 0;
      mat-icon {
        font-size: 28px;
        width: 28px;
        height: 28px;
        color: white;
      }
      &.bg-blue { background: #1a237e; }
      &.bg-red { background: #d32f2f; }
      &.bg-teal { background: #00796b; }
      &.bg-orange { background: #f57c00; }
    }
    .stat-details {
      flex: 1;
      display: flex;
      flex-direction: column;
      .stat-label {
        font-size: 0.85rem;
        color: #666;
        font-weight: 500;
      }
      .stat-value {
        font-size: 1.6rem;
        font-weight: 700;
        color: #2c3e50;
      }
      .stat-sub {
        font-size: 0.75rem;
        color: #999;
      }
    }
    .banner-card {
      mat-card {
        border-radius: 12px;
        background: #f8fafc;
        border: 1px solid #e2e8f0;
      }
    }
    .info-banner {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 24px !important;
      flex-wrap: wrap;
      gap: 16px;
      h2 {
        margin: 0 0 6px 0;
        font-size: 1.25rem;
        color: #1a237e;
      }
      p {
        margin: 0;
        color: #555;
      }
    }
    .mt-2 { margin-top: 8px; }
    .mt-4 { margin-top: 24px; }
  `]
})
export class DashboardComponent implements OnInit {
  authService = inject(AuthService);
  private http = inject(HttpClient);
  private router = inject(Router);

  stats = signal<DashboardStats>({
    todayAttendancePercent: 0,
    totalPresentToday: 0,
    totalAbsentToday: 0,
    totalStudents: 0,
    totalStaff: 0,
    pendingSwapsCount: 0
  });

  ngOnInit(): void {
    if (this.authService.isSuperAdmin()) {
      this.router.navigate(['/app/super-admin']);
      return;
    }
    if (this.authService.isParent()) {
      this.router.navigate(['/app/parent-portal']);
      return;
    }
    this.loadStats();
  }

  loadStats(): void {
    this.http.get<DashboardStats>(`${environment.apiUrl}/dashboard/stats`).subscribe({
      next: (data) => this.stats.set(data),
      error: () => {
        // Fallback / initial zero stats until attendance is populated
      }
    });
  }
}
