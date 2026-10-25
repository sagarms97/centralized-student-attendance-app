using System.ComponentModel.DataAnnotations;

namespace StudentAttendance.Api.DTOs;

public class FaceSettingsDto
{
    public bool IsEnabled { get; set; }
    public double MatchThreshold { get; set; }
    public double LowConfidenceThreshold { get; set; }
    public int DataRetentionDays { get; set; }
    public string ConsentNoticeText { get; set; } = string.Empty;
    public DateTime? UpdatedAt { get; set; }
    public string? UpdatedBy { get; set; }
}

public class UpdateFaceSettingsRequest
{
    public bool IsEnabled { get; set; }

    [Range(0.1, 1.0, ErrorMessage = "Match threshold must be between 0.1 and 1.0")]
    public double MatchThreshold { get; set; } = 0.65;

    [Range(0.1, 1.0, ErrorMessage = "Low confidence threshold must be between 0.1 and 1.0")]
    public double LowConfidenceThreshold { get; set; } = 0.45;

    [Range(1, 1825, ErrorMessage = "Data retention days must be between 1 and 1825")]
    public int DataRetentionDays { get; set; } = 365;

    [Required]
    [MinLength(10, ErrorMessage = "Consent notice text must be at least 10 characters")]
    public string ConsentNoticeText { get; set; } = string.Empty;
}

public class StudentConsentDto
{
    public int StudentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string RollNumber { get; set; } = string.Empty;
    public int ClassId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;
    public string Status { get; set; } = string.Empty;
    public string? ConsentGivenBy { get; set; }
    public DateTime? ConsentDate { get; set; }
    public string? RecordedBy { get; set; }
    public DateTime? WithdrawnDate { get; set; }
    public string? WithdrawnBy { get; set; }
    public string? Notes { get; set; }
    public int FaceEmbeddingCount { get; set; }
}

public class RecordConsentRequest
{
    [Required]
    public int StudentId { get; set; }

    [Required]
    [MaxLength(150)]
    public string ConsentGivenBy { get; set; } = string.Empty;

    [MaxLength(500)]
    public string? Notes { get; set; }
}

public class WithdrawConsentRequest
{
    [Required]
    public int StudentId { get; set; }

    [MaxLength(500)]
    public string? Reason { get; set; }
}

public class ClassConsentSummaryDto
{
    public int ClassId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public int TotalStudents { get; set; }
    public int ConsentedCount { get; set; }
    public int WithdrawnCount { get; set; }
    public int PendingCount { get; set; }
    public int EnrolledCount { get; set; }
}

public class FaceDataDeletionResultDto
{
    public string Scope { get; set; } = string.Empty;
    public int DeletedEmbeddingsCount { get; set; }
    public string Message { get; set; } = string.Empty;
}
