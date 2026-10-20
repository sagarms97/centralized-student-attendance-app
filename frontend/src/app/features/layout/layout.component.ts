import { Component, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    MatSidenavModule,
    MatToolbarModule,
    MatListModule,
    MatIconModule,
    MatButtonModule,
    MatMenuModule,
    MatDividerModule
  ],
  template: `
    <div class="layout-container">
      <mat-toolbar color="primary" class="main-toolbar">
        <button mat-icon-button (click)="snav.toggle()" class="menu-toggle-btn">
          <mat-icon>menu</mat-icon>
        </button>

        <div class="brand-info">
          <mat-icon class="brand-icon">school</mat-icon>
          <div class="titles">
            <span class="app-title">EduAttend</span>
            @if (authService.currentInstitute(); as inst) {
              <span class="institute-sub">{{ inst.name }} ({{ inst.code }})</span>
            }
          </div>
        </div>

        <span class="spacer"></span>

        <div class="user-profile" [matMenuTriggerFor]="userMenu">
          <div class="avatar">{{ userInitials }}</div>
          <div class="user-meta desktop-only">
            <span class="user-name">{{ authService.currentUser()?.fullName }}</span>
            <span class="role-pill">{{ authService.currentUser()?.role }}</span>
          </div>
          <mat-icon>arrow_drop_down</mat-icon>
        </div>

        <mat-menu #userMenu="matMenu" xPosition="before">
          <div class="menu-header">
            <strong>{{ authService.currentUser()?.fullName }}</strong>
            <small>{{ authService.currentUser()?.email }}</small>
            <span class="role-pill mt-1">{{ authService.currentUser()?.role }}</span>
          </div>
          <mat-divider></mat-divider>
          <button mat-menu-item (click)="logout()">
            <mat-icon color="warn">logout</mat-icon>
            <span>Sign Out</span>
          </button>
        </mat-menu>
      </mat-toolbar>

      <mat-sidenav-container class="sidenav-container">
        <mat-sidenav #snav mode="side" opened class="app-sidenav">
          <mat-nav-list>
            <a mat-list-item routerLink="/app/dashboard" routerLinkActive="active-link" [routerLinkActiveOptions]="{exact: true}">
              <mat-icon matListItemIcon>dashboard</mat-icon>
              <span matListItemTitle>Dashboard</span>
            </a>

            @if (authService.isAdmin()) {
              <div class="nav-section-label">ADMINISTRATION</div>

              <a mat-list-item routerLink="/app/staff" routerLinkActive="active-link">
                <mat-icon matListItemIcon>badge</mat-icon>
                <span matListItemTitle>Staff Directory</span>
              </a>

              <a mat-list-item routerLink="/app/students" routerLinkActive="active-link">
                <mat-icon matListItemIcon>groups</mat-icon>
                <span matListItemTitle>Students & Import</span>
              </a>

              <a mat-list-item routerLink="/app/timetable" routerLinkActive="active-link">
                <mat-icon matListItemIcon>calendar_month</mat-icon>
                <span matListItemTitle>Timetable Setup</span>
              </a>
            }

            <div class="nav-section-label">ATTENDANCE</div>

            @if (authService.isStaff() || authService.isAdmin()) {
              <a mat-list-item routerLink="/app/attendance" routerLinkActive="active-link">
                <mat-icon matListItemIcon>fact_check</mat-icon>
                <span matListItemTitle>Mark Attendance</span>
              </a>

              <a mat-list-item routerLink="/app/swaps" routerLinkActive="active-link">
                <mat-icon matListItemIcon>swap_horiz</mat-icon>
                <span matListItemTitle>Period Swaps</span>
              </a>
            }

            <a mat-list-item routerLink="/app/reports" routerLinkActive="active-link">
              <mat-icon matListItemIcon>assessment</mat-icon>
              <span matListItemTitle>Reports & Defaulters</span>
            </a>
          </mat-nav-list>
        </mat-sidenav>

        <mat-sidenav-content class="content-wrapper">
          <router-outlet></router-outlet>
        </mat-sidenav-content>
      </mat-sidenav-container>
    </div>
  `,
  styles: [`
    .layout-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
    }
    .main-toolbar {
      height: 64px;
      z-index: 10;
      box-shadow: 0 2px 4px rgba(0,0,0,0.15);
      background-color: #1a237e;
      color: white;
    }
    .brand-info {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-left: 8px;
    }
    .brand-icon {
      font-size: 28px;
      width: 28px;
      height: 28px;
    }
    .titles {
      display: flex;
      flex-direction: column;
      .app-title {
        font-size: 1.2rem;
        font-weight: 700;
        letter-spacing: 0.5px;
      }
      .institute-sub {
        font-size: 0.75rem;
        color: #b0bec5;
      }
    }
    .sidenav-container {
      flex: 1;
    }
    .app-sidenav {
      width: 240px;
      background-color: #ffffff;
      border-right: 1px solid #e0e0e0;
      padding-top: 12px;
    }
    .nav-section-label {
      padding: 16px 16px 6px;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 1px;
      color: #9e9e9e;
    }
    .active-link {
      background-color: #e8eaf6 !important;
      color: #1a237e !important;
      font-weight: 600;
      mat-icon {
        color: #1a237e;
      }
    }
    .content-wrapper {
      background-color: #f4f6f9;
      overflow-y: auto;
    }
    .user-profile {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      padding: 6px 12px;
      border-radius: 24px;
      background: rgba(255,255,255,0.1);
      &:hover {
        background: rgba(255,255,255,0.18);
      }
    }
    .avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: #004d40;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.85rem;
    }
    .user-meta {
      display: flex;
      flex-direction: column;
      text-align: left;
      .user-name {
        font-size: 0.85rem;
        font-weight: 600;
      }
    }
    .role-pill {
      display: inline-block;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 2px 6px;
      border-radius: 10px;
      background: rgba(255,255,255,0.25);
      text-transform: uppercase;
      align-self: flex-start;
    }
    .menu-header {
      padding: 12px 16px;
      display: flex;
      flex-direction: column;
      gap: 2px;
      .role-pill {
        background: #e8eaf6;
        color: #1a237e;
      }
    }
    @media (max-width: 768px) {
      .desktop-only {
        display: none;
      }
    }
  `]
})
export class LayoutComponent {
  authService = inject(AuthService);

  get userInitials(): string {
    const name = this.authService.currentUser()?.fullName || 'User';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  logout(): void {
    this.authService.logout();
  }
}
