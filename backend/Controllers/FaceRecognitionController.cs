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
[Route("api/face/recognition")]
[Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.Staff}")]
public class FaceRecognitionController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IFaceRecognitionService _recognitionService;
    private readonly ICurrentTenantService _tenantService;
    private readonly ILogger<FaceRecognitionController> _logger;

    public FaceRecognitionController(
        ApplicationDbContext context,
        IFaceRecognitionService recognitionService,
        ICurrentTenantService tenantService,
        ILogger<FaceRecognitionController> logger)
    {
        _context = context;
        _recognitionService = recognitionService;
        _tenantService = tenantService;
        _logger = logger;
    }

    [HttpPost("match-class")]
    public async Task<ActionResult<ClassRecognitionResultDto>> MatchClassFaces([FromBody] MatchClassAttendanceRequest request)
    {
        if (!ModelState.IsValid)
            return BadRequest(new { message = "Invalid match request payload." });

        var instituteId = _tenantService.InstituteId;
        if (!instituteId.HasValue)
            return Unauthorized(new { message = "Tenant context missing." });

        // 1. Verify module is enabled for this institute
        var settings = await _context.InstituteFaceSettings
            .FirstOrDefaultAsync(s => s.InstituteId == instituteId.Value);

        if (settings == null || !settings.IsEnabled)
        {
            return StatusCode(403, new { message = "Face attendance module is currently disabled for your institute. An administrator must enable it in Face Attendance Settings before running recognition." });
        }

        // 2. Verify class exists
        var classEntity = await _context.Classes
            .FirstOrDefaultAsync(c => c.Id == request.ClassId && c.InstituteId == instituteId.Value && c.IsActive);

        if (classEntity == null)
            return NotFound(new { message = "Class not found." });

        // 3. Match faces against enrolled embeddings
        var result = await _recognitionService.MatchClassFacesAsync(
            request.ClassId,
            request.Section,
            request.FaceCrops,
            settings.MatchThreshold,
            settings.LowConfidenceThreshold
        );

        // 4. Audit Log
        await LogAuditAsync(
            "FaceAttendance.MatchRun",
            instituteId.Value,
            $"Face recognition executed for class '{classEntity.Name}' (Section: {request.Section ?? "All"}). " +
            $"Processed {result.ProcessedPhotosCount} photo(s), {result.TotalFacesDetected} face crop(s). Matched: {result.MatchedCount}, LowConfidence: {result.LowConfidenceCount}, Unknown: {result.UnknownCount}."
        );

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
