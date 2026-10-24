namespace StudentAttendance.Api.DTOs;

public class PlatformOverviewDto
{
    public int TotalInstitutes { get; set; }
    public int ActiveInstitutes { get; set; }
    public int InactiveInstitutes { get; set; }
    public int TotalStaff { get; set; }
    public int TotalStudents { get; set; }
    public int TotalParents { get; set; }
    public double TodayAttendancePercent { get; set; }
    public int TotalAttendanceRecordedToday { get; set; }
    public List<RegistrationTrendDto> RegistrationTrends { get; set; } = new();
    public List<AuditLogItemDto> RecentAuditLogs { get; set; } = new();
}

public class RegistrationTrendDto
{
    public string Date { get; set; } = string.Empty; // yyyy-MM-dd
    public int Count { get; set; }
}

public class SuperAdminInstituteItemDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string ContactEmail { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string? LogoPath { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public int StaffCount { get; set; }
    public int StudentCount { get; set; }
    public int ClassCount { get; set; }
    public int ParentCount { get; set; }
    public double TodayAttendancePercent { get; set; }
}

public class ClassStrengthDto
{
    public int ClassId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public string Sections { get; set; } = string.Empty;
    public int StudentCount { get; set; }
}

public class SuperAdminStaffItemDto
{
    public int Id { get; set; }
    public string EmployeeId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? SubjectSpecialization { get; set; }
    public bool IsActive { get; set; }
}

public class SuperAdminStudentItemDto
{
    public int Id { get; set; }
    public string RollNo { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;
    public string ParentPhone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public bool IsActive { get; set; }
    public double AttendancePercentage { get; set; }
}

public class SuperAdminSubjectDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public int AssignedClassesCount { get; set; }
}

public class TimetableDaySummaryDto
{
    public string DayOfWeek { get; set; } = string.Empty;
    public int TotalSlots { get; set; }
    public int ActiveSubjects { get; set; }
    public int ActiveTeachers { get; set; }
}

public class SuperAdminInstituteDetailDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string ContactEmail { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string? LogoPath { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }

    public int StaffCount { get; set; }
    public int StudentCount { get; set; }
    public int ClassCount { get; set; }
    public int ParentCount { get; set; }
    public double TodayAttendancePercent { get; set; }
    public double MonthAttendancePercent { get; set; }

    public List<ClassStrengthDto> ClassStrength { get; set; } = new();
    public List<SuperAdminStaffItemDto> StaffList { get; set; } = new();
    public List<SuperAdminStudentItemDto> StudentList { get; set; } = new();
    public List<SuperAdminSubjectDto> Subjects { get; set; } = new();
    public List<TimetableDaySummaryDto> TimetableSummary { get; set; } = new();
}

public class SuperAdminStudentAttendanceRecordDto
{
    public string Date { get; set; } = string.Empty;
    public string PeriodName { get; set; } = string.Empty;
    public string TimeRange { get; set; } = string.Empty;
    public string SubjectName { get; set; } = string.Empty;
    public string StaffName { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? Remarks { get; set; }
}

public class SuperAdminStudentAttendanceHistoryDto
{
    public int StudentId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string RollNo { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;
    public string InstituteName { get; set; } = string.Empty;
    public int TotalSessions { get; set; }
    public int PresentSessions { get; set; }
    public int AbsentSessions { get; set; }
    public int LateSessions { get; set; }
    public int OnLeaveSessions { get; set; }
    public double AttendancePercentage { get; set; }
    public List<SuperAdminStudentAttendanceRecordDto> Records { get; set; } = new();
}

public class AuditLogItemDto
{
    public int Id { get; set; }
    public int? InstituteId { get; set; }
    public string? InstituteName { get; set; }
    public int UserId { get; set; }
    public string UserEmail { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Details { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
    public DateTime Timestamp { get; set; }
}

public class ToggleInstituteStatusRequest
{
    public bool IsActive { get; set; }
}
