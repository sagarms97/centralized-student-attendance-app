using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using System.Text.Json;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudentAttendance.Api.Data;
using StudentAttendance.Api.DTOs;
using StudentAttendance.Api.Models;
using StudentAttendance.Api.Services;

namespace StudentAttendance.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InvitesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly INotificationService _notificationService;
    private readonly ICurrentTenantService _tenantService;
    private readonly IConfiguration _configuration;

    public InvitesController(
        ApplicationDbContext context,
        INotificationService notificationService,
        ICurrentTenantService tenantService,
        IConfiguration configuration)
    {
        _context = context;
        _notificationService = notificationService;
        _tenantService = tenantService;
        _configuration = configuration;
    }

    [HttpPost("send")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult<SendInviteResponse>> SendInvite([FromBody] SendInviteRequest request)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        var email = request.Email.Trim().ToLowerInvariant();
        var institute = await _context.Institutes.FindAsync(tenantId.Value);
        if (institute == null) return NotFound(new { message = "Institute not found." });

        // Check if an active user with this email already exists in this institute
        var existingUser = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.InstituteId == tenantId.Value && u.Email.ToLower() == email && u.IsActive);

        if (existingUser != null && existingUser.AccountStatus == AccountStatuses.Active)
        {
            return BadRequest(new { message = $"An active user account already exists with email '{email}'." });
        }

        // Invalidate prior unused invites for this email
        var priorInvites = await _context.UserInvites
            .Where(ui => ui.InstituteId == tenantId.Value && ui.Email == email && !ui.IsUsed)
            .ToListAsync();
        foreach (var pi in priorInvites) pi.IsUsed = true;

        // Generate cryptographically random token
        var rawToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));

        var currentUserIdClaim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        int.TryParse(currentUserIdClaim, out var adminUserId);

        var metadata = new Dictionary<string, object>();
        if (!string.IsNullOrWhiteSpace(request.EmployeeId)) metadata["EmployeeId"] = request.EmployeeId.Trim();
        if (!string.IsNullOrWhiteSpace(request.SubjectSpecialization)) metadata["SubjectSpecialization"] = request.SubjectSpecialization.Trim();
        if (request.LinkedStudentIds != null && request.LinkedStudentIds.Count > 0) metadata["LinkedStudentIds"] = request.LinkedStudentIds;

        var invite = new UserInvite
        {
            InstituteId = tenantId.Value,
            Email = email,
            FullName = request.FullName.Trim(),
            Phone = request.Phone.Trim(),
            Role = request.Role.Trim(),
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            IsUsed = false,
            MetadataJson = metadata.Count > 0 ? JsonSerializer.Serialize(metadata) : null,
            CreatedByUserId = adminUserId > 0 ? adminUserId : null,
            CreatedAt = DateTime.UtcNow
        };

        _context.UserInvites.Add(invite);
        await _context.SaveChangesAsync();

        var frontendUrl = _configuration["FrontendUrl"] ?? "http://localhost:4200";
        var inviteLink = $"{frontendUrl}/register-invite?token={rawToken}";

        // Dispatch invite through notification abstraction
        await _notificationService.SendInviteAsync(
            email,
            request.Phone.Trim(),
            request.FullName.Trim(),
            inviteLink,
            request.Role.Trim(),
            institute.Name
        );

        return Ok(new SendInviteResponse
        {
            InviteId = invite.Id,
            Email = invite.Email,
            FullName = invite.FullName,
            Role = invite.Role,
            InviteLink = inviteLink,
            ExpiresAt = invite.ExpiresAt
        });
    }

    [HttpGet("validate")]
    [AllowAnonymous]
    public async Task<ActionResult<ValidateInviteResponse>> ValidateInvite([FromQuery] string token)
    {
        if (string.IsNullOrWhiteSpace(token))
        {
            return Ok(new ValidateInviteResponse { IsValid = false, Message = "Missing invitation token." });
        }

        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(token.Trim())));

        var invite = await _context.UserInvites
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(ui => ui.TokenHash == tokenHash && ui.IsActive);

        if (invite == null || invite.IsUsed || invite.ExpiresAt <= DateTime.UtcNow)
        {
            return Ok(new ValidateInviteResponse
            {
                IsValid = false,
                Message = "This invitation link is invalid or has expired. Please contact your administrator for a new invite."
            });
        }

        var institute = await _context.Institutes
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(i => i.Id == invite.InstituteId);

        string? employeeId = null;
        string? specialization = null;

        if (!string.IsNullOrWhiteSpace(invite.MetadataJson))
        {
            try
            {
                var dict = JsonSerializer.Deserialize<Dictionary<string, JsonElement>>(invite.MetadataJson);
                if (dict != null)
                {
                    if (dict.TryGetValue("EmployeeId", out var emp)) employeeId = emp.GetString();
                    if (dict.TryGetValue("SubjectSpecialization", out var spec)) specialization = spec.GetString();
                }
            }
            catch { }
        }

        return Ok(new ValidateInviteResponse
        {
            IsValid = true,
            Email = invite.Email,
            FullName = invite.FullName,
            Phone = invite.Phone,
            Role = invite.Role,
            InstituteName = institute?.Name,
            InstituteCode = institute?.Code,
            EmployeeId = employeeId,
            SubjectSpecialization = specialization
        });
    }
}
