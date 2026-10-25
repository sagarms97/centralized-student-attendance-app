import { Routes } from '@angular/router';
import { authGuard, adminGuard, superAdminGuard } from './core/guards/auth.guard';
import { LoginComponent } from './features/auth/login/login.component';
import { RegisterComponent } from './features/auth/register/register.component';
import { LayoutComponent } from './features/layout/layout.component';
import { DashboardComponent } from './features/dashboard/dashboard.component';

export const routes: Routes = [
  { path: '', redirectTo: 'login', pathMatch: 'full' },
  { path: 'login', component: LoginComponent },
  { path: 'register', component: RegisterComponent },
  {
    path: 'forgot-password',
    loadComponent: () => import('./features/auth/forgot-password/forgot-password.component').then(m => m.ForgotPasswordComponent)
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent)
  },
  {
    path: 'register-invite',
    loadComponent: () => import('./features/auth/register-invite/register-invite.component').then(m => m.RegisterInviteComponent)
  },
  {
    path: 'app',
    component: LayoutComponent,
    canActivate: [authGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', component: DashboardComponent },
      {
        path: 'staff',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/staff/staff-list.component').then(m => m.StaffListComponent)
      },
      {
        path: 'students',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/students/student-list.component').then(m => m.StudentListComponent)
      },
      {
        path: 'parents',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/parents/parents-list.component').then(m => m.ParentsListComponent)
      },
      {
        path: 'subjects',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/subjects/subjects-list.component').then(m => m.SubjectsListComponent)
      },
      {
        path: 'timetable',
        loadComponent: () => import('./features/timetable/timetable.component').then(m => m.TimetableComponent)
      },
      {
        path: 'approvals',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/approvals/approvals-list.component').then(m => m.ApprovalsListComponent)
      },
      {
        path: 'attendance',
        loadComponent: () => import('./features/attendance/mark-attendance.component').then(m => m.MarkAttendanceComponent)
      },
      {
        path: 'swaps',
        loadComponent: () => import('./features/swaps/period-swaps.component').then(m => m.PeriodSwapsComponent)
      },
      {
        path: 'reports',
        loadComponent: () => import('./features/reports/reports.component').then(m => m.ReportsComponent)
      },
      {
        path: 'parent-portal',
        loadComponent: () => import('./features/parents/parent-portal.component').then(m => m.ParentPortalComponent)
      },
      {
        path: 'leaves',
        loadComponent: () => import('./features/parents/leave-approvals.component').then(m => m.LeaveApprovalsComponent)
      },
      {
        path: 'face-attendance/settings',
        canActivate: [adminGuard],
        loadComponent: () => import('./features/face-attendance/face-settings.component').then(m => m.FaceSettingsComponent)
      },
      {
        path: 'face-attendance/consent',
        loadComponent: () => import('./features/face-attendance/face-consent.component').then(m => m.FaceConsentComponent)
      },
      {
        path: 'face-attendance/enrollment',
        loadComponent: () => import('./features/face-attendance/face-enrollment.component').then(m => m.FaceEnrollmentComponent)
      },
      {
        path: 'face-attendance/capture',
        loadComponent: () => import('./features/face-attendance/face-camera-capture.component').then(m => m.FaceCameraCaptureComponent)
      },
      {
        path: 'super-admin',
        canActivate: [superAdminGuard],
        loadComponent: () => import('./features/super-admin/super-admin-dashboard.component').then(m => m.SuperAdminDashboardComponent)
      },
      {
        path: 'super-admin/institutes/:id',
        canActivate: [superAdminGuard],
        loadComponent: () => import('./features/super-admin/institute-detail.component').then(m => m.InstituteDetailComponent)
      },
      {
        path: 'super-admin/audit-logs',
        canActivate: [superAdminGuard],
        loadComponent: () => import('./features/super-admin/audit-logs.component').then(m => m.AuditLogsComponent)
      }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
