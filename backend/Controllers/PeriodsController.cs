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
public class PeriodsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;

    public PeriodsController(ApplicationDbContext context, ICurrentTenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    [HttpGet]
    public async Task<ActionResult<List<PeriodDto>>> GetAll()
    {
        var periods = await _context.Periods
            .OrderBy(p => p.PeriodNumber)
            .Select(p => new PeriodDto
            {
                Id = p.Id,
                PeriodNumber = p.PeriodNumber,
                Name = p.Name,
                StartTime = p.StartTime.ToString(@"hh\:mm"),
                EndTime = p.EndTime.ToString(@"hh\:mm"),
                IsActive = p.IsActive
            })
            .ToListAsync();

        return Ok(periods);
    }

    [HttpPost]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult<PeriodDto>> Create([FromBody] CreatePeriodRequest request)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        if (await _context.Periods.AnyAsync(p => p.PeriodNumber == request.PeriodNumber))
        {
            return BadRequest(new { message = $"Period number {request.PeriodNumber} already exists in your schedule." });
        }

        if (!TimeSpan.TryParse(request.StartTime, out var startTime) || !TimeSpan.TryParse(request.EndTime, out var endTime))
        {
            return BadRequest(new { message = "Invalid time format. Please provide time in HH:mm format." });
        }

        if (endTime <= startTime)
        {
            return BadRequest(new { message = "End time must be after start time." });
        }

        var period = new Period
        {
            PeriodNumber = request.PeriodNumber,
            Name = request.Name.Trim(),
            StartTime = startTime,
            EndTime = endTime
        };

        _context.Periods.Add(period);
        await _context.SaveChangesAsync();

        return Ok(new PeriodDto
        {
            Id = period.Id,
            PeriodNumber = period.PeriodNumber,
            Name = period.Name,
            StartTime = period.StartTime.ToString(@"hh\:mm"),
            EndTime = period.EndTime.ToString(@"hh\:mm"),
            IsActive = period.IsActive
        });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> Delete(int id)
    {
        var period = await _context.Periods.FindAsync(id);
        if (period == null) return NotFound(new { message = "Period not found." });

        period.IsActive = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }
}
