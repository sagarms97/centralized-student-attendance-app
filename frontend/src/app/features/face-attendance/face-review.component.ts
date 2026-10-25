import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatRadioModule } from '@angular/material/radio';
import {
  FaceAttendanceService,
  FaceReviewSessionData,
  RecognizedFace,
  ReviewPhotoItem,
  FaceBoundingBox
} from '../../core/services/face-attendance.service';
import { AttendanceService } from '../../core/services/attendance.service';
import { StudentService } from '../../core/services/student.service';
import { Student } from '../../core/models/academic.models';
import { StaffDailyScheduleItem, StudentAttendanceItem } from '../../core/models/attendance.models';

export interface StudentReviewItem {
  studentId: number;
  rollNumber: string;
  fullName: string;
  status: 'Present' | 'Absent' | 'Late' | 'OnLeave';
  source: 'Face' | 'Manual';
  confidence: number | null;
  isConfirmed: boolean;
  photoIndex?: number;
  cropIndex?: number;
  remarks?: string;
}

export interface InspectorFace {
  cropIndex: number;
  photoIndex: number;
  status: 'Matched' | 'LowConfidence' | 'Unknown';
  confidence: number;
  matchedStudentId?: number;
  matchedStudentName?: string;
  rollNumber?: string;
  boundingBox?: FaceBoundingBox;
}

