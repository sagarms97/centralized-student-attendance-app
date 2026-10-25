import { Component, OnInit, OnDestroy, inject, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterModule } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatSelectModule } from '@angular/material/select';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatChipsModule } from '@angular/material/chips';
import { AcademicService } from '../../core/services/academic.service';
import { ClassItem } from '../../core/models/academic.models';
import {
  FaceAttendanceService,
  FaceCropMatchRequest,
  ClassRecognitionResult
} from '../../core/services/face-attendance.service';
import { MediaPipeFaceDetectorService, DetectedFaceItem } from '../../core/services/mediapipe-face-detector.service';

interface ClassPhotoSlot {
  index: number;
  label: string;
  description: string;
  imageSrc: string | null;
  detectedFaces: DetectedFaceItem[];
  isProcessing: boolean;
}

@Component({
  selector: 'app-face-camera-capture',
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
    MatTooltipModule,
    MatChipsModule
  ],
  template: `
    <div class="face-capture-container">
      <div class="page-header">
        <div>
          <h2>Classroom Multi-Face Attendance Capture</h2>
          <p class="subtitle">Capture 1 to 3 wide-angle photos of the classroom (Left, Center, Right). Faces are detected locally on-device via MediaPipe WASM and only cropped faces are transmitted securely.</p>
        </div>
        <div>
          <a mat-stroked-button routerLink="/app/attendance">
            <mat-icon>arrow_back</mat-icon>
            Manual Attendance
          </a>
        </div>
      </div>

      <!-- Class & Session Setup -->
      <mat-card class="setup-card">
        <div class="setup-grid">
          <mat-form-field appearance="outline" class="select-field">
            <mat-label>Class</mat-label>
            <mat-select [(value)]="selectedClassId" (selectionChange)="onClassSelect($event.value)">
              <mat-option *ngFor="let c of classes" [value]="c.id">
                {{ c.name }}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="select-field">
            <mat-label>Section</mat-label>
            <mat-select [(value)]="selectedSection">
              <mat-option [value]="''">All Sections</mat-option>
              <mat-option *ngFor="let s of availableSections" [value]="s">Section {{ s }}</mat-option>
            </mat-select>
          </mat-form-field>
        </div>
      </mat-card>

      <!-- Multi-Photo Slots (1 to 3 photos) -->
      <div class="photos-slots-grid">
        <mat-card *ngFor="let slot of photoSlots; let i = index"
                  class="slot-card"
                  [class.active-slot]="currentSlotIndex === i"
                  (click)="selectSlot(i)">
          <div class="slot-preview">
            <img *ngIf="slot.imageSrc" [src]="slot.imageSrc" alt="Classroom section">
            <div *ngIf="!slot.imageSrc" class="slot-empty">
              <mat-icon>add_a_photo</mat-icon>
              <span>{{ slot.label }}</span>
            </div>
            <div *ngIf="slot.isProcessing" class="slot-overlay">
              <mat-spinner diameter="30"></mat-spinner>
              <small>Detecting...</small>
            </div>
            <span class="badge-counter" *ngIf="slot.detectedFaces.length > 0">
              {{ slot.detectedFaces.length }} faces
            </span>
          </div>
          <div class="slot-info">
            <strong>{{ slot.label }}</strong>
            <small>{{ slot.description }}</small>
          </div>
        </mat-card>
      </div>

      <!-- Active Camera Studio -->
      <mat-card class="studio-card">
        <mat-card-header>
          <mat-icon mat-card-avatar color="primary">photo_camera</mat-icon>
          <mat-card-title>Capturing: {{ currentSlot.label }}</mat-card-title>
          <mat-card-subtitle>Ensure students are seated, facing forward with sufficient classroom lighting.</mat-card-subtitle>
        </mat-card-header>

        <mat-card-content class="viewport-content">
          <!-- Live Camera Stream -->
          <div class="camera-stream-wrapper" [class.hidden]="!isCameraActive">
            <video #videoElement autoplay playsinline muted class="camera-stream"></video>
            <div class="camera-guidelines">
              <span class="guide-pill">Wide View • {{ currentSlot.label }}</span>
            </div>
          </div>

          <!-- Captured Photo Preview with Bounding Box Overlay -->
          <div class="preview-overlay-wrapper" *ngIf="!isCameraActive && currentSlot.imageSrc">
            <img #previewImage [src]="currentSlot.imageSrc" alt="Class preview" class="preview-img" (load)="drawBoundingBoxes()">
            <canvas #boxCanvas class="box-overlay-canvas"></canvas>
          </div>

          <!-- Inactive Placeholder -->
          <div *ngIf="!isCameraActive && !currentSlot.imageSrc" class="inactive-placeholder">
            <mat-icon class="huge-icon">sensors_off</mat-icon>
            <p>Ready to capture photo for {{ currentSlot.label }}. Start device camera or upload image.</p>
            <div class="init-actions">
              <button mat-flat-button color="primary" (click)="startCamera()">
                <mat-icon>videocam</mat-icon>
                Start Camera
              </button>
            </div>
          </div>

          <!-- Hidden canvas for photo conversion -->
          <canvas #captureCanvas class="hidden"></canvas>
        </mat-card-content>

        <mat-card-actions class="studio-actions">
          <div class="action-left">
            <span class="detected-summary" *ngIf="totalDetectedFacesAcrossAllPhotos > 0">
              <mat-icon color="primary">groups</mat-icon>
              <strong>{{ totalDetectedFacesAcrossAllPhotos }}</strong> total faces detected across {{ completedSlotsCount }} photo(s)
            </span>
          </div>

          <div class="action-right">
            <!-- Camera controls -->
            <button mat-stroked-button (click)="toggleCamera()" *ngIf="isCameraActive">
              <mat-icon>stop</mat-icon>
              Stop Camera
            </button>

            <button mat-flat-button color="primary" (click)="snapPhoto()" [disabled]="!isCameraActive || currentSlot.isProcessing" *ngIf="isCameraActive">
              <mat-icon>camera</mat-icon>
              Snap Photo
            </button>

            <input type="file" #fileInput accept="image/jpeg,image/png,image/webp" class="hidden" (change)="onFileSelected($event)">
            <button mat-stroked-button (click)="fileInput.click()" [disabled]="currentSlot.isProcessing">
              <mat-icon>upload</mat-icon>
              Upload Photo
            </button>

            <!-- Proceed to Recognition -->
            <button mat-flat-button color="accent"
                    [disabled]="totalDetectedFacesAcrossAllPhotos === 0 || isRecognizing"
                    (click)="submitForRecognition()">
              <mat-icon *ngIf="!isRecognizing">face</mat-icon>
              <mat-spinner diameter="18" *ngIf="isRecognizing"></mat-spinner>
              <span>Recognize & Match Students ({{ totalDetectedFacesAcrossAllPhotos }})</span>
            </button>
          </div>
        </mat-card-actions>
      </mat-card>

      <!-- Recognition Results Summary Dialog / Drawer (Phase 4 integration) -->
      <mat-card *ngIf="recognitionResult" class="results-card">
        <mat-card-header>
          <mat-icon mat-card-avatar color="primary">how_to_reg</mat-icon>
          <mat-card-title>Face Recognition Results ({{ recognitionResult.className }})</mat-card-title>
          <mat-card-subtitle>Processed {{ recognitionResult.processedPhotosCount }} photo(s) • {{ recognitionResult.totalFacesDetected }} total faces</mat-card-subtitle>
        </mat-card-header>
        <mat-card-content class="results-content">
          <div class="results-kpi-bar">
            <div class="kpi-pill matched-pill">
              <strong>{{ recognitionResult.matchedCount }}</strong> Confident Matches
            </div>
            <div class="kpi-pill lowconf-pill">
              <strong>{{ recognitionResult.lowConfidenceCount }}</strong> Needs Teacher Review
            </div>
            <div class="kpi-pill unknown-pill">
              <strong>{{ recognitionResult.unknownCount }}</strong> Unknown Faces
            </div>
            <div class="kpi-pill notdetected-pill">
              <strong>{{ recognitionResult.notDetectedStudents.length }}</strong> Not Detected
            </div>
          </div>

          <!-- Matched Faces Roster -->
          <div class="matched-roster-preview">
            <h4>Matched Students:</h4>
            <div class="students-chip-grid">
              <mat-chip-set>
                <mat-chip *ngFor="let face of recognitionResult.recognizedFaces"
                          [class.green-chip]="face.status === 'Matched'"
                          [class.amber-chip]="face.status === 'LowConfidence'"
                          [class.red-chip]="face.status === 'Unknown'">
                  <mat-icon matChipAvatar *ngIf="face.status === 'Matched'">check_circle</mat-icon>
                  <mat-icon matChipAvatar *ngIf="face.status === 'LowConfidence'">help</mat-icon>
                  <mat-icon matChipAvatar *ngIf="face.status === 'Unknown'">person_off</mat-icon>
                  {{ face.matchedStudentName || 'Unknown Face' }} ({{ face.confidence | percent:'1.0-0' }})
                  <span *ngIf="face.isDuplicate" class="dup-tag">DUP</span>
                </mat-chip>
              </mat-chip-set>
            </div>
          </div>
        </mat-card-content>
      </mat-card>
    </div>
  `,
  styles: [`
    .face-capture-container {
      max-width: 1200px;
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
    .setup-card {
      border-radius: 12px;
      padding: 16px 20px;
    }
    .setup-grid {
      display: flex;
      gap: 16px;
      flex-wrap: wrap;
    }
    .select-field {
      flex: 1;
      min-width: 240px;
    }
    .photos-slots-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
      gap: 16px;
    }
    .slot-card {
      border-radius: 12px;
      padding: 12px;
      cursor: pointer;
      border: 2px solid #e2e8f0;
      transition: all 0.2s;
    }
    .slot-card:hover {
      border-color: #94a3b8;
    }
    .slot-card.active-slot {
      border-color: #2563eb;
      background: #eff6ff;
    }
    .slot-preview {
      height: 140px;
      background: #f1f5f9;
      border-radius: 8px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    .slot-preview img {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .slot-empty {
      display: flex;
      flex-direction: column;
      align-items: center;
      color: #94a3b8;
      gap: 4px;
      font-size: 0.85rem;
    }
    .slot-overlay {
      position: absolute;
      top: 0;
      left: 0;
      right: 0;
      bottom: 0;
      background: rgba(255, 255, 255, 0.85);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      gap: 8px;
      font-weight: 600;
      color: #2563eb;
    }
    .badge-counter {
      position: absolute;
      top: 8px;
      right: 8px;
      background: #1e293b;
      color: white;
      font-size: 0.75rem;
      font-weight: 700;
      padding: 3px 8px;
      border-radius: 12px;
    }
    .slot-info {
      margin-top: 10px;
      display: flex;
      flex-direction: column;
    }
    .slot-info strong {
      font-size: 0.95rem;
    }
    .slot-info small {
      font-size: 0.8rem;
      color: #64748b;
    }
    .studio-card {
      border-radius: 12px;
      overflow: hidden;
    }
    .viewport-content {
      background: #0f172a;
      min-height: 440px;
      display: flex;
      align-items: center;
      justify-content: center;
      position: relative;
      overflow: hidden;
    }
    .camera-stream-wrapper {
      position: relative;
      width: 100%;
      height: 440px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .camera-stream {
      width: 100%;
      height: 100%;
      object-fit: cover;
    }
    .camera-guidelines {
      position: absolute;
      top: 16px;
      left: 16px;
      pointer-events: none;
    }
    .guide-pill {
      background: rgba(0,0,0,0.6);
      color: white;
      font-size: 0.85rem;
      font-weight: 600;
      padding: 6px 12px;
      border-radius: 20px;
      backdrop-filter: blur(4px);
    }
    .preview-overlay-wrapper {
      position: relative;
      width: 100%;
      height: 440px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .preview-img {
      max-width: 100%;
      max-height: 440px;
      object-fit: contain;
    }
    .box-overlay-canvas {
      position: absolute;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
    }
    .inactive-placeholder {
      display: flex;
      flex-direction: column;
      align-items: center;
      color: #94a3b8;
      padding: 60px 16px;
      gap: 16px;
      text-align: center;
    }
    .huge-icon {
      font-size: 64px;
      width: 64px;
      height: 64px;
    }
    .studio-actions {
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 16px 20px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .action-left {
      display: flex;
      align-items: center;
    }
    .detected-summary {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 0.95rem;
      color: #334155;
    }
    .action-right {
      display: flex;
      gap: 10px;
      flex-wrap: wrap;
    }
    .results-card {
      border-radius: 12px;
      border-left: 5px solid #2563eb;
    }
    .results-kpi-bar {
      display: flex;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 20px;
    }
    .kpi-pill {
      padding: 10px 16px;
      border-radius: 10px;
      font-size: 0.9rem;
      font-weight: 500;
    }
    .matched-pill { background: #dcfce7; color: #166534; }
    .lowconf-pill { background: #fef3c7; color: #92400e; }
    .unknown-pill { background: #fee2e2; color: #991b1b; }
    .notdetected-pill { background: #f1f5f9; color: #475569; }
    .matched-roster-preview h4 {
      margin: 0 0 10px 0;
      font-weight: 600;
    }
    .students-chip-grid {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
    }
    .green-chip { background-color: #dcfce7 !important; color: #166534 !important; }
    .amber-chip { background-color: #fef3c7 !important; color: #92400e !important; }
    .red-chip { background-color: #fee2e2 !important; color: #991b1b !important; }
    .dup-tag {
      background: #dc2626;
      color: white;
      font-size: 0.65rem;
      font-weight: 700;
      padding: 2px 4px;
      border-radius: 4px;
      margin-left: 4px;
    }
    .hidden {
      display: none !important;
    }
  `]
})
export class FaceCameraCaptureComponent implements OnInit, OnDestroy {
  @ViewChild('videoElement') videoRef!: ElementRef<HTMLVideoElement>;
  @ViewChild('captureCanvas') canvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('boxCanvas') boxCanvasRef!: ElementRef<HTMLCanvasElement>;
  @ViewChild('previewImage') previewImgRef!: ElementRef<HTMLImageElement>;

