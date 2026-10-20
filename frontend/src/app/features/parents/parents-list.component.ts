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
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { ParentService } from '../../core/services/parent.service';
import { ParentItem, CreateParentRequest, UpdateParentRequest } from '../../core/models/parent.models';
import { ParentDialogComponent } from './parent-dialog.component';
import { LinkStudentDialogComponent } from './link-student-dialog.component';
import { InviteDialogComponent } from '../auth/invite-dialog.component';

@Component({
  selector: 'app-parents-list',
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
    MatChipsModule,
    MatTooltipModule
  ],
  template: `
    <div class="page-container">
      <div class="page-header">
        <div>
          <h1>Parent Directory & Child Linking</h1>
          <p class="subtitle">Manage parent accounts and map them to enrolled students</p>
        </div>
        <div class="header-actions">
          <button mat-stroked-button color="primary" (click)="openInviteDialog()">
            <mat-icon>forward_to_inbox</mat-icon> Send Invite
          </button>
          <button mat-flat-button color="primary" (click)="openAddDialog()">
            <mat-icon>person_add</mat-icon> Register Parent
          </button>
        </div>
      </div>

      <!-- Search Card -->
      <mat-card class="search-card">
        <mat-card-content>
          <div class="search-bar">
            <mat-form-field appearance="outline" class="search-field">
              <mat-label>Search Parents</mat-label>
              <input matInput [(ngModel)]="searchTerm" (keyup.enter)="loadParents()" placeholder="Search by name, email, or phone...">
              <mat-icon matPrefix>search</mat-icon>
              @if (searchTerm) {
                <button mat-icon-button matSuffix (click)="searchTerm = ''; loadParents()">
                  <mat-icon>clear</mat-icon>
                </button>
              }
            </mat-form-field>

            <button mat-stroked-button color="primary" (click)="loadParents()">
              <mat-icon>filter_list</mat-icon> Apply
            </button>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Desktop View: Table -->
      <mat-card class="table-card desktop-table-card">
        <mat-card-content class="p-0">
          <table mat-table [dataSource]="parents()" class="parents-table">
            <!-- Parent Info Column -->
            <ng-container matColumnDef="parentInfo">
              <th mat-header-cell *matHeaderCellDef>Parent Profile</th>
              <td mat-cell *matCellDef="let p">
                <div class="parent-cell">
                  <div class="parent-avatar">{{ getInitials(p.fullName) }}</div>
                  <div class="parent-meta">
                    <span class="parent-name">{{ p.fullName }}</span>
                    <span class="parent-contact">{{ p.email }} • {{ p.phone }}</span>
                    @if (p.address) {
                      <span class="parent-address"><mat-icon>home</mat-icon> {{ p.address }}</span>
                    }
                  </div>
                </div>
              </td>
            </ng-container>

            <!-- Linked Children Column -->
            <ng-container matColumnDef="linkedStudents">
              <th mat-header-cell *matHeaderCellDef>Linked Children</th>
              <td mat-cell *matCellDef="let p">
                @if (p.linkedStudents && p.linkedStudents.length > 0) {
                  <div class="children-chip-list">
                    @for (s of p.linkedStudents; track s.studentId) {
                      <span class="child-chip">
                        <mat-icon class="child-icon">face</mat-icon>
                        <span class="child-text">
                          <strong>{{ s.fullName }}</strong> ({{ s.className }} {{ s.section }} • Roll: {{ s.rollNo }}) - <em>{{ s.relationship }}</em>
                        </span>
                        <button mat-icon-button class="unlink-mini-btn" matTooltip="Unlink child" (click)="unlinkStudent(p, s.studentId)">
                          <mat-icon>close</mat-icon>
                        </button>
                      </span>
                    }
                  </div>
                } @else {
                  <span class="no-children-text">No children linked yet</span>
                }
              </td>
            </ng-container>

            <!-- Status Column -->
            <ng-container matColumnDef="status">
              <th mat-header-cell *matHeaderCellDef>Status</th>
              <td mat-cell *matCellDef="let p">
                <span class="badge" [class.badge-approved]="p.isActive" [class.badge-absent]="!p.isActive">
                  {{ p.isActive ? 'ACTIVE' : 'INACTIVE' }}
                </span>
              </td>
            </ng-container>

            <!-- Actions Column -->
            <ng-container matColumnDef="actions">
              <th mat-header-cell *matHeaderCellDef class="actions-header">Actions</th>
              <td mat-cell *matCellDef="let p" class="actions-cell">
                <button mat-stroked-button color="primary" class="action-btn" matTooltip="Link another child" (click)="openLinkStudentDialog(p)">
                  <mat-icon>add_link</mat-icon> Link Child
                </button>
                <button mat-icon-button color="primary" matTooltip="Edit parent details" (click)="openEditDialog(p)">
                  <mat-icon>edit</mat-icon>
                </button>
                @if (p.isActive) {
                  <button mat-icon-button color="warn" matTooltip="Deactivate parent" (click)="deactivateParent(p)">
                    <mat-icon>person_off</mat-icon>
                  </button>
                }
              </td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"></tr>

            <tr class="mat-row empty-row" *matNoDataRow>
              <td class="mat-cell" colspan="4">
                <div class="empty-state">
                  <mat-icon>family_restroom</mat-icon>
                  <p>No parents found matching the search criteria.</p>
                </div>
              </td>
            </tr>
          </table>
        </mat-card-content>
      </mat-card>

      <!-- Mobile View: Card List -->
      <div class="mobile-card-list">
        @for (p of parents(); track p.id) {
          <mat-card class="parent-mobile-card">
            <mat-card-header>
              <div mat-card-avatar class="parent-avatar">{{ getInitials(p.fullName) }}</div>
              <mat-card-title>{{ p.fullName }}</mat-card-title>
              <mat-card-subtitle>{{ p.email }} • {{ p.phone }}</mat-card-subtitle>
              <span class="spacer"></span>
              <span class="badge" [class.badge-approved]="p.isActive" [class.badge-absent]="!p.isActive">
                {{ p.isActive ? 'ACTIVE' : 'INACTIVE' }}
              </span>
            </mat-card-header>

            <mat-card-content class="mobile-card-body">
              @if (p.address) {
                <div class="mobile-address">
                  <mat-icon>home</mat-icon>
                  <span>{{ p.address }}</span>
                </div>
              }

              <div class="mobile-children-header">
                <mat-icon>family_restroom</mat-icon>
                <strong>Linked Children ({{ p.linkedStudents.length }})</strong>
              </div>

              @if (p.linkedStudents && p.linkedStudents.length > 0) {
                <div class="children-chip-list">
                  @for (s of p.linkedStudents; track s.studentId) {
                    <div class="child-chip mobile-chip">
                      <mat-icon class="child-icon">face</mat-icon>
                      <div class="mobile-child-text">
                        <strong>{{ s.fullName }}</strong> ({{ s.className }} {{ s.section }} • Roll: {{ s.rollNo }})
                        <div class="mobile-rel">{{ s.relationship }}</div>
                      </div>
                      <button mat-icon-button class="unlink-mini-btn" (click)="unlinkStudent(p, s.studentId)">
                        <mat-icon>close</mat-icon>
                      </button>
                    </div>
                  }
                </div>
              } @else {
                <p class="no-children-text">No children linked to this parent account.</p>
              }
            </mat-card-content>

            <mat-card-actions align="end" class="mobile-card-actions">
              <button mat-stroked-button color="primary" (click)="openLinkStudentDialog(p)">
                <mat-icon>add_link</mat-icon> Link Child
              </button>
              <button mat-icon-button color="primary" (click)="openEditDialog(p)">
                <mat-icon>edit</mat-icon>
              </button>
              @if (p.isActive) {
                <button mat-icon-button color="warn" (click)="deactivateParent(p)">
                  <mat-icon>person_off</mat-icon>
                </button>
              }
            </mat-card-actions>
          </mat-card>
        } @empty {
          <div class="empty-state-mobile">
            <mat-icon>family_restroom</mat-icon>
            <p>No parents found.</p>
          </div>
        }
      </div>
    </div>
  `,
  styles: [`
    .subtitle {
      color: #64748b;
      margin: 4px 0 0;
      font-size: 0.9rem;
    }
    .search-card {
      margin-bottom: 20px;
    }
    .search-bar {
      display: flex;
      gap: 12px;
      align-items: center;
      flex-wrap: wrap;
    }
    .search-field {
      flex: 1;
      min-width: 260px;
      margin-bottom: -1.25em;
    }
    .table-card {
      background: white;
      border-radius: 8px;
      overflow: hidden;
    }
    .p-0 { padding: 0 !important; }
    .parents-table {
      width: 100%;
    }
    .parent-cell {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 12px 0;
    }
    .parent-avatar {
      width: 40px;
      height: 40px;
      border-radius: 50%;
      background: #3949ab;
      color: white;
      display: flex;
      align-items: center;
      justify-content: center;
      font-weight: 700;
      font-size: 0.9rem;
      flex-shrink: 0;
    }
    .parent-meta {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .parent-name {
      font-weight: 600;
      color: #1e293b;
      font-size: 0.95rem;
    }
    .parent-contact {
      font-size: 0.8rem;
      color: #64748b;
    }
    .parent-address {
      font-size: 0.75rem;
      color: #94a3b8;
      display: flex;
      align-items: center;
      gap: 4px;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
    }
    .children-chip-list {
      display: flex;
      flex-direction: column;
      gap: 6px;
      padding: 8px 0;
    }
    .child-chip {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      border-radius: 16px;
      padding: 2px 8px 2px 10px;
      font-size: 0.82rem;
      color: #1e40af;
      max-width: fit-content;
    }
    .child-icon {
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #3b82f6;
    }
    .unlink-mini-btn {
      width: 22px;
      height: 22px;
      line-height: 22px;
      margin-left: 2px;
      mat-icon {
        font-size: 14px;
        width: 14px;
        height: 14px;
        color: #ef4444;
      }
    }
    .no-children-text {
      color: #94a3b8;
      font-style: italic;
      font-size: 0.85rem;
    }
    .actions-header {
      text-align: right;
    }
    .actions-cell {
      text-align: right;
      white-space: nowrap;
    }
    .action-btn {
      margin-right: 8px;
    }
    .empty-state, .empty-state-mobile {
      text-align: center;
      padding: 48px 16px;
      color: #94a3b8;
      mat-icon { font-size: 48px; width: 48px; height: 48px; margin-bottom: 8px; }
    }
    .mobile-card-list {
      display: none;
      flex-direction: column;
      gap: 16px;
    }
    .parent-mobile-card {
      border-radius: 12px;
    }
    .mobile-card-body {
      padding-top: 12px;
    }
    .mobile-address {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.8rem;
      color: #64748b;
      margin-bottom: 12px;
      mat-icon { font-size: 16px; width: 16px; height: 16px; }
    }
    .mobile-children-header {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.85rem;
      color: #334155;
      margin-bottom: 8px;
      mat-icon { font-size: 18px; width: 18px; height: 18px; color: #475569; }
    }
    .mobile-chip {
      width: 100%;
      justify-content: space-between;
      border-radius: 8px;
      padding: 6px 10px;
    }
    .mobile-child-text {
      flex: 1;
      .mobile-rel {
        font-size: 0.75rem;
        color: #64748b;
      }
    }

    @media (max-width: 768px) {
      .desktop-table-card {
        display: none;
      }
      .mobile-card-list {
        display: flex;
      }
    }
  `]
})
export class ParentsListComponent implements OnInit {
  private parentService = inject(ParentService);
  private dialog = inject(MatDialog);
  private snackBar = inject(MatSnackBar);

