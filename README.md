# Student Attendance Management System (Multi-Tenant PWA)

A production-grade, multi-tenant Student Attendance Management System designed for colleges and universities.

---

## 🏗️ Architecture & Tech Stack

- **Backend**: ASP.NET Core Web API (.NET 8)
  - **ORM**: Entity Framework Core 8 with SQL Server (`MSSQLLocalDB`)
  - **Multi-Tenancy**: Global EF Core query filters (`InstituteId == currentTenantId && IsActive`) resolved exclusively from JWT claims via `ICurrentTenantService`.
  - **Security**: ASP.NET Core Identity `PasswordHasher<T>` (PBKDF2 HMAC-SHA512) and JWT token authentication with automated refresh token rotation.
  - **Excel Engine**: ClosedXML 0.102.3 for bulk student imports and formatted report exports.
  - **Architecture**: Clean layered architecture (Controllers -> Services -> Data/EF Core -> DTOs).

- **Frontend**: Angular 18 (Standalone Components, TypeScript)
  - **UI Library**: Angular Material 18, custom responsive theme, Material Icons.
  - **State & Reactivity**: Angular Signals and Reactive Forms with real-time validation.
  - **Security**: Functional `authInterceptor` (automatic Bearer token injection and 401 refresh token handling) and role guards (`authGuard`, `adminGuard`).
  - **PWA**: Installable Progressive Web Application with `@angular/service-worker` and `manifest.webmanifest`.

---

## 🗄️ Database Schema & Entities

The database is automatically created and migrated on startup into `(localdb)\MSSQLLocalDB` under `StudentAttendanceDb`.

| Table | Multi-Tenant Key | Primary Constraints & Indexes | Description |
|---|---|---|---|
| **`Institutes`** | Tenant Root | `UNIQUE(Code)` | College/tenant account with address, contact info |
| **`Users`** | `InstituteId` | `UNIQUE(InstituteId, Email)` | System logins (`SuperAdmin`, `InstituteAdmin`, `Staff`) |
| **`RefreshTokens`** | - | `INDEX(UserId)`, `UNIQUE(Token)` | Rotating refresh tokens with revocation support |
| **`Staff`** | `InstituteId` | `UNIQUE(InstituteId, EmployeeId)` | Faculty profiles with secure institute photo storage |
| **`Classes`** | `InstituteId` | `UNIQUE(InstituteId, Name)` | Academic classes (e.g. Grade 10) & sections (A, B) |
| **`Subjects`** | `InstituteId` | `UNIQUE(InstituteId, Code)` | Academic courses & subjects |
| **`Periods`** | `InstituteId` | `UNIQUE(InstituteId, PeriodNumber)` | Daily bell schedule slots with start & end times |
| **`Students`** | `InstituteId` | `UNIQUE(InstituteId, RollNo)` | Student directory with parent contacts |
| **`TimetableEntries`** | `InstituteId` | `UNIQUE(InstituteId, Day, Period, StaffId)`<br>`UNIQUE(InstituteId, Day, Period, Class, Section)` | Weekly schedule with double-booking clash prevention |
| **`PeriodSwapRequests`** | `InstituteId` | `INDEX(InstituteId, SwapDate, Status)` | Temporary teacher substitution workflow |
| **`AttendanceRecords`** | `InstituteId` | `UNIQUE(InstituteId, Date, PeriodId, StudentId)` | Bulk attendance entries (`Present`, `Absent`, `Late`) |

---

## 🚀 Quickstart & Setup Guide

### Prerequisites
- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js v20+ or v24+](https://nodejs.org/) & `npm`
- SQL Server LocalDB (`MSSQLLocalDB` installed with Visual Studio or SQL Express)

### 1. Backend Setup & Startup
```powershell
cd D:\Angular\StudentAttendaceApp\backend

# Restore & build
dotnet restore
dotnet build

# Apply EF Core migrations to LocalDB
dotnet ef database update

# Run the API server on http://localhost:5000
dotnet run --launch-profile http
```
The backend Swagger documentation will be available at: [http://localhost:5000/swagger](http://localhost:5000/swagger)

### 2. Frontend Setup & Startup
```powershell
cd D:\Angular\StudentAttendaceApp\frontend

# Install dependencies (if needed)
npm install

# Run development server
npm start
# or: npx ng serve --port 4200
```
Open your browser at: [http://localhost:4200](http://localhost:4200)

---

## 🔑 Pre-Seeded Test Credentials

| Role | Email | Password | Institute Code |
|---|---|---|---|
| **Institute Admin** | `alice@mit.edu` | `Password@123` | `MIT-001` |
| **Staff Member 1** | `bob@mit.edu` | `Staff@123456` | `MIT-001` |
| **Staff Member 2** | `alan@mit.edu` | `Staff@123456` | `MIT-001` |

---

## ✨ Features Implemented & Verified

### 1. Institute Registration & Authentication
- Self-service college registration form (`/register`) creating the `Institute` and first `InstituteAdmin`.
- JWT generation with embedded `institute_id` and role claims.
- Automatic refresh token rotation upon expiry and revocation handling.

### 2. Staff Management
- Admin staff directory with avatar photos, employee IDs, contact info, and subject specializations.
- Photo upload endpoint validating MIME type (`image/jpeg`, `image/png`, `image/webp`) and size (<= 2MB), saved to per-institute folder and served securely.
- Auto-creation of user login credentials for every enrolled staff member.

### 3. Student Management & Excel Bulk Import
- Manual enrollment with Roll No, Name, Class, Section, and Parent Phone.
- ClosedXML Bulk Excel Import Wizard:
  - Download standardized `.xlsx` template.
  - Upload & interactive validation preview with row-level error reporting (flags duplicate roll numbers and non-existent classes).
  - Batch confirmation insert.

### 4. Periods & Weekly Timetable
- Period configuration with period number, start time, and end time.
- Interactive matrix grid (Days of week vs. Periods).
- Real-time conflict validation preventing:
  - Faculty double-booking in the same period.
  - Class/Section double-booking in the same period.

### 5. Daily Attendance Marking
- Staff daily timetable schedule view.
- Single-click attendance sheet defaulting all enrolled students to `Present`.
- Bulk submit attendance in one request (`Present`, `Absent`, `Late` with optional remarks).
- Same-day edit rule (staff can update only entries for the current date; past dates are locked).

### 6. Period Substitution & Swapping
- Staff can request another faculty member to cover their period for a specific date.
- Target teacher or admin can approve or reject the request.
- Dynamic timetable update: on the swap date, the substitute teacher's schedule dynamically gains the slot without altering the permanent timetable.

### 7. Reports & Defaulter Analytics
- Student attendance percentage calculation.
- Configurable defaulters threshold slider (e.g. < 75%) with highlighted status badges.
- Daily conducted sessions breakdown and class-wise summaries.
- One-click exports to Excel (`.xlsx`) via ClosedXML and PDF / printable format.

### 8. Analytics Dashboard
- Today's attendance percentage and absentee count.
- Total enrolled students and active staff counters.
- Pending period swap requests alert.