  private academicService = inject(AcademicService);
  private faceService = inject(FaceAttendanceService);
  private mediaPipeService = inject(MediaPipeFaceDetectorService);
  private snackBar = inject(MatSnackBar);
  private router = inject(Router);

  classes: ClassItem[] = [];
  selectedClassId: number | null = null;
  selectedSection = '';
  availableSections: string[] = ['A', 'B'];

  isCameraActive = false;
  mediaStream: MediaStream | null = null;
  isRecognizing = false;

  currentSlotIndex = 0;
  photoSlots: ClassPhotoSlot[] = [
    {
      index: 1,
      label: 'Photo 1 (Left Wing)',
      description: 'Wide view covering the left side rows',
      imageSrc: null,
      detectedFaces: [],
      isProcessing: false
    },
    {
      index: 2,
      label: 'Photo 2 (Center Rows)',
      description: 'Direct view covering middle rows',
      imageSrc: null,
      detectedFaces: [],
      isProcessing: false
    },
    {
      index: 3,
      label: 'Photo 3 (Right Wing)',
      description: 'Wide view covering the right side rows',
      imageSrc: null,
      detectedFaces: [],
      isProcessing: false
    }
  ];

  recognitionResult: ClassRecognitionResult | null = null;

  get currentSlot(): ClassPhotoSlot {
    return this.photoSlots[this.currentSlotIndex];
  }

