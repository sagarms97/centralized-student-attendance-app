# EduAttend - Administrator User Manual

## 1. Introduction
Welcome to the EduAttend Administrator User Manual. This guide provides comprehensive operational instructions for Institute Administrators managing student attendance, academic rosters, timetable schedules, faculty substitution, and the **AI Face Attendance Module**.

---

## 2. Face Attendance Module Configuration

The Face Attendance Module is **optional** and **disabled by default**. As an Institute Administrator, you hold exclusive authorization to enable, configure, and audit this module for your institution.

### 2.1 Enabling the Module
1. Navigate to **Face Attendance > Settings** (`/app/face-attendance/settings`).
2. Toggle **Enable Face Attendance System** to active.
3. Review and configure the detection & recognition thresholds:
   - **Match Confidence Threshold (Default 75%)**: The minimum cosine similarity score required for an automatic match.
   - **Low Confidence Threshold (Default 50%)**: Embeddings scoring between the low-confidence and match thresholds are highlighted in amber for teacher verification.
   - **Data Retention Period (Days, Default 365)**: Embeddings older than this retention threshold are eligible for automated purging.
4. Customize the **Parental Consent & Privacy Notice Text** displayed to parents and staff.
5. Click **Save Settings**. Every change is recorded in the immutable `AuditLog`.

---

## 3. Parental Consent Governance

> **Important Privacy Constraint**: Students without an active parental consent record can **NEVER** be enrolled in face recognition or matched during classroom photo scanning.

### 3.1 Recording Parental Consent
1. Navigate to **Face Attendance > Consent Directory** (`/app/face-attendance/consent`).
2. Select the **Class** and **Section**.
3. For each student, view their current consent status: `Consented`, `Pending`, `Withdrawn`, or `Declined`.
4. To record consent:
   - Tap **Record Consent**.
   - Input the parent's full name (`Consent Given By`).
   - Add optional administrative notes.
   - Confirm submission.

### 3.2 Immediate Data Purge on Consent Withdrawal
1. When a parent requests consent withdrawal:
   - Click **Withdraw Consent** on the student's card.
   - Specify the withdrawal reason.
2. The system executes an **instant hard purge** of all stored encrypted face embeddings for that student from the database.
3. Temporary image files are never retained; only mathematical vector embeddings existed, and they are deleted immediately.

---

## 4. Student Face Enrollment

Enrollment requires capturing high-quality multi-angle photos for consented students.

1. Navigate to **Face Attendance > Enrollment Studio** (`/app/face-attendance/enrollment`).
2. Select the student from the class roster. (Unconsented students are strictly disabled).
3. Capture or upload **3 to 4 distinct angles**:
   - **Front Pose**: Direct front-facing eye level.
   - **Slight Left Pose**: 15–20° turn to the left.
   - **Slight Right Pose**: 15–20° turn to the right.
   - **Natural / Expression Pose**: Normal relaxed expression.
4. The system validates image quality automatically:
   - Face presence check (exactly 1 face per photo).
   - Resolution check ($\ge 60 \times 60$ pixels).
   - Exposure and blur analysis (Laplacian variance check).
5. Click **Enroll Student**. The system generates 512-dimensional ArcFace embeddings, encrypts them using AES-256-GCM, stores the ciphertext in `StudentFaceEmbeddings`, and permanently discards the raw photo bytes.

---

## 5. Face Data Privacy & Deletion Tools

Under **Face Attendance > Data Management**:
- **Delete Single Student Data**: Instantly clears face vectors for a specific student.
- **Delete Entire Class Face Data**: Purges embeddings for an entire class grade.
- **Purge All Institute Face Data**: Irreversibly destroys all face vectors across the entire tenant.
- **Run Expired Data Cleanup**: Automatically purges records exceeding the configured retention period.

All operations log tenant ID, administrator user ID, timestamp, and record count to `AuditLog`.

---

## 6. Reports & Source Verification

Administrators can audit how attendance was marked across all class periods:
1. Open **Reports & Analytics** (`/app/reports`).
2. In **Daily Class Sessions**:
   - View the **Source** column:
     - `Face`: 100% verified via AI classroom face recognition (displays average confidence score).
     - `Mixed`: Partially verified via Face Recognition with manual teacher adjustments.
     - `Manual`: Traditional manual roster marking.
3. In **Student Attendance & Defaulters**:
   - View **Source Breakdown**: Shows exact counts of `Face` vs `Manual` sessions for each student.
4. Export options:
   - **Excel Export**: Includes `Face Verified` and `Manual` session breakdown columns.
   - **PDF Printable Summary**: Formatted official report with source breakdown and defaulter indicators.