@Component({
  selector: 'app-face-review',
  standalone: true,
  imports: [
    CommonModule,
    RouterModule,
    FormsModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatSelectModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule,
    MatChipsModule,
    MatTabsModule,
    MatRadioModule
  ],
  template: `
    <div class="face-review-container">
      <!-- Page Header -->
      <div class="page-header">
        <div>
          <h2>Face Attendance Review & Confirmation</h2>
          <p class="subtitle">
            Mobile-first review: Verify AI face detections, inspect colored boxes, resolve unrecognized students, and confirm attendance.
          </p>
        </div>
        <div class="header-actions">
          <a mat-stroked-button routerLink="/app/attendance">
            <mat-icon>edit_calendar</mat-icon>
            Switch to Manual Marking
          </a>
          <a mat-stroked-button routerLink="/app/face-attendance/capture">
            <mat-icon>replay</mat-icon>
            Re-Capture Photos
          </a>
        </div>
      </div>

      <!-- No Active Session Alert -->
      <mat-card *ngIf="!sessionData" class="alert-card empty-card">
        <mat-card-content>
          <mat-icon class="huge-icon">no_photography</mat-icon>
          <h3>No Face Attendance Session Found</h3>
          <p>Please capture classroom photos first or select an active teaching period.</p>
          <div class="mt-3">
            <a mat-flat-button color="primary" routerLink="/app/face-attendance/capture">
              <mat-icon>photo_camera</mat-icon>
              Go to Camera Capture
            </a>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Active Review Interface -->
      <div *ngIf="sessionData" class="review-layout">
        <!-- Top Session & Slot Bar -->
        <mat-card class="session-bar-card">
          <div class="session-bar-content">
            <div class="session-meta">
              <span class="class-badge">{{ sessionData.className }} {{ sessionData.section ? '- Section ' + sessionData.section : '' }}</span>
              <span class="date-badge"><mat-icon class="mini-icon">event</mat-icon> {{ attendanceDate }}</span>
            </div>

            <!-- Teaching Slot Selector (if not already set) -->
            <div class="slot-selection-box">
              <mat-form-field appearance="outline" class="slot-select">
                <mat-label>Assigned Period / Timetable Slot</mat-label>
                <mat-select [(value)]="selectedTimetableEntryId" (selectionChange)="onSlotSelected($event.value)">
                  <mat-option *ngFor="let slot of availableSlots" [value]="slot.timetableEntryId">
                    {{ slot.periodName }} ({{ slot.timeRange }}): {{ slot.subjectName }}
                  </mat-option>
                </mat-select>
              </mat-form-field>
            </div>
          </div>
        </mat-card>

        <!-- KPI Ticker -->
        <div class="kpi-ticker-grid">
          <div class="kpi-box green-box" (click)="selectedTab = 0">
            <div class="kpi-number">{{ suggestedPresentCount }}</div>
            <div class="kpi-label">Matched (Present)</div>
          </div>
          <div class="kpi-box amber-box" (click)="selectedTab = 1">
            <div class="kpi-number">{{ lowConfidenceOrUnknownCount }}</div>
            <div class="kpi-label">Review / Unknown</div>
          </div>
          <div class="kpi-box blue-box" (click)="selectedTab = 2">
            <div class="kpi-number">{{ notDetectedCount }}</div>
            <div class="kpi-label">Not Detected</div>
          </div>
          <div class="kpi-box gray-box">
            <div class="kpi-number">{{ totalClassStudentsCount }}</div>
            <div class="kpi-label">Total in Class</div>
          </div>
        </div>

        <!-- Interactive Classroom Photo Viewer with Color Boxes -->
        <mat-card class="photo-viewer-card">
          <div class="viewer-header">
            <div class="viewer-tabs">
              <button *ngFor="let photo of sessionData.photos; let i = index"
                      mat-button
                      [class.active-photo-btn]="currentPhotoIndex === i"
                      (click)="switchPhoto(i)">
                <mat-icon>photo</mat-icon>
                {{ photo.label }}
              </button>
            </div>
            <div class="box-legend">
              <span class="legend-item"><span class="dot green-dot"></span> Matched (&ge; Threshold)</span>
              <span class="legend-item"><span class="dot amber-dot"></span> Low Confidence</span>
              <span class="legend-item"><span class="dot red-dot"></span> Unknown</span>
            </div>
          </div>

          <!-- Canvas Preview -->
          <div class="canvas-viewport" #canvasContainer>
            <img #sourceImg
                 [src]="currentPhoto?.imageSrc"
                 alt="Classroom photo view"
                 class="underlay-img"
                 (load)="renderOverlayBoxes()">
            <canvas #overlayCanvas class="boxes-canvas" (click)="onCanvasClick($event)"></canvas>
          </div>
          <small class="viewer-hint">
            <mat-icon class="mini-icon">touch_app</mat-icon>
            Tap any colored box on the photo or a student in the list below to inspect or reassign.
          </small>
        </mat-card>

        <!-- Face Inspector Modal / Card (when a face is selected) -->
        <mat-card *ngIf="inspectingFace" class="inspector-card">
          <div class="inspector-header">
            <div class="inspector-title">
              <mat-icon color="accent">face</mat-icon>
              <strong>Inspect Detected Face #{{ inspectingFace.cropIndex }} (Photo {{ inspectingFace.photoIndex }})</strong>
            </div>
            <button mat-icon-button (click)="closeInspector()">
              <mat-icon>close</mat-icon>
            </button>
          </div>
          <div class="inspector-body">
            <div class="inspector-details">
              <div class="status-indicator"
                   [class.status-green]="inspectingFace.status === 'Matched'"
                   [class.status-amber]="inspectingFace.status === 'LowConfidence'"
                   [class.status-red]="inspectingFace.status === 'Unknown'">
                {{ inspectingFace.status }} ({{ inspectingFace.confidence | percent:'1.0-0' }})
              </div>
              <div class="current-assign">
                <span class="lbl">Currently Assigned:</span>
                <strong>{{ inspectingFace.matchedStudentName || 'Unknown / Unassigned' }}</strong>
                <span *ngIf="inspectingFace.rollNumber" class="roll-tag">Roll: {{ inspectingFace.rollNumber }}</span>
              </div>
            </div>

            <!-- Reassignment Selector -->
            <div class="reassign-controls">
              <mat-form-field appearance="outline" class="reassign-field">
                <mat-label>Reassign to Class Student</mat-label>
                <mat-select [(value)]="inspectorSelectedStudentId">
                  <mat-option [value]="0">-- Mark as Unknown / Dismiss --</mat-option>
                  <mat-option *ngFor="let st of classStudents" [value]="st.id">
                    {{ st.rollNo }} - {{ st.fullName }}
                  </mat-option>
                </mat-select>
              </mat-form-field>
              <button mat-flat-button color="primary" (click)="applyInspectorAssignment()">
                <mat-icon>done</mat-icon> Save Assignment
              </button>
            </div>
          </div>
        </mat-card>

        <!-- Review Tabs (Lists) -->
        <mat-card class="tabs-card">
          <mat-tab-group [(selectedIndex)]="selectedTab">
            <!-- Tab 1: Suggested Present (Matched) -->
            <mat-tab>
              <ng-template matTabLabel>
                <mat-icon class="tab-icon">check_circle</mat-icon>
                <span>Suggested Present ({{ suggestedPresentStudents.length }})</span>
              </ng-template>

              <div class="tab-pane">
                <div class="pane-helper-text">
                  Students whose faces matched with high confidence. Default status is <strong>Present</strong>.
                </div>

                <div class="students-list">
                  <div *ngFor="let s of suggestedPresentStudents" class="student-card matched-item">
                    <div class="student-info">
                      <span class="roll-pill">{{ s.rollNumber }}</span>
                      <div class="name-block">
                        <strong>{{ s.fullName }}</strong>
                        <div class="meta-row">
                          <span class="conf-badge" [matTooltip]="'Matched with ' + (s.confidence ? (s.confidence * 100 | number:'1.0-0') : '0') + '% confidence'">
                            <mat-icon class="mini-icon">verified</mat-icon>
                            {{ s.confidence ? (s.confidence * 100 | number:'1.0-0') + '%' : 'AI' }}
                          </span>
                          <span class="source-tag">Source: Face</span>
                        </div>
                      </div>
                    </div>

                    <!-- Attendance Status Segmented Toggle -->
                    <div class="status-toggle-group">
                      <button type="button"
                              class="toggle-btn"
                              [class.btn-present]="s.status === 'Present'"
                              (click)="setStudentStatus(s, 'Present')">
                        Present
                      </button>
                      <button type="button"
                              class="toggle-btn"
                              [class.btn-late]="s.status === 'Late'"
                              (click)="setStudentStatus(s, 'Late')">
                        Late
                      </button>
                      <button type="button"
                              class="toggle-btn"
                              [class.btn-absent]="s.status === 'Absent'"
                              (click)="setStudentStatus(s, 'Absent')">
                        Absent
                      </button>
                    </div>

                    <div class="item-actions">
                      <button mat-icon-button matTooltip="Reassign or mark as unknown" (click)="reassignStudent(s)">
                        <mat-icon>manage_accounts</mat-icon>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </mat-tab>

            <!-- Tab 2: Low Confidence & Unknown Faces -->
            <mat-tab>
              <ng-template matTabLabel>
                <mat-icon class="tab-icon">help_outline</mat-icon>
                <span>Needs Review & Unknown ({{ lowConfidenceAndUnknownFaces.length }})</span>
              </ng-template>

              <div class="tab-pane">
                <div class="pane-helper-text">
                  Faces detected in class photos with confidence below the threshold or unrecognized. Confirm or assign manually.
                </div>

                <div *ngIf="lowConfidenceAndUnknownFaces.length === 0" class="empty-list-notice">
                  <mat-icon class="check-icon">task_alt</mat-icon>
                  <p>All detected faces were matched with confident scores! No unresolved faces.</p>
                </div>

                <div class="students-list">
                  <div *ngFor="let face of lowConfidenceAndUnknownFaces" class="student-card review-item">
                    <div class="student-info">
                      <span class="face-tag">Face #{{ face.cropIndex }}</span>
                      <div class="name-block">
                        <strong>{{ face.matchedStudentName || 'Unknown Student' }}</strong>
                        <div class="meta-row">
                          <span class="status-chip"
                                [class.amber-chip]="face.status === 'LowConfidence'"
                                [class.red-chip]="face.status === 'Unknown'">
                            {{ face.status === 'LowConfidence' ? 'Low Confidence (' + (face.confidence | percent:'1.0-0') + ')' : 'Unknown Face' }}
                          </span>
                          <span *ngIf="face.rollNumber" class="roll-info">Roll: {{ face.rollNumber }}</span>
                        </div>
                      </div>
                    </div>

                    <div class="review-actions">
                      <button *ngIf="face.matchedStudentId"
                              mat-stroked-button
                              color="primary"
                              (click)="confirmLowConfidenceFace(face)">
                        <mat-icon>check</mat-icon> Confirm as {{ face.matchedStudentName }}
                      </button>
                      <button mat-stroked-button
                              (click)="openInspectorForFace(face)">
                        <mat-icon>search</mat-icon> Reassign...
                      </button>
                      <button mat-icon-button
                              color="warn"
                              matTooltip="Dismiss (visitor/non-student)"
                              (click)="dismissFace(face)">
                        <mat-icon>person_remove</mat-icon>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </mat-tab>

            <!-- Tab 3: Not Detected Students -->
            <mat-tab>
              <ng-template matTabLabel>
                <mat-icon class="tab-icon">person_off</mat-icon>
                <span>Not Detected ({{ notDetectedStudents.length }})</span>
              </ng-template>

              <div class="tab-pane">
                <div class="pane-helper-text not-detected-helper">
                  <mat-icon class="mini-icon">info</mat-icon>
                  <strong>Human-in-the-Loop Rule:</strong> Not-detected students are NOT marked absent automatically. Please review and specify whether they are Absent, Present, Late, or On Leave.
                  <div class="batch-action-bar">
                    <button mat-stroked-button color="warn" (click)="markAllNotDetectedAsAbsent()">
                      <mat-icon>person_off</mat-icon> Mark All Unreviewed as Absent
                    </button>
                  </div>
                </div>

                <div class="students-list">
                  <div *ngFor="let s of notDetectedStudents" class="student-card notdetected-item">
                    <div class="student-info">
                      <span class="roll-pill">{{ s.rollNumber }}</span>
                      <div class="name-block">
                        <strong>{{ s.fullName }}</strong>
                        <div class="meta-row">
                          <span class="not-detected-tag">Not in Photos</span>
                          <span class="source-tag">Manual Review</span>
                        </div>
                      </div>
                    </div>

                    <!-- Attendance Status Segmented Toggle -->
                    <div class="status-toggle-group">
                      <button type="button"
                              class="toggle-btn"
                              [class.btn-absent]="s.status === 'Absent'"
                              (click)="setStudentStatus(s, 'Absent')">
                        Absent
                      </button>
                      <button type="button"
                              class="toggle-btn"
                              [class.btn-present]="s.status === 'Present'"
                              (click)="setStudentStatus(s, 'Present')">
                        Present
                      </button>
                      <button type="button"
                              class="toggle-btn"
                              [class.btn-late]="s.status === 'Late'"
                              (click)="setStudentStatus(s, 'Late')">
                        Late
                      </button>
                      <button type="button"
                              class="toggle-btn"
                              [class.btn-leave]="s.status === 'OnLeave'"
                              (click)="setStudentStatus(s, 'OnLeave')">
                        Leave
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </mat-tab>
          </mat-tab-group>
        </mat-card>

        <!-- Fixed Bottom Confirmation Bar -->
        <div class="bottom-action-bar">
          <div class="action-summary">
            <span class="summary-pill sum-present">Present: {{ countByStatus('Present') }}</span>
            <span class="summary-pill sum-absent">Absent: {{ countByStatus('Absent') }}</span>
            <span class="summary-pill sum-late">Late: {{ countByStatus('Late') }}</span>
            <span class="summary-pill sum-leave" *ngIf="countByStatus('OnLeave') > 0">Leave: {{ countByStatus('OnLeave') }}</span>
            <span class="summary-pill sum-total">Total: {{ allStudentReviewItems.length }}</span>
          </div>

          <div class="action-buttons">
            <button mat-stroked-button routerLink="/app/attendance">
              Cancel
            </button>
            <button mat-flat-button
                    color="primary"
                    class="save-btn"
                    [disabled]="isSubmitting || !selectedTimetableEntryId"
                    (click)="confirmAndSaveAttendance()">
              <mat-spinner *ngIf="isSubmitting" diameter="20" class="mini-spinner"></mat-spinner>
              <mat-icon *ngIf="!isSubmitting">check_circle</mat-icon>
              <span>{{ isSubmitting ? 'Submitting...' : 'Confirm & Save Attendance' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .face-review-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px 16px 100px 16px;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
      gap: 16px;
      flex-wrap: wrap;
      h2 { margin: 0; font-size: 1.5rem; font-weight: 700; color: #1e293b; }
      .subtitle { margin: 4px 0 0; color: #64748b; font-size: 0.9rem; }
    }
    .header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
    .alert-card.empty-card {
      text-align: center;
      padding: 40px 20px;
      border-radius: 12px;
      .huge-icon { font-size: 56px; width: 56px; height: 56px; color: #94a3b8; }
      h3 { margin: 12px 0 6px; color: #334155; }
      p { color: #64748b; }
    }
    .review-layout { display: flex; flex-direction: column; gap: 16px; }

    /* Session Bar */
    .session-bar-card {
      border-radius: 12px;
      padding: 12px 16px;
    }
    .session-bar-content {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .session-meta { display: flex; align-items: center; gap: 10px; }
    .class-badge {
      background: #e0e7ff;
      color: #3730a3;
      font-weight: 600;
      padding: 6px 14px;
      border-radius: 20px;
      font-size: 0.9rem;
    }
    .date-badge {
      background: #f1f5f9;
      color: #475569;
      padding: 6px 12px;
      border-radius: 20px;
      font-size: 0.85rem;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }
    .mini-icon { font-size: 16px; width: 16px; height: 16px; vertical-align: middle; }
    .slot-selection-box { min-width: 300px; flex: 1; max-width: 500px; }
    .slot-select { width: 100%; margin-bottom: -1.25em; }

    /* KPI Ticker */
    .kpi-ticker-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(130px, 1fr));
      gap: 12px;
    }
    .kpi-box {
      border-radius: 10px;
      padding: 12px 14px;
      display: flex;
      flex-direction: column;
      cursor: pointer;
      transition: transform 0.15s, box-shadow 0.15s;
      &:hover { transform: translateY(-2px); box-shadow: 0 4px 10px rgba(0,0,0,0.06); }
      .kpi-number { font-size: 1.6rem; font-weight: 800; line-height: 1.1; }
      .kpi-label { font-size: 0.75rem; font-weight: 600; text-transform: uppercase; margin-top: 4px; }
    }
    .green-box { background: #dcfce7; color: #15803d; }
    .amber-box { background: #fef3c7; color: #b45309; }
    .blue-box { background: #e0f2fe; color: #0369a1; }
    .gray-box { background: #f1f5f9; color: #475569; cursor: default; }

    /* Photo Viewer */
    .photo-viewer-card {
      border-radius: 12px;
      overflow: hidden;
      padding: 12px;
    }
    .viewer-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 8px;
      margin-bottom: 8px;
    }
    .viewer-tabs {
      display: flex;
      gap: 6px;
      button { border-radius: 8px; }
      .active-photo-btn { background: #e0e7ff; color: #3730a3; font-weight: 600; }
    }
    .box-legend {
      display: flex;
      gap: 12px;
      font-size: 0.75rem;
      color: #64748b;
      .legend-item { display: inline-flex; align-items: center; gap: 4px; }
      .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
      .green-dot { background: #22c55e; }
      .amber-dot { background: #f59e0b; }
      .red-dot { background: #ef4444; }
    }
    .canvas-viewport {
      position: relative;
      width: 100%;
      background: #0f172a;
      border-radius: 8px;
      overflow: hidden;
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 260px;
      cursor: crosshair;
    }
    .underlay-img {
      max-width: 100%;
      max-height: 480px;
      display: block;
      object-fit: contain;
    }
    .boxes-canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: auto;
    }
    .viewer-hint {
      display: flex;
      align-items: center;
      gap: 4px;
      color: #64748b;
      margin-top: 6px;
      font-size: 0.75rem;
    }

    /* Inspector Card */
    .inspector-card {
      border-radius: 12px;
      background: #f8fafc;
      border: 2px solid #6366f1;
      padding: 12px 16px;
      animation: fadeIn 0.2s ease-in-out;
    }
    .inspector-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
      .inspector-title { display: flex; align-items: center; gap: 6px; color: #312e81; }
    }
    .inspector-body {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 16px;
    }
    .inspector-details { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
    .status-indicator {
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 700;
    }
    .status-green { background: #dcfce7; color: #16a34a; }
    .status-amber { background: #fef3c7; color: #d97706; }
    .status-red { background: #fee2e2; color: #dc2626; }
    .current-assign {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 0.9rem;
      .lbl { color: #64748b; }
      .roll-tag { background: #e2e8f0; padding: 2px 6px; border-radius: 4px; font-size: 0.8rem; }
    }
    .reassign-controls {
      display: flex;
      align-items: center;
      gap: 8px;
      flex-wrap: wrap;
      .reassign-field { width: 260px; margin-bottom: -1.25em; }
    }

    /* Tabs & Student Lists */
    .tabs-card { border-radius: 12px; overflow: hidden; }
    .tab-icon { margin-right: 6px; }
    .tab-pane { padding: 16px; }
    .pane-helper-text {
      color: #64748b;
      font-size: 0.85rem;
      margin-bottom: 12px;
    }
    .not-detected-helper {
      background: #eff6ff;
      border: 1px solid #bfdbfe;
      padding: 8px 12px;
      border-radius: 8px;
      color: #1e40af;
      display: flex;
      align-items: center;
      justify-content: space-between;
      flex-wrap: wrap;
      gap: 8px;
    }
    .students-list { display: flex; flex-direction: column; gap: 8px; }
    .student-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      background: #ffffff;
      flex-wrap: wrap;
      gap: 10px;
      transition: background 0.1s;
      &:hover { background: #f8fafc; }
    }
    .student-info { display: flex; align-items: center; gap: 12px; }
    .roll-pill {
      background: #f1f5f9;
      color: #475569;
      padding: 4px 8px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 0.8rem;
      min-width: 32px;
      text-align: center;
    }
    .face-tag {
      background: #f3e8ff;
      color: #7e22ce;
      padding: 4px 8px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 0.8rem;
    }
    .name-block {
      display: flex;
      flex-direction: column;
      strong { font-size: 0.95rem; color: #1e293b; }
      .meta-row { display: flex; align-items: center; gap: 8px; margin-top: 2px; }
    }
    .conf-badge {
      font-size: 0.75rem;
      color: #16a34a;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 2px;
    }
    .source-tag { font-size: 0.7rem; color: #94a3b8; }
    .status-chip {
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 0.75rem;
      font-weight: 600;
    }
    .amber-chip { background: #fef3c7; color: #b45309; }
    .red-chip { background: #fee2e2; color: #dc2626; }
    .not-detected-tag { font-size: 0.75rem; color: #64748b; font-style: italic; }

    /* Segmented Status Toggle Group */
    .status-toggle-group {
      display: inline-flex;
      background: #f1f5f9;
      border-radius: 8px;
      padding: 3px;
      gap: 3px;
    }
    .toggle-btn {
      border: none;
      background: transparent;
      padding: 6px 12px;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 600;
      color: #64748b;
      cursor: pointer;
      transition: all 0.15s;
      &:hover { color: #1e293b; }
    }
    .btn-present { background: #22c55e !important; color: #ffffff !important; }
    .btn-absent { background: #ef4444 !important; color: #ffffff !important; }
    .btn-late { background: #f59e0b !important; color: #ffffff !important; }
    .btn-leave { background: #8b5cf6 !important; color: #ffffff !important; }

    .review-actions { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
    .empty-list-notice {
      text-align: center;
      padding: 30px;
      color: #64748b;
      .check-icon { font-size: 40px; width: 40px; height: 40px; color: #22c55e; }
    }

    /* Fixed Bottom Confirmation Bar */
    .bottom-action-bar {
      position: fixed;
      bottom: 0;
      left: 0;
      right: 0;
      background: #ffffff;
      border-top: 1px solid #cbd5e1;
      padding: 12px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 -4px 16px rgba(0,0,0,0.08);
      z-index: 1000;
      flex-wrap: wrap;
      gap: 12px;
    }
    .action-summary {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .summary-pill {
      padding: 4px 10px;
      border-radius: 6px;
      font-size: 0.8rem;
      font-weight: 700;
    }
    .sum-present { background: #dcfce7; color: #15803d; }
    .sum-absent { background: #fee2e2; color: #b91c1c; }
    .sum-late { background: #fef3c7; color: #b45309; }
    .sum-leave { background: #ede9fe; color: #6d28d9; }
    .sum-total { background: #f1f5f9; color: #475569; }
    .action-buttons { display: flex; gap: 12px; align-items: center; }
    .save-btn {
      padding: 0 24px;
      font-weight: 600;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .mini-spinner { margin-right: 6px; }

    @keyframes fadeIn {
      from { opacity: 0; transform: translateY(-4px); }
      to { opacity: 1; transform: translateY(0); }
    }

    @media (max-width: 600px) {
      .student-card { flex-direction: column; align-items: flex-start; }
      .status-toggle-group { width: 100%; justify-content: space-between; }
      .toggle-btn { flex: 1; text-align: center; }
      .bottom-action-bar { flex-direction: column; align-items: stretch; }
      .action-buttons { justify-content: flex-end; }
    }
  `]
})
export class FaceReviewComponent implements OnInit, OnDestroy {
  @ViewChild('sourceImg') sourceImgRef!: ElementRef<HTMLImageElement>;
  @ViewChild('overlayCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('canvasContainer') containerRef!: ElementRef<HTMLDivElement>;

  private faceService = inject(FaceAttendanceService);
  private attendanceService = inject(AttendanceService);
  private studentService = inject(StudentService);
  private route = inject(ActivatedRoute);
  private router = inject(Router);
  private snackBar = inject(MatSnackBar);

  sessionData: FaceReviewSessionData | null = null;
  currentPhotoIndex = 0;
  classStudents: Student[] = [];
  availableSlots: StaffDailyScheduleItem[] = [];

  selectedTimetableEntryId: number | null = null;
  selectedPeriodId: number | null = null;
  attendanceDate = '';

  selectedTab = 0;
  isSubmitting = false;

  // Student reviews mapping
  allStudentReviewItems: StudentReviewItem[] = [];
  lowConfidenceAndUnknownFaces: RecognizedFace[] = [];

  // Face inspector state
  inspectingFace: InspectorFace | null = null;
  inspectorSelectedStudentId: number = 0;

  get currentPhoto(): ReviewPhotoItem | undefined {
    return this.sessionData?.photos[this.currentPhotoIndex];
  }

  get suggestedPresentStudents(): StudentReviewItem[] {
    return this.allStudentReviewItems.filter(s => s.status === 'Present' || s.source === 'Face');
  }

  get notDetectedStudents(): StudentReviewItem[] {
    return this.allStudentReviewItems.filter(s => s.source === 'Manual');
  }

  get suggestedPresentCount(): number {
    return this.allStudentReviewItems.filter(s => s.status === 'Present').length;
  }

  get lowConfidenceOrUnknownCount(): number {
    return this.lowConfidenceAndUnknownFaces.length;
  }

  get notDetectedCount(): number {
    return this.notDetectedStudents.length;
  }

  get totalClassStudentsCount(): number {
    return this.allStudentReviewItems.length;
  }

  ngOnInit(): void {
    // 1. Load active session data
    this.sessionData = this.faceService.getReviewSession();

    // 2. Read query params if routed with timetable entry info
    this.route.queryParams.subscribe(params => {
      if (params['timetableEntryId']) {
        this.selectedTimetableEntryId = +params['timetableEntryId'];
      }
      if (params['periodId']) {
        this.selectedPeriodId = +params['periodId'];
      }
      if (params['date']) {
        this.attendanceDate = params['date'];
      }
    });

    if (this.sessionData) {
      if (!this.attendanceDate) {
        this.attendanceDate = this.sessionData.date || new Date().toISOString().substring(0, 10);
      }
      if (!this.selectedTimetableEntryId && this.sessionData.timetableEntryId) {
        this.selectedTimetableEntryId = this.sessionData.timetableEntryId;
      }
      if (!this.selectedPeriodId && this.sessionData.periodId) {
        this.selectedPeriodId = this.sessionData.periodId;
      }

      this.loadClassStudents();
      this.loadScheduleSlots();
      this.initializeReviewRoster();
    }
  }

  ngOnDestroy(): void {}

  @HostListener('window:resize')
  onResize(): void {
    this.renderOverlayBoxes();
  }

  loadClassStudents(): void {
    if (!this.sessionData) return;
    this.studentService.getAll({
      classId: this.sessionData.classId,
      section: this.sessionData.section || undefined,
      pageSize: 200
    }).subscribe({
      next: (res) => {
        this.classStudents = res.items || [];
        this.reconcileClassStudentsWithReview();
      }
    });
  }

  loadScheduleSlots(): void {
    this.attendanceService.getMySchedule(this.attendanceDate).subscribe({
      next: (slots) => {
        if (this.sessionData) {
          // Filter slots for this class
          const matchingSlots = slots.filter(s => s.classId === this.sessionData!.classId);
          this.availableSlots = matchingSlots.length > 0 ? matchingSlots : slots;
          if (!this.selectedTimetableEntryId && this.availableSlots.length > 0) {
            this.selectedTimetableEntryId = this.availableSlots[0].timetableEntryId;
            this.selectedPeriodId = this.availableSlots[0].periodId;
          }
        } else {
          this.availableSlots = slots;
        }
      }
    });
  }

  onSlotSelected(entryId: number): void {
    this.selectedTimetableEntryId = entryId;
    const found = this.availableSlots.find(s => s.timetableEntryId === entryId);
    if (found) {
      this.selectedPeriodId = found.periodId;
    }
  }

  initializeReviewRoster(): void {
    if (!this.sessionData) return;
    const result = this.sessionData.recognitionResult;

    const items: StudentReviewItem[] = [];
    const unknownList: RecognizedFace[] = [];

    // Matched faces
    for (const face of result.recognizedFaces) {
      if (face.status === 'Matched' && face.matchedStudentId) {
        // Prevent duplicate students if matched in multiple photos: keep higher confidence
        const existing = items.find(i => i.studentId === face.matchedStudentId);
        if (existing) {
          if ((face.confidence || 0) > (existing.confidence || 0)) {
            existing.confidence = face.confidence;
            existing.photoIndex = face.photoIndex;
            existing.cropIndex = face.cropIndex;
          }
        } else {
          items.push({
            studentId: face.matchedStudentId,
            rollNumber: face.rollNumber || '',
            fullName: face.matchedStudentName || 'Student',
            status: 'Present',
            source: 'Face',
            confidence: face.confidence,
            isConfirmed: true,
            photoIndex: face.photoIndex,
            cropIndex: face.cropIndex
          });
        }
      } else {
        unknownList.push(face);
      }
    }

    // Not detected students from recognition
    for (const notDet of result.notDetectedStudents) {
      if (!items.some(i => i.studentId === notDet.studentId)) {
        items.push({
          studentId: notDet.studentId,
          rollNumber: notDet.rollNumber,
          fullName: notDet.studentName,
          status: 'Absent', // default recommendation; teacher reviews and confirms
          source: 'Manual',
          confidence: null,
          isConfirmed: false
        });
      }
    }

    this.allStudentReviewItems = items;
    this.lowConfidenceAndUnknownFaces = unknownList;

    setTimeout(() => this.renderOverlayBoxes(), 100);
  }

  reconcileClassStudentsWithReview(): void {
    for (const st of this.classStudents) {
      if (!this.allStudentReviewItems.some(i => i.studentId === st.id)) {
        this.allStudentReviewItems.push({
          studentId: st.id,
          rollNumber: st.rollNo,
          fullName: st.fullName,
          status: 'Absent',
          source: 'Manual',
          confidence: null,
          isConfirmed: false
        });
      }
    }
  }

  switchPhoto(index: number): void {
    this.currentPhotoIndex = index;
    setTimeout(() => this.renderOverlayBoxes(), 50);
  }

  renderOverlayBoxes(): void {
    if (!this.canvasRef || !this.sourceImgRef) return;
    const canvas = this.canvasRef.nativeElement;
    const img = this.sourceImgRef.nativeElement;

    const width = img.clientWidth || img.naturalWidth || 640;
    const height = img.clientHeight || img.naturalHeight || 480;

    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, width, height);

    if (!this.sessionData) return;
    const photoNumber = this.currentPhotoIndex + 1;

    // Filter faces belonging to current photo
    const photoFaces = this.sessionData.recognitionResult.recognizedFaces
      .filter(f => f.photoIndex === photoNumber && f.boundingBox);

    const scaleX = width / (img.naturalWidth || width || 1);
    const scaleY = height / (img.naturalHeight || height || 1);

    for (const face of photoFaces) {
      if (!face.boundingBox) continue;

      const bx = face.boundingBox.x * scaleX;
      const by = face.boundingBox.y * scaleY;
      const bw = face.boundingBox.width * scaleX;
      const bh = face.boundingBox.height * scaleY;

      let strokeColor = '#22c55e'; // Green
      let statusLabel = face.matchedStudentName ? `${face.matchedStudentName} (${Math.round(face.confidence * 100)}%)` : `Matched (${Math.round(face.confidence * 100)}%)`;

      if (face.status === 'LowConfidence') {
        strokeColor = '#f59e0b'; // Amber
        statusLabel = face.matchedStudentName ? `? ${face.matchedStudentName}` : 'Low Conf';
      } else if (face.status === 'Unknown') {
        strokeColor = '#ef4444'; // Red
        statusLabel = `Unknown #${face.cropIndex}`;
      }

      ctx.strokeStyle = strokeColor;
      ctx.lineWidth = 3;
      ctx.strokeRect(bx, by, bw, bh);

      // Label background pill
      ctx.font = 'bold 11px sans-serif';
      const textWidth = ctx.measureText(statusLabel).width;
      ctx.fillStyle = strokeColor;
      ctx.fillRect(bx, Math.max(0, by - 18), textWidth + 8, 18);

      ctx.fillStyle = '#ffffff';
      ctx.fillText(statusLabel, bx + 4, Math.max(12, by - 4));
    }
  }

