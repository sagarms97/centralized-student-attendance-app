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
public class AttendanceController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;

    public AttendanceController(ApplicationDbContext context, ICurrentTenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    [HttpGet("my-schedule")]
    public async Task<ActionResult<List<StaffDailyScheduleItemDto>>> GetMySchedule([FromQuery] string? date)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        DateOnly targetDate;
        if (string.IsNullOrWhiteSpace(date) || !DateOnly.TryParse(date, out targetDate))
        {
            targetDate = DateOnly.FromDateTime(DateTime.UtcNow);
        }

        var dayOfWeek = targetDate.DayOfWeek;
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var userRole = User.FindFirstValue(ClaimTypes.Role);
        var currentStaff = await _context.StaffMembers.FirstOrDefaultAsync(s => s.UserId == userId);

        // Fetch regular timetable slots for today
        var timetableQuery = _context.TimetableEntries
            .Include(t => t.Class)
            .Include(t => t.Period)
            .Include(t => t.Subject)
            .Include(t => t.Staff)
            .Where(t => t.DayOfWeek == dayOfWeek);

        // If user is staff, filter by their staffId or where they are an approved substitute
        List<TimetableEntry> entries;
        if (userRole != Roles.InstituteAdmin && userRole != Roles.SuperAdmin)
        {
            if (currentStaff == null) return Ok(new List<StaffDailyScheduleItemDto>());

            // Approved swaps where currentStaff is substitute
            var substitutedEntryIds = await _context.PeriodSwapRequests
                .Where(r => r.TargetStaffId == currentStaff.Id && r.SwapDate == targetDate && r.Status == SwapStatus.Approved)
                .Select(r => r.TimetableEntryId)
                .ToListAsync();

            entries = await timetableQuery
                .Where(t => t.StaffId == currentStaff.Id || substitutedEntryIds.Contains(t.Id))
                .OrderBy(t => t.Period.PeriodNumber)
                .ToListAsync();
        }
        else
        {
            // Admin sees all slots for today
            entries = await timetableQuery
                .OrderBy(t => t.Period.PeriodNumber)
                .ToListAsync();
        }

        // Fetch all approved swaps for today
        var approvedSwapsToday = await _context.PeriodSwapRequests
            .Include(r => r.RequesterStaff)
            .Include(r => r.TargetStaff)
            .Where(r => r.SwapDate == targetDate && r.Status == SwapStatus.Approved)
            .ToListAsync();

        var swapDict = approvedSwapsToday.ToDictionary(s => s.TimetableEntryId, s => s);

        // Fetch attendance records already submitted for today
        var periodIds = entries.Select(e => e.PeriodId).Distinct().ToList();
        var existingAttendance = await _context.AttendanceRecords
            .Where(a => a.Date == targetDate && periodIds.Contains(a.PeriodId))
            .ToListAsync();

        var schedule = new List<StaffDailyScheduleItemDto>();

        foreach (var entry in entries)
        {
            var isHandedOver = false;
            var isSubstituted = false;
            string? substituteName = null;

            if (swapDict.TryGetValue(entry.Id, out var swap))
            {
                if (currentStaff != null && entry.StaffId == currentStaff.Id && swap.TargetStaffId != currentStaff.Id)
                {
                    isHandedOver = true;
                    substituteName = swap.TargetStaff.FullName;
                }
                else if (currentStaff != null && swap.TargetStaffId == currentStaff.Id)
                {
                    isSubstituted = true;
                    substituteName = swap.RequesterStaff.FullName;
                }
            }

            var attRecords = existingAttendance
                .Where(a => a.TimetableEntryId == entry.Id && a.PeriodId == entry.PeriodId)
                .ToList();

            var totalStudents = await _context.Students
                .CountAsync(s => s.ClassId == entry.ClassId && s.Section == entry.Section && s.IsActive);

            schedule.Add(new StaffDailyScheduleItemDto
            {
                TimetableEntryId = entry.Id,
                PeriodId = entry.PeriodId,
                PeriodNumber = entry.Period.PeriodNumber,
                PeriodName = entry.Period.Name,
                TimeRange = $"{entry.Period.StartTime:hh\\:mm} - {entry.Period.EndTime:hh\\:mm}",
                ClassId = entry.ClassId,
                ClassName = entry.Class.Name,
                Section = entry.Section,
                SubjectId = entry.SubjectId,
                SubjectName = entry.Subject.Name,
                IsSubstitutedForMe = isSubstituted,
                IsHandedOverToOther = isHandedOver,
                SubstituteStaffName = substituteName,
                IsAttendanceMarked = attRecords.Count > 0,
                PresentCount = attRecords.Count(a => a.Status == AttendanceStatus.Present),
                AbsentCount = attRecords.Count(a => a.Status == AttendanceStatus.Absent),
                LateCount = attRecords.Count(a => a.Status == AttendanceStatus.Late),
                TotalStudents = totalStudents
            });
        }

        return Ok(schedule);
    }

    [HttpGet("sheet")]
    public async Task<ActionResult<AttendanceSheetDto>> GetAttendanceSheet([FromQuery] int timetableEntryId, [FromQuery] string date)
    {
        if (!DateOnly.TryParse(date, out var targetDate))
        {
            return BadRequest(new { message = "Invalid date format. Use yyyy-MM-dd." });
        }

        var entry = await _context.TimetableEntries
            .Include(t => t.Class)
            .Include(t => t.Period)
            .Include(t => t.Subject)
            .Include(t => t.Staff)
            .FirstOrDefaultAsync(t => t.Id == timetableEntryId);

        if (entry == null) return NotFound(new { message = "Timetable slot not found." });

        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var userRole = User.FindFirstValue(ClaimTypes.Role);
        var staff = await _context.StaffMembers.FirstOrDefaultAsync(s => s.UserId == userId);

        // Same-day edit rule: staff can edit only within the same day
        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        bool isToday = targetDate == today;
        bool isAdmin = userRole == Roles.InstituteAdmin || userRole == Roles.SuperAdmin;

        // Check substitution
        var swap = await _context.PeriodSwapRequests
            .FirstOrDefaultAsync(r => r.TimetableEntryId == entry.Id && r.SwapDate == targetDate && r.Status == SwapStatus.Approved);

        int effectiveStaffId = swap?.TargetStaffId ?? entry.StaffId;
        bool isAssignedTeacher = staff != null && staff.Id == effectiveStaffId;

        bool isEditable = isAdmin || (isAssignedTeacher && isToday);

        // Get all active students for this class & section
        var students = await _context.Students
            .Where(s => s.ClassId == entry.ClassId && s.Section == entry.Section && s.IsActive)
            .OrderBy(s => s.RollNo)
            .ToListAsync();

        // Get existing attendance records if any
        var existingRecords = await _context.AttendanceRecords
            .Where(a => a.Date == targetDate && a.PeriodId == entry.PeriodId && a.TimetableEntryId == entry.Id)
            .ToDictionaryAsync(a => a.StudentId, a => a);

        var studentAttendanceList = students.Select(s =>
        {
            if (existingRecords.TryGetValue(s.Id, out var record))
            {
                return new StudentAttendanceItemDto
                {
                    StudentId = s.Id,
                    RollNo = s.RollNo,
                    FullName = s.FullName,
                    Status = record.Status,
                    Remarks = record.Remarks
                };
            }

            // Default all students to "Present"
            return new StudentAttendanceItemDto
            {
                StudentId = s.Id,
                RollNo = s.RollNo,
                FullName = s.FullName,
                Status = AttendanceStatus.Present,
                Remarks = null
            };
        }).ToList();

        return Ok(new AttendanceSheetDto
        {
            TimetableEntryId = entry.Id,
            PeriodId = entry.PeriodId,
            PeriodName = entry.Period.Name,
            ClassId = entry.ClassId,
            ClassName = entry.Class.Name,
            Section = entry.Section,
            SubjectName = entry.Subject.Name,
            Date = targetDate.ToString("yyyy-MM-dd"),
            IsEditable = isEditable,
            IsAlreadyMarked = existingRecords.Count > 0,
            Students = studentAttendanceList
        });
    }

    [HttpPost("submit")]
    public async Task<ActionResult> SubmitAttendance([FromBody] SubmitAttendanceRequest request)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        if (!DateOnly.TryParse(request.Date, out var targetDate))
        {
            return BadRequest(new { message = "Invalid date format. Use yyyy-MM-dd." });
        }

        var entry = await _context.TimetableEntries.FindAsync(request.TimetableEntryId);
        if (entry == null) return NotFound(new { message = "Timetable entry not found." });

        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var userRole = User.FindFirstValue(ClaimTypes.Role);
        var staff = await _context.StaffMembers.FirstOrDefaultAsync(s => s.UserId == userId);

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        bool isAdmin = userRole == Roles.InstituteAdmin || userRole == Roles.SuperAdmin;

        // Same day edit rule
        if (!isAdmin && targetDate != today)
        {
            return BadRequest(new { message = "Attendance can only be submitted or updated on the same day." });
        }

        // Verify substitution / ownership
        var swap = await _context.PeriodSwapRequests
            .FirstOrDefaultAsync(r => r.TimetableEntryId == entry.Id && r.SwapDate == targetDate && r.Status == SwapStatus.Approved);

        int effectiveStaffId = swap?.TargetStaffId ?? entry.StaffId;
        if (!isAdmin && (staff == null || staff.Id != effectiveStaffId))
        {
            return Forbid();
        }

        // Load existing attendance records for this slot & date
        var existingRecords = await _context.AttendanceRecords
            .Where(a => a.Date == targetDate && a.PeriodId == request.PeriodId && a.TimetableEntryId == entry.Id)
            .ToListAsync();

        var existingDict = existingRecords.ToDictionary(a => a.StudentId, a => a);
        var newRecords = new List<AttendanceRecord>();

        foreach (var rec in request.Records)
        {
            var status = rec.Status switch
            {
                "Absent" => AttendanceStatus.Absent,
                "Late" => AttendanceStatus.Late,
                _ => AttendanceStatus.Present
            };

            if (existingDict.TryGetValue(rec.StudentId, out var existing))
            {
                // Update existing record
                existing.Status = status;
                existing.Remarks = rec.Remarks;
                existing.MarkedByUserId = userId;
                existing.MarkedAt = DateTime.UtcNow;
            }
            else
            {
                // Add new record
                newRecords.Add(new AttendanceRecord
                {
                    InstituteId = tenantId.Value,
                    Date = targetDate,
                    PeriodId = request.PeriodId,
                    TimetableEntryId = entry.Id,
                    StudentId = rec.StudentId,
                    Status = status,
                    Remarks = rec.Remarks,
                    MarkedByUserId = userId,
                    MarkedAt = DateTime.UtcNow,
                    IsActive = true
                });
            }
        }

        if (newRecords.Count > 0)
        {
            await _context.AttendanceRecords.AddRangeAsync(newRecords);
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Attendance submitted successfully.",
            updatedCount = existingRecords.Count,
            insertedCount = newRecords.Count
        });
    }
}
