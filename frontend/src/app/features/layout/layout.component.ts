import { Component, inject, ViewChild, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { BreakpointObserver, Breakpoints } from '@angular/cdk/layout';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs/operators';
import { MatSidenav, MatSidenavModule } from '@angular/material/sidenav';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatListModule } from '@angular/material/list';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { AuthService } from '../../core/services/auth.service';
import { ApprovalService } from '../../core/services/approval.service';
import { LeaveService } from '../../core/services/leave.service';
import { ProfileDialogComponent } from '../profile/profile-dialog.component';

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
    MatDividerModule,
    MatBadgeModule,
    MatDialogModule
  ],
  template: `
    <div class="layout-container" [class.mobile-layout]="isHandset()">
      <!-- Main Top Toolbar -->
      <mat-toolbar color="primary" class="main-toolbar">
        <button mat-icon-button (click)="snav.toggle()" class="menu-toggle-btn" aria-label="Toggle navigation menu">
          <mat-icon>menu</mat-icon>
        </button>

        <div class="brand-info">
          <mat-icon class="brand-icon">school</mat-icon>
          <div class="titles">
            <span class="app-title">EduAttend</span>
            @if (authService.currentInstitute(); as inst) {
              <span class="institute-sub">{{ inst.name }}</span>
            } @else if (authService.isSuperAdmin()) {
              <span class="institute-sub">Platform Administration</span>
            }
          </div>
        </div>

        <span class="spacer"></span>

        <!-- User Profile Pill & Dropdown -->
        <div class="user-profile" [matMenuTriggerFor]="userMenu">
          <div class="avatar">{{ userInitials }}</div>
          <div class="user-meta desktop-only">
            <span class="user-name">{{ authService.currentUser()?.fullName }}</span>
            <span class="role-pill">{{ authService.currentUser()?.role }}</span>
          </div>
          <mat-icon class="dropdown-icon">arrow_drop_down</mat-icon>
        </div>

        <mat-menu #userMenu="matMenu" xPosition="before">
          <div class="menu-header">
            <strong>{{ authService.currentUser()?.fullName }}</strong>
            <small>{{ authService.currentUser()?.email }}</small>
            <span class="role-pill mt-1">{{ authService.currentUser()?.role }}</span>
          </div>
          <mat-divider></mat-divider>
          <button mat-menu-item (click)="openProfileDialog()">
            <mat-icon color="primary">account_circle</mat-icon>
            <span>My Profile & Security</span>
          </button>
          <mat-divider></mat-divider>
          <button mat-menu-item (click)="logout()">
            <mat-icon color="warn">logout</mat-icon>
            <span>Sign Out</span>
          </button>
        </mat-menu>
      </mat-toolbar>

      <mat-sidenav-container class="sidenav-container">
        <!-- Collapsible / Responsive Sidenav -->
        <mat-sidenav
          #snav
          [mode]="isHandset() ? 'over' : 'side'"
          [opened]="!isHandset()"
          class="app-sidenav"
          [fixedInViewport]="isHandset()"
          [fixedTopGap]="isHandset() ? 56 : 0">

          <mat-nav-list>
            @if (authService.isSuperAdmin()) {
              <div class="nav-section-label">PLATFORM ADMIN</div>

              <a mat-list-item routerLink="/app/super-admin" routerLinkActive="active-link" [routerLinkActiveOptions]="{exact: true}" (click)="closeIfHandset()">
                <mat-icon matListItemIcon>admin_panel_settings</mat-icon>
                <span matListItemTitle>Platform Overview</span>
              </a>

              <a mat-list-item routerLink="/app/super-admin/audit-logs" routerLinkActive="active-link" (click)="closeIfHandset()">
                <mat-icon matListItemIcon>security</mat-icon>
                <span matListItemTitle>Platform Audit Logs</span>
              </a>
            } @else {
              <a mat-list-item routerLink="/app/dashboard" routerLinkActive="active-link" [routerLinkActiveOptions]="{exact: true}" (click)="closeIfHandset()">
                <mat-icon matListItemIcon>dashboard</mat-icon>
                <span matListItemTitle>Dashboard</span>
              </a>
            }

            <!-- Institute Admin Menu -->
            @if (authService.isAdmin()) {
              <div class="nav-section-label">ADMINISTRATION</div>

              <a mat-list-item routerLink="/app/staff" routerLinkActive="active-link" (click)="closeIfHandset()">
                <mat-icon matListItemIcon>badge</mat-icon>
                <span matListItemTitle>Staff Directory</span>
              </a>

              <a mat-list-item routerLink="/app/students" routerLinkActive="active-link" (click)="closeIfHandset()">
                <mat-icon matListItemIcon>groups</mat-icon>
                <span matListItemTitle>Students & Import</span>
              </a>

              <a mat-list-item routerLink="/app/parents" routerLinkActive="active-link" (click)="closeIfHandset()">
                <mat-icon matListItemIcon>family_restroom</mat-icon>
                <span matListItemTitle>Parent Directory</span>
              </a>

              <a mat-list-item routerLink="/app/subjects" routerLinkActive="active-link" (click)="closeIfHandset()">
                <mat-icon matListItemIcon>menu_book</mat-icon>
                <span matListItemTitle>Subjects Setup</span>
              </a>

              <a mat-list-item routerLink="/app/timetable" routerLinkActive="active-link" (click)="closeIfHandset()">
                <mat-icon matListItemIcon>calendar_month</mat-icon>
                <span matListItemTitle>Timetable Setup</span>
              </a>

              <a mat-list-item routerLink="/app/approvals" routerLinkActive="active-link" (click)="closeIfHandset()">
                <mat-icon matListItemIcon [matBadge]="pendingApprovalsCount()" [matBadgeHidden]="pendingApprovalsCount() === 0" matBadgeColor="warn" matBadgeSize="small">
                  how_to_reg
                </mat-icon>
                <span matListItemTitle>Approvals</span>
              </a>
            }

            <!-- Staff & Admin Operations -->
            @if (authService.isStaff() || authService.isAdmin()) {
              <div class="nav-section-label">ATTENDANCE & OPERATIONS</div>

              <a mat-list-item routerLink="/app/attendance" routerLinkActive="active-link" (click)="closeIfHandset()">
                <mat-icon matListItemIcon>fact_check</mat-icon>
                <span matListItemTitle>Mark Attendance</span>
              </a>

              <a mat-list-item routerLink="/app/swaps" routerLinkActive="active-link" (click)="closeIfHandset()">
                <mat-icon matListItemIcon>swap_horiz</mat-icon>
                <span matListItemTitle>Period Swaps</span>
              </a>

              <a mat-list-item routerLink="/app/leaves" routerLinkActive="active-link" (click)="closeIfHandset()">
                <mat-icon matListItemIcon [matBadge]="pendingLeavesCount()" [matBadgeHidden]="pendingLeavesCount() === 0" matBadgeColor="warn" matBadgeSize="small">
                  event_busy
                </mat-icon>
                <span matListItemTitle>Leave Requests</span>
              </a>

              <a mat-list-item routerLink="/app/reports" routerLinkActive="active-link" (click)="closeIfHandset()">
                <mat-icon matListItemIcon>assessment</mat-icon>
                <span matListItemTitle>Reports & Analytics</span>
              </a>
            }

            <!-- Parent Specific Links -->
            @if (authService.isParent()) {
              <div class="nav-section-label">MY FAMILY</div>

              <a mat-list-item routerLink="/app/parent-portal" routerLinkActive="active-link" (click)="closeIfHandset()">
                <mat-icon matListItemIcon>family_restroom</mat-icon>
                <span matListItemTitle>Parent Portal & Attendance</span>
              </a>

              <a mat-list-item routerLink="/app/leaves" routerLinkActive="active-link" (click)="closeIfHandset()">
                <mat-icon matListItemIcon [matBadge]="pendingLeavesCount()" [matBadgeHidden]="pendingLeavesCount() === 0" matBadgeColor="warn" matBadgeSize="small">
                  event_note
                </mat-icon>
                <span matListItemTitle>Leave Requests</span>
              </a>
            }
          </mat-nav-list>
        </mat-sidenav>

        <mat-sidenav-content class="content-wrapper" [class.mobile-content]="isHandset()">
          <router-outlet></router-outlet>
        </mat-sidenav-content>
      </mat-sidenav-container>

      <!-- Bottom Navigation Bar for Mobile -->
      @if (isHandset()) {
        <nav class="bottom-nav">
          @if (authService.isSuperAdmin()) {
            <a routerLink="/app/super-admin" routerLinkActive="active-bottom" class="bottom-nav-item">
              <mat-icon>admin_panel_settings</mat-icon>
              <span>Overview</span>
            </a>

            <a routerLink="/app/super-admin/audit-logs" routerLinkActive="active-bottom" class="bottom-nav-item">
              <mat-icon>security</mat-icon>
              <span>Audit Logs</span>
            </a>
          } @else {
            <a routerLink="/app/dashboard" routerLinkActive="active-bottom" class="bottom-nav-item">
              <mat-icon>dashboard</mat-icon>
              <span>Home</span>
            </a>
          }

          @if (authService.isAdmin()) {
            <a routerLink="/app/students" routerLinkActive="active-bottom" class="bottom-nav-item">
              <mat-icon>groups</mat-icon>
              <span>Students</span>
            </a>

            <a routerLink="/app/parents" routerLinkActive="active-bottom" class="bottom-nav-item">
              <mat-icon>family_restroom</mat-icon>
              <span>Parents</span>
            </a>

            <a routerLink="/app/attendance" routerLinkActive="active-bottom" class="bottom-nav-item">
              <mat-icon>fact_check</mat-icon>
              <span>Attendance</span>
            </a>
          } @else if (authService.isStaff()) {
            <a routerLink="/app/attendance" routerLinkActive="active-bottom" class="bottom-nav-item">
              <mat-icon>fact_check</mat-icon>
              <span>Mark</span>
            </a>

            <a routerLink="/app/swaps" routerLinkActive="active-bottom" class="bottom-nav-item">
              <mat-icon>swap_horiz</mat-icon>
              <span>Swaps</span>
            </a>

            <a routerLink="/app/reports" routerLinkActive="active-bottom" class="bottom-nav-item">
              <mat-icon>assessment</mat-icon>
              <span>Reports</span>
            </a>
          } @else if (authService.isParent()) {
            <a routerLink="/app/parent-portal" routerLinkActive="active-bottom" class="bottom-nav-item">
              <mat-icon>family_restroom</mat-icon>
              <span>Children</span>
            </a>

            <a routerLink="/app/leaves" routerLinkActive="active-bottom" class="bottom-nav-item">
              <mat-icon>event_note</mat-icon>
              <span>Leaves</span>
            </a>
          }

          <button type="button" class="bottom-nav-item menu-trigger" (click)="snav.toggle()">
            <mat-icon>menu</mat-icon>
            <span>Menu</span>
          </button>
        </nav>
      }
    </div>
  `,
  styles: [`
    .layout-container {
      display: flex;
      flex-direction: column;
      height: 100vh;
      overflow: hidden;
    }
    .main-toolbar {
      height: 64px;
      z-index: 10;
      box-shadow: 0 2px 4px rgba(0,0,0,0.15);
      background-color: #1a237e;
      color: white;
      flex-shrink: 0;
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
        font-size: 1.15rem;
        font-weight: 700;
        letter-spacing: 0.5px;
        line-height: 1.2;
      }
      .institute-sub {
        font-size: 0.72rem;
        color: #b0bec5;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        max-width: 200px;
      }
    }
    .sidenav-container {
      flex: 1;
      height: calc(100vh - 64px);
    }
    .app-sidenav {
      width: 250px;
      background-color: #ffffff;
      border-right: 1px solid #e2e8f0;
      padding-top: 12px;
    }
    .nav-section-label {
      padding: 16px 16px 6px;
      font-size: 0.7rem;
      font-weight: 700;
      letter-spacing: 1px;
      color: #94a3b8;
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
      height: 100%;
    }
    .mobile-content {
      padding-bottom: 64px; /* Space for bottom navigation */
    }
    .user-profile {
      display: flex;
      align-items: center;
      gap: 10px;
      cursor: pointer;
      padding: 6px 12px;
      border-radius: 24px;
      background: rgba(255,255,255,0.1);
      transition: background-color 0.2s;
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
        line-height: 1.2;
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

    /* Bottom Navigation for Mobile */
    .bottom-nav {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      height: 58px;
      background: #ffffff;
      border-top: 1px solid #e2e8f0;
      display: flex;
      justify-content: space-around;
      align-items: center;
      z-index: 100;
      box-shadow: 0 -2px 8px rgba(0,0,0,0.06);
    }
    .bottom-nav-item {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      flex: 1;
      height: 100%;
      text-decoration: none;
      color: #64748b;
      font-size: 0.72rem;
      font-weight: 500;
      background: none;
      border: none;
      padding: 0;
      cursor: pointer;
      gap: 2px;
      transition: color 0.15s ease-in-out;

      mat-icon {
        font-size: 22px;
        width: 22px;
        height: 22px;
      }

      &.active-bottom {
        color: #1a237e;
        font-weight: 700;
        mat-icon {
          color: #1a237e;
        }
      }
    }

    @media (max-width: 768px) {
      .main-toolbar {
        height: 56px;
      }
      .desktop-only {
        display: none !important;
      }
      .dropdown-icon {
        display: none;
      }
      .user-profile {
        padding: 4px;
        background: transparent;
      }
      .sidenav-container {
        height: calc(100vh - 56px);
      }
    }
  `]
})
export class LayoutComponent implements OnInit {
  authService = inject(AuthService);
  private approvalService = inject(ApprovalService);
  private leaveService = inject(LeaveService);
  private breakpointObserver = inject(BreakpointObserver);
  private dialog = inject(MatDialog);

  @ViewChild('snav') snav?: MatSidenav;

  pendingApprovalsCount = signal<number>(0);
  pendingLeavesCount = signal<number>(0);

  isHandset = toSignal(
    this.breakpointObserver
      .observe([Breakpoints.Handset, '(max-width: 768px)'])
      .pipe(map(result => result.matches)),
    { initialValue: false }
  );

  ngOnInit(): void {
    if (this.authService.isAdmin()) {
      this.approvalService.getPendingCount().subscribe({
        next: count => this.pendingApprovalsCount.set(count)
      });
    }

    this.leaveService.getPendingCount().subscribe({
      next: count => this.pendingLeavesCount.set(count),
      error: () => {}
    });
  }

  get userInitials(): string {
    const name = this.authService.currentUser()?.fullName || 'User';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  openProfileDialog(): void {
    this.dialog.open(ProfileDialogComponent, { width: '560px' });
  }

  closeIfHandset(): void {
    if (this.isHandset() && this.snav) {
      this.snav.close();
    }
  }

  logout(): void {
    this.authService.logout();
  }
}