  onCanvasClick(event: MouseEvent): void {
    if (!this.canvasRef || !this.sourceImgRef || !this.sessionData) return;
    const canvas = this.canvasRef.nativeElement;
    const rect = canvas.getBoundingClientRect();
    const clickX = event.clientX - rect.left;
    const clickY = event.clientY - rect.top;

    const img = this.sourceImgRef.nativeElement;
    const scaleX = canvas.width / (img.naturalWidth || canvas.width || 1);
    const scaleY = canvas.height / (img.naturalHeight || canvas.height || 1);

    const photoNumber = this.currentPhotoIndex + 1;
    const photoFaces = this.sessionData.recognitionResult.recognizedFaces
      .filter(f => f.photoIndex === photoNumber && f.boundingBox);

    // Find clicked face box
    for (const face of photoFaces) {
      if (!face.boundingBox) continue;
      const bx = face.boundingBox.x * scaleX;
      const by = face.boundingBox.y * scaleY;
      const bw = face.boundingBox.width * scaleX;
      const bh = face.boundingBox.height * scaleY;

      if (clickX >= bx && clickX <= bx + bw && clickY >= by && clickY <= by + bh) {
        this.openInspectorForFace(face);
        return;
      }
    }
  }

  openInspectorForFace(face: RecognizedFace): void {
    this.inspectingFace = {
      cropIndex: face.cropIndex,
      photoIndex: face.photoIndex,
      status: face.status,
      confidence: face.confidence,
      matchedStudentId: face.matchedStudentId,
      matchedStudentName: face.matchedStudentName,
      rollNumber: face.rollNumber,
      boundingBox: face.boundingBox
    };
    this.inspectorSelectedStudentId = face.matchedStudentId || 0;
  }

