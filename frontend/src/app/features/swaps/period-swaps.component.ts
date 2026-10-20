import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormBuilder, FormsModule, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatDialog, MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AttendanceService } from '../../core/services/attendance.service';
import { StaffService } from '../../core/services/staff.service';
import { TimetableService } from '../../core/services/timetable.service';
import { AuthService } from '../../core/services/auth.service';
import { PeriodSwapRequestItem } from '../../core/models/attendance.models';
import { Staff } from '../../core/models/academic.models';
import { TimetableEntry } from '../../core/models/timetable.models';

@Component({
  selector: 'app-swap-request-dialog',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    MatDialogModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatButtonModule,
    MatIconModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon color="primary">swap_horiz</mat-icon>
      <span>Request Period Substitution / Swap</span>
    </h2>

    <mat-dialog-content>
      <form [formGroup]="form" class="dialog-form">
        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Substitution Date</mat-label>
          <input matInput type="date" formControlName="swapDate" (change)="onDateChanged()">
          @if (form.get('swapDate')?.hasError('required')) {
            <mat-error>Date is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Select Your Scheduled Slot</mat-label>
          <mat-select formControlName="timetableEntryId">
            @for (slot of mySlots(); track slot.id) {
              <mat-option [value]="slot.id">
                {{ slot.dayName }} - {{ slot.periodName }} ({{ slot.className }} Sec {{ slot.section }}: {{ slot.subjectName }})
              </mat-option>
            }
          </mat-select>
          @if (form.get('timetableEntryId')?.hasError('required')) {
            <mat-error>Slot is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Substitute Teacher</mat-label>
          <mat-select formControlName="targetStaffId">
            @for (st of colleagues(); track st.id) {
              <mat-option [value]="st.id">{{ st.fullName }} ({{ st.employeeId }})</mat-option>
            }
          </mat-select>
          @if (form.get('targetStaffId')?.hasError('required')) {
            <mat-error>Target teacher is required</mat-error>
          }
        </mat-form-field>

        <mat-form-field appearance="outline" class="full-width">
          <mat-label>Reason for Substitution</mat-label>
          <textarea matInput formControlName="reason" rows="3" placeholder="e.g. Attending academic conference..."></textarea>
        </mat-form-field>
      </form>
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary" [disabled]="form.invalid" (click)="save()">
        Submit Swap Request
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-form {
      min-width: 480px;
      display: flex;
      flex-direction: column;
      gap: 12px;
      padding-top: 8px;
    }
    .full-width { width: 100%; }
    h2 { display: flex; align-items: center; gap: 8px; color: #1a237e; }
  `]
})
export class SwapRequestDialogComponent implements OnInit {
  private fb = inject(FormBuilder);
  private authService = inject(AuthService);
  private staffService = inject(StaffService);
  private timetableService = inject(TimetableService);
  dialogRef = inject(MatDialogRef<SwapRequestDialogComponent>);

  mySlots = signal<TimetableEntry[]>([]);
  colleagues = signal<Staff[]>([]);

  form = this.fb.group({
    swapDate: [new Date().toISOString().substring(0, 10), Validators.required],
    timetableEntryId: [null as number | null, Validators.required],
    targetStaffId: [null as number | null, Validators.required],
    reason: ['']
  });

  ngOnInit(): void {
    const user = this.authService.currentUser();
    const myStaffId = user?.staffId;

    if (myStaffId) {
      this.timetableService.getStaffTimetable(myStaffId).subscribe(res => this.mySlots.set(res));
    }

    this.staffService.getAll(false).subscribe(res => {
      // Filter out current user from substitute options
      this.colleagues.set(res.filter(s => s.id !== myStaffId && s.isActive));
    });
  }

  onDateChanged(): void {
    // Optionally filter slots for the selected day of week
  }

  save(): void {
    if (this.form.invalid) return;
    this.dialogRef.close(this.form.value);
  }
}

@Component({
  selector: 'app-period-swaps',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatSnackBarModule,
    MatDialogModule,
    MatTooltipModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Period Substitution & Swapping</h1>
          <p class="subtitle">Temporary period handovers and replacement requests</p>
        </div>
        <button mat-flat-button color="primary" (click)="openRequestDialog()">
          <mat-icon>add</mat-icon> Request Period Swap
        </button>
      </div>

      <mat-card class="table-card mt-3">
        <table mat-table [dataSource]="requests()" class="full-width">
          <!-- Date Column -->
          <ng-container matColumnDef="date">
            <th mat-header-cell *matHeaderCellDef>Swap Date</th>
            <td mat-cell *matCellDef="let r">
              <span class="date-badge">{{ r.swapDate }}</span>
            </td>
          </ng-container>

          <!-- Period & Subject Column -->
          <ng-container matColumnDef="period">
            <th mat-header-cell *matHeaderCellDef>Period & Subject</th>
            <td mat-cell *matCellDef="let r">
              <div><strong>{{ r.periodName }}</strong> ({{ r.timeRange }})</div>
              <small class="text-teal">{{ r.className }} - Sec {{ r.section }} | {{ r.subjectName }}</small>
            </td>
          </ng-container>

          <!-- Requester Column -->
          <ng-container matColumnDef="requester">
            <th mat-header-cell *matHeaderCellDef>Original Teacher</th>
            <td mat-cell *matCellDef="let r">
              <strong>{{ r.requesterStaffName }}</strong>
            </td>
          </ng-container>

          <!-- Substitute Column -->
          <ng-container matColumnDef="substitute">
            <th mat-header-cell *matHeaderCellDef>Substitute Teacher</th>
            <td mat-cell *matCellDef="let r">
              <strong>{{ r.targetStaffName }}</strong>
            </td>
          </ng-container>

          <!-- Reason Column -->
          <ng-container matColumnDef="reason">
            <th mat-header-cell *matHeaderCellDef>Reason</th>
            <td mat-cell *matCellDef="let r">
              <span class="reason-text">{{ r.reason || 'No reason specified' }}</span>
            </td>
          </ng-container>

          <!-- Status Column -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let r">
              <span class="badge"
                    [class.badge-pending]="r.status === 'Pending'"
                    [class.badge-approved]="r.status === 'Approved'"
                    [class.badge-rejected]="r.status === 'Rejected'">
                {{ r.status }}
              </span>
            </td>
          </ng-container>

          <!-- Actions Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Actions</th>
            <td mat-cell *matCellDef="let r">
              @if (r.canRespond) {
                <button mat-icon-button color="primary" matTooltip="Approve Substitution" (click)="respond(r, 'Approved')">
                  <mat-icon>check_circle</mat-icon>
                </button>
                <button mat-icon-button color="warn" matTooltip="Reject Request" (click)="respond(r, 'Rejected')">
                  <mat-icon>cancel</mat-icon>
                </button>
              } @else {
                <span class="text-muted">-</span>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="columns"></tr>
          <tr mat-row *matRowDef="let row; columns: columns;"></tr>

          <tr class="mat-row" *matNoDataRow>
            <td class="mat-cell empty-state" colspan="7">
              <mat-icon>swap_calls</mat-icon>
              <p>No period swap requests found.</p>
            </td>
          </tr>
        </table>
      </mat-card>
    </div>
  `,
  styles: [`
    .subtitle { color: #666; margin: 4px 0 0 0; }
    .table-card { border-radius: 12px; overflow: hidden; }
    .full-width { width: 100%; }
    .date-badge { font-family: monospace; font-weight: 700; color: #1a237e; background: #e8eaf6; padding: 3px 8px; border-radius: 6px; }
    .text-teal { color: #00796b; }
    .text-muted { color: #94a3b8; }
    .reason-text { font-size: 0.85rem; color: #475569; }
    .mt-3 { margin-top: 16px; }
    .empty-state { text-align: center; padding: 48px; color: #999; mat-icon { font-size: 48px; width: 48px; height: 48px; } }
  `]
})
export class PeriodSwapsComponent implements OnInit {
  private attendanceService = inject(AttendanceService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  columns = ['date', 'period', 'requester', 'substitute', 'reason', 'status', 'actions'];
  requests = signal<PeriodSwapRequestItem[]>([]);

  ngOnInit(): void {
    this.loadRequests();
  }

  loadRequests(): void {
    this.attendanceService.getMySwapRequests().subscribe({
      next: (res) => this.requests.set(res),
      error: () => this.snackBar.open('Failed to load swap requests', 'Close', { duration: 3000 })
    });
  }

  openRequestDialog(): void {
    const ref = this.dialog.open(SwapRequestDialogComponent, { width: '540px' });
    ref.afterClosed().subscribe((res) => {
      if (res) {
        this.attendanceService.createSwapRequest(res).subscribe({
          next: () => {
            this.snackBar.open('Swap request submitted successfully!', 'Close', { duration: 3000 });
            this.loadRequests();
          },
          error: (err) => this.snackBar.open(err.error?.message || 'Failed to submit request', 'Close', { duration: 4000 })
        });
      }
    });
  }

  respond(req: PeriodSwapRequestItem, status: 'Approved' | 'Rejected'): void {
    this.attendanceService.respondToSwap(req.id, status).subscribe({
      next: (res) => {
        this.snackBar.open(res.message || `Request ${status.toLowerCase()}`, 'Close', { duration: 3000 });
        this.loadRequests();
      },
      error: (err) => this.snackBar.open(err.error?.message || 'Action failed', 'Close', { duration: 3000 })
    });
  }
}
