namespace StudentAttendance.Api.DTOs;

public class DailyAttendanceReportItem
{
    public string Date { get; set; } = string.Empty;
    public int ClassId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;
    public string PeriodName { get; set; } = string.Empty;
    public string SubjectName { get; set; } = string.Empty;
    public string StaffName { get; set; } = string.Empty;
    public int TotalStudents { get; set; }
    public int PresentCount { get; set; }
    public int AbsentCount { get; set; }
    public int LateCount { get; set; }
    public double AttendancePercentage => TotalStudents > 0 ? Math.Round((PresentCount + (LateCount * 0.5)) / TotalStudents * 100, 1) : 0;
    public string Source { get; set; } = "Manual"; // "Manual", "Face", or "Mixed"
    public int FaceVerifiedCount { get; set; }
    public int ManualCount { get; set; }
    public double? AverageFaceConfidence { get; set; }
}

public class StudentAttendanceSummaryDto
{
    public int StudentId { get; set; }
    public string RollNo { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;
    public int TotalSessions { get; set; }
    public int PresentSessions { get; set; }
    public int AbsentSessions { get; set; }
    public int LateSessions { get; set; }
    public int FaceVerifiedSessions { get; set; }
    public int ManualSessions { get; set; }
    public double AttendancePercentage => TotalSessions > 0 ? Math.Round((PresentSessions + (LateSessions * 0.5)) / TotalSessions * 100, 1) : 0;
    public bool IsDefaulter { get; set; }
}

public class ClassSummaryDto
{
    public int ClassId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;
    public int TotalEnrolled { get; set; }
    public int TotalSessionsConducted { get; set; }
    public double AverageAttendancePercentage { get; set; }
}

public class DashboardStatsDto
{
    public double TodayAttendancePercent { get; set; }
    public int TotalPresentToday { get; set; }
    public int TotalAbsentToday { get; set; }
    public int TotalStudents { get; set; }
    public int TotalStaff { get; set; }
    public int PendingSwapsCount { get; set; }
}