  closeInspector(): void {
    this.inspectingFace = null;
  }

  applyInspectorAssignment(): void {
    if (!this.inspectingFace) return;

    const faceRef = this.sessionData?.recognitionResult.recognizedFaces
      .find(f => f.cropIndex === this.inspectingFace!.cropIndex && f.photoIndex === this.inspectingFace!.photoIndex);

    if (this.inspectorSelectedStudentId === 0) {
      // Mark as unknown / dismiss
      if (faceRef) {
        faceRef.status = 'Unknown';
        faceRef.matchedStudentId = undefined;
        faceRef.matchedStudentName = undefined;
      }

      // Remove from present items if it was matched there
      if (this.inspectingFace.matchedStudentId) {
        const item = this.allStudentReviewItems.find(i => i.studentId === this.inspectingFace!.matchedStudentId);
        if (item) {
          item.source = 'Manual';
          item.status = 'Absent';
          item.confidence = null;
        }
      }

      this.snackBar.open(`Face #${this.inspectingFace.cropIndex} unassigned / marked as Unknown.`, 'OK', { duration: 2500 });
    } else {
      // Reassign to selected student
      const selectedStudent = this.classStudents.find(s => s.id === this.inspectorSelectedStudentId);
      if (selectedStudent) {
        if (faceRef) {
          faceRef.status = 'Matched';
          faceRef.matchedStudentId = selectedStudent.id;
          faceRef.matchedStudentName = selectedStudent.fullName;
          faceRef.rollNumber = selectedStudent.rollNo;
          faceRef.confidence = 0.99; // manually verified
        }

        let item = this.allStudentReviewItems.find(i => i.studentId === selectedStudent.id);
        if (item) {
          item.status = 'Present';
          item.source = 'Face';
          item.confidence = 0.99;
          item.isConfirmed = true;
        } else {
          this.allStudentReviewItems.push({
            studentId: selectedStudent.id,
            rollNumber: selectedStudent.rollNo,
            fullName: selectedStudent.fullName,
            status: 'Present',
            source: 'Face',
            confidence: 0.99,
            isConfirmed: true
          });
        }

        // Remove from unknown list
        this.lowConfidenceAndUnknownFaces = this.lowConfidenceAndUnknownFaces
          .filter(f => !(f.cropIndex === this.inspectingFace!.cropIndex && f.photoIndex === this.inspectingFace!.photoIndex));

        this.snackBar.open(`Assigned Face #${this.inspectingFace.cropIndex} to ${selectedStudent.fullName} as Present.`, 'OK', { duration: 2500 });
      }
    }

    this.closeInspector();
    this.renderOverlayBoxes();
  }

