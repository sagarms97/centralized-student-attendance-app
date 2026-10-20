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
[Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
public class ApprovalsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly INotificationService _notificationService;
    private readonly ICurrentTenantService _tenantService;

    public ApprovalsController(
        ApplicationDbContext context,
        INotificationService notificationService,
        ICurrentTenantService tenantService)
    {
        _context = context;
        _notificationService = notificationService;
        _tenantService = tenantService;
    }

    [HttpGet("pending")]
    public async Task<ActionResult<List<PendingApprovalUserDto>>> GetPendingApprovals()
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        var pendingUsers = await _context.Users
            .IgnoreQueryFilters()
            .Include(u => u.StaffProfile)
            .Include(u => u.ParentProfile)
                .ThenInclude(p => p!.ChildrenLinks)
                    .ThenInclude(cl => cl.Student)
            .Where(u => u.InstituteId == tenantId.Value && u.AccountStatus == AccountStatuses.PendingApproval)
            .OrderByDescending(u => u.CreatedAt)
            .ToListAsync();

        var result = pendingUsers.Select(u => new PendingApprovalUserDto
        {
            UserId = u.Id,
            FullName = u.FullName,
            Email = u.Email,
            Phone = u.StaffProfile?.Phone ?? u.ParentProfile?.Phone ?? "",
            Role = u.Role,
            AccountStatus = u.AccountStatus,
            EmployeeId = u.StaffProfile?.EmployeeId,
            SubjectSpecialization = u.StaffProfile?.SubjectSpecialization,
            Address = u.ParentProfile?.Address,
            LinkedStudentsCount = u.ParentProfile?.ChildrenLinks.Count ?? 0,
            LinkedStudents = u.ParentProfile?.ChildrenLinks
                .Select(cl => $"{cl.Student.FullName} ({cl.Relationship})")
                .ToList() ?? new List<string>(),
            CreatedAt = u.CreatedAt
        }).ToList();

        return Ok(result);
    }

    [HttpGet("count")]
    public async Task<ActionResult<int>> GetPendingCount()
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return 0;

        var count = await _context.Users
            .IgnoreQueryFilters()
            .CountAsync(u => u.InstituteId == tenantId.Value && u.AccountStatus == AccountStatuses.PendingApproval);

        return Ok(count);
    }

    [HttpPost("{userId}/approve")]
    public async Task<IActionResult> ApproveUser(int userId)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        var user = await _context.Users
            .IgnoreQueryFilters()
            .Include(u => u.Institute)
            .Include(u => u.StaffProfile)
            .Include(u => u.ParentProfile)
            .FirstOrDefaultAsync(u => u.Id == userId && u.InstituteId == tenantId.Value);

        if (user == null) return NotFound(new { message = "User not found." });

        user.AccountStatus = AccountStatuses.Active;
        user.IsActive = true;
        user.RejectionReason = null;

        if (user.StaffProfile != null)
        {
            user.StaffProfile.IsActive = true;
        }

        if (user.ParentProfile != null)
        {
            user.ParentProfile.IsActive = true;
        }

        await _context.SaveChangesAsync();

        var instituteName = user.Institute?.Name ?? "Your Institute";
        var phone = user.StaffProfile?.Phone ?? user.ParentProfile?.Phone ?? "";

        await _notificationService.SendApprovalStatusAsync(
            user.Email,
            phone,
            user.FullName,
            isApproved: true,
            instituteName: instituteName
        );

        return Ok(new { message = $"Account for {user.FullName} approved successfully." });
    }

    [HttpPost("{userId}/reject")]
    public async Task<IActionResult> RejectUser(int userId, [FromBody] RejectApprovalRequest request)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        var user = await _context.Users
            .IgnoreQueryFilters()
            .Include(u => u.Institute)
            .Include(u => u.StaffProfile)
            .Include(u => u.ParentProfile)
            .FirstOrDefaultAsync(u => u.Id == userId && u.InstituteId == tenantId.Value);

        if (user == null) return NotFound(new { message = "User not found." });

        user.AccountStatus = AccountStatuses.Rejected;
        user.RejectionReason = request.Reason.Trim();
        user.IsActive = false;

        if (user.StaffProfile != null) user.StaffProfile.IsActive = false;
        if (user.ParentProfile != null) user.ParentProfile.IsActive = false;

        await _context.SaveChangesAsync();

        var instituteName = user.Institute?.Name ?? "Your Institute";
        var phone = user.StaffProfile?.Phone ?? user.ParentProfile?.Phone ?? "";

        await _notificationService.SendApprovalStatusAsync(
            user.Email,
            phone,
            user.FullName,
            isApproved: false,
            instituteName: instituteName,
            rejectionReason: request.Reason.Trim()
        );

        return Ok(new { message = $"Registration for {user.FullName} rejected." });
    }
}
