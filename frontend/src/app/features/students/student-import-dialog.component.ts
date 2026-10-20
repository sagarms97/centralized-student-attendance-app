import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatDialogModule, MatDialogRef } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatTooltipModule } from '@angular/material/tooltip';
import { StudentService } from '../../core/services/student.service';
import { ExcelImportPreviewResult, ExcelImportRowPreview } from '../../core/models/academic.models';

@Component({
  selector: 'app-student-import-dialog',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatProgressBarModule,
    MatChipsModule,
    MatTooltipModule
  ],
  template: `
    <h2 mat-dialog-title>
      <mat-icon color="primary">upload_file</mat-icon>
      <span>Bulk Import Students via Excel</span>
    </h2>

    <mat-dialog-content class="dialog-content">
      <!-- Step 1 & 2: Template & Upload Controls -->
      <div class="action-bar">
        <div class="guide-box">
          <p>Download our standardized Excel template, fill in student details, and upload below for automated validation.</p>
        </div>
        <button mat-stroked-button color="primary" (click)="downloadTemplate()">
          <mat-icon>file_download</mat-icon> Download Excel Template (.xlsx)
        </button>
      </div>

      <div class="dropzone" (click)="fileInput.click()">
        <input #fileInput type="file" accept=".xlsx, .xls" class="hidden-input" (change)="onFileSelected($event)">
        <mat-icon class="upload-icon">cloud_upload</mat-icon>
        <span class="upload-text">
          @if (selectedFileName()) {
            <strong>Selected: {{ selectedFileName() }}</strong>
          } @else {
            Click to select or drop an Excel spreadsheet (.xlsx)
          }
        </span>
      </div>

      @if (isLoading()) {
        <div class="loading-box">
          <mat-progress-bar mode="indeterminate"></mat-progress-bar>
          <span>Parsing and validating student records against database...</span>
        </div>
      }

      <!-- Step 3: Validation Preview -->
      @if (previewResult(); as preview) {
        <div class="preview-section">
          <div class="preview-metrics">
            <div class="metric-pill pill-total">
              <span class="label">Total Rows:</span>
              <span class="val">{{ preview.totalRows }}</span>
            </div>
            <div class="metric-pill pill-valid">
              <mat-icon>check_circle</mat-icon>
              <span class="label">Ready to Import:</span>
              <span class="val">{{ preview.validRowsCount }}</span>
            </div>
            @if (preview.invalidRowsCount > 0) {
              <div class="metric-pill pill-invalid">
                <mat-icon>error</mat-icon>
                <span class="label">Invalid / Skipped:</span>
                <span class="val">{{ preview.invalidRowsCount }}</span>
              </div>
            }
          </div>

          <div class="table-scroll-container">
            <table mat-table [dataSource]="preview.rows" class="preview-table">
              <!-- Status Column -->
              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let r">
                  @if (r.isValid) {
                    <span class="status-badge valid" matTooltip="Valid row">
                      <mat-icon>check</mat-icon> Valid
                    </span>
                  } @else {
                    <span class="status-badge invalid" [matTooltip]="r.errors.join(' | ')">
                      <mat-icon>warning</mat-icon> Errors ({{ r.errors.length }})
                    </span>
                  }
                </td>
              </ng-container>

              <!-- Roll No -->
              <ng-container matColumnDef="rollNo">
                <th mat-header-cell *matHeaderCellDef>Roll No</th>
                <td mat-cell *matCellDef="let r">
                  <code>{{ r.rollNo }}</code>
                </td>
              </ng-container>

              <!-- Name -->
              <ng-container matColumnDef="name">
                <th mat-header-cell *matHeaderCellDef>Full Name</th>
                <td mat-cell *matCellDef="let r">{{ r.firstName }} {{ r.lastName }}</td>
              </ng-container>

              <!-- Class -->
              <ng-container matColumnDef="class">
                <th mat-header-cell *matHeaderCellDef>Class & Section</th>
                <td mat-cell *matCellDef="let r">{{ r.className }} - {{ r.section }}</td>
              </ng-container>

              <!-- Phone -->
              <ng-container matColumnDef="phone">
                <th mat-header-cell *matHeaderCellDef>Parent Phone</th>
                <td mat-cell *matCellDef="let r">{{ r.parentPhone }}</td>
              </ng-container>

              <!-- Errors / Diagnostics -->
              <ng-container matColumnDef="diagnostics">
                <th mat-header-cell *matHeaderCellDef>Issues Detected</th>
                <td mat-cell *matCellDef="let r">
                  @if (r.errors.length > 0) {
                    <div class="error-list">
                      @for (err of r.errors; track err) {
                        <span class="err-item">{{ err }}</span>
                      }
                    </div>
                  } @else {
                    <span class="no-err">-</span>
                  }
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="columns"></tr>
              <tr mat-row *matRowDef="let row; columns: columns;" [class.error-row]="!row.isValid"></tr>
            </table>
          </div>
        </div>
      }
    </mat-dialog-content>

    <mat-dialog-actions align="end">
      <button mat-button mat-dialog-close>Cancel</button>
      <button mat-flat-button color="primary"
              [disabled]="!hasValidRows() || isSubmitting()"
              (click)="confirmImport()">
        @if (isSubmitting()) {
          <span>Importing...</span>
        } @else {
          <mat-icon>done_all</mat-icon>
          <span>Confirm & Import ({{ validRowCount() }} Students)</span>
        }
      </button>
    </mat-dialog-actions>
  `,
  styles: [`
    .dialog-content {
      min-width: 800px;
      max-height: 75vh;
      overflow-y: auto;
    }
    .action-bar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: #f1f5f9;
      padding: 12px 16px;
      border-radius: 8px;
      margin-bottom: 16px;
      .guide-box p {
        margin: 0;
        font-size: 0.85rem;
        color: #475569;
      }
    }
    .dropzone {
      border: 2px dashed #94a3b8;
      border-radius: 12px;
      padding: 24px;
      text-align: center;
      cursor: pointer;
      background: #fafafa;
      transition: background 0.2s;
      &:hover {
        background: #f1f5f9;
        border-color: #1a237e;
      }
    }
    .hidden-input { display: none; }
    .upload-icon {
      font-size: 44px;
      width: 44px;
      height: 44px;
      color: #1a237e;
    }
    .upload-text {
      display: block;
      margin-top: 8px;
      color: #334155;
      font-size: 0.95rem;
    }
    .loading-box {
      margin-top: 16px;
      text-align: center;
      span {
        display: block;
        margin-top: 8px;
        font-size: 0.85rem;
        color: #64748b;
      }
    }
    .preview-section {
      margin-top: 20px;
    }
    .preview-metrics {
      display: flex;
      gap: 12px;
      margin-bottom: 12px;
    }
    .metric-pill {
      display: flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.85rem;
      font-weight: 600;
      mat-icon { font-size: 18px; width: 18px; height: 18px; }

      &.pill-total { background: #e2e8f0; color: #1e293b; }
      &.pill-valid { background: #dcfce7; color: #15803d; }
      &.pill-invalid { background: #fee2e2; color: #b91c1c; }
    }
    .table-scroll-container {
      max-height: 350px;
      overflow-y: auto;
      border: 1px solid #e2e8f0;
      border-radius: 8px;
    }
    .preview-table { width: 100%; }
    .status-badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 12px;
      font-size: 0.75rem;
      font-weight: 600;
      mat-icon { font-size: 14px; width: 14px; height: 14px; }
      &.valid { background: #e8f5e9; color: #2e7d32; }
      &.invalid { background: #ffebee; color: #c62828; }
    }
    .error-row { background: #fff5f5; }
    .error-list {
      display: flex;
      flex-direction: column;
      gap: 2px;
    }
    .err-item {
      font-size: 0.75rem;
      color: #c62828;
      font-weight: 500;
    }
    .no-err { color: #94a3b8; }
  `]
})
export class StudentImportDialogComponent {
  private studentService = inject(StudentService);
  dialogRef = inject(MatDialogRef<StudentImportDialogComponent>);