  confirmLowConfidenceFace(face: RecognizedFace): void {
    if (!face.matchedStudentId) return;
    face.status = 'Matched';

    let item = this.allStudentReviewItems.find(i => i.studentId === face.matchedStudentId);
    if (item) {
      item.status = 'Present';
      item.source = 'Face';
      item.isConfirmed = true;
    } else {
      this.allStudentReviewItems.push({
        studentId: face.matchedStudentId,
        rollNumber: face.rollNumber || '',
        fullName: face.matchedStudentName || 'Student',
        status: 'Present',
        source: 'Face',
        confidence: face.confidence,
        isConfirmed: true
      });
    }

    this.lowConfidenceAndUnknownFaces = this.lowConfidenceAndUnknownFaces
      .filter(f => !(f.cropIndex === face.cropIndex && f.photoIndex === face.photoIndex));

    this.snackBar.open(`Confirmed ${face.matchedStudentName} as Present!`, 'OK', { duration: 2500 });
    this.renderOverlayBoxes();
  }

  dismissFace(face: RecognizedFace): void {
    face.status = 'Unknown';
    face.matchedStudentId = undefined;
    face.matchedStudentName = undefined;

    this.lowConfidenceAndUnknownFaces = this.lowConfidenceAndUnknownFaces
      .filter(f => !(f.cropIndex === face.cropIndex && f.photoIndex === face.photoIndex));

    this.snackBar.open(`Dismissed Face #${face.cropIndex}.`, 'OK', { duration: 2000 });
    this.renderOverlayBoxes();
  }