  parents = signal<ParentItem[]>([]);
  searchTerm = '';
  displayedColumns: string[] = ['parentInfo', 'linkedStudents', 'status', 'actions'];

  ngOnInit(): void {
    this.loadParents();
  }

  loadParents(): void {
    this.parentService.getAll(this.searchTerm).subscribe({
      next: data => this.parents.set(data),
      error: () => this.snackBar.open('Failed to load parents', 'Close', { duration: 3000 })
    });
  }

  getInitials(name: string): string {
    if (!name) return 'P';
    return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
  }

  openAddDialog(): void {
    const ref = this.dialog.open(ParentDialogComponent, { width: '560px' });
    ref.afterClosed().subscribe((res: CreateParentRequest | undefined) => {
      if (res) {
        this.parentService.create(res).subscribe({
          next: () => {
            this.snackBar.open('Parent profile created successfully', 'Close', { duration: 3000 });
            this.loadParents();
          },
          error: err => {
            this.snackBar.open(err.error?.message || 'Failed to create parent profile', 'Close', { duration: 4000 });
          }
        });
      }
    });
  }

  openInviteDialog(): void {
    this.dialog.open(InviteDialogComponent, {
      width: '540px',
      data: { role: 'Parent' }
    });
  }

  openEditDialog(parent: ParentItem): void {
    const ref = this.dialog.open(ParentDialogComponent, {
      width: '560px',
      data: parent
    });
    ref.afterClosed().subscribe((res: UpdateParentRequest | undefined) => {
      if (res) {
        this.parentService.update(parent.id, res).subscribe({
          next: () => {
            this.snackBar.open('Parent profile updated', 'Close', { duration: 3000 });
            this.loadParents();
          },
          error: err => {
            this.snackBar.open(err.error?.message || 'Failed to update parent profile', 'Close', { duration: 4000 });
          }
        });
      }
    });
  }

