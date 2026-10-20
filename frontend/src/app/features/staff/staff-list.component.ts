import { Component, inject, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatTableModule } from '@angular/material/table';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StaffService } from '../../core/services/staff.service';
import { Staff } from '../../core/models/academic.models';
import { StaffDialogComponent } from './staff-dialog.component';

@Component({
  selector: 'app-staff-list',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatTableModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatDialogModule,
    MatSnackBarModule,
    MatFormFieldModule,
    MatInputModule,
    MatTooltipModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Staff Directory</h1>
          <p class="subtitle">Manage academic and teaching personnel</p>
        </div>
        <button mat-flat-button color="primary" (click)="openAddDialog()">
          <mat-icon>person_add</mat-icon> Add Staff Member
        </button>
      </div>

      <mat-card class="filter-card">
        <mat-card-content>
          <mat-form-field appearance="outline" class="search-field">
            <mat-label>Search Staff</mat-label>
            <input matInput [(ngModel)]="searchTerm" (ngModelChange)="applyFilter()" placeholder="Search by name, ID, or email">
            <mat-icon matSuffix>search</mat-icon>
          </mat-form-field>
        </mat-card-content>
      </mat-card>

      <mat-card class="table-card mt-3">
        <table mat-table [dataSource]="filteredStaff()" class="full-width">
          <!-- Photo Column -->
          <ng-container matColumnDef="photo">
            <th mat-header-cell *matHeaderCellDef>Photo</th>
            <td mat-cell *matCellDef="let s">
              <div class="photo-cell">
                @if (s.photoPath) {
                  <img [src]="staffService.getPhotoUrl(s.id)" class="staff-photo" alt="Photo">
                } @else {
                  <div class="photo-placeholder">{{ getInitials(s.fullName) }}</div>
                }
                <label class="photo-upload-label" matTooltip="Upload / Change Photo">
                  <mat-icon>photo_camera</mat-icon>
                  <input type="file" accept="image/*" class="file-input" (change)="onPhotoSelected($event, s)">
                </label>
              </div>
            </td>
          </ng-container>

          <!-- Employee ID Column -->
          <ng-container matColumnDef="employeeId">
            <th mat-header-cell *matHeaderCellDef>Employee ID</th>
            <td mat-cell *matCellDef="let s">
              <span class="emp-code">{{ s.employeeId }}</span>
            </td>
          </ng-container>

          <!-- Full Name Column -->
          <ng-container matColumnDef="fullName">
            <th mat-header-cell *matHeaderCellDef>Full Name</th>
            <td mat-cell *matCellDef="let s">
              <strong>{{ s.fullName }}</strong>
            </td>
          </ng-container>

          <!-- Email Column -->
          <ng-container matColumnDef="email">
            <th mat-header-cell *matHeaderCellDef>Email</th>
            <td mat-cell *matCellDef="let s">{{ s.email }}</td>
          </ng-container>

          <!-- Phone Column -->
          <ng-container matColumnDef="phone">
            <th mat-header-cell *matHeaderCellDef>Phone</th>
            <td mat-cell *matCellDef="let s">{{ s.phone }}</td>
          </ng-container>

          <!-- Specialization Column -->
          <ng-container matColumnDef="subject">
            <th mat-header-cell *matHeaderCellDef>Subject / Dept</th>
            <td mat-cell *matCellDef="let s">
              <span class="subject-tag">{{ s.subjectSpecialization || 'General' }}</span>
            </td>
          </ng-container>

          <!-- Status Column -->
          <ng-container matColumnDef="status">
            <th mat-header-cell *matHeaderCellDef>Status</th>
            <td mat-cell *matCellDef="let s">
              <span class="badge" [ngClass]="s.isActive ? 'badge-approved' : 'badge-absent'">
                {{ s.isActive ? 'Active' : 'Inactive' }}
              </span>
            </td>
          </ng-container>

          <!-- Actions Column -->
          <ng-container matColumnDef="actions">
            <th mat-header-cell *matHeaderCellDef>Actions</th>
            <td mat-cell *matCellDef="let s">
              <button mat-icon-button color="primary" matTooltip="Edit Staff" (click)="openEditDialog(s)">
                <mat-icon>edit</mat-icon>
              </button>
              @if (s.isActive) {
                <button mat-icon-button color="warn" matTooltip="Deactivate Staff" (click)="deactivate(s)">
                  <mat-icon>person_off</mat-icon>
                </button>
              }
            </td>
          </ng-container>

          <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
          <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>

          <tr class="mat-row" *matNoDataRow>
            <td class="mat-cell empty-state" colspan="8">
              <mat-icon>people_outline</mat-icon>
              <p>No staff members found.</p>
            </td>
          </tr>
        </table>
      </mat-card>
    </div>
  `,
  styles: [`
    .subtitle { color: #666; margin: 4px 0 0 0; }
    .filter-card {
      padding: 8px 16px;
      border-radius: 12px;
      mat-card-content { padding: 0 !important; }
    }
    .search-field { width: 100%; max-width: 400px; margin-bottom: -1.25em; }
    .table-card { border-radius: 12px; overflow: hidden; }
    .full-width { width: 100%; }
    .photo-cell {
      position: relative;
      display: inline-flex;
      align-items: center;
      margin: 8px 0;
    }
    .staff-photo {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      object-fit: cover;
      border: 2px solid #1a237e;
    }
    .photo-placeholder {
      width: 44px;
      height: 44px;
      border-radius: 50%;
      background: #1a237e;
      color: white;
      font-weight: 700;
      font-size: 0.9rem;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .photo-upload-label {
      position: absolute;
      bottom: -4px;
      right: -6px;
      background: #fff;
      border-radius: 50%;
      width: 22px;
      height: 22px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 2px 4px rgba(0,0,0,0.2);
      mat-icon { font-size: 14px; width: 14px; height: 14px; color: #1a237e; }
    }
    .file-input { display: none; }
    .emp-code { font-family: monospace; font-weight: 700; color: #1a237e; }
    .subject-tag {
      background: #e8eaf6;
      color: #1a237e;
      padding: 3px 8px;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 500;
    }
    .mt-3 { margin-top: 16px; }
    .empty-state {
      text-align: center;
      padding: 48px;
      color: #999;
      mat-icon { font-size: 48px; width: 48px; height: 48px; }
    }
  `]
})
export class StaffListComponent implements OnInit {
  staffService = inject(StaffService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  displayedColumns = ['photo', 'employeeId', 'fullName', 'email', 'phone', 'subject', 'status', 'actions'];
  staffList = signal<Staff[]>([]);
  filteredStaff = signal<Staff[]>([]);
  searchTerm = '';

  ngOnInit(): void {
    this.loadStaff();
  }

  loadStaff(): void {
    this.staffService.getAll(true).subscribe({
      next: (data) => {
        this.staffList.set(data);
        this.applyFilter();
      },
      error: () => this.snackBar.open('Failed to load staff list', 'Close', { duration: 3000 })
    });
  }

  applyFilter(): void {
    const term = this.searchTerm.trim().toLowerCase();
    if (!term) {
      this.filteredStaff.set(this.staffList());
      return;
    }
    const filtered = this.staffList().filter(s =>
      s.fullName.toLowerCase().includes(term) ||
      s.employeeId.toLowerCase().includes(term) ||
      s.email.toLowerCase().includes(term) ||
      (s.subjectSpecialization && s.subjectSpecialization.toLowerCase().includes(term))
    );
    this.filteredStaff.set(filtered);
  }

  openAddDialog(): void {
    const ref = this.dialog.open(StaffDialogComponent, { width: '560px' });
    ref.afterClosed().subscribe((res) => {
      if (res) {
        this.staffService.create(res).subscribe({
          next: () => {
            this.snackBar.open('Staff member and login credentials created!', 'Close', { duration: 3000 });
            this.loadStaff();
          },
          error: (err) => this.snackBar.open(err.error?.message || 'Failed to create staff', 'Close', { duration: 4000 })
        });
      }
    });
  }

  openEditDialog(staff: Staff): void {
    const ref = this.dialog.open(StaffDialogComponent, { width: '560px', data: staff });
    ref.afterClosed().subscribe((res) => {
      if (res) {
        this.staffService.update(staff.id, res).subscribe({
          next: () => {
            this.snackBar.open('Staff profile updated!', 'Close', { duration: 3000 });
            this.loadStaff();
          },
          error: (err) => this.snackBar.open(err.error?.message || 'Failed to update staff', 'Close', { duration: 4000 })
        });
      }
    });
  }

  onPhotoSelected(event: Event, staff: Staff): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];
      this.staffService.uploadPhoto(staff.id, file).subscribe({
        next: () => {
          this.snackBar.open('Staff photo uploaded successfully!', 'Close', { duration: 3000 });
          this.loadStaff();
        },
        error: (err) => this.snackBar.open(err.error?.message || 'Photo upload failed', 'Close', { duration: 4000 })
      });
    }
  }

  deactivate(staff: Staff): void {
    if (confirm(`Are you sure you want to deactivate ${staff.fullName}?`)) {
      this.staffService.deactivate(staff.id).subscribe({
        next: () => {
          this.snackBar.open('Staff member deactivated', 'Close', { duration: 3000 });
          this.loadStaff();
        },
        error: () => this.snackBar.open('Failed to deactivate staff', 'Close', { duration: 3000 })
      });
    }
  }

  getInitials(name: string): string {
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }
}
