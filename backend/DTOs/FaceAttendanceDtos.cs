using System.ComponentModel.DataAnnotations;
using StudentAttendance.Api.Models;

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

// ==========================================
// Phase 2: Enrollment DTOs
// ==========================================

public class EnrollPhotoItem
{
    [Required]
    public string PoseType { get; set; } = FacePoseType.Front;

    [Required]
    public string ImageBase64 { get; set; } = string.Empty;
}

public class EnrollStudentFaceRequest
{
    [Required]
    public int StudentId { get; set; }

    [Required]
    [MinLength(1, ErrorMessage = "At least one enrollment photo is required (recommended 3-5).")]
    public List<EnrollPhotoItem> Photos { get; set; } = new();
}

public class FaceQualityResult
{
    public bool IsValid { get; set; }
    public string? ErrorMessage { get; set; }
    public double QualityScore { get; set; }
    public int Width { get; set; }
    public int Height { get; set; }
    public double SharpnessVariance { get; set; }
}

public class FaceEnrollmentResultDto
{
    public int StudentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public int SuccessfullyEnrolledCount { get; set; }
    public int TotalStoredEmbeddings { get; set; }
    public List<string> Details { get; set; } = new();
}

// ==========================================
// Phase 3 & 4: Multi-Face Detection & Recognition DTOs
// ==========================================

public class FaceBoundingBoxDto
{
    public double X { get; set; }
    public double Y { get; set; }
    public double Width { get; set; }
    public double Height { get; set; }
}

public class FaceCropMatchRequest
{
    public int CropIndex { get; set; }
    public int PhotoIndex { get; set; } = 1;
    public string ImageBase64 { get; set; } = string.Empty;
    public FaceBoundingBoxDto? BoundingBox { get; set; }
}

public class MatchClassAttendanceRequest
{
    [Required]
    public int ClassId { get; set; }

    public string? Section { get; set; }

    public int? PeriodId { get; set; }

    public DateTime? AttendanceDate { get; set; }

    [Required]
    [MinLength(1, ErrorMessage = "At least one face crop must be provided for recognition.")]
    public List<FaceCropMatchRequest> FaceCrops { get; set; } = new();
}

public class RecognizedFaceDto
{
    public int CropIndex { get; set; }
    public int PhotoIndex { get; set; }
    public int? MatchedStudentId { get; set; }
    public string? MatchedStudentName { get; set; }
    public string? RollNumber { get; set; }
    public string? Section { get; set; }
    public double Confidence { get; set; }
    public string Status { get; set; } = "Unknown"; // Matched, LowConfidence, Unknown
    public bool IsDuplicate { get; set; }
    public FaceBoundingBoxDto? BoundingBox { get; set; }
}

public class NotDetectedStudentDto
{
    public int StudentId { get; set; }
    public string StudentName { get; set; } = string.Empty;
    public string RollNumber { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;
    public bool HasConsent { get; set; }
    public bool IsEnrolled { get; set; }
}

public class ClassRecognitionResultDto
{
    public int ClassId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public string? Section { get; set; }
    public int TotalStudentsInClass { get; set; }
    public int ConsentedStudentsCount { get; set; }
    public int EnrolledStudentsCount { get; set; }
    public int ProcessedPhotosCount { get; set; }
    public int TotalFacesDetected { get; set; }
    public int MatchedCount { get; set; }
    public int LowConfidenceCount { get; set; }
    public int UnknownCount { get; set; }
    public List<RecognizedFaceDto> RecognizedFaces { get; set; } = new();
    public List<NotDetectedStudentDto> NotDetectedStudents { get; set; } = new();
}
