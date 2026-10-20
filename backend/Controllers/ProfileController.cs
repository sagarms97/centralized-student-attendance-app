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
[Route("api/[controller]")]
[Authorize]
public class ProfileController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly IPasswordService _passwordService;
    private readonly IFileStorageService _fileStorage;
    private readonly ICurrentTenantService _tenantService;

    public ProfileController(
        ApplicationDbContext context,
        IPasswordService passwordService,
        IFileStorageService fileStorage,
        ICurrentTenantService tenantService)
    {
        _context = context;
        _passwordService = passwordService;
        _fileStorage = fileStorage;
        _tenantService = tenantService;
    }

    [HttpGet("me")]
    public async Task<ActionResult<UserProfileDto>> GetMyProfile()
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized();

        var user = await _context.Users
            .Include(u => u.Institute)
            .Include(u => u.StaffProfile)
            .Include(u => u.ParentProfile)
            .FirstOrDefaultAsync(u => u.Id == userId.Value);

        if (user == null) return NotFound(new { message = "User not found." });

        return Ok(new UserProfileDto
        {
            Id = user.Id,
            InstituteId = user.InstituteId,
            InstituteName = user.Institute?.Name,
            InstituteCode = user.Institute?.Code,
            FullName = user.FullName,
            Email = user.Email,
            Role = user.Role,
            AccountStatus = user.AccountStatus,
            PhotoPath = user.PhotoPath,
            Phone = user.StaffProfile?.Phone ?? user.ParentProfile?.Phone,
            Address = user.ParentProfile?.Address,
            EmployeeId = user.StaffProfile?.EmployeeId,
            SubjectSpecialization = user.StaffProfile?.SubjectSpecialization,
            CreatedAt = user.CreatedAt
        });
    }

    [HttpPut("password")]
    public async Task<IActionResult> ChangePassword([FromBody] ChangePasswordRequest request)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized();

        var user = await _context.Users.FindAsync(userId.Value);
        if (user == null) return NotFound(new { message = "User not found." });

        if (!_passwordService.VerifyPassword(user, user.PasswordHash, request.CurrentPassword))
        {
            return BadRequest(new { message = "Current password is incorrect." });
        }

        user.PasswordHash = _passwordService.HashPassword(user, request.NewPassword);
        await _context.SaveChangesAsync();

        return Ok(new { message = "Password updated successfully." });
    }

    [HttpPost("photo")]
    public async Task<ActionResult> UploadPhoto(IFormFile file)
    {
        var userId = GetCurrentUserId();
        if (!userId.HasValue) return Unauthorized();

        var user = await _context.Users
            .Include(u => u.StaffProfile)
            .Include(u => u.ParentProfile)
            .FirstOrDefaultAsync(u => u.Id == userId.Value);

        if (user == null) return NotFound(new { message = "User not found." });

        var instituteId = user.InstituteId ?? 0;

        // Delete old photo if existed
        if (!string.IsNullOrWhiteSpace(user.PhotoPath))
        {
            _fileStorage.DeleteProfilePhoto(instituteId, user.PhotoPath);
        }

        var fileName = await _fileStorage.SaveProfilePhotoAsync(instituteId, file);

        user.PhotoPath = fileName;
        if (user.StaffProfile != null) user.StaffProfile.PhotoPath = fileName;
        if (user.ParentProfile != null) user.ParentProfile.PhotoPath = fileName;

        await _context.SaveChangesAsync();

        return Ok(new { photoPath = fileName, message = "Profile photo uploaded successfully." });
    }

    [HttpGet("photo/{fileName}")]
    [AllowAnonymous] // Serve profile photos with tenant verification via query or path
    public IActionResult GetPhoto(string fileName, [FromQuery] int? instituteId)
    {
        var targetInstituteId = instituteId ?? _tenantService.InstituteId ?? 0;
        var photo = _fileStorage.GetProfilePhoto(targetInstituteId, fileName);
        if (photo == null) return NotFound();

        return File(photo.Value.Stream, photo.Value.ContentType);
    }

    private int? GetCurrentUserId()
    {
        var claim = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
        return int.TryParse(claim, out var id) ? id : null;
    }
}