  get completedSlotsCount(): number {
    return this.photoSlots.filter(s => s.detectedFaces.length > 0).length;
  }

  get totalDetectedFacesAcrossAllPhotos(): number {
    return this.photoSlots.reduce((sum, s) => sum + s.detectedFaces.length, 0);
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
          this.onClassSelect(this.selectedClassId);
        }
      }
    });
  }

  onClassSelect(classId: number): void {
    this.selectedClassId = classId;
    const cl = this.classes.find(c => c.id === classId);
    if (cl && cl.sections) {
      this.availableSections = cl.sections.split(',').map(s => s.trim());
    } else {
      this.availableSections = ['A', 'B'];
    }
  }

  selectSlot(index: number): void {
    this.currentSlotIndex = index;
    if (this.currentSlot.imageSrc) {
      setTimeout(() => this.drawBoundingBoxes(), 50);
    }
  }

  async startCamera(): Promise<void> {
    try {
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 1920 }, height: { ideal: 1080 }, facingMode: 'environment' },
        audio: false
      });
      this.isCameraActive = true;
      setTimeout(() => {
        if (this.videoRef && this.videoRef.nativeElement) {
          this.videoRef.nativeElement.srcObject = this.mediaStream;
        }
      }, 100);
    } catch (err) {
      this.snackBar.open('Unable to access classroom camera. Check device permissions.', 'Close', { duration: 4000 });
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

  async snapPhoto(): Promise<void> {
    if (!this.videoRef || !this.canvasRef) return;
    const video = this.videoRef.nativeElement;
    const canvas = this.canvasRef.nativeElement;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    this.stopCamera();

    await this.processClassPhoto(canvas);
  }

  async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    if (!input.files || input.files.length === 0) return;

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
          await this.processClassPhoto(canvas);
        }
      };
      img.src = e.target?.result as string;
    };

    reader.readAsDataURL(file);
    input.value = '';
  }

  async processClassPhoto(canvas: HTMLCanvasElement): Promise<void> {
    const slot = this.currentSlot;
    slot.isProcessing = true;
    slot.imageSrc = canvas.toDataURL('image/jpeg', 0.92);

    try {
      // Run MediaPipe Face Detector on the entire classroom photo
      const detected = await this.mediaPipeService.detectAndCropFaces(canvas, slot.index);
      slot.detectedFaces = detected;

      this.snackBar.open(`Detected ${detected.length} face(s) in ${slot.label}!`, 'OK', { duration: 3000 });
      setTimeout(() => this.drawBoundingBoxes(), 50);

      // Auto-advance to next empty slot if any
      const nextEmpty = this.photoSlots.findIndex((s, idx) => idx > this.currentSlotIndex && s.detectedFaces.length === 0);
      if (nextEmpty !== -1) {
        this.currentSlotIndex = nextEmpty;
      }
    } catch (err: any) {
      this.snackBar.open('Error detecting faces with MediaPipe.', 'Close', { duration: 4000 });
    } finally {
      slot.isProcessing = false;
    }
  }

  drawBoundingBoxes(): void {
    if (!this.boxCanvasRef || !this.previewImgRef) return;
    const canvas = this.boxCanvasRef.nativeElement;
    const img = this.previewImgRef.nativeElement;

    canvas.width = img.clientWidth || img.naturalWidth;
    canvas.height = img.clientHeight || img.naturalHeight;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scaleX = canvas.width / (img.naturalWidth || 1);
    const scaleY = canvas.height / (img.naturalHeight || 1);

    ctx.strokeStyle = '#22c55e'; // Green box
    ctx.lineWidth = 3;
    ctx.font = '12px sans-serif';
    ctx.fillStyle = '#22c55e';

    for (const face of this.currentSlot.detectedFaces) {
      const bx = face.box.x * scaleX;
      const by = face.box.y * scaleY;
      const bw = face.box.width * scaleX;
      const bh = face.box.height * scaleY;

      ctx.strokeRect(bx, by, bw, bh);
      ctx.fillRect(bx, by - 16, 50, 16);
      ctx.fillStyle = '#ffffff';
      ctx.fillText(`Face #${face.index}`, bx + 4, by - 4);
      ctx.fillStyle = '#22c55e';
    }
  }

  submitForRecognition(): void {
    if (!this.selectedClassId || this.totalDetectedFacesAcrossAllPhotos === 0) return;

    this.isRecognizing = true;

    // Collect all cropped faces across all 1-3 photos
    const allCrops: FaceCropMatchRequest[] = [];
    let cropCounter = 1;

    for (const slot of this.photoSlots) {
      for (const face of slot.detectedFaces) {
        allCrops.push({
          cropIndex: cropCounter++,
          photoIndex: slot.index,
          imageBase64: face.cropBase64,
          boundingBox: face.box
        });
      }
    }

    this.faceService.matchClassFaces({
      classId: this.selectedClassId,
      section: this.selectedSection || undefined,
      faceCrops: allCrops
    }).subscribe({
      next: (result) => {
        this.isRecognizing = false;
        this.recognitionResult = result;
        this.snackBar.open(`Recognition complete: ${result.matchedCount} student(s) identified!`, 'OK', { duration: 4000 });
      },
      error: (err) => {
        this.isRecognizing = false;
        this.snackBar.open(err.error?.message || 'Face recognition matching failed.', 'Close', { duration: 4000 });
      }
    });
  }
}
