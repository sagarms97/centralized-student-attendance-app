import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TimetableService } from '../../core/services/timetable.service';
import { AcademicService } from '../../core/services/academic.service';
import { AuthService } from '../../core/services/auth.service';
import { Period, TimetableEntry } from '../../core/models/timetable.models';
import { ClassItem } from '../../core/models/academic.models';
import { TimetableDialogComponent, TimetableDialogData } from './timetable-dialog.component';

interface DayConfig {
  dayOfWeek: number;
  name: string;
}

@Component({
  selector: 'app-timetable',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDialogModule,
    MatSnackBarModule,
    MatExpansionModule,
    MatTooltipModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Timetable Management</h1>
          <p class="subtitle">Weekly class scheduling and periods configuration</p>
        </div>
      </div>

      <!-- Periods Configuration Panel -->
      @if (authService.isAdmin()) {
        <mat-accordion class="mb-4">
          <mat-expansion-panel>
            <mat-expansion-panel-header>
              <mat-panel-title>
                <mat-icon class="mr-2">schedule</mat-icon> Configure Daily Periods / Slots
              </mat-panel-title>
              <mat-panel-description>
                {{ periods().length }} Periods defined in daily schedule
              </mat-panel-description>
            </mat-expansion-panel-header>

            <div class="period-management">
              <div class="add-period-form">
                <mat-form-field appearance="outline" class="w-80">
                  <mat-label>Period #</mat-label>
                  <input matInput type="number" [(ngModel)]="newPeriodNum" placeholder="1">
                </mat-form-field>

                <mat-form-field appearance="outline" class="flex-1">
                  <mat-label>Period Name</mat-label>
                  <input matInput [(ngModel)]="newPeriodName" placeholder="e.g. Period 1">
                </mat-form-field>

                <mat-form-field appearance="outline" class="w-120">
                  <mat-label>Start Time (HH:mm)</mat-label>
                  <input matInput [(ngModel)]="newStartTime" placeholder="09:00">
                </mat-form-field>

                <mat-form-field appearance="outline" class="w-120">
                  <mat-label>End Time (HH:mm)</mat-label>
                  <input matInput [(ngModel)]="newEndTime" placeholder="10:00">
                </mat-form-field>

                <button mat-flat-button color="accent" (click)="addPeriod()">
                  <mat-icon>add</mat-icon> Add Period
                </button>
              </div>

              <div class="periods-badge-list">
                @for (p of periods(); track p.id) {
                  <div class="period-card">
                    <div class="period-badge-num">{{ p.periodNumber }}</div>
                    <div class="period-info">
                      <strong>{{ p.name }}</strong>
                      <small>{{ p.timeFormatted }}</small>
                    </div>
                    <button mat-icon-button color="warn" (click)="deletePeriod(p.id)" matTooltip="Remove Period">
                      <mat-icon>delete_outline</mat-icon>
                    </button>
                  </div>
                }
              </div>
            </div>
          </mat-expansion-panel>
        </mat-accordion>
      }

      <!-- Class & Section Selector -->
      <mat-card class="filter-card">
        <mat-card-content class="filter-row">
          <mat-form-field appearance="outline" class="filter-select">
            <mat-label>Select Class</mat-label>
            <mat-select [(ngModel)]="selectedClassId" (selectionChange)="onClassSelected()">
              @for (c of classes(); track c.id) {
                <mat-option [value]="c.id">{{ c.name }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="filter-select">
            <mat-label>Section</mat-label>
            <mat-select [(ngModel)]="selectedSection" (selectionChange)="loadTimetable()">
              @for (s of availableSections(); track s) {
                <mat-option [value]="s">Section {{ s }}</mat-option>
              }
            </mat-select>
          </mat-form-field>

          <button mat-stroked-button color="primary" (click)="loadTimetable()" [disabled]="!selectedClassId">
            <mat-icon>refresh</mat-icon> Refresh Grid
          </button>
        </mat-card-content>
      </mat-card>

      <!-- Matrix Grid -->
      <div class="matrix-container mt-4">
        @if (periods().length === 0) {
          <mat-card class="empty-card">
            <mat-card-content>
              <mat-icon class="empty-icon">schedule</mat-icon>
              <h3>No Periods Configured</h3>
              <p>Please expand the "Configure Daily Periods" panel above to define periods.</p>
            </mat-card-content>
          </mat-card>
        } @else if (!selectedClassId) {
          <mat-card class="empty-card">
            <mat-card-content>
              <mat-icon class="empty-icon">school</mat-icon>
              <h3>Select a Class & Section</h3>
              <p>Choose an academic class above to view and assign its weekly timetable.</p>
            </mat-card-content>
          </mat-card>
        } @else {
          <div class="table-wrapper">
            <table class="matrix-table">
              <thead>
                <tr>
                  <th class="day-col-header">Day</th>
                  @for (p of periods(); track p.id) {
                    <th class="period-col-header">
                      <div class="th-pname">{{ p.name }}</div>
                      <div class="th-ptime">{{ p.timeFormatted }}</div>
                    </th>
                  }
                </tr>
              </thead>
              <tbody>
                @for (day of days; track day.dayOfWeek) {
                  <tr>
                    <td class="day-cell">
                      <strong>{{ day.name }}</strong>
                    </td>
                    @for (p of periods(); track p.id) {
                      <td class="slot-cell">
                        @if (getEntry(day.dayOfWeek, p.id); as entry) {
                          <div class="assigned-slot">
                            <div class="slot-subj">{{ entry.subjectName }}</div>
                            <div class="slot-code">{{ entry.subjectCode }}</div>
                            <div class="slot-staff">
                              <mat-icon>person</mat-icon>
                              <span>{{ entry.staffName }}</span>
                            </div>
                            @if (authService.isAdmin()) {
                              <button mat-icon-button class="del-slot-btn" (click)="deleteEntry(entry.id)" matTooltip="Remove Assignment">
                                <mat-icon>close</mat-icon>
                              </button>
                            }
                          </div>
                        } @else {
                          @if (authService.isAdmin()) {
                            <button mat-button class="empty-slot-btn" (click)="openSlotDialog(day, p)">
                              <mat-icon>add</mat-icon>
                              <span>Assign</span>
                            </button>
                          } @else {
                            <span class="free-slot">Free</span>
                          }
                        }
                      </td>
                    }
                  </tr>
                }
              </tbody>
            </table>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .subtitle { color: #666; margin: 4px 0 0 0; }
    .mr-2 { margin-right: 8px; }
    .mb-4 { margin-bottom: 20px; }
    .mt-4 { margin-top: 24px; }
    .w-80 { width: 90px; }
    .w-120 { width: 150px; }
    .flex-1 { flex: 1; }
    .period-management { padding: 12px 0; }
    .add-period-form {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
      margin-bottom: 16px;
    }
    .periods-badge-list {
      display: flex;
      flex-wrap: wrap;
      gap: 12px;
    }
    .period-card {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 14px;
      background: #e8eaf6;
      border-radius: 8px;
      border-left: 4px solid #1a237e;
    }
    .period-badge-num {
      width: 28px;
      height: 28px;
      border-radius: 50%;
      background: #1a237e;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.85rem;
    }
    .period-info {
      display: flex;
      flex-direction: column;
      font-size: 0.85rem;
      small { color: #555; }
    }
    .filter-card { border-radius: 12px; }
    .filter-row {
      display: flex;
      gap: 16px;
      align-items: center;
      padding: 12px 16px !important;
      flex-wrap: wrap;
    }
    .filter-select { min-width: 220px; margin-bottom: -1.25em; }
    .table-wrapper {
      overflow-x: auto;
      background: white;
      border-radius: 12px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.05);
      border: 1px solid #e2e8f0;
    }
    .matrix-table {
      width: 100%;
      border-collapse: collapse;
      text-align: center;
    }
    .day-col-header {
      width: 130px;
      background: #1a237e;
      color: white;
      padding: 14px 16px;
      font-size: 0.95rem;
    }
    .period-col-header {
      background: #283593;
      color: white;
      padding: 12px 16px;
      min-width: 170px;
      border-left: 1px solid rgba(255,255,255,0.15);
      .th-pname { font-weight: 600; font-size: 0.95rem; }
      .th-ptime { font-size: 0.75rem; color: #b0bec5; margin-top: 2px; }
    }
    .day-cell {
      background: #f8fafc;
      font-weight: 600;
      color: #1a237e;
      border-bottom: 1px solid #e2e8f0;
      border-right: 2px solid #cbd5e1;
      padding: 14px;
    }
    .slot-cell {
      border: 1px solid #e2e8f0;
      padding: 8px;
      vertical-align: top;
      height: 90px;
    }
    .assigned-slot {
      position: relative;
      background: #e0f2f1;
      border: 1px solid #80cbc4;
      border-radius: 8px;
      padding: 8px;
      text-align: left;
      height: 100%;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
      .slot-subj { font-weight: 700; color: #004d40; font-size: 0.85rem; }
      .slot-code { font-size: 0.75rem; color: #00796b; font-family: monospace; }
      .slot-staff {
        display: flex;
        align-items: center;
        gap: 4px;
        font-size: 0.75rem;
        color: #334155;
        margin-top: 4px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; color: #00796b; }
      }
      .del-slot-btn {
        position: absolute;
        top: 2px;
        right: 2px;
        width: 22px;
        height: 22px;
        line-height: 22px;
        mat-icon { font-size: 14px; width: 14px; height: 14px; color: #d32f2f; }
      }
    }
    .empty-slot-btn {
      width: 100%;
      height: 100%;
      min-height: 70px;
      border: 1px dashed #cbd5e1;
      color: #94a3b8;
      border-radius: 8px;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 2px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }
      span { font-size: 0.75rem; }
      &:hover { border-color: #1a237e; color: #1a237e; background: #e8eaf6; }
    }
    .free-slot { color: #cbd5e1; font-size: 0.85rem; font-style: italic; }
    .empty-card {
      text-align: center;
      padding: 48px;
      border-radius: 12px;
      .empty-icon { font-size: 54px; width: 54px; height: 54px; color: #cbd5e1; }
      h3 { margin: 12px 0 4px 0; color: #1e293b; }
      p { margin: 0; color: #64748b; }
    }
  `]
})
export class TimetableComponent implements OnInit {
  authService = inject(AuthService);
  private timetableService = inject(TimetableService);
  private academicService = inject(AcademicService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  classes = signal<ClassItem[]>([]);
  availableSections = signal<string[]>(['A', 'B']);
  periods = signal<Period[]>([]);
  entries = signal<TimetableEntry[]>([]);

  selectedClassId: number | null = null;
  selectedSection = 'A';

  // Period Form
  newPeriodNum = 1;
  newPeriodName = 'Period 1';
  newStartTime = '09:00';
  newEndTime = '10:00';

  days: DayConfig[] = [
    { dayOfWeek: 1, name: 'Monday' },
    { dayOfWeek: 2, name: 'Tuesday' },
    { dayOfWeek: 3, name: 'Wednesday' },
    { dayOfWeek: 4, name: 'Thursday' },
    { dayOfWeek: 5, name: 'Friday' },
    { dayOfWeek: 6, name: 'Saturday' }
  ];

  ngOnInit(): void {
    this.loadAcademicData();
    this.loadPeriods();
  }

  loadAcademicData(): void {
    this.academicService.getClasses().subscribe((res) => {
      this.classes.set(res);
      if (res.length > 0 && !this.selectedClassId) {
        this.selectedClassId = res[0].id;
        this.onClassSelected();
      }
    });
  }

  loadPeriods(): void {
    this.timetableService.getPeriods().subscribe({
      next: (res) => {
        this.periods.set(res);
        this.newPeriodNum = res.length + 1;
        this.newPeriodName = `Period ${this.newPeriodNum}`;
      }
    });
  }

  onClassSelected(): void {
    const cls = this.classes().find(c => c.id === this.selectedClassId);
    if (cls && cls.sections) {
      const sects = cls.sections.split(',').map(s => s.trim());
      this.availableSections.set(sects);
      if (!sects.includes(this.selectedSection)) {
        this.selectedSection = sects[0];
      }
    }
    this.loadTimetable();
  }

  loadTimetable(): void {
    if (!this.selectedClassId) return;
    this.timetableService.getClassTimetable(this.selectedClassId, this.selectedSection).subscribe({
      next: (data) => this.entries.set(data),
      error: () => this.snackBar.open('Failed to load timetable', 'Close', { duration: 3000 })
    });
  }

  getEntry(dayOfWeek: number, periodId: number): TimetableEntry | undefined {
    return this.entries().find(e => e.dayOfWeek === dayOfWeek && e.periodId === periodId);
  }

  addPeriod(): void {
    if (!this.newPeriodNum || !this.newPeriodName.trim() || !this.newStartTime || !this.newEndTime) {
      this.snackBar.open('Please fill all period details', 'Close', { duration: 3000 });
      return;
    }

    this.timetableService.createPeriod({
      periodNumber: this.newPeriodNum,
      name: this.newPeriodName.trim(),
      startTime: this.newStartTime,
      endTime: this.newEndTime
    }).subscribe({
      next: () => {
        this.snackBar.open('Period added to daily schedule', 'Close', { duration: 3000 });
        this.loadPeriods();
      },
      error: (err) => this.snackBar.open(err.error?.message || 'Failed to add period', 'Close', { duration: 4000 })
    });
  }

  deletePeriod(id: number): void {
    if (confirm('Delete this period? Any timetable slots under this period will be unassigned.')) {
      this.timetableService.deletePeriod(id).subscribe(() => {
        this.loadPeriods();
        this.loadTimetable();
      });
    }
  }

  openSlotDialog(day: DayConfig, period: Period): void {
    const cls = this.classes().find(c => c.id === this.selectedClassId);
    if (!cls) return;

    const dialogData: TimetableDialogData = {
      classId: cls.id,
      className: cls.name,
      section: this.selectedSection,
      dayOfWeek: day.dayOfWeek,
      dayName: day.name,
      periodId: period.id,
      periodName: `${period.name} (${period.timeFormatted})`
    };

    const ref = this.dialog.open(TimetableDialogComponent, { width: '480px', data: dialogData });
    ref.afterClosed().subscribe((res) => {
      if (res) {
        this.timetableService.createEntry({
          classId: cls.id,
          section: this.selectedSection,
          dayOfWeek: day.dayOfWeek,
          periodId: period.id,
          subjectId: res.subjectId,
          staffId: res.staffId
        }).subscribe({
          next: () => {
            this.snackBar.open('Slot scheduled successfully!', 'Close', { duration: 3000 });
            this.loadTimetable();
          },
          error: (err) => {
            this.snackBar.open(err.error?.message || 'Double-booking clash detected!', 'Close', { duration: 6000 });
          }
        });
      }
    });
  }

  deleteEntry(id: number): void {
    if (confirm('Remove this timetable entry?')) {
      this.timetableService.deleteEntry(id).subscribe({
        next: () => {
          this.snackBar.open('Slot removed', 'Close', { duration: 2500 });
          this.loadTimetable();
        }
      });
    }
  }
}