  reassignStudent(studentItem: StudentReviewItem): void {
    this.inspectingFace = {
      cropIndex: studentItem.cropIndex || 1,
      photoIndex: studentItem.photoIndex || 1,
      status: 'Matched',
      confidence: studentItem.confidence || 0.9,
      matchedStudentId: studentItem.studentId,
      matchedStudentName: studentItem.fullName,
      rollNumber: studentItem.rollNumber
    };
    this.inspectorSelectedStudentId = studentItem.studentId;
  }

  setStudentStatus(item: StudentReviewItem, status: 'Present' | 'Absent' | 'Late' | 'OnLeave'): void {
    item.status = status;
    item.isConfirmed = true;
  }

  markAllNotDetectedAsAbsent(): void {
    for (const item of this.notDetectedStudents) {
      item.status = 'Absent';
      item.isConfirmed = true;
    }
    this.snackBar.open('Marked all not-detected students as Absent.', 'OK', { duration: 2500 });
  }

  countByStatus(status: string): number {
    return this.allStudentReviewItems.filter(s => s.status === status).length;
  }

  confirmAndSaveAttendance(): void {
    if (!this.selectedTimetableEntryId || !this.selectedPeriodId) {
      this.snackBar.open('Please select an assigned teaching period from the dropdown first.', 'Close', { duration: 4000 });
      return;
    }

    this.isSubmitting = true;

    const records: StudentAttendanceItem[] = this.allStudentReviewItems.map(item => ({
      studentId: item.studentId,
      rollNo: item.rollNumber,
      fullName: item.fullName,
      status: item.status,
      remarks: item.remarks,
      source: item.source,
      faceConfidence: item.confidence ?? undefined
    }));

    this.attendanceService.submitAttendance({
      timetableEntryId: this.selectedTimetableEntryId,
      periodId: this.selectedPeriodId,
      date: this.attendanceDate,
      source: 'Face',
      records
    }).subscribe({
      next: (res) => {
        this.isSubmitting = false;
        this.faceService.clearReviewSession();
        this.snackBar.open(
          `Success: Attendance confirmed & saved via Face Recognition! (${records.length} students recorded)`,
          'View Attendance',
          { duration: 4500 }
        ).onAction().subscribe(() => {
          this.router.navigate(['/app/attendance']);
        });

        setTimeout(() => {
          this.router.navigate(['/app/attendance']);
        }, 1500);
      },
      error: (err) => {
        this.isSubmitting = false;
        this.snackBar.open(err.error?.message || 'Failed to submit attendance. Please try again.', 'Close', { duration: 5000 });
      }
    });
  }
}
