using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudentAttendance.Api.Data;
using StudentAttendance.Api.DTOs;
using StudentAttendance.Api.Models;
using StudentAttendance.Api.Services;
using StudentAttendance.Api.Services.FaceRecognition;

namespace StudentAttendance.Api.Controllers;

[ApiController]
[Route("api/face/enrollment")]
[Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.Staff}")]
public class FaceEnrollmentController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IFaceRecognitionService _recognitionService;
    private readonly IFaceEncryptionService _encryptionService;
    private readonly ICurrentTenantService _tenantService;
    private readonly ILogger<FaceEnrollmentController> _logger;

    public FaceEnrollmentController(
        ApplicationDbContext context,
        IFaceRecognitionService recognitionService,
        IFaceEncryptionService encryptionService,
        ICurrentTenantService tenantService,
        ILogger<FaceEnrollmentController> logger)
    {
        _context = context;
        _recognitionService = recognitionService;
        _encryptionService = encryptionService;
        _tenantService = tenantService;
        _logger = logger;
    }

    [HttpPost]
    public async Task<ActionResult<FaceEnrollmentResultDto>> EnrollStudent([FromBody] EnrollStudentFaceRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(new { message = "Invalid enrollment payload." });

        var instituteId = _tenantService.InstituteId;
        if (!instituteId.HasValue)
            return Unauthorized(new { message = "Tenant context missing." });

        var student = await _context.Students
            .Include(s => s.Class)
            .FirstOrDefaultAsync(s => s.Id == request.StudentId && s.InstituteId == instituteId.Value);

        if (student == null)
            return NotFound(new { message = "Student not found." });

        // 1. Check Parental Consent: MANDATORY REQUIREMENT
        var consent = await _context.StudentFaceConsents
            .Where(c => c.StudentId == request.StudentId && c.InstituteId == instituteId.Value && c.IsActive)
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync();

        if (consent == null || consent.Status != FaceConsentStatus.Consented)
        {
            return BadRequest(new { message = $"Cannot enroll student {student.FullName}: Verified parental consent is required before capturing or storing biometric face data." });
        }

        var userId = GetCurrentUserId();
        var details = new List<string>();
        int enrolledCount = 0;

        // Process photos
        foreach (var photo in request.Photos)
        {
            byte[] imageBytes;
            try
            {
                var base64 = photo.ImageBase64;
                if (base64.Contains(","))
                {
                    base64 = base64.Substring(base64.IndexOf(",") + 1);
                }
                imageBytes = Convert.FromBase64String(base64);
            }
            catch (Exception)
            {
                details.Add($"Pose '{photo.PoseType}': Invalid base64 image data.");
                continue;
            }

            // Quality Check
            var quality = await _recognitionService.AssessFaceQualityAsync(imageBytes);
            if (!quality.IsValid)
            {
                details.Add($"Pose '{photo.PoseType}' rejected: {quality.ErrorMessage}");
                continue;
            }

            try
            {
                // Generate 512-dim embedding
                var embedding = await _recognitionService.GenerateEmbeddingAsync(imageBytes);

                // Encrypt embedding with AES-256-GCM
                var (ciphertext, iv, tag) = _encryptionService.EncryptEmbedding(embedding);

                // Save to database
                var faceEmbedding = new StudentFaceEmbedding
                {
                    InstituteId = instituteId.Value,
                    StudentId = student.Id,
                    PoseType = string.IsNullOrWhiteSpace(photo.PoseType) ? FacePoseType.Front : photo.PoseType,
                    EmbeddingVectorEncrypted = ciphertext,
                    EncryptionIv = iv,
                    EncryptionTag = tag,
                    QualityScore = quality.QualityScore,
                    CreatedByUserId = userId,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };

                _context.StudentFaceEmbeddings.Add(faceEmbedding);
                enrolledCount++;
                details.Add($"Pose '{faceEmbedding.PoseType}' enrolled successfully (Quality score: {quality.QualityScore:P0}).");
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Failed to compute or encrypt face embedding for student {StudentId}", student.Id);
                details.Add($"Pose '{photo.PoseType}' failed: {ex.Message}");
            }
        }

        if (enrolledCount > 0)
        {
            await _context.SaveChangesAsync();

            await LogAuditAsync(
                "FaceAttendance.StudentEnrolled",
                instituteId.Value,
                $"Enrolled {enrolledCount} face photo embeddings for student {student.FullName} (ID: {student.Id}, Roll: {student.RollNo})."
            );
        }

        var totalStored = await _context.StudentFaceEmbeddings
            .CountAsync(e => e.StudentId == student.Id && e.InstituteId == instituteId.Value && e.IsActive);

        var result = new FaceEnrollmentResultDto
        {
            StudentId = student.Id,
            StudentName = student.FullName,
            SuccessfullyEnrolledCount = enrolledCount,
            TotalStoredEmbeddings = totalStored,
            Details = details
        };

        if (enrolledCount == 0)
        {
            return BadRequest(new { message = "All uploaded enrollment photos were rejected by quality verification.", details = details });
        }

        return Ok(result);
    }

    [HttpGet("student/{studentId}")]
    public async Task<ActionResult<object>> GetStudentEnrollment(int studentId)
    {
        var instituteId = _tenantService.InstituteId;
        if (!instituteId.HasValue)
            return Unauthorized(new { message = "Tenant context missing." });

        var student = await _context.Students
            .Include(s => s.Class)
            .FirstOrDefaultAsync(s => s.Id == studentId && s.InstituteId == instituteId.Value);

        if (student == null)
            return NotFound(new { message = "Student not found." });

        var consent = await _context.StudentFaceConsents
            .Where(c => c.StudentId == studentId && c.InstituteId == instituteId.Value)
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync();

        var embeddings = await _context.StudentFaceEmbeddings
            .Where(e => e.StudentId == studentId && e.InstituteId == instituteId.Value && e.IsActive)
            .Select(e => new
            {
                e.Id,
                e.PoseType,
                e.QualityScore,
                e.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            studentId = student.Id,
            studentName = student.FullName,
            rollNumber = student.RollNo,
            className = student.Class?.Name,
            section = student.Section,
            consentStatus = consent?.Status ?? FaceConsentStatus.Pending,
            consentGivenBy = consent?.ConsentGivenBy,
            enrolledEmbeddings = embeddings,
            totalPhotos = embeddings.Count
        });
    }

    [HttpDelete("embedding/{embeddingId}")]
    public async Task<ActionResult> DeleteEmbedding(int embeddingId)
    {
        var instituteId = _tenantService.InstituteId;
        if (!instituteId.HasValue)
            return Unauthorized(new { message = "Tenant context missing." });

        var embedding = await _context.StudentFaceEmbeddings
            .FirstOrDefaultAsync(e => e.Id == embeddingId && e.InstituteId == instituteId.Value);

        if (embedding == null)
            return NotFound(new { message = "Face embedding not found." });

        _context.StudentFaceEmbeddings.Remove(embedding);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Face embedding removed successfully." });
    }

    private int GetCurrentUserId()
    {
        var claim = User.FindFirstValue(ClaimTypes.NameIdentifier);
        return int.TryParse(claim, out var id) ? id : 0;
    }

    private async Task LogAuditAsync(string action, int instituteId, string details)
    {
        try
        {
            var userId = GetCurrentUserId();
            var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.Identity?.Name ?? "system";
            var ip = HttpContext.Connection.RemoteIpAddress?.ToString();

            _context.AuditLogs.Add(new AuditLog
            {
                InstituteId = instituteId,
                UserId = userId,
                UserEmail = userEmail,
                Action = action,
                Details = details,
                IpAddress = ip,
                CreatedAt = DateTime.UtcNow
            });

            await _context.SaveChangesAsync();
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to record audit log for action {Action}", action);
        }
    }
}
