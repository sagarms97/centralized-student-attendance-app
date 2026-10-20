import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { adminGuard } from './core/guards/auth.guard';
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
      }
    ]
  },
  { path: '**', redirectTo: 'login' }
];
