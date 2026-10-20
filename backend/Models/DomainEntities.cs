namespace StudentAttendance.Api.Models;

public class Staff : BaseTenantEntity
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string EmployeeId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? SubjectSpecialization { get; set; }
    public string? PhotoPath { get; set; }

    public ICollection<TimetableEntry> TimetableEntries { get; set; } = new List<TimetableEntry>();
    public ICollection<PeriodSwapRequest> RequestedSwaps { get; set; } = new List<PeriodSwapRequest>();
    public ICollection<PeriodSwapRequest> ReceivedSwaps { get; set; } = new List<PeriodSwapRequest>();
}

public class ClassEntity : BaseTenantEntity
{
    public string Name { get; set; } = string.Empty;
    public string Sections { get; set; } = "A,B"; // Comma separated list of sections e.g. "A,B,C"

    public ICollection<Student> Students { get; set; } = new List<Student>();
    public ICollection<TimetableEntry> TimetableEntries { get; set; } = new List<TimetableEntry>();
}

public class Subject : BaseTenantEntity
{
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;

    public ICollection<TimetableEntry> TimetableEntries { get; set; } = new List<TimetableEntry>();
}

public class Period : BaseTenantEntity
{
    public int PeriodNumber { get; set; }
    public string Name { get; set; } = string.Empty;
    public TimeSpan StartTime { get; set; }
    public TimeSpan EndTime { get; set; }

    public ICollection<TimetableEntry> TimetableEntries { get; set; } = new List<TimetableEntry>();
    public ICollection<AttendanceRecord> AttendanceRecords { get; set; } = new List<AttendanceRecord>();
}

public class Student : BaseTenantEntity
{
    public int ClassId { get; set; }
    public ClassEntity Class { get; set; } = null!;
    public string RollNo { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;
    public string ParentPhone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? PhotoPath { get; set; }

    public string FullName => $"{FirstName} {LastName}".Trim();

    public ICollection<AttendanceRecord> AttendanceRecords { get; set; } = new List<AttendanceRecord>();
    public ICollection<ParentStudent> ParentLinks { get; set; } = new List<ParentStudent>();
    public ICollection<LeaveRequest> LeaveRequests { get; set; } = new List<LeaveRequest>();
}

public class TimetableEntry : BaseTenantEntity
{
    public int ClassId { get; set; }
    public ClassEntity Class { get; set; } = null!;
    public string Section { get; set; } = string.Empty;
    public DayOfWeek DayOfWeek { get; set; }
    public int PeriodId { get; set; }
    public Period Period { get; set; } = null!;
    public int SubjectId { get; set; }
    public Subject Subject { get; set; } = null!;
    public int StaffId { get; set; }
    public Staff Staff { get; set; } = null!;

    public ICollection<AttendanceRecord> AttendanceRecords { get; set; } = new List<AttendanceRecord>();
    public ICollection<PeriodSwapRequest> SwapRequests { get; set; } = new List<PeriodSwapRequest>();
}

public static class SwapStatus
{
    public const string Pending = "Pending";
    public const string Approved = "Approved";
    public const string Rejected = "Rejected";
    public const string Cancelled = "Cancelled";
}

public class PeriodSwapRequest : BaseTenantEntity
{
    public int TimetableEntryId { get; set; }
    public TimetableEntry TimetableEntry { get; set; } = null!;
    public int RequesterStaffId { get; set; }
    public Staff RequesterStaff { get; set; } = null!;
    public int TargetStaffId { get; set; }
    public Staff TargetStaff { get; set; } = null!;
    public DateOnly SwapDate { get; set; }
    public string? Reason { get; set; }
    public string Status { get; set; } = SwapStatus.Pending;
    public int? ReviewedByUserId { get; set; }
    public User? ReviewedByUser { get; set; }
    public DateTime? ReviewedAt { get; set; }
}

public static class AttendanceStatus
{
    public const string Present = "Present";
    public const string Absent = "Absent";
    public const string Late = "Late";
    public const string OnLeave = "OnLeave";
}

public class AttendanceRecord : BaseTenantEntity
{
    public DateOnly Date { get; set; }
    public int PeriodId { get; set; }
    public Period Period { get; set; } = null!;
    public int TimetableEntryId { get; set; }
    public TimetableEntry TimetableEntry { get; set; } = null!;
    public int StudentId { get; set; }
    public Student Student { get; set; } = null!;
    public string Status { get; set; } = AttendanceStatus.Present;
    public string? Remarks { get; set; }
    public int MarkedByUserId { get; set; }
    public User MarkedByUser { get; set; } = null!;
    public DateTime MarkedAt { get; set; } = DateTime.UtcNow;
    public int? LeaveRequestId { get; set; }
}

public class Parent : BaseTenantEntity
{
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? PhotoPath { get; set; }

    public ICollection<ParentStudent> ChildrenLinks { get; set; } = new List<ParentStudent>();
    public ICollection<LeaveRequest> LeaveRequests { get; set; } = new List<LeaveRequest>();
}

public class ParentStudent : BaseTenantEntity
{
    public int ParentId { get; set; }
    public Parent Parent { get; set; } = null!;
    public int StudentId { get; set; }
    public Student Student { get; set; } = null!;
    public string Relationship { get; set; } = "Parent"; // Father, Mother, Guardian, etc.
}

public static class LeaveStatus
{
    public const string Pending = "Pending";
    public const string Approved = "Approved";
    public const string Rejected = "Rejected";
}

public class LeaveRequest : BaseTenantEntity
{
    public int StudentId { get; set; }
    public Student Student { get; set; } = null!;
    public int ParentId { get; set; }
    public Parent Parent { get; set; } = null!;
    public DateOnly StartDate { get; set; }
    public DateOnly EndDate { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string Status { get; set; } = LeaveStatus.Pending;
    public int? ReviewedByUserId { get; set; }
    public User? ReviewedByUser { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewRemarks { get; set; }
}
