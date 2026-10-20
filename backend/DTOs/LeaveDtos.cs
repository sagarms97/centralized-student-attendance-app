using System.ComponentModel.DataAnnotations;

namespace StudentAttendance.Api.DTOs;

public class ParentChildOverviewDto
{
    public int StudentId { get; set; }
    public string RollNo { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public int ClassId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;
    public string? PhotoPath { get; set; }
    public string Relationship { get; set; } = "Parent";
    public int TotalSessions { get; set; }
    public int PresentSessions { get; set; }
    public int AbsentSessions { get; set; }
    public int LateSessions { get; set; }
    public int OnLeaveSessions { get; set; }
    public double AttendancePercentage { get; set; }
    public string? TodayStatus { get; set; }
}

public class ChildPeriodAttendanceDto
{
    public int PeriodId { get; set; }
    public string PeriodName { get; set; } = string.Empty;
    public string TimeRange { get; set; } = string.Empty;
    public string SubjectName { get; set; } = string.Empty;
    public string StaffName { get; set; } = string.Empty;
    public string Status { get; set; } = "Present";
    public string? Remarks { get; set; }
}

public class ChildDailyAttendanceDto
{
    public string Date { get; set; } = string.Empty; // yyyy-MM-dd
    public string DayOfWeek { get; set; } = string.Empty;
    public string Status { get; set; } = "Present"; // Present, Absent, Late, OnLeave, Partial, NoRecord
    public bool IsLeave { get; set; }
    public string? LeaveReason { get; set; }
    public List<ChildPeriodAttendanceDto> Periods { get; set; } = new();
}

public class ChildMonthlyCalendarDto
{
    public int StudentId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string RollNo { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;
    public string Month { get; set; } = string.Empty; // yyyy-MM
    public int TotalRecordedDays { get; set; }
    public int PresentDays { get; set; }
    public int AbsentDays { get; set; }
    public int LateDays { get; set; }
    public int OnLeaveDays { get; set; }
    public double AttendancePercentage { get; set; }
    public List<ChildDailyAttendanceDto> Days { get; set; } = new();
}

public class LeaveRequestDto
{
    public int Id { get; set; }
    public int StudentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string RollNo { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;
    public int ParentId { get; set; }
    public string ParentName { get; set; } = string.Empty;
    public string ParentPhone { get; set; } = string.Empty;
    public string StartDate { get; set; } = string.Empty; // yyyy-MM-dd
    public string EndDate { get; set; } = string.Empty;   // yyyy-MM-dd
    public int DaysCount { get; set; }
    public string Reason { get; set; } = string.Empty;
    public string Status { get; set; } = "Pending"; // Pending, Approved, Rejected
    public int? ReviewedByUserId { get; set; }
    public string? ReviewedByUserName { get; set; }
    public DateTime? ReviewedAt { get; set; }
    public string? ReviewRemarks { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateLeaveRequest
{
    [Required]
    public int StudentId { get; set; }

    [Required]
    public string StartDate { get; set; } = string.Empty; // yyyy-MM-dd

    [Required]
    public string EndDate { get; set; } = string.Empty;   // yyyy-MM-dd

    [Required, StringLength(500, MinimumLength = 3)]
    public string Reason { get; set; } = string.Empty;
}

public class ReviewLeaveRequest
{
    [Required]
    public string Status { get; set; } = "Approved"; // Approved or Rejected

    [StringLength(500)]
    public string? ReviewRemarks { get; set; }
}
