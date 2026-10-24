import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { FormsModule } from '@angular/forms';
import { SuperAdminService } from '../../core/services/super-admin.service';
import { SuperAdminInstituteDetail, SuperAdminStudentItem } from '../../core/models/super-admin.models';
import { StudentAttendanceDialogComponent } from './student-attendance-dialog.component';

@Component({
  selector: 'app-institute-detail',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatChipsModule,
    MatTabsModule,
    MatTableModule,
    MatProgressSpinnerModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatDialogModule,
    MatFormFieldModule,
    MatInputModule
  ],
  template: `
    <div class="institute-detail-container">
      <div class="top-nav-bar">
        <a mat-button routerLink="/app/super-admin" class="back-link">
          <mat-icon>arrow_back</mat-icon> Back to All Institutes
        </a>
      </div>

      @if (loading()) {
        <div class="loading-state">
          <mat-spinner diameter="44"></mat-spinner>
          <p>Loading institute drill-down details...</p>
        </div>
      } @else {
        @if (detail(); as inst) {
        <!-- Institute Hero Banner -->
        <mat-card class="hero-banner">
          <mat-card-content class="hero-content">
            <div class="inst-logo-col">
              <div class="inst-avatar">
                <mat-icon>school</mat-icon>
              </div>
            </div>

            <div class="inst-meta-col">
              <div class="title-status-row">
                <h2>{{ inst.name }}</h2>
                <span class="code-pill">{{ inst.code }}</span>
                <span class="status-pill" [class.bg-active]="inst.isActive" [class.bg-inactive]="!inst.isActive">
                  {{ inst.isActive ? 'Active' : 'Disabled' }}
                </span>
              </div>

              <div class="contact-details">
                <span><mat-icon inline>email</mat-icon> {{ inst.contactEmail }}</span>
                <span><mat-icon inline>phone</mat-icon> {{ inst.contactPhone }}</span>
                <span><mat-icon inline>location_on</mat-icon> {{ inst.city }}, {{ inst.state }} &bull; {{ inst.address }}</span>
              </div>
            </div>

            <div class="inst-actions-col">
              <button
                mat-flat-button
                [color]="inst.isActive ? 'warn' : 'primary'"
                (click)="toggleStatus(inst)"
                [disabled]="togglingStatus()">
                <mat-icon>{{ inst.isActive ? 'block' : 'check_circle' }}</mat-icon>
                <span>{{ inst.isActive ? 'Disable Institute' : 'Enable Institute' }}</span>
              </button>
            </div>
          </mat-card-content>
        </mat-card>

        <!-- KPI Metric Cards Grid -->
        <div class="kpi-grid mt-3">
          <mat-card class="kpi-card border-blue">
            <mat-card-content>
              <div class="kpi-num">{{ inst.studentCount }}</div>
              <div class="kpi-lbl">Total Students</div>
              <small class="kpi-sub">Enrolled active learners</small>
            </mat-card-content>
          </mat-card>

          <mat-card class="kpi-card border-teal">
            <mat-card-content>
              <div class="kpi-num">{{ inst.staffCount }}</div>
              <div class="kpi-lbl">Faculty & Staff</div>
              <small class="kpi-sub">Teachers & instructors</small>
            </mat-card-content>
          </mat-card>

          <mat-card class="kpi-card border-amber">
            <mat-card-content>
              <div class="kpi-num">{{ inst.classCount }}</div>
              <div class="kpi-lbl">Classes</div>
              <small class="kpi-sub">Academic standards</small>
            </mat-card-content>
          </mat-card>

          <mat-card class="kpi-card border-purple">
            <mat-card-content>
              <div class="kpi-num">{{ inst.parentCount }}</div>
              <div class="kpi-lbl">Parents Linked</div>
              <small class="kpi-sub">Family portal accounts</small>
            </mat-card-content>
          </mat-card>

          <mat-card class="kpi-card border-green">
            <mat-card-content>
              <div class="kpi-num">{{ inst.todayAttendancePercent }}%</div>
              <div class="kpi-lbl">Today's Attendance</div>
              <small class="kpi-sub">Live daily average</small>
            </mat-card-content>
          </mat-card>

          <mat-card class="kpi-card border-cyan">
            <mat-card-content>
              <div class="kpi-num">{{ inst.monthAttendancePercent }}%</div>
              <div class="kpi-lbl">Monthly Attendance</div>
              <small class="kpi-sub">Current calendar month</small>
            </mat-card-content>
          </mat-card>
        </div>

        <!-- Detailed Tabs Navigation -->
        <mat-card class="content-tabs-card mt-3">
          <mat-tab-group animationDuration="200ms">
            <!-- Tab 1: Class-wise Strength -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="mr-2">groups</mat-icon> Class Strength ({{ inst.classStrength.length }})
              </ng-template>
              <div class="tab-padding">
                @if (inst.classStrength.length === 0) {
                  <p class="text-muted text-center py-4">No classes created yet in this institute.</p>
                } @else {
                  <div class="class-grid">
                    @for (c of inst.classStrength; track c.classId) {
                      <div class="class-card">
                        <div class="class-card-header">
                          <strong>{{ c.className }}</strong>
                          <span class="sections-badge">Sec: {{ c.sections }}</span>
                        </div>
                        <div class="class-card-body">
                          <span class="strength-num">{{ c.studentCount }}</span>
                          <span class="strength-lbl">enrolled students</span>
                        </div>
                      </div>
                    }
                  </div>
                }
              </div>
            </mat-tab>

            <!-- Tab 2: Students & Attendance Drill-Down -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="mr-2">person_search</mat-icon> Students & Attendance History ({{ inst.studentList.length }})
              </ng-template>
              <div class="tab-padding">
                <div class="filter-bar">
                  <mat-form-field appearance="outline" class="search-field">
                    <mat-label>Search student by name, roll no, or section...</mat-label>
                    <input matInput [(ngModel)]="studentSearch" placeholder="e.g. John, 2026-CS" />
                    <mat-icon matSuffix>search</mat-icon>
                  </mat-form-field>
                </div>

                <div class="table-container">
                  <table mat-table [dataSource]="filteredStudents()" class="responsive-table">
                    <!-- Roll No -->
                    <ng-container matColumnDef="rollNo">
                      <th mat-header-cell *matHeaderCellDef>Roll No</th>
                      <td mat-cell *matCellDef="let s"><strong>{{ s.rollNo }}</strong></td>
                    </ng-container>

                    <!-- Name -->
                    <ng-container matColumnDef="fullName">
                      <th mat-header-cell *matHeaderCellDef>Student Name</th>
                      <td mat-cell *matCellDef="let s">{{ s.fullName }}</td>
                    </ng-container>

                    <!-- Class & Section -->
                    <ng-container matColumnDef="class">
                      <th mat-header-cell *matHeaderCellDef>Class & Sec</th>
                      <td mat-cell *matCellDef="let s">{{ s.className }} - {{ s.section }}</td>
                    </ng-container>

                    <!-- Parent Phone -->
                    <ng-container matColumnDef="parentPhone">
                      <th mat-header-cell *matHeaderCellDef>Parent Contact</th>
                      <td mat-cell *matCellDef="let s">{{ s.parentPhone }}</td>
                    </ng-container>

                    <!-- Attendance % -->
                    <ng-container matColumnDef="attendance">
                      <th mat-header-cell *matHeaderCellDef>Attendance %</th>
                      <td mat-cell *matCellDef="let s">
                        <span class="pct-badge" [class.pct-good]="s.attendancePercentage >= 75" [class.pct-low]="s.attendancePercentage < 75">
                          {{ s.attendancePercentage }}%
                        </span>
                      </td>
                    </ng-container>

                    <!-- Actions -->
                    <ng-container matColumnDef="actions">
                      <th mat-header-cell *matHeaderCellDef>Drill-Down</th>
                      <td mat-cell *matCellDef="let s">
                        <button mat-stroked-button color="primary" (click)="openStudentAttendance(s)">
                          <mat-icon>history</mat-icon> View Log
                        </button>
                      </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="studentColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: studentColumns;" class="clickable-row"></tr>
                  </table>
                </div>
              </div>
            </mat-tab>

            <!-- Tab 3: Staff Directory -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="mr-2">badge</mat-icon> Staff Directory ({{ inst.staffList.length }})
              </ng-template>
              <div class="tab-padding">
                <div class="table-container">
                  <table mat-table [dataSource]="inst.staffList" class="responsive-table">
                    <ng-container matColumnDef="employeeId">
                      <th mat-header-cell *matHeaderCellDef>Emp ID</th>
                      <td mat-cell *matCellDef="let st"><strong>{{ st.employeeId }}</strong></td>
                    </ng-container>

                    <ng-container matColumnDef="fullName">
                      <th mat-header-cell *matHeaderCellDef>Teacher Name</th>
                      <td mat-cell *matCellDef="let st">{{ st.fullName }}</td>
                    </ng-container>

                    <ng-container matColumnDef="email">
                      <th mat-header-cell *matHeaderCellDef>Email</th>
                      <td mat-cell *matCellDef="let st">{{ st.email }}</td>
                    </ng-container>

                    <ng-container matColumnDef="phone">
                      <th mat-header-cell *matHeaderCellDef>Phone</th>
                      <td mat-cell *matCellDef="let st">{{ st.phone }}</td>
                    </ng-container>

                    <ng-container matColumnDef="specialization">
                      <th mat-header-cell *matHeaderCellDef>Specialization</th>
                      <td mat-cell *matCellDef="let st">{{ st.subjectSpecialization || 'General' }}</td>
                    </ng-container>

                    <ng-container matColumnDef="status">
                      <th mat-header-cell *matHeaderCellDef>Status</th>
                      <td mat-cell *matCellDef="let st">
                        <span class="status-pill" [class.bg-active]="st.isActive" [class.bg-inactive]="!st.isActive">
                          {{ st.isActive ? 'Active' : 'Inactive' }}
                        </span>
                      </td>
                    </ng-container>

                    <tr mat-header-row *matHeaderRowDef="staffColumns"></tr>
                    <tr mat-row *matRowDef="let row; columns: staffColumns;"></tr>
                  </table>
                </div>
              </div>
            </mat-tab>

            <!-- Tab 4: Subjects & Timetable Summary -->
            <mat-tab>
              <ng-template mat-tab-label>
                <mat-icon class="mr-2">calendar_month</mat-icon> Timetable & Subjects
              </ng-template>
              <div class="tab-padding">
                <h4>Weekly Timetable Slot Coverage</h4>
                <div class="timetable-grid">
                  @for (t of inst.timetableSummary; track t.dayOfWeek) {
                    <div class="timetable-card">
                      <span class="day-name">{{ t.dayOfWeek }}</span>
                      <div class="slot-count"><strong>{{ t.totalSlots }}</strong> slots</div>
                      <small class="slot-details">{{ t.activeSubjects }} subjects &bull; {{ t.activeTeachers }} teachers</small>
                    </div>
                  }
                </div>

                <h4 class="mt-4">Subjects Catalogue ({{ inst.subjects.length }})</h4>
                <div class="subjects-grid">
                  @for (sub of inst.subjects; track sub.id) {
                    <div class="subject-card">
                      <strong>{{ sub.name }}</strong>
                      <span class="sub-code">{{ sub.code }}</span>
                      <small class="assigned-classes">{{ sub.assignedClassesCount }} classes assigned</small>
                    </div>
                  }
                </div>
              </div>
            </mat-tab>
          </mat-tab-group>
        </mat-card>
        }
      }
    </div>
  `,
  styles: [`
    .institute-detail-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 16px;
    }
    .top-nav-bar {
      margin-bottom: 12px;
    }
    .back-link {
      font-weight: 500;
      color: #3f51b5;
    }
    .hero-banner {
      border-radius: 12px;
      border: 1px solid #e0e7ff;
      background: linear-gradient(135deg, #ffffff 0%, #f4f6fb 100%);
    }
    .hero-content {
      display: flex;
      align-items: center;
      gap: 20px;
      flex-wrap: wrap;
      padding: 20px !important;
    }
    .inst-avatar {
      width: 60px;
      height: 60px;
      border-radius: 12px;
      background: #3f51b5;
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .inst-avatar mat-icon { font-size: 32px; width: 32px; height: 32px; }
    .inst-meta-col { flex: 1; min-width: 260px; }
    .title-status-row {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    .title-status-row h2 { margin: 0; font-size: 22px; font-weight: 700; }
    .code-pill {
      background: #e0e7ff;
      color: #3730a3;
      padding: 2px 8px;
      border-radius: 8px;
      font-size: 12px;
      font-weight: 600;
    }
    .status-pill {
      font-size: 11px;
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .bg-active { background: #e8f5e9; color: #2e7d32; }
    .bg-inactive { background: #ffebee; color: #c62828; }
    .contact-details {
      display: flex;
      gap: 16px;
      margin-top: 8px;
      font-size: 13px;
      color: #555;
      flex-wrap: wrap;
    }
    .contact-details span { display: flex; align-items: center; gap: 4px; }
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(170px, 1fr));
      gap: 12px;
    }
    .kpi-card {
      border-radius: 10px;
      border-left: 4px solid #ccc;
      box-shadow: 0 1px 4px rgba(0,0,0,0.05);
    }
    .border-blue { border-left-color: #2196f3; }
    .border-teal { border-left-color: #009688; }
    .border-amber { border-left-color: #ff9800; }
    .border-purple { border-left-color: #9c27b0; }
    .border-green { border-left-color: #4caf50; }
    .border-cyan { border-left-color: #00bcd4; }
    .kpi-num { font-size: 24px; font-weight: 700; color: #222; }
    .kpi-lbl { font-size: 13px; font-weight: 600; color: #555; }
    .kpi-sub { font-size: 11px; color: #888; }
    .content-tabs-card {
      border-radius: 12px;
      overflow: hidden;
    }
    .tab-padding { padding: 20px 16px; }
    .class-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
      gap: 12px;
    }
    .class-card {
      padding: 14px;
      border-radius: 10px;
      border: 1px solid #e2e8f0;
      background: #fafafa;
    }
    .class-card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .sections-badge {
      font-size: 11px;
      background: #e2e8f0;
      padding: 1px 6px;
      border-radius: 6px;
    }
    .strength-num { font-size: 22px; font-weight: 700; color: #1a237e; display: block; }
    .strength-lbl { font-size: 11px; color: #777; }
    .timetable-grid, .subjects-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
      gap: 12px;
    }
    .timetable-card, .subject-card {
      padding: 12px;
      border-radius: 8px;
      border: 1px solid #e0e0e0;
      background: #fff;
      display: flex;
      flex-direction: column;
      gap: 4px;
    }
    .day-name { font-weight: 600; font-size: 13px; color: #333; }
    .slot-count { font-size: 14px; }
    .slot-details { font-size: 11px; color: #777; }
    .sub-code { font-size: 12px; color: #666; font-family: monospace; }
    .assigned-classes { font-size: 11px; color: #1976d2; }
    .pct-badge {
      padding: 2px 8px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 12px;
    }
    .pct-good { background: #e8f5e9; color: #2e7d32; }
    .pct-low { background: #ffebee; color: #c62828; }
    .clickable-row:hover { background: #f8fafc; }
    .mt-3 { margin-top: 16px; }
    .mt-4 { margin-top: 24px; }
    .mr-2 { margin-right: 8px; }
    .search-field { width: 100%; max-width: 400px; }
    .table-container { overflow-x: auto; }
    .loading-state { text-align: center; padding: 40px; }
  `]
})
export class InstituteDetailComponent implements OnInit {
  private route = inject(ActivatedRoute);
  private superAdminService = inject(SuperAdminService);
  private snackBar = inject(MatSnackBar);
  private dialog = inject(MatDialog);

