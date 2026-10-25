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
[Route("api/face")]
public class FaceSettingsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly ILogger<FaceSettingsController> _logger;

    public FaceSettingsController(
        ApplicationDbContext context,
        ICurrentTenantService tenantService,
        ILogger<FaceSettingsController> logger)
    {
        _context = context;
        _tenantService = tenantService;
        _logger = logger;
    }

    [HttpGet("settings")]
    [Authorize(Roles = Roles.InstituteAdmin)]
    public async Task<ActionResult<FaceSettingsDto>> GetSettings()
    {
        var instituteId = _tenantService.InstituteId;
        if (!instituteId.HasValue)
            return Unauthorized(new { message = "Tenant context missing" });

        var settings = await _context.InstituteFaceSettings
            .Include(s => s.UpdatedByUser)
            .FirstOrDefaultAsync(s => s.InstituteId == instituteId.Value);

        if (settings == null)
        {
            settings = new InstituteFaceSettings
            {
                InstituteId = instituteId.Value,
                IsEnabled = false,
                MatchThreshold = 0.65,
                LowConfidenceThreshold = 0.45,
                DataRetentionDays = 365,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            _context.InstituteFaceSettings.Add(settings);
            await _context.SaveChangesAsync();
        }

        var dto = new FaceSettingsDto
        {
            IsEnabled = settings.IsEnabled,
            MatchThreshold = settings.MatchThreshold,
            LowConfidenceThreshold = settings.LowConfidenceThreshold,
            DataRetentionDays = settings.DataRetentionDays,
            ConsentNoticeText = settings.ConsentNoticeText,
            UpdatedAt = settings.CreatedAt,
            UpdatedBy = settings.UpdatedByUser?.FullName
        };

        return Ok(dto);
    }

    [HttpPut("settings")]
    [Authorize(Roles = Roles.InstituteAdmin)]
    public async Task<ActionResult<FaceSettingsDto>> UpdateSettings([FromBody] UpdateFaceSettingsRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(new { message = "Invalid input parameters" });

        if (request.LowConfidenceThreshold >= request.MatchThreshold)
            return BadRequest(new { message = "Low confidence threshold must be strictly less than match threshold" });

        var instituteId = _tenantService.InstituteId;
        if (!instituteId.HasValue)
            return Unauthorized(new { message = "Tenant context missing" });

        var userId = GetCurrentUserId();

        var settings = await _context.InstituteFaceSettings
            .FirstOrDefaultAsync(s => s.InstituteId == instituteId.Value);

        if (settings == null)
        {
            settings = new InstituteFaceSettings
            {
                InstituteId = instituteId.Value,
                IsEnabled = request.IsEnabled,
                MatchThreshold = request.MatchThreshold,
                LowConfidenceThreshold = request.LowConfidenceThreshold,
                DataRetentionDays = request.DataRetentionDays,
                ConsentNoticeText = request.ConsentNoticeText,
                UpdatedByUserId = userId,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            _context.InstituteFaceSettings.Add(settings);
        }
        else
        {
            settings.IsEnabled = request.IsEnabled;
            settings.MatchThreshold = request.MatchThreshold;
            settings.LowConfidenceThreshold = request.LowConfidenceThreshold;
            settings.DataRetentionDays = request.DataRetentionDays;
            settings.ConsentNoticeText = request.ConsentNoticeText;
            settings.UpdatedByUserId = userId;
        }

        await _context.SaveChangesAsync();

        await LogAuditAsync(
            "FaceAttendance.SettingsUpdated",
            instituteId.Value,
            $"Face Attendance settings updated. Enabled: {settings.IsEnabled}, MatchThreshold: {settings.MatchThreshold}, LowConfThreshold: {settings.LowConfidenceThreshold}, RetentionDays: {settings.DataRetentionDays}"
        );

        var user = await _context.Users.FindAsync(userId);
        var dto = new FaceSettingsDto
        {
            IsEnabled = settings.IsEnabled,
            MatchThreshold = settings.MatchThreshold,
            LowConfidenceThreshold = settings.LowConfidenceThreshold,
            DataRetentionDays = settings.DataRetentionDays,
            ConsentNoticeText = settings.ConsentNoticeText,
            UpdatedAt = DateTime.UtcNow,
            UpdatedBy = user?.FullName
        };

        return Ok(dto);
    }

    [HttpGet("privacy-notice")]
    [Authorize]
    public async Task<ActionResult<object>> GetPrivacyNotice()
    {
        var instituteId = _tenantService.InstituteId;
        var settings = instituteId.HasValue
            ? await _context.InstituteFaceSettings.FirstOrDefaultAsync(s => s.InstituteId == instituteId.Value)
            : null;

        var notice = settings?.ConsentNoticeText ?? 
            "EduAttend Face Attendance Privacy Notice:\n\n" +
            "1. Purpose: Facial detection and recognition are used solely for recording classroom attendance.\n" +
            "2. Storage & Privacy: No student photographs are stored on our servers. Images are processed strictly in memory to extract mathematical feature vectors (embeddings) which are encrypted at rest with AES-256.\n" +
            "3. Consent: Participation is voluntary. Parents or legal guardians may grant or withdraw consent at any time.\n" +
            "4. Data Purge: Withdrawing consent immediately and permanently deletes all stored facial embeddings for the student.\n" +
            "5. Isolation: Facial data is strictly isolated to your institute and never shared with third parties or used for any other purpose.";

        return Ok(new
        {
            isEnabled = settings?.IsEnabled ?? false,
            consentNoticeText = notice,
            dataRetentionDays = settings?.DataRetentionDays ?? 365
        });
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
