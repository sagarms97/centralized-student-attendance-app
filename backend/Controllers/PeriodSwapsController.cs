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
[Route("api/period-swaps")]
[Authorize]
public class PeriodSwapsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;

    public PeriodSwapsController(ApplicationDbContext context, ICurrentTenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    [HttpGet("my-requests")]
    public async Task<ActionResult<List<PeriodSwapRequestDto>>> GetMyRequests()
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var userRole = User.FindFirstValue(ClaimTypes.Role);
        var staff = await _context.StaffMembers.FirstOrDefaultAsync(s => s.UserId == userId);

        var query = _context.PeriodSwapRequests
            .Include(r => r.TimetableEntry)
                .ThenInclude(t => t.Class)
            .Include(r => r.TimetableEntry)
                .ThenInclude(t => t.Period)
            .Include(r => r.TimetableEntry)
                .ThenInclude(t => t.Subject)
            .Include(r => r.RequesterStaff)
            .Include(r => r.TargetStaff)
            .AsQueryable();

        // Admin sees all swaps; Staff sees their incoming or outgoing requests
        if (userRole != Roles.InstituteAdmin && userRole != Roles.SuperAdmin)
        {
            if (staff == null) return Ok(new List<PeriodSwapRequestDto>());
            query = query.Where(r => r.RequesterStaffId == staff.Id || r.TargetStaffId == staff.Id);
        }

        var list = await query
            .OrderByDescending(r => r.CreatedAt)
            .Select(r => new PeriodSwapRequestDto
            {
                Id = r.Id,
                TimetableEntryId = r.TimetableEntryId,
                ClassName = r.TimetableEntry.Class.Name,
                Section = r.TimetableEntry.Section,
                PeriodName = r.TimetableEntry.Period.Name,
                TimeRange = $"{r.TimetableEntry.Period.StartTime:hh\\:mm} - {r.TimetableEntry.Period.EndTime:hh\\:mm}",
                SubjectName = r.TimetableEntry.Subject.Name,
                SwapDate = r.SwapDate.ToString("yyyy-MM-dd"),
                RequesterStaffId = r.RequesterStaffId,
                RequesterStaffName = r.RequesterStaff.FullName,
                TargetStaffId = r.TargetStaffId,
                TargetStaffName = r.TargetStaff.FullName,
                Reason = r.Reason,
                Status = r.Status,
                CreatedAt = r.CreatedAt,
                CanRespond = r.Status == SwapStatus.Pending &&
                             (userRole == Roles.InstituteAdmin || (staff != null && r.TargetStaffId == staff.Id))
            })
            .ToListAsync();

        return Ok(list);
    }

    [HttpPost("request")]
    public async Task<ActionResult<PeriodSwapRequestDto>> CreateRequest([FromBody] CreateSwapRequest request)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        if (!DateOnly.TryParse(request.SwapDate, out var swapDate))
        {
            return BadRequest(new { message = "Invalid swap date format. Use yyyy-MM-dd." });
        }

        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var staff = await _context.StaffMembers.FirstOrDefaultAsync(s => s.UserId == userId);
        if (staff == null)
        {
            return Forbid();
        }

        var timetableEntry = await _context.TimetableEntries
            .Include(t => t.Class)
            .Include(t => t.Period)
            .Include(t => t.Subject)
            .FirstOrDefaultAsync(t => t.Id == request.TimetableEntryId);

        if (timetableEntry == null)
        {
            return NotFound(new { message = "Timetable entry not found." });
        }

        if (timetableEntry.StaffId != staff.Id)
        {
            return BadRequest(new { message = "You can only request swaps for your own scheduled periods." });
        }

        if (request.TargetStaffId == staff.Id)
        {
            return BadRequest(new { message = "Target staff member must be different from yourself." });
        }

        var targetStaff = await _context.StaffMembers.FindAsync(request.TargetStaffId);
        if (targetStaff == null || !targetStaff.IsActive)
        {
            return BadRequest(new { message = "Target substitute staff member not found or is inactive." });
        }

        // Check if there is already an active swap request for this slot and date
        var existingRequest = await _context.PeriodSwapRequests
            .AnyAsync(r => r.TimetableEntryId == timetableEntry.Id && r.SwapDate == swapDate && r.Status == SwapStatus.Pending);

        if (existingRequest)
        {
            return BadRequest(new { message = "A pending swap request already exists for this slot and date." });
        }

        var swap = new PeriodSwapRequest
        {
            InstituteId = tenantId.Value,
            TimetableEntryId = timetableEntry.Id,
            RequesterStaffId = staff.Id,
            TargetStaffId = request.TargetStaffId,
            SwapDate = swapDate,
            Reason = request.Reason?.Trim(),
            Status = SwapStatus.Pending,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.PeriodSwapRequests.Add(swap);
        await _context.SaveChangesAsync();

        return Ok(new PeriodSwapRequestDto
        {
            Id = swap.Id,
            TimetableEntryId = timetableEntry.Id,
            ClassName = timetableEntry.Class.Name,
            Section = timetableEntry.Section,
            PeriodName = timetableEntry.Period.Name,
            TimeRange = $"{timetableEntry.Period.StartTime:hh\\:mm} - {timetableEntry.Period.EndTime:hh\\:mm}",
            SubjectName = timetableEntry.Subject.Name,
            SwapDate = swapDate.ToString("yyyy-MM-dd"),
            RequesterStaffId = staff.Id,
            RequesterStaffName = staff.FullName,
            TargetStaffId = targetStaff.Id,
            TargetStaffName = targetStaff.FullName,
            Reason = swap.Reason,
            Status = swap.Status,
            CreatedAt = swap.CreatedAt,
            CanRespond = false
        });
    }

    [HttpPut("{id}/respond")]
    public async Task<ActionResult> Respond(int id, [FromBody] RespondSwapRequest request)
    {
        var swap = await _context.PeriodSwapRequests
            .Include(r => r.TargetStaff)
            .Include(r => r.RequesterStaff)
            .FirstOrDefaultAsync(r => r.Id == id);

        if (swap == null) return NotFound(new { message = "Swap request not found." });

        if (swap.Status != SwapStatus.Pending)
        {
            return BadRequest(new { message = $"Swap request is already {swap.Status}." });
        }

        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var userRole = User.FindFirstValue(ClaimTypes.Role);
        var staff = await _context.StaffMembers.FirstOrDefaultAsync(s => s.UserId == userId);

        bool isTargetStaff = staff != null && staff.Id == swap.TargetStaffId;
        bool isAdmin = userRole == Roles.InstituteAdmin || userRole == Roles.SuperAdmin;

        if (!isTargetStaff && !isAdmin)
        {
            return Forbid();
        }

        var newStatus = request.Status.Trim().ToLowerInvariant() == "approved" ? SwapStatus.Approved : SwapStatus.Rejected;

        swap.Status = newStatus;
        swap.ReviewedByUserId = userId;
        swap.ReviewedAt = DateTime.UtcNow;

        await _context.SaveChangesAsync();

        return Ok(new { message = $"Period swap request has been {newStatus.ToLower()}." });
    }
}
