# EduAttend - Staff & Faculty User Manual

## 1. Introduction
This manual explains daily classroom operations for faculty members using EduAttend, focusing on timetable schedules, attendance marking, period substitutions, and the **AI Face Attendance Capture & Review workflow**.

---

## 2. Daily Schedule & Period Selection

1. Upon logging in, navigate to **Mark Attendance** (`/app/attendance`).
2. Your assigned teaching slots for the current date are displayed as cards showing:
   - Period Name & Time Range (e.g., `Period 1: 09:00 - 09:50`).
   - Class & Section (e.g., `Grade 10 - Section A`).
   - Subject (e.g., `Mathematics`).
   - Attendance Status (`Pending` or `Marked`).
   - Substitute indicators if you are covering for a colleague or if your slot was handed over.
3. Click on the period card you wish to mark.

---

## 3. Taking Attendance via Face Recognition

When the Face Attendance module is enabled by your administrator:
1. In the attendance sheet header, click **Take via Face**.
2. This opens the **Classroom Multi-Face Attendance Capture Studio** (`/app/face-attendance/capture`), pre-loaded with your selected class, section, date, and period.

### 3.1 Classroom Photography Guidelines
For maximum recognition accuracy:
- **Coverage**: Capture 1 to 3 wide-angle photos covering the classroom:
  - **Slot 1 (Left Wing)**: Left-side rows and corners.
  - **Slot 2 (Center Rows)**: Center aisle and front/middle seats.
  - **Slot 3 (Right Wing)**: Right-side rows and rear corners.
- **Lighting**: Ensure classroom lights are on and window glare is minimized.
- **Student Posture**: Ask students to face towards the camera naturally.
- **Privacy Assurance**: The system uses on-device **MediaPipe WASM** to detect faces locally on your phone or laptop. Only cropped face bounding boxes are transmitted securely to the server; full classroom panoramic photos are never uploaded or stored.

### 3.2 Processing Multi-Face Photos
1. Use your device camera or tap **Upload Image** for each photo slot.
2. The on-device detector highlights detected faces with bounding boxes and counters.
3. Once 1 to 3 photos are captured, tap **Run Classroom Face Recognition**.
4. The recognition engine extracts ArcFace embeddings and compares them against enrolled students of your selected class.
5. When complete, tap **Proceed to Attendance Review Screen**.

---

## 4. Mobile-First Attendance Review Screen

> **Human-in-the-Loop Principle**: The AI **NEVER** auto-saves attendance. The teacher must review suggestions, make any necessary adjustments, and press **Confirm & Save Attendance**.

### 4.1 Photo Overlay with Colored Bounding Boxes
The review screen displays your captured classroom photos with color-coded boxes:
- **Green Box (`#22c55e`)**: Confident match ($\ge 75\%$ confidence). The student is suggested as **Present**.
- **Amber Box (`#f59e0b`)**: Low-confidence match ($50\% - 74\%$). Requires your confirmation.
- **Red Box (`#ef4444`)**: Unknown or unrecognized face.

**Interactive Inspection**:
- Tap on any colored box on the photo or on any student card in the list.
- An inspector card appears with:
  - Face crop thumbnail.
  - Current AI match and confidence score.
  - Quick action to **Confirm Match**, **Reassign to Class Student** (searchable class roster dropdown), or **Mark as Unknown / Dismiss**.

### 4.2 Review Tabs
1. **Suggested Present Tab**:
   - Lists all students matched via face recognition.
   - Default status: **Present**.
   - Quick segmented toggles allow changing status to `Late` or `Absent`.
2. **Needs Review & Unknown Tab**:
   - Displays unconfident or unrecognized faces.
   - Tap **Confirm as [Student Name]** if the AI suggestion is correct, or tap **Reassign** to pick the right student.
3. **Not Detected Tab**:
   - Lists consented students enrolled in the class who did not appear in any photo.
   - **Crucial Rule**: Students not detected are **NOT** marked absent automatically. You can review and mark them as `Absent`, `Present` (e.g. if seated behind a pillar), `Late`, or `Leave`.
   - A convenient button **Mark All Unreviewed as Absent** is provided for quick completion.

### 4.3 Confirming & Saving Attendance
1. Check the summary bar at the bottom: e.g., `Present: 28 · Absent: 3 · Late: 1 · Total: 32`.
2. Ensure your assigned period slot is selected.
3. Click **Confirm & Save Attendance**.
4. Records are saved with `Source = Face`, and your faculty ID is tagged as the confirming teacher.

---

## 5. Manual Marking Fallback

Manual attendance marking always remains fully operational:
- You can mark attendance manually anytime from the standard `/app/attendance` screen.
- On the Review Screen, tapping **Switch to Manual Marking** cancels the face review session and opens the standard roster grid.
- Previously saved face attendance records display a `[Face]` badge with confidence percentage, while manual records display a `[Manual]` badge.