  openLinkStudentDialog(parent: ParentItem): void {
    const ref = this.dialog.open(LinkStudentDialogComponent, {
      width: '460px',
      data: { parent }
    });
    ref.afterClosed().subscribe((res: { studentId: number; relationship: string } | undefined) => {
      if (res) {
        this.parentService.linkStudent(parent.id, res.studentId, res.relationship).subscribe({
          next: () => {
            this.snackBar.open('Student linked successfully', 'Close', { duration: 3000 });
            this.loadParents();
          },
          error: err => {
            this.snackBar.open(err.error?.message || 'Failed to link student', 'Close', { duration: 4000 });
          }
        });
      }
    });
  }

  unlinkStudent(parent: ParentItem, studentId: number): void {
    if (!confirm('Are you sure you want to unlink this student from the parent?')) return;
    this.parentService.unlinkStudent(parent.id, studentId).subscribe({
      next: () => {
        this.snackBar.open('Student unlinked', 'Close', { duration: 3000 });
        this.loadParents();
      },
      error: () => this.snackBar.open('Failed to unlink student', 'Close', { duration: 3000 })
    });
  }

  deactivateParent(parent: ParentItem): void {
    if (!confirm(`Are you sure you want to deactivate ${parent.fullName}'s account?`)) return;
    this.parentService.deactivate(parent.id).subscribe({
      next: () => {
        this.snackBar.open('Parent account deactivated', 'Close', { duration: 3000 });
        this.loadParents();
      },
      error: () => this.snackBar.open('Failed to deactivate parent', 'Close', { duration: 3000 })
    });
  }
}
