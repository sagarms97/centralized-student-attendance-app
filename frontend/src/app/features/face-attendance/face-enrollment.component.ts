import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { AcademicService } from '../../core/services/academic.service';
import { ClassItem } from '../../core/models/academic.models';
import {
  FaceAttendanceService,
  StudentConsent,
  EnrollPhotoItem
} from '../../core/services/face-attendance.service';
import { MediaPipeFaceDetectorService } from '../../core/services/mediapipe-face-detector.service';

interface CapturedPose {
  poseType: 'Front' | 'SlightLeft' | 'SlightRight' | 'Alternative';
  label: string;
  description: string;
  imageBase64: string | null;
  isValid: boolean;
  statusMessage: string;
}

@Component({
  selector: 'app-face-enrollment',
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
    MatSnackBarModule,
    MatProgressSpinnerModule,
    MatTooltipModule
  ],
  template: `
    <div class="face-enrollment-container">
      <div class="page-header">
        <div>
          <h2>Student Face Biometric Enrollment</h2>
          <p class="subtitle">Capture 3 to 5 standardized facial photos for enrolled students. Raw photos are discarded immediately after in-memory encryption.</p>
        </div>
        <div>
          <a mat-stroked-button routerLink="/app/face-attendance/consent">
            <mat-icon>arrow_back</mat-icon>
            Back to Roster
          </a>
        </div>
      </div>

      <!-- Student Selection -->
      <mat-card class="selection-card">
        <div class="selection-row">
          <mat-form-field appearance="outline" class="select-field">
            <mat-label>Select Class</mat-label>
            <mat-select [(value)]="selectedClassId" (selectionChange)="onClassChange($event.value)">
              <mat-option *ngFor="let c of classes" [value]="c.id">
                {{ c.name }} ({{ c.sections }})
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="select-field">
            <mat-label>Select Student</mat-label>
            <mat-select [(value)]="selectedStudentId" (selectionChange)="onStudentChange($event.value)">
              <mat-option *ngFor="let s of students" [value]="s.studentId">
                {{ s.rollNumber }} - {{ s.studentName }} ({{ s.status }})
              </mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </mat-card>

      <!-- Consent Status Warning -->
      <div *ngIf="selectedStudent && selectedStudent.status !== 'Consented'" class="consent-warning-box">
        <mat-icon color="warn">gpp_bad</mat-icon>
        <div>
          <h4>Verified Parental Consent Required</h4>
          <p>
            Student <strong>{{ selectedStudent.studentName }}</strong> does not have verified parental consent on file (Status: {{ selectedStudent.status }}).
            Under GDPR & FERPA guidelines, facial enrollment is blocked until a parent or legal guardian provides formal consent.
          </p>
          <a mat-flat-button color="primary" routerLink="/app/face-attendance/consent">
            <mat-icon>how_to_reg</mat-icon>
            Record Consent First
          </a>
        </div>
      </div>

      <!-- Enrollment Studio (Visible only when consented) -->
      <div *ngIf="selectedStudent && selectedStudent.status === 'Consented'" class="studio-layout">
        <!-- Camera / Capture View -->
        <mat-card class="camera-card">
          <mat-card-header>
            <mat-icon mat-card-avatar color="primary">camera_alt</mat-icon>
            <mat-card-title>Capture Pose: {{ currentPose.label }}</mat-card-title>
            <mat-card-subtitle>{{ currentPose.description }}</mat-card-subtitle>
          </mat-card-header>

          <mat-card-content class="camera-viewport">
            <!-- Video Stream -->
            <div class="video-wrapper" [class.hidden]="!isCameraActive">
              <video #videoElement autoplay playsinline muted class="camera-video"></video>
              <div class="face-guide-overlay">
                <div class="face-guide-oval"></div>
                <span class="guide-text">Position face inside oval</span>
              </div>
            </div>

            <!-- Placeholder when camera is off -->
            <div *ngIf="!isCameraActive" class="camera-off-placeholder">
              <mat-icon class="large-icon">videocam_off</mat-icon>
              <p>Camera is currently inactive. Start camera or upload a photo.</p>
              <button mat-flat-button color="primary" (click)="startCamera()">
                <mat-icon>videocam</mat-icon>
                Start Camera
              </button>
            </div>

            <!-- Canvas for snapshot processing -->
            <canvas #snapshotCanvas class="hidden"></canvas>
          </mat-card-content>

          <mat-card-actions class="camera-controls">
            <button mat-stroked-button (click)="toggleCamera()" *ngIf="isCameraActive">
              <mat-icon>stop</mat-icon>
              Stop Camera
            </button>

            <button mat-flat-button color="primary" (click)="captureCurrentPose()" [disabled]="!isCameraActive || isAnalyzing" *ngIf="isCameraActive">
              <mat-icon *ngIf="!isAnalyzing">photo_camera</mat-icon>
              <mat-spinner diameter="18" *ngIf="isAnalyzing"></mat-spinner>
              <span>Capture {{ currentPose.label }}</span>
            </button>

            <!-- File Upload Alternative -->
            <input type="file" #fileInput accept="image/jpeg,image/png,image/webp" class="hidden" (change)="onFileSelected($event)">
            <button mat-stroked-button (click)="fileInput.click()" [disabled]="isAnalyzing">
              <mat-icon>upload_file</mat-icon>
              Upload Photo
            </button>
          </mat-card-actions>
        </mat-card>

        <!-- Pose Checklist & Gallery -->
        <div class="poses-checklist">
          <mat-card class="checklist-card">
            <mat-card-header>
              <mat-icon mat-card-avatar color="accent">checklist</mat-icon>
              <mat-card-title>Required Poses ({{ validPosesCount }}/{{ poses.length }})</mat-card-title>
              <mat-card-subtitle>Capture diverse angles for optimal ArcFace verification.</mat-card-subtitle>
            </mat-card-header>

            <mat-card-content class="poses-grid">
              <div *ngFor="let p of poses; let i = index"
                   class="pose-item"
                   [class.active-pose]="currentPoseIndex === i"
                   [class.completed-pose]="p.isValid"
                   (click)="selectPose(i)">
                <div class="pose-thumb">
                  <img *ngIf="p.imageBase64" [src]="p.imageBase64" alt="Captured pose">
                  <mat-icon *ngIf="!p.imageBase64">person</mat-icon>
                  <mat-icon class="check-icon" *ngIf="p.isValid">check_circle</mat-icon>
                </div>
                <div class="pose-meta">
                  <strong>{{ p.label }}</strong>
                  <small>{{ p.statusMessage }}</small>
                </div>
              </div>
            </mat-card-content>

            <mat-card-actions class="save-actions">
              <button mat-flat-button color="primary" class="full-width"
                      [disabled]="validPosesCount < 1 || isSaving"
                      (click)="saveEnrollment()">
                <mat-icon *ngIf="!isSaving">lock</mat-icon>
                <mat-spinner diameter="18" *ngIf="isSaving"></mat-spinner>
                <span>Save & Encrypt {{ validPosesCount }} Biometrics</span>
              </button>
            </mat-card-actions>
          </mat-card>

          <!-- Privacy / Security Note -->
          <mat-card class="security-note-card">
            <mat-icon color="primary">shield</mat-icon>
            <div>
              <strong>Zero Photo Storage Guarantee:</strong>
              <p>Uploaded photos are processed strictly in-memory into 512-d float vectors and encrypted with AES-256-GCM. Image bytes are immediately destroyed.</p>
            </div>
          </mat-card>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .face-enrollment-container {
      max-width: 1100px;
      margin: 0 auto;
      padding: 24px 16px;
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .page-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 12px;
    }
    .page-header h2 {
      margin: 0 0 4px 0;
      font-size: 1.5rem;
      font-weight: 700;
    }
    .subtitle {
      margin: 0;
      color: #64748b;
      font-size: 0.95rem;
    }
    .selection-card {
      border-radius: 12px;
      padding: 16px 20px;
    }
    .selection-row {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    .select-field {
      flex: 1;
      min-width: 260px;
    }
    .consent-warning-box {
      background: #fef2f2;
      border: 1px solid #fecaca;
      border-radius: 12px;
      padding: 20px;
      display: flex;
      gap: 16px;
      align-items: flex-start;
      color: #991b1b;
    }
    .consent-warning-box mat-icon {
      font-size: 36px;
      width: 36px;
      height: 36px;
      flex-shrink: 0;
    }
    .consent-warning-box h4 {
      margin: 0 0 6px 0;
      font-size: 1.1rem;
      font-weight: 600;
    }
    .consent-warning-box p {
      margin: 0 0 14px 0;
      font-size: 0.92rem;
      line-height: 1.5;
    }
    .studio-layout {
      display: grid;
      grid-template-columns: 1fr 380px;
      gap: 20px;
    }
    @media (max-width: 900px) {
      .studio-layout {
        grid-template-columns: 1fr;
      }
    }
    .camera-card {
      border-radius: 12px;
      overflow: hidden;
    }
    .camera-viewport {
      background: #0f172a;
      min-height: 360px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    .video-wrapper {
      position: relative;
      width: 100%;
      height: 360px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .camera-video {
      width: 100%;
      height: 100%;
      object-fit: cover;
      transform: scaleX(-1);
    }
    .face-guide-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      pointer-events: none;
    }
    .face-guide-oval {
      width: 180px;
      height: 240px;
      border: 3px dashed rgba(255, 255, 255, 0.7);
      border-radius: 50%;
      box-shadow: 0 0 0 9999px rgba(0, 0, 0, 0.35);
    }
    .guide-text {
      color: white;
      margin-top: 12px;
      font-size: 0.85rem;
      text-shadow: 0 1px 3px rgba(0,0,0,0.8);
      font-weight: 600;
    }
    .camera-off-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      color: #94a3b8;
      padding: 40px 16px;
      gap: 12px;
    }
    .large-icon {
      font-size: 48px;
      width: 48px;
      height: 48px;
    }
    .camera-controls {
      display: flex;
      justify-content: flex-end;
      gap: 10px;
      padding: 12px 16px;
    }
    .poses-checklist {
      display: flex;
      flex-direction: column;
      gap: 16px;
    }
    .checklist-card {
      border-radius: 12px;
    }
    .poses-grid {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-top: 8px;
    }
    .pose-item {
      display: flex;
      align-items: center;
      gap: 12px;
      padding: 8px 12px;
      border-radius: 8px;
      border: 1px solid #e2e8f0;
      cursor: pointer;
      transition: all 0.2s;
    }
    .pose-item:hover {
      background: #f8fafc;
    }
    .pose-item.active-pose {
      border-color: #2563eb;
      background: #eff6ff;
    }
    .pose-item.completed-pose {
      border-color: #86efac;
      background: #f0fdf4;
    }
    .pose-thumb {
      width: 48px;
      height: 48px;
      border-radius: 6px;
      background: #e2e8f0;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    .pose-thumb img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .check-icon {
      position: absolute;
      bottom: 2px;
      right: 2px;
      font-size: 16px;
      width: 16px;
      height: 16px;
      color: #16a34a;
      background: white;
      border-radius: 50%;
    }
    .pose-meta {
      display: flex;
      flex-direction: column;
    }
    .pose-meta strong {
      font-size: 0.9rem;
    }
    .pose-meta small {
      font-size: 0.78rem;
      color: #64748b;
    }
    .save-actions {
      padding: 16px;
    }
    .full-width {
      width: 100%;
    }
    .security-note-card {
      border-radius: 12px;
      background: #f0fdf4;
      border: 1px solid #bbf7d0;
      display: flex;
      align-items: flex-start;
      gap: 12px;
      padding: 16px;
      color: #166534;
      font-size: 0.85rem;
    }
    .security-note-card p {
      margin: 4px 0 0 0;
      color: #15803d;
    }
    .hidden {
      display: none !important;
    }
  `]
})
export class FaceEnrollmentComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('snapshotCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;

  private route = inject(ActivatedRoute);
  private academicService = inject(AcademicService);
  private faceService = inject(FaceAttendanceService);
  private mediaPipeService = inject(MediaPipeFaceDetectorService);
  private snackBar = inject(MatSnackBar);

  classes: ClassItem[] = [];
  selectedClassId: number | null = null;
  students: StudentConsent[] = [];
  selectedStudentId: number | null = null;
  selectedStudent: StudentConsent | null = null;

  isCameraActive = false;
  mediaStream: MediaStream | null = null;
  isAnalyzing = false;
  isSaving = false;

  currentPoseIndex = 0;
  poses: CapturedPose[] = [
    {
      poseType: 'Front',
      label: '1. Front Facing',
      description: 'Look directly at camera with neutral expression.',
      imageBase64: null,
      isValid: false,
      statusMessage: 'Not captured'
    },
    {
      poseType: 'SlightLeft',
      label: '2. Slight Left',
      description: 'Turn head slightly 15 degrees to the left.',
      imageBase64: null,
      isValid: false,
      statusMessage: 'Not captured'
    },
    {
      poseType: 'SlightRight',
      label: '3. Slight Right',
      description: 'Turn head slightly 15 degrees to the right.',
      imageBase64: null,
      isValid: false,
      statusMessage: 'Not captured'
    },
    {
      poseType: 'Alternative',
      label: '4. Natural Expression',
      description: 'Smiling or with normal classroom lighting.',
      imageBase64: null,
      isValid: false,
      statusMessage: 'Optional'
    }
  ];

  get currentPose(): CapturedPose {
    return this.poses[this.currentPoseIndex];
  }

  get validPosesCount(): number {
    return this.poses.filter(p => p.isValid).length;
  }

  ngOnInit(): void {
    this.loadClasses();
  }

  ngOnDestroy(): void {
    this.stopCamera();
  }

  loadClasses(): void {
    this.academicService.getClasses().subscribe({
      next: (res) => {
        this.classes = res;
        if (this.classes.length > 0) {
          this.selectedClassId = this.classes[0].id;
          this.loadStudentsForClass(this.selectedClassId);
        }
      }
    });
  }

  onClassChange(classId: number): void {
    this.selectedClassId = classId;
    this.loadStudentsForClass(classId);
  }

  loadStudentsForClass(classId: number): void {
    this.faceService.getClassConsents(classId).subscribe({
      next: (res) => {
        this.students = res;
        const targetStudentId = this.route.snapshot.queryParams['studentId'];
        if (targetStudentId) {
          const id = parseInt(targetStudentId, 10);
          this.onStudentChange(id);
        } else if (this.students.length > 0) {
          this.onStudentChange(this.students[0].studentId);
        }
      }
    });
  }

  onStudentChange(studentId: number): void {
    this.selectedStudentId = studentId;
    this.selectedStudent = this.students.find(s => s.studentId === studentId) || null;
    this.resetPoses();
  }

  resetPoses(): void {
    this.poses.forEach(p => {
      p.imageBase64 = null;
      p.isValid = false;
      p.statusMessage = 'Not captured';
    });
    this.currentPoseIndex = 0;
  }

  selectPose(index: number): void {
    this.currentPoseIndex = index;
  }

  async startCamera(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1280 }, height: { ideal: 720 }, facingMode: 'user' },
        audio: false
      });
      this.isCameraActive = true;
      setTimeout(() => {
        if (this.videoRef && this.videoRef.nativeElement) {
          this.videoRef.nativeElement.srcObject = this.mediaStream;
        }
      }, 100);
    } catch (err) {
      this.snackBar.open('Unable to access device camera. Please check camera permissions.', 'Close', { duration: 4000 });
    }
  }

  stopCamera(): void {
    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach(t => t.stop());
      this.mediaStream = null;
    }
    this.isCameraActive = false;
  }

  toggleCamera(): void {
    if (this.isCameraActive) {
      this.stopCamera();
    } else {
      this.startCamera();
    }
  }

  async captureCurrentPose(): Promise<void> {
    if (!this.videoRef || !this.canvasRef) return;
    this.isAnalyzing = true;

    const video = this.videoRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      this.isAnalyzing = false;
      return;
    }

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    await this.processImage(canvas);
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

    this.isAnalyzing = true;
    const file = input.files[0];
    const reader = new FileReader();

    reader.onload = async (e) => {
      const img = new Image();
      img.onload = async () => {
        const canvas = this.canvasRef.nativeElement;
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0);
          await this.processImage(canvas);
        }
      };
      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
    input.value = '';
  }

  async processImage(canvas: HTMLCanvasElement): Promise<void> {
    try {
      // Run MediaPipe Face Detector on the image
      const detected = await this.mediaPipeService.detectAndCropFaces(canvas);

      if (detected.length === 0) {
        this.currentPose.statusMessage = 'Rejected: No face detected in frame';
        this.currentPose.isValid = false;
        this.snackBar.open('No face detected. Please ensure student is well-lit and looking at the camera.', 'OK', { duration: 4000 });
        this.isAnalyzing = false;
        return;
      }

      if (detected.length > 1) {
        this.currentPose.statusMessage = 'Rejected: Multiple faces detected';
        this.currentPose.isValid = false;
        this.snackBar.open('Multiple faces detected. Only one student face is permitted during enrollment.', 'OK', { duration: 4000 });
        this.isAnalyzing = false;
        return;
      }

      const face = detected[0];
      this.currentPose.imageBase64 = face.cropBase64;
      this.currentPose.isValid = true;
      this.currentPose.statusMessage = `Ready (Quality score: ${(face.score * 100).toFixed(0)}%)`;

      this.snackBar.open(`Pose '${this.currentPose.label}' captured successfully!`, 'OK', { duration: 2500 });

      // Advance to next uncaptured pose
      const nextUncaptured = this.poses.findIndex((p, idx) => idx > this.currentPoseIndex && !p.isValid);
      if (nextUncaptured !== -1) {
        this.currentPoseIndex = nextUncaptured;
      }
    } catch (err: any) {
      this.snackBar.open('Error detecting face in photo.', 'Close', { duration: 3000 });
    } finally {
      this.isAnalyzing = false;
    }
  }

  saveEnrollment(): void {
    if (!this.selectedStudent || this.validPosesCount === 0) return;

    this.isSaving = true;
    const validPhotos: EnrollPhotoItem[] = this.poses
      .filter(p => p.isValid && p.imageBase64)
      .map(p => ({
        poseType: p.poseType,
        imageBase64: p.imageBase64!
      }));

    this.faceService.enrollStudent({
      studentId: this.selectedStudent.studentId,
      photos: validPhotos
    }).subscribe({
      next: (res) => {
        this.isSaving = false;
        this.snackBar.open(`Successfully enrolled ${res.successfullyEnrolledCount} biometric poses for ${res.studentName}!`, 'OK', { duration: 4000 });
        this.stopCamera();
        if (this.selectedClassId) {
          this.loadStudentsForClass(this.selectedClassId);
        }
      },
      error: (err) => {
        this.isSaving = false;
        this.snackBar.open(err.error?.message || 'Enrollment failed.', 'Close', { duration: 4000 });
      }
    });
  }
}