  columns = ['status', 'rollNo', 'name', 'class', 'phone', 'diagnostics'];
  selectedFileName = signal<string | null>(null);
  isLoading = signal(false);
  isSubmitting = signal(false);
  previewResult = signal<ExcelImportPreviewResult | null>(null);

  downloadTemplate(): void {
    this.studentService.downloadTemplate().subscribe({
      next: (blob) => {
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'Student_Import_Template.xlsx';
        a.click();
        window.URL.revokeObjectURL(url);
      }
    });
  }

  onFileSelected(event: Event): void {
    const target = event.target as HTMLInputElement;
    if (target.files && target.files.length > 0) {
      const file = target.files[0];
      this.selectedFileName.set(file.name);
      this.isLoading.set(true);

      this.studentService.previewImport(file).subscribe({
        next: (res) => {
          this.previewResult.set(res);
          this.isLoading.set(false);
        },
        error: () => {
          this.isLoading.set(false);
          alert('Failed to parse Excel file. Ensure file matches template format.');
        }
      });
    }
  }

  hasValidRows(): boolean {
    const res = this.previewResult();
    return !!res && res.validRowsCount > 0;
  }

  validRowCount(): number {
    return this.previewResult()?.validRowsCount || 0;
  }

  confirmImport(): void {
    const res = this.previewResult();
    if (!res) return;

    const validStudents = res.rows
      .filter(r => r.isValid && r.classId)
      .map(r => ({
        rollNo: r.rollNo,
        firstName: r.firstName,
        lastName: r.lastName,
        classId: r.classId!,
        section: r.section,
        parentPhone: r.parentPhone,
        email: r.email || undefined
      }));

    this.isSubmitting.set(true);
    this.studentService.confirmImport(validStudents).subscribe({
      next: (result) => {
        this.isSubmitting.set(false);
        this.dialogRef.close(result);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        alert(err.error?.message || 'Failed to import students');
      }
    });
  }
}