  loading = signal(true);
  detail = signal<SuperAdminInstituteDetail | null>(null);
  togglingStatus = signal(false);
  studentSearch = '';

  studentColumns = ['rollNo', 'fullName', 'class', 'parentPhone', 'attendance', 'actions'];
  staffColumns = ['employeeId', 'fullName', 'email', 'phone', 'specialization', 'status'];

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));
    if (id) {
      this.loadDetail(id);
    }
  }

  loadDetail(id: number): void {
    this.loading.set(true);
    this.superAdminService.getInstituteDetail(id).subscribe({
      next: (data) => {
        this.detail.set(data);
        this.loading.set(false);
      },
      error: () => {
        this.loading.set(false);
        this.snackBar.open('Failed to load institute details.', 'Close', { duration: 3500 });
      }
    });
  }

  filteredStudents(): SuperAdminStudentItem[] {
    const list = this.detail()?.studentList || [];
    if (!this.studentSearch) return list;
    const term = this.studentSearch.trim().toLowerCase();
    return list.filter(s =>
      s.fullName.toLowerCase().includes(term) ||
      s.rollNo.toLowerCase().includes(term) ||
      s.section.toLowerCase().includes(term)
    );
  }

  toggleStatus(inst: SuperAdminInstituteDetail): void {
    const newStatus = !inst.isActive;
    const action = newStatus ? 'enable' : 'disable';
    if (!confirm(`Are you sure you want to ${action} ${inst.name}?`)) return;

    this.togglingStatus.set(true);
    this.superAdminService.toggleInstituteStatus(inst.id, newStatus).subscribe({
      next: () => {
        this.togglingStatus.set(false);
        inst.isActive = newStatus;
        this.snackBar.open(`Institute ${newStatus ? 'enabled' : 'disabled'} successfully.`, 'Close', { duration: 3000 });
      },
      error: () => {
        this.togglingStatus.set(false);
        this.snackBar.open('Failed to update institute status.', 'Close', { duration: 3500 });
      }
    });
  }

  openStudentAttendance(student: SuperAdminStudentItem): void {
    this.dialog.open(StudentAttendanceDialogComponent, {
      width: '640px',
      data: {
        studentId: student.id,
        studentName: student.fullName
      }
    });
  }
}
