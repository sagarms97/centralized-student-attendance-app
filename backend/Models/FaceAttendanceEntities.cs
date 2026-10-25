using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace StudentAttendance.Api.Models;

public static class FaceConsentStatus
{
    public const string Consented = "Consented";
    public const string Withdrawn = "Withdrawn";
    public const string Declined = "Declined";
    public const string Pending = "Pending";
}

public class InstituteFaceSettings : BaseTenantEntity
{
    public bool IsEnabled { get; set; } = false; // Disabled by default, enabled per institute by admin

    [Range(0.1, 1.0)]
    public double MatchThreshold { get; set; } = 0.65; // Cosine similarity threshold for confident match

    [Range(0.1, 1.0)]
    public double LowConfidenceThreshold { get; set; } = 0.45; // Cosine similarity threshold for low-confidence flag

    [Range(1, 1825)]
    public int DataRetentionDays { get; set; } = 365; // Automatic retention window

    public string ConsentNoticeText { get; set; } = 
        "EduAttend Face Attendance Privacy Notice:\n\n" +
        "1. Purpose: Facial detection and recognition are used solely for recording classroom attendance.\n" +
        "2. Storage & Privacy: No student photographs are stored on our servers. Images are processed strictly in memory to extract mathematical feature vectors (embeddings) which are encrypted at rest with AES-256.\n" +
        "3. Consent: Participation is voluntary. Parents or legal guardians may grant or withdraw consent at any time.\n" +
        "4. Data Purge: Withdrawing consent immediately and permanently deletes all stored facial embeddings for the student.\n" +
        "5. Isolation: Facial data is strictly isolated to your institute and never shared with third parties or used for any other purpose.";

    public int? UpdatedByUserId { get; set; }
    public User? UpdatedByUser { get; set; }
}

public class StudentFaceConsent : BaseTenantEntity
{
    public int StudentId { get; set; }
    public Student Student { get; set; } = null!;

    public int? ParentId { get; set; }
    public Parent? Parent { get; set; }

    [MaxLength(150)]
    public string ConsentGivenBy { get; set; } = string.Empty; // Name of parent or guardian

    public DateTime ConsentDate { get; set; } = DateTime.UtcNow;

    [MaxLength(50)]
    public string Status { get; set; } = FaceConsentStatus.Consented;

    public int RecordedByUserId { get; set; }
    public User RecordedByUser { get; set; } = null!;

    public DateTime? WithdrawnDate { get; set; }
    public int? WithdrawnByUserId { get; set; }
    public User? WithdrawnByUser { get; set; }

    [MaxLength(500)]
    public string? Notes { get; set; }
}

public static class FacePoseType
{
    public const string Front = "Front";
    public const string SlightLeft = "SlightLeft";
    public const string SlightRight = "SlightRight";
}

public class StudentFaceEmbedding : BaseTenantEntity
{
    public int StudentId { get; set; }
    public Student Student { get; set; } = null!;

    [MaxLength(50)]
    public string PoseType { get; set; } = FacePoseType.Front;

    public byte[] EmbeddingVectorEncrypted { get; set; } = Array.Empty<byte>(); // AES-256-GCM encrypted 512-d float array

    public byte[] EncryptionIv { get; set; } = Array.Empty<byte>(); // 12-byte GCM initialization vector

    public byte[] EncryptionTag { get; set; } = Array.Empty<byte>(); // 16-byte GCM authentication tag

    public double QualityScore { get; set; } = 1.0;

    public int CreatedByUserId { get; set; }
    public User CreatedByUser { get; set; } = null!;
}
