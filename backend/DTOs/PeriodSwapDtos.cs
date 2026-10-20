using System.ComponentModel.DataAnnotations;

namespace StudentAttendance.Api.DTOs;

public class PeriodSwapRequestDto
{
    public int Id { get; set; }
    public int TimetableEntryId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;
    public string PeriodName { get; set; } = string.Empty;
    public string TimeRange { get; set; } = string.Empty;
    public string SubjectName { get; set; } = string.Empty;
    public string SwapDate { get; set; } = string.Empty; // yyyy-MM-dd
    public int RequesterStaffId { get; set; }
    public string RequesterStaffName { get; set; } = string.Empty;
    public int TargetStaffId { get; set; }
    public string TargetStaffName { get; set; } = string.Empty;
    public string? Reason { get; set; }
    public string Status { get; set; } = "Pending";
    public DateTime CreatedAt { get; set; }
    public bool CanRespond { get; set; }
}

public class CreateSwapRequest
{
    [Required]
    public int TimetableEntryId { get; set; }

    [Required]
    public int TargetStaffId { get; set; }

    [Required]
    public string SwapDate { get; set; } = string.Empty; // yyyy-MM-dd

    [StringLength(250)]
    public string? Reason { get; set; }
}

public class RespondSwapRequest
{
    [Required]
    public string Status { get; set; } = "Approved"; // "Approved" or "Rejected"
}
