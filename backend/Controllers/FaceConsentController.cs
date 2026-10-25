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
[Route("api/face/consent")]
public class FaceConsentController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ILogger<FaceConsentController> _logger;

    public FaceConsentController(
        ApplicationDbContext context,
        ICurrentTenantService tenantService,
        ILogger<FaceConsentController> logger)
    {
        _context = context;
        _tenantService = tenantService;
        _logger = logger;
    }

    [HttpGet("class/{classId}")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.Staff}")]
    public async Task<ActionResult<List<StudentConsentDto>>> GetClassConsents(int classId)
    {
        var instituteId = _tenantService.InstituteId;
        if (!instituteId.HasValue)
            return Unauthorized(new { message = "Tenant context missing" });

        var students = await _context.Students
            .Include(s => s.Class)
            .Where(s => s.ClassId == classId && s.InstituteId == instituteId.Value)
            .OrderBy(s => s.RollNo)
            .ThenBy(s => s.FirstName)
            .ToListAsync();

        var studentIds = students.Select(s => s.Id).ToList();

        var consents = await _context.StudentFaceConsents
            .Include(c => c.RecordedByUser)
            .Include(c => c.WithdrawnByUser)
            .Where(c => studentIds.Contains(c.StudentId) && c.InstituteId == instituteId.Value)
            .ToListAsync();

        var consentDict = consents
            .GroupBy(c => c.StudentId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(c => c.CreatedAt).First());

        var embeddingCounts = await _context.StudentFaceEmbeddings
            .Where(e => studentIds.Contains(e.StudentId) && e.InstituteId == instituteId.Value && e.IsActive)
            .GroupBy(e => e.StudentId)
            .Select(g => new { StudentId = g.Key, Count = g.Count() })
            .ToDictionaryAsync(g => g.StudentId, g => g.Count);

        var result = students.Select(s =>
        {
            consentDict.TryGetValue(s.Id, out var consent);
            embeddingCounts.TryGetValue(s.Id, out var count);

            return new StudentConsentDto
            {
                StudentId = s.Id,
                StudentName = s.FullName,
                RollNumber = s.RollNo,
                ClassId = s.ClassId,
                ClassName = s.Class?.Name ?? string.Empty,
                Section = s.Section,
                Status = consent?.Status ?? FaceConsentStatus.Pending,
                ConsentGivenBy = consent?.ConsentGivenBy,
                ConsentDate = consent?.ConsentDate,
                RecordedBy = consent?.RecordedByUser?.FullName,
                WithdrawnDate = consent?.WithdrawnDate,
                WithdrawnBy = consent?.WithdrawnByUser?.FullName,
                Notes = consent?.Notes,
                FaceEmbeddingCount = count
            };
        }).ToList();

        return Ok(result);
    }

    [HttpGet("student/{studentId}")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.Staff},{Roles.Parent}")]
    public async Task<ActionResult<StudentConsentDto>> GetStudentConsent(int studentId)
    {
        var instituteId = _tenantService.InstituteId;
        if (!instituteId.HasValue)
            return Unauthorized(new { message = "Tenant context missing" });

        // If parent, check they are linked to this student
        if (User.IsInRole(Roles.Parent))
        {
            var userId = GetCurrentUserId();
            var parent = await _context.Parents.FirstOrDefaultAsync(p => p.UserId == userId);
            if (parent == null)
                return Forbid();

            var hasAccess = await _context.ParentStudents
                .AnyAsync(ps => ps.ParentId == parent.Id && ps.StudentId == studentId);
            if (!hasAccess)
                return Forbid();
        }

        var student = await _context.Students
            .Include(s => s.Class)
            .FirstOrDefaultAsync(s => s.Id == studentId && s.InstituteId == instituteId.Value);

        if (student == null)
            return NotFound(new { message = "Student not found" });

        var consent = await _context.StudentFaceConsents
            .Include(c => c.RecordedByUser)
            .Include(c => c.WithdrawnByUser)
            .Where(c => c.StudentId == studentId && c.InstituteId == instituteId.Value)
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync();

        var embeddingCount = await _context.StudentFaceEmbeddings
            .CountAsync(e => e.StudentId == studentId && e.InstituteId == instituteId.Value && e.IsActive);

        var dto = new StudentConsentDto
        {
            StudentId = student.Id,
            StudentName = student.FullName,
            RollNumber = student.RollNo,
            ClassId = student.ClassId,
            ClassName = student.Class?.Name ?? string.Empty,
            Section = student.Section,
            Status = consent?.Status ?? FaceConsentStatus.Pending,
            ConsentGivenBy = consent?.ConsentGivenBy,
            ConsentDate = consent?.ConsentDate,
            RecordedBy = consent?.RecordedByUser?.FullName,
            WithdrawnDate = consent?.WithdrawnDate,
            WithdrawnBy = consent?.WithdrawnByUser?.FullName,
            Notes = consent?.Notes,
            FaceEmbeddingCount = embeddingCount
        };

        return Ok(dto);
    }

    [HttpPost]
    [Authorize(Roles = Roles.InstituteAdmin)]
    public async Task<ActionResult<StudentConsentDto>> RecordConsent([FromBody] RecordConsentRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(new { message = "Invalid consent request" });

        var instituteId = _tenantService.InstituteId;
        if (!instituteId.HasValue)
            return Unauthorized(new { message = "Tenant context missing" });

        var student = await _context.Students
            .Include(s => s.Class)
            .FirstOrDefaultAsync(s => s.Id == request.StudentId && s.InstituteId == instituteId.Value);

        if (student == null)
            return NotFound(new { message = "Student not found" });

        var userId = GetCurrentUserId();

        var consent = await _context.StudentFaceConsents
            .Where(c => c.StudentId == request.StudentId && c.InstituteId == instituteId.Value)
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync();

        if (consent == null)
        {
            consent = new StudentFaceConsent
            {
                InstituteId = instituteId.Value,
                StudentId = request.StudentId,
                ConsentGivenBy = request.ConsentGivenBy.Trim(),
                ConsentDate = DateTime.UtcNow,
                Status = FaceConsentStatus.Consented,
                RecordedByUserId = userId,
                Notes = request.Notes?.Trim(),
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            _context.StudentFaceConsents.Add(consent);
        }
        else
        {
            consent.ConsentGivenBy = request.ConsentGivenBy.Trim();
            consent.ConsentDate = DateTime.UtcNow;
            consent.Status = FaceConsentStatus.Consented;
            consent.RecordedByUserId = userId;
            consent.WithdrawnDate = null;
            consent.WithdrawnByUserId = null;
            consent.Notes = request.Notes?.Trim();
        }

        await _context.SaveChangesAsync();

        await LogAuditAsync(
            "FaceAttendance.ConsentRecorded",
            instituteId.Value,
            $"Consent recorded for student {student.FullName} (ID: {student.Id}, Roll: {student.RollNo}) by guardian '{consent.ConsentGivenBy}'."
        );

        var recordedUser = await _context.Users.FindAsync(userId);
        var dto = new StudentConsentDto
        {
            StudentId = student.Id,
            StudentName = student.FullName,
            RollNumber = student.RollNo,
            ClassId = student.ClassId,
            ClassName = student.Class?.Name ?? string.Empty,
            Section = student.Section,
            Status = consent.Status,
            ConsentGivenBy = consent.ConsentGivenBy,
            ConsentDate = consent.ConsentDate,
            RecordedBy = recordedUser?.FullName,
            Notes = consent.Notes,
            FaceEmbeddingCount = 0
        };

        return Ok(dto);
    }

    [HttpPost("withdraw")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.Parent}")]
    public async Task<ActionResult<StudentConsentDto>> WithdrawConsent([FromBody] WithdrawConsentRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(new { message = "Invalid withdrawal request" });

        var instituteId = _tenantService.InstituteId;
        if (!instituteId.HasValue)
            return Unauthorized(new { message = "Tenant context missing" });

        // Check parent access if Parent role
        if (User.IsInRole(Roles.Parent))
        {
            var currentUserId = GetCurrentUserId();
            var parent = await _context.Parents.FirstOrDefaultAsync(p => p.UserId == currentUserId);
            if (parent == null)
                return Forbid();

            var linked = await _context.ParentStudents
                .AnyAsync(ps => ps.ParentId == parent.Id && ps.StudentId == request.StudentId);
            if (!linked)
                return Forbid();
        }

        var student = await _context.Students
            .Include(s => s.Class)
            .FirstOrDefaultAsync(s => s.Id == request.StudentId && s.InstituteId == instituteId.Value);

        if (student == null)
            return NotFound(new { message = "Student not found" });

        var userId = GetCurrentUserId();

        var consent = await _context.StudentFaceConsents
            .Where(c => c.StudentId == request.StudentId && c.InstituteId == instituteId.Value)
            .OrderByDescending(c => c.CreatedAt)
            .FirstOrDefaultAsync();

        if (consent == null)
        {
            consent = new StudentFaceConsent
            {
                InstituteId = instituteId.Value,
                StudentId = request.StudentId,
                ConsentGivenBy = "Parent/Guardian",
                ConsentDate = DateTime.UtcNow,
                Status = FaceConsentStatus.Withdrawn,
                RecordedByUserId = userId,
                WithdrawnDate = DateTime.UtcNow,
                WithdrawnByUserId = userId,
                Notes = request.Reason,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            _context.StudentFaceConsents.Add(consent);
        }
        else
        {
            consent.Status = FaceConsentStatus.Withdrawn;
            consent.WithdrawnDate = DateTime.UtcNow;
            consent.WithdrawnByUserId = userId;
            if (!string.IsNullOrWhiteSpace(request.Reason))
            {
                consent.Notes = (consent.Notes + " | Withdrawn: " + request.Reason).Trim();
            }
        }

        // PURGE ALL ENROLLED EMBEDDINGS FOR THIS STUDENT IMMEDIATELY
        var embeddings = await _context.StudentFaceEmbeddings
            .Where(e => e.StudentId == request.StudentId && e.InstituteId == instituteId.Value)
            .ToListAsync();

        var purgedCount = embeddings.Count;
        if (purgedCount > 0)
        {
            _context.StudentFaceEmbeddings.RemoveRange(embeddings);
        }

        await _context.SaveChangesAsync();

        await LogAuditAsync(
            "FaceAttendance.ConsentWithdrawn",
            instituteId.Value,
            $"Consent withdrawn for student {student.FullName} (ID: {student.Id}). {purgedCount} face embedding(s) permanently deleted."
        );

        var withdrawnUser = await _context.Users.FindAsync(userId);
        var dto = new StudentConsentDto
        {
            StudentId = student.Id,
            StudentName = student.FullName,
            RollNumber = student.RollNo,
            ClassId = student.ClassId,
            ClassName = student.Class?.Name ?? string.Empty,
            Section = student.Section,
            Status = consent.Status,
            ConsentGivenBy = consent.ConsentGivenBy,
            ConsentDate = consent.ConsentDate,
            WithdrawnDate = consent.WithdrawnDate,
            WithdrawnBy = withdrawnUser?.FullName,
            Notes = consent.Notes,
            FaceEmbeddingCount = 0
        };

        return Ok(dto);
    }

    [HttpGet("summary")]
    [Authorize(Roles = Roles.InstituteAdmin)]
    public async Task<ActionResult<List<ClassConsentSummaryDto>>> GetConsentSummary()
    {
        var instituteId = _tenantService.InstituteId;
        if (!instituteId.HasValue)
            return Unauthorized(new { message = "Tenant context missing" });

        var classes = await _context.Classes
            .Where(c => c.InstituteId == instituteId.Value && c.IsActive)
            .OrderBy(c => c.Name)
            .ToListAsync();

        var classIds = classes.Select(c => c.Id).ToList();

        var students = await _context.Students
            .Where(s => classIds.Contains(s.ClassId) && s.InstituteId == instituteId.Value && s.IsActive)
            .ToListAsync();

        var studentIds = students.Select(s => s.Id).ToList();

        var consents = await _context.StudentFaceConsents
            .Where(c => studentIds.Contains(c.StudentId) && c.InstituteId == instituteId.Value)
            .ToListAsync();

        var latestConsents = consents
            .GroupBy(c => c.StudentId)
            .ToDictionary(g => g.Key, g => g.OrderByDescending(c => c.CreatedAt).First().Status);

        var enrolledStudentIds = await _context.StudentFaceEmbeddings
            .Where(e => studentIds.Contains(e.StudentId) && e.InstituteId == instituteId.Value && e.IsActive)
            .Select(e => e.StudentId)
            .Distinct()
            .ToListAsync();

        var enrolledSet = new HashSet<int>(enrolledStudentIds);

        var result = classes.Select(c =>
        {
            var classStudents = students.Where(s => s.ClassId == c.Id).ToList();
            var total = classStudents.Count;

            var consented = 0;
            var withdrawn = 0;
            var pending = 0;
            var enrolled = 0;

            foreach (var s in classStudents)
            {
                if (latestConsents.TryGetValue(s.Id, out var status))
                {
                    if (status == FaceConsentStatus.Consented) consented++;
                    else if (status == FaceConsentStatus.Withdrawn || status == FaceConsentStatus.Declined) withdrawn++;
                    else pending++;
                }
                else
                {
                    pending++;
                }

                if (enrolledSet.Contains(s.Id)) enrolled++;
            }

            return new ClassConsentSummaryDto
            {
                ClassId = c.Id,
                ClassName = c.Name,
                TotalStudents = total,
                ConsentedCount = consented,
                WithdrawnCount = withdrawn,
                PendingCount = pending,
                EnrolledCount = enrolled
            };
        }).ToList();

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
