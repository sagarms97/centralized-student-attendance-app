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
public class DashboardController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;

    public DashboardController(ApplicationDbContext context, ICurrentTenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    [HttpGet("stats")]
    public async Task<ActionResult<DashboardStatsDto>> GetStats()
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Fetch today's attendance records
        var todayRecords = await _context.AttendanceRecords
            .Where(a => a.Date == today)
            .ToListAsync();

        var totalMarks = todayRecords.Count;
        var presentMarks = todayRecords.Count(a => a.Status == AttendanceStatus.Present);
        var lateMarks = todayRecords.Count(a => a.Status == AttendanceStatus.Late);
        var absentMarks = todayRecords.Count(a => a.Status == AttendanceStatus.Absent);

        var todayPercent = totalMarks > 0 ? Math.Round((presentMarks + (lateMarks * 0.5)) / totalMarks * 100, 1) : 0.0;

        var totalStudents = await _context.Students.CountAsync(s => s.IsActive);
        var totalStaff = await _context.StaffMembers.CountAsync(s => s.IsActive);
        var pendingSwaps = await _context.PeriodSwapRequests.CountAsync(r => r.Status == SwapStatus.Pending);

        return Ok(new DashboardStatsDto
        {
            TodayAttendancePercent = todayPercent,
            TotalPresentToday = presentMarks,
            TotalAbsentToday = absentMarks,
            TotalStudents = totalStudents,
            TotalStaff = totalStaff,
            PendingSwapsCount = pendingSwaps
        });
    }
}
