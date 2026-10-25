using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudentAttendance.Api.Data;
using StudentAttendance.Api.DTOs;
using StudentAttendance.Api.Models;
using StudentAttendance.Api.Services;

namespace StudentAttendance.Api.Controllers;

[ApiController]
[Route("api/face/data")]
[Authorize(Roles = Roles.InstituteAdmin)]
public class FaceDataDeletionController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ILogger<FaceDataDeletionController> _logger;

    public FaceDataDeletionController(
        ApplicationDbContext context,
        ICurrentTenantService tenantService,
        ILogger<FaceDataDeletionController> logger)
    {
        _context = context;
        _tenantService = tenantService;
        _logger = logger;
    }

    [HttpDelete("student/{studentId}")]
    public async Task<ActionResult<FaceDataDeletionResultDto>> DeleteStudentFaceData(int studentId)
    {
        var instituteId = _tenantService.InstituteId;
        if (!instituteId.HasValue)
            return Unauthorized(new { message = "Tenant context missing" });

        var student = await _context.Students
            .FirstOrDefaultAsync(s => s.Id == studentId && s.InstituteId == instituteId.Value);

        if (student == null)
            return NotFound(new { message = "Student not found" });

        var embeddings = await _context.StudentFaceEmbeddings
            .Where(e => e.StudentId == studentId && e.InstituteId == instituteId.Value)
            .ToListAsync();

        var count = embeddings.Count;
        if (count > 0)
        {
            _context.StudentFaceEmbeddings.RemoveRange(embeddings);
            await _context.SaveChangesAsync();
        }

        await LogAuditAsync(
            "FaceAttendance.StudentDataDeleted",
            instituteId.Value,
            $"Deleted {count} facial embeddings for student {student.FullName} (ID: {student.Id}, Roll: {student.RollNo})."
        );

        var result = new FaceDataDeletionResultDto
        {
            Scope = "Student",
            DeletedEmbeddingsCount = count,
            Message = $"Successfully deleted {count} facial embeddings for {student.FullName}."
        };

        return Ok(result);
    }

    [HttpDelete("class/{classId}")]
    public async Task<ActionResult<FaceDataDeletionResultDto>> DeleteClassFaceData(int classId)
    {
        var instituteId = _tenantService.InstituteId;
        if (!instituteId.HasValue)
            return Unauthorized(new { message = "Tenant context missing" });

        var classEntity = await _context.Classes
            .FirstOrDefaultAsync(c => c.Id == classId && c.InstituteId == instituteId.Value);

        if (classEntity == null)
            return NotFound(new { message = "Class not found" });

        var studentIds = await _context.Students
            .Where(s => s.ClassId == classId && s.InstituteId == instituteId.Value)
            .Select(s => s.Id)
            .ToListAsync();

        var embeddings = await _context.StudentFaceEmbeddings
            .Where(e => studentIds.Contains(e.StudentId) && e.InstituteId == instituteId.Value)
            .ToListAsync();

        var count = embeddings.Count;
        if (count > 0)
        {
            _context.StudentFaceEmbeddings.RemoveRange(embeddings);
            await _context.SaveChangesAsync();
        }

        await LogAuditAsync(
            "FaceAttendance.ClassDataDeleted",
            instituteId.Value,
            $"Deleted {count} facial embeddings across {studentIds.Count} students in class '{classEntity.Name}'."
        );

        var result = new FaceDataDeletionResultDto
        {
            Scope = "Class",
            DeletedEmbeddingsCount = count,
            Message = $"Successfully deleted {count} facial embeddings for class {classEntity.Name}."
        };

        return Ok(result);
    }

    [HttpDelete("institute")]
    public async Task<ActionResult<FaceDataDeletionResultDto>> PurgeInstituteFaceData()
    {
        var instituteId = _tenantService.InstituteId;
        if (!instituteId.HasValue)
            return Unauthorized(new { message = "Tenant context missing" });

        var embeddings = await _context.StudentFaceEmbeddings
            .Where(e => e.InstituteId == instituteId.Value)
            .ToListAsync();

        var count = embeddings.Count;
        if (count > 0)
        {
            _context.StudentFaceEmbeddings.RemoveRange(embeddings);
            await _context.SaveChangesAsync();
        }

        await LogAuditAsync(
            "FaceAttendance.InstituteDataPurged",
            instituteId.Value,
            $"CRITICAL: Purged all {count} facial embeddings for institute (ID: {instituteId.Value})."
        );

        var result = new FaceDataDeletionResultDto
        {
            Scope = "Institute",
            DeletedEmbeddingsCount = count,
            Message = $"Successfully purged all {count} facial embeddings for this institute."
        };

        return Ok(result);
    }

    [HttpPost("cleanup-expired")]
    public async Task<ActionResult<FaceDataDeletionResultDto>> CleanupExpiredAndInactive()
    {
        var instituteId = _tenantService.InstituteId;
        if (!instituteId.HasValue)
            return Unauthorized(new { message = "Tenant context missing" });

        var settings = await _context.InstituteFaceSettings
            .FirstOrDefaultAsync(s => s.InstituteId == instituteId.Value);

        var retentionDays = settings?.DataRetentionDays ?? 365;
        var expirationDate = DateTime.UtcNow.AddDays(-retentionDays);

        // Find embeddings older than retention period or belonging to inactive students
        var inactiveStudentIds = await _context.Students
            .Where(s => s.InstituteId == instituteId.Value && !s.IsActive)
            .Select(s => s.Id)
            .ToListAsync();

        var expiredEmbeddings = await _context.StudentFaceEmbeddings
            .Where(e => e.InstituteId == instituteId.Value &&
                        (e.CreatedAt < expirationDate || inactiveStudentIds.Contains(e.StudentId)))
            .ToListAsync();

        var count = expiredEmbeddings.Count;
        if (count > 0)
        {
            _context.StudentFaceEmbeddings.RemoveRange(expiredEmbeddings);
            await _context.SaveChangesAsync();
        }

        await LogAuditAsync(
            "FaceAttendance.RetentionCleanup",
            instituteId.Value,
            $"Automated retention cleanup: Purged {count} facial embeddings older than {retentionDays} days or belonging to inactive students."
        );

        var result = new FaceDataDeletionResultDto
        {
            Scope = "RetentionCleanup",
            DeletedEmbeddingsCount = count,
            Message = $"Cleanup completed. Removed {count} expired or inactive face embeddings."
        };

        return Ok(result);
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
