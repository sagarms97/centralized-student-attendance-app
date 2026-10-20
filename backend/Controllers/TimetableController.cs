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
public class TimetableController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;

    public TimetableController(ApplicationDbContext context, ICurrentTenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    [HttpGet("class")]
    public async Task<ActionResult<List<TimetableEntryDto>>> GetClassTimetable([FromQuery] int classId, [FromQuery] string section)
    {
        var sec = section.Trim().ToUpper();
        var entries = await _context.TimetableEntries
            .Include(t => t.Class)
            .Include(t => t.Period)
            .Include(t => t.Subject)
            .Include(t => t.Staff)
            .Where(t => t.ClassId == classId && t.Section.ToUpper() == sec)
            .OrderBy(t => t.DayOfWeek)
            .ThenBy(t => t.Period.PeriodNumber)
            .Select(t => new TimetableEntryDto
            {
                Id = t.Id,
                ClassId = t.ClassId,
                ClassName = t.Class.Name,
                Section = t.Section,
                DayOfWeek = (int)t.DayOfWeek,
                DayName = t.DayOfWeek.ToString(),
                PeriodId = t.PeriodId,
                PeriodNumber = t.Period.PeriodNumber,
                PeriodName = t.Period.Name,
                TimeRange = $"{t.Period.StartTime:hh\\:mm} - {t.Period.EndTime:hh\\:mm}",
                SubjectId = t.SubjectId,
                SubjectName = t.Subject.Name,
                SubjectCode = t.Subject.Code,
                StaffId = t.StaffId,
                StaffName = t.Staff.FullName,
                StaffEmployeeId = t.Staff.EmployeeId
            })
            .ToListAsync();

        return Ok(entries);
    }

    [HttpGet("staff/{staffId}")]
    public async Task<ActionResult<List<TimetableEntryDto>>> GetStaffTimetable(int staffId)
    {
        var entries = await _context.TimetableEntries
            .Include(t => t.Class)
            .Include(t => t.Period)
            .Include(t => t.Subject)
            .Include(t => t.Staff)
            .Where(t => t.StaffId == staffId)
            .OrderBy(t => t.DayOfWeek)
            .ThenBy(t => t.Period.PeriodNumber)
            .Select(t => new TimetableEntryDto
            {
                Id = t.Id,
                ClassId = t.ClassId,
                ClassName = t.Class.Name,
                Section = t.Section,
                DayOfWeek = (int)t.DayOfWeek,
                DayName = t.DayOfWeek.ToString(),
                PeriodId = t.PeriodId,
                PeriodNumber = t.Period.PeriodNumber,
                PeriodName = t.Period.Name,
                TimeRange = $"{t.Period.StartTime:hh\\:mm} - {t.Period.EndTime:hh\\:mm}",
                SubjectId = t.SubjectId,
                SubjectName = t.Subject.Name,
                SubjectCode = t.Subject.Code,
                StaffId = t.StaffId,
                StaffName = t.Staff.FullName,
                StaffEmployeeId = t.Staff.EmployeeId
            })
            .ToListAsync();

        return Ok(entries);
    }

    [HttpPost]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult<TimetableEntryDto>> CreateEntry([FromBody] CreateTimetableEntryRequest request)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        var day = (DayOfWeek)(request.DayOfWeek % 7); // convert 1=Monday...7=Sunday
        var section = request.Section.Trim().ToUpperInvariant();

        // 1. Double booking check: Staff clash
        var staffClash = await _context.TimetableEntries
            .Include(t => t.Class)
            .Include(t => t.Period)
            .Include(t => t.Staff)
            .FirstOrDefaultAsync(t =>
                t.DayOfWeek == day &&
                t.PeriodId == request.PeriodId &&
                t.StaffId == request.StaffId);

        if (staffClash != null)
        {
            return Conflict(new
            {
                message = $"Staff Double-Booking Conflict: {staffClash.Staff.FullName} is already booked for {staffClash.Class.Name} Section {staffClash.Section} during {staffClash.Period.Name} on {day}."
            });
        }

        // 2. Double booking check: Class & Section clash
        var classClash = await _context.TimetableEntries
            .Include(t => t.Class)
            .Include(t => t.Period)
            .Include(t => t.Subject)
            .FirstOrDefaultAsync(t =>
                t.DayOfWeek == day &&
                t.PeriodId == request.PeriodId &&
                t.ClassId == request.ClassId &&
                t.Section.ToUpper() == section);

        if (classClash != null)
        {
            return Conflict(new
            {
                message = $"Class Slot Conflict: {classClash.Class.Name} Section {section} already has {classClash.Subject.Name} scheduled during {classClash.Period.Name} on {day}."
            });
        }

        // 3. Verify subject is assigned to this class
        var hasClassSubjects = await _context.ClassSubjects.AnyAsync(cs => cs.ClassId == request.ClassId);
        if (hasClassSubjects)
        {
            var isSubjectAssigned = await _context.ClassSubjects.AnyAsync(cs => cs.ClassId == request.ClassId && cs.SubjectId == request.SubjectId);
            if (!isSubjectAssigned)
            {
                return BadRequest(new { message = "The selected subject is not assigned to this class. Please assign the subject to the class in the Subjects tab first." });
            }
        }

        var entry = new TimetableEntry
        {
            InstituteId = tenantId.Value,
            ClassId = request.ClassId,
            Section = section,
            DayOfWeek = day,
            PeriodId = request.PeriodId,
            SubjectId = request.SubjectId,
            StaffId = request.StaffId,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.TimetableEntries.Add(entry);
        await _context.SaveChangesAsync();

        // Reload with navigation properties
        await _context.Entry(entry).Reference(e => e.Class).LoadAsync();
        await _context.Entry(entry).Reference(e => e.Period).LoadAsync();
        await _context.Entry(entry).Reference(e => e.Subject).LoadAsync();
        await _context.Entry(entry).Reference(e => e.Staff).LoadAsync();

        return Ok(new TimetableEntryDto
        {
            Id = entry.Id,
            ClassId = entry.ClassId,
            ClassName = entry.Class.Name,
            Section = entry.Section,
            DayOfWeek = (int)entry.DayOfWeek,
            DayName = entry.DayOfWeek.ToString(),
            PeriodId = entry.PeriodId,
            PeriodNumber = entry.Period.PeriodNumber,
            PeriodName = entry.Period.Name,
            TimeRange = $"{entry.Period.StartTime:hh\\:mm} - {entry.Period.EndTime:hh\\:mm}",
            SubjectId = entry.SubjectId,
            SubjectName = entry.Subject.Name,
            SubjectCode = entry.Subject.Code,
            StaffId = entry.StaffId,
            StaffName = entry.Staff.FullName,
            StaffEmployeeId = entry.Staff.EmployeeId
        });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> DeleteEntry(int id)
    {
        var entry = await _context.TimetableEntries.FindAsync(id);
        if (entry == null) return NotFound(new { message = "Timetable slot not found." });

        _context.TimetableEntries.Remove(entry); // Hard delete slot or soft delete
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
