using System.ComponentModel.DataAnnotations;

namespace StudentAttendance.Api.DTOs;

public class PeriodDto
{
    public int Id { get; set; }
    public int PeriodNumber { get; set; }
    public string Name { get; set; } = string.Empty;
    public string StartTime { get; set; } = string.Empty;
    public string EndTime { get; set; } = string.Empty;
    public string TimeFormatted => $"{StartTime} - {EndTime}";
    public bool IsActive { get; set; }
}

public class CreatePeriodRequest
{
    [Required, Range(1, 20)]
    public int PeriodNumber { get; set; }

    [Required, StringLength(50)]
    public string Name { get; set; } = string.Empty;

    [Required, RegularExpression(@"^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$", ErrorMessage = "StartTime must be HH:mm or HH:mm:ss")]
    public string StartTime { get; set; } = "09:00";

    [Required, RegularExpression(@"^([0-1]?[0-9]|2[0-3]):[0-5][0-9](:[0-5][0-9])?$", ErrorMessage = "EndTime must be HH:mm or HH:mm:ss")]
    public string EndTime { get; set; } = "10:00";
}

public class TimetableEntryDto
{
    public int Id { get; set; }
    public int ClassId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;
    public int DayOfWeek { get; set; }
    public string DayName { get; set; } = string.Empty;
    public int PeriodId { get; set; }
    public int PeriodNumber { get; set; }
    public string PeriodName { get; set; } = string.Empty;
    public string TimeRange { get; set; } = string.Empty;
    public int SubjectId { get; set; }
    public string SubjectName { get; set; } = string.Empty;
    public string SubjectCode { get; set; } = string.Empty;
    public int StaffId { get; set; }
    public string StaffName { get; set; } = string.Empty;
    public string StaffEmployeeId { get; set; } = string.Empty;
}

public class CreateTimetableEntryRequest
{
    [Required]
    public int ClassId { get; set; }

    [Required, StringLength(10)]
    public string Section { get; set; } = "A";

    [Required, Range(1, 7)]
    public int DayOfWeek { get; set; } // 1=Monday, 2=Tuesday, ..., 7=Sunday

    [Required]
    public int PeriodId { get; set; }

    [Required]
    public int SubjectId { get; set; }

    [Required]
    public int StaffId { get; set; }
}
