using System.ComponentModel.DataAnnotations;

namespace StudentAttendance.Api.DTOs;

public class StaffDailyScheduleItemDto
{
    public int TimetableEntryId { get; set; }
    public int PeriodId { get; set; }
    public int PeriodNumber { get; set; }
    public string PeriodName { get; set; } = string.Empty;
    public string TimeRange { get; set; } = string.Empty;
    public int ClassId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;
    public int SubjectId { get; set; }
    public string SubjectName { get; set; } = string.Empty;
    public bool IsSubstitutedForMe { get; set; }
    public bool IsHandedOverToOther { get; set; }
    public string? SubstituteStaffName { get; set; }
    public bool IsAttendanceMarked { get; set; }
    public int PresentCount { get; set; }
    public int AbsentCount { get; set; }
    public int LateCount { get; set; }
    public int TotalStudents { get; set; }
}

public class StudentAttendanceItemDto
{
    public int StudentId { get; set; }
    public string RollNo { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Status { get; set; } = "Present"; // Present, Absent, Late
    public string? Remarks { get; set; }
}

public class AttendanceSheetDto
{
    public int TimetableEntryId { get; set; }
    public int PeriodId { get; set; }
    public string PeriodName { get; set; } = string.Empty;
    public int ClassId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;
    public string SubjectName { get; set; } = string.Empty;
    public string Date { get; set; } = string.Empty;
    public bool IsEditable { get; set; }
    public bool IsAlreadyMarked { get; set; }
    public List<StudentAttendanceItemDto> Students { get; set; } = new();
}

public class SubmitAttendanceRequest
{
    [Required]
    public int TimetableEntryId { get; set; }

    [Required]
    public int PeriodId { get; set; }

    [Required]
    public string Date { get; set; } = string.Empty; // yyyy-MM-dd

    [Required]
    public List<StudentAttendanceItemDto> Records { get; set; } = new();
}
