using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudentAttendance.Api.Data;
using StudentAttendance.Api.DTOs;
using StudentAttendance.Api.Models;

namespace StudentAttendance.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize(Roles = Roles.SuperAdmin)]
public class SuperAdminController : ControllerBase
{
    private readonly ApplicationDbContext _context;

    public SuperAdminController(ApplicationDbContext context)
    {
        _context = context;
    }

    [HttpGet("overview")]
    public async Task<ActionResult<PlatformOverviewDto>> GetPlatformOverview()
    {
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        // Platform-wide queries bypassing tenant filters
        var totalInstitutes = await _context.Institutes.IgnoreQueryFilters().CountAsync();
        var activeInstitutes = await _context.Institutes.IgnoreQueryFilters().CountAsync(i => i.IsActive);
        var inactiveInstitutes = totalInstitutes - activeInstitutes;

        var totalStaff = await _context.StaffMembers.IgnoreQueryFilters().CountAsync(s => s.IsActive);
        var totalStudents = await _context.Students.IgnoreQueryFilters().CountAsync(s => s.IsActive);
        var totalParents = await _context.Parents.IgnoreQueryFilters().CountAsync(p => p.IsActive);

        // Platform-wide attendance today
        var todayRecords = await _context.AttendanceRecords
            .IgnoreQueryFilters()
            .Where(a => a.Date == today && a.IsActive)
            .ToListAsync();

        int totalTodayAttendance = todayRecords.Count;
        double todayPct = 0.0;
        if (totalTodayAttendance > 0)
        {
            var present = todayRecords.Count(r => r.Status == AttendanceStatus.Present);
            var late = todayRecords.Count(r => r.Status == AttendanceStatus.Late);
            var onLeave = todayRecords.Count(r => r.Status == AttendanceStatus.OnLeave);
            todayPct = Math.Round((present + (late * 0.5) + onLeave) / (double)totalTodayAttendance * 100, 1);
        }

        // New registrations trend over past 14 days
        var fourteenDaysAgo = DateTime.UtcNow.Date.AddDays(-13);
        var recentUsers = await _context.Users
            .IgnoreQueryFilters()
            .Where(u => u.CreatedAt >= fourteenDaysAgo)
            .Select(u => u.CreatedAt.Date)
            .ToListAsync();

        var registrationTrends = new List<RegistrationTrendDto>();
        for (int i = 0; i < 14; i++)
        {
            var d = fourteenDaysAgo.AddDays(i);
            var count = recentUsers.Count(u => u == d);
            registrationTrends.Add(new RegistrationTrendDto
            {
                Date = d.ToString("yyyy-MM-dd"),
                Count = count
            });
        }

        // Recent Audit Logs
        var recentLogs = await _context.AuditLogs
            .IgnoreQueryFilters()
            .Include(a => a.Institute)
            .OrderByDescending(a => a.CreatedAt)
            .Take(10)
            .Select(a => new AuditLogItemDto
            {
                Id = a.Id,
                InstituteId = a.InstituteId,
                InstituteName = a.Institute != null ? a.Institute.Name : "Platform Wide",
                UserId = a.UserId,
                UserEmail = a.UserEmail,
                Action = a.Action,
                Details = a.Details,
                IpAddress = a.IpAddress,
                Timestamp = a.CreatedAt
            })
            .ToListAsync();

        await LogAuditAsync("ViewPlatformOverview", null, "Viewed platform-wide summary metrics.");

        return Ok(new PlatformOverviewDto
        {
            TotalInstitutes = totalInstitutes,
            ActiveInstitutes = activeInstitutes,
            InactiveInstitutes = inactiveInstitutes,
            TotalStaff = totalStaff,
            TotalStudents = totalStudents,
            TotalParents = totalParents,
            TodayAttendancePercent = todayPct,
            TotalAttendanceRecordedToday = totalTodayAttendance,
            RegistrationTrends = registrationTrends,
            RecentAuditLogs = recentLogs
        });
    }

    [HttpGet("institutes")]
    public async Task<ActionResult<List<SuperAdminInstituteItemDto>>> GetInstitutes(
        [FromQuery] string? search,
        [FromQuery] string? status)
    {
        var query = _context.Institutes.IgnoreQueryFilters().AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(i => i.Name.ToLower().Contains(term) || i.Code.ToLower().Contains(term) || i.City.ToLower().Contains(term));
        }

        if (!string.IsNullOrWhiteSpace(status) && status != "All")
        {
            bool isActive = status.Equals("Active", StringComparison.OrdinalIgnoreCase);
            query = query.Where(i => i.IsActive == isActive);
        }

        var institutes = await query.OrderByDescending(i => i.CreatedAt).ToListAsync();
        var today = DateOnly.FromDateTime(DateTime.UtcNow);

        var result = new List<SuperAdminInstituteItemDto>();

        foreach (var inst in institutes)
        {
            var staffCount = await _context.StaffMembers.IgnoreQueryFilters().CountAsync(s => s.InstituteId == inst.Id && s.IsActive);
            var studentCount = await _context.Students.IgnoreQueryFilters().CountAsync(s => s.InstituteId == inst.Id && s.IsActive);
            var classCount = await _context.Classes.IgnoreQueryFilters().CountAsync(c => c.InstituteId == inst.Id && c.IsActive);
            var parentCount = await _context.Parents.IgnoreQueryFilters().CountAsync(p => p.InstituteId == inst.Id && p.IsActive);

            var todayRecords = await _context.AttendanceRecords
                .IgnoreQueryFilters()
                .Where(a => a.InstituteId == inst.Id && a.Date == today && a.IsActive)
                .ToListAsync();

            double todayPct = 0.0;
            if (todayRecords.Count > 0)
            {
                var present = todayRecords.Count(r => r.Status == AttendanceStatus.Present);
                var late = todayRecords.Count(r => r.Status == AttendanceStatus.Late);
                var onLeave = todayRecords.Count(r => r.Status == AttendanceStatus.OnLeave);
                todayPct = Math.Round((present + (late * 0.5) + onLeave) / (double)todayRecords.Count * 100, 1);
            }

            result.Add(new SuperAdminInstituteItemDto
            {
                Id = inst.Id,
                Name = inst.Name,
                Code = inst.Code,
                City = inst.City,
                State = inst.State,
                ContactEmail = inst.ContactEmail,
                ContactPhone = inst.ContactPhone,
                LogoPath = inst.LogoPath,
                IsActive = inst.IsActive,
                CreatedAt = inst.CreatedAt,
                StaffCount = staffCount,
                StudentCount = studentCount,
                ClassCount = classCount,
                ParentCount = parentCount,
                TodayAttendancePercent = todayPct
            });
        }

        await LogAuditAsync("ListInstitutes", null, $"Retrieved institutes list (filter: search='{search}', status='{status}'). Total returned: {result.Count}");

        return Ok(result);
    }

    [HttpGet("institutes/{id}")]
    public async Task<ActionResult<SuperAdminInstituteDetailDto>> GetInstituteDetail(int id)
    {
        var inst = await _context.Institutes
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(i => i.Id == id);

        if (inst == null) return NotFound(new { message = "Institute not found." });

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var monthStart = new DateOnly(today.Year, today.Month, 1);
        var monthEnd = new DateOnly(today.Year, today.Month, DateTime.DaysInMonth(today.Year, today.Month));

        // Counts
        var staffCount = await _context.StaffMembers.IgnoreQueryFilters().CountAsync(s => s.InstituteId == id && s.IsActive);
        var studentCount = await _context.Students.IgnoreQueryFilters().CountAsync(s => s.InstituteId == id && s.IsActive);
        var classCount = await _context.Classes.IgnoreQueryFilters().CountAsync(c => c.InstituteId == id && c.IsActive);
        var parentCount = await _context.Parents.IgnoreQueryFilters().CountAsync(p => p.InstituteId == id && p.IsActive);

        // Today's attendance
        var todayRecords = await _context.AttendanceRecords
            .IgnoreQueryFilters()
            .Where(a => a.InstituteId == id && a.Date == today && a.IsActive)
            .ToListAsync();

        double todayPct = 0.0;
        if (todayRecords.Count > 0)
        {
            var p = todayRecords.Count(r => r.Status == AttendanceStatus.Present);
            var l = todayRecords.Count(r => r.Status == AttendanceStatus.Late);
            var lv = todayRecords.Count(r => r.Status == AttendanceStatus.OnLeave);
            todayPct = Math.Round((p + (l * 0.5) + lv) / (double)todayRecords.Count * 100, 1);
        }

        // Monthly attendance
        var monthRecords = await _context.AttendanceRecords
            .IgnoreQueryFilters()
            .Where(a => a.InstituteId == id && a.Date >= monthStart && a.Date <= monthEnd && a.IsActive)
            .ToListAsync();

        double monthPct = 0.0;
        if (monthRecords.Count > 0)
        {
            var p = monthRecords.Count(r => r.Status == AttendanceStatus.Present);
            var l = monthRecords.Count(r => r.Status == AttendanceStatus.Late);
            var lv = monthRecords.Count(r => r.Status == AttendanceStatus.OnLeave);
            monthPct = Math.Round((p + (l * 0.5) + lv) / (double)monthRecords.Count * 100, 1);
        }

        // Class Strength
        var classes = await _context.Classes
            .IgnoreQueryFilters()
            .Where(c => c.InstituteId == id && c.IsActive)
            .OrderBy(c => c.Name)
            .ToListAsync();

        var classStrengths = new List<ClassStrengthDto>();
        foreach (var c in classes)
        {
            var count = await _context.Students.IgnoreQueryFilters().CountAsync(s => s.ClassId == c.Id && s.IsActive);
            classStrengths.Add(new ClassStrengthDto
            {
                ClassId = c.Id,
                ClassName = c.Name,
                Sections = c.Sections,
                StudentCount = count
            });
        }

        // Staff List
        var staffList = await _context.StaffMembers
            .IgnoreQueryFilters()
            .Where(s => s.InstituteId == id)
            .OrderBy(s => s.FullName)
            .Select(s => new SuperAdminStaffItemDto
            {
                Id = s.Id,
                EmployeeId = s.EmployeeId,
                FullName = s.FullName,
                Email = s.Email,
                Phone = s.Phone,
                SubjectSpecialization = s.SubjectSpecialization,
                IsActive = s.IsActive
            })
            .ToListAsync();

        // Students List with individual attendance %
        var rawStudents = await _context.Students
            .IgnoreQueryFilters()
            .Include(s => s.Class)
            .Where(s => s.InstituteId == id)
            .OrderBy(s => s.RollNo)
            .ToListAsync();

        var studentList = new List<SuperAdminStudentItemDto>();
        foreach (var s in rawStudents)
        {
            var sRecords = await _context.AttendanceRecords
                .IgnoreQueryFilters()
                .Where(a => a.StudentId == s.Id && a.IsActive)
                .ToListAsync();

            double pct = 100.0;
            if (sRecords.Count > 0)
            {
                var p = sRecords.Count(r => r.Status == AttendanceStatus.Present);
                var l = sRecords.Count(r => r.Status == AttendanceStatus.Late);
                var lv = sRecords.Count(r => r.Status == AttendanceStatus.OnLeave);
                pct = Math.Round((p + (l * 0.5) + lv) / (double)sRecords.Count * 100, 1);
            }

            studentList.Add(new SuperAdminStudentItemDto
            {
                Id = s.Id,
                RollNo = s.RollNo,
                FullName = s.FullName,
                ClassName = s.Class.Name,
                Section = s.Section,
                ParentPhone = s.ParentPhone,
                Email = s.Email,
                IsActive = s.IsActive,
                AttendancePercentage = pct
            });
        }

        // Subjects List
        var subjects = await _context.Subjects
            .IgnoreQueryFilters()
            .Where(sb => sb.InstituteId == id && sb.IsActive)
            .OrderBy(sb => sb.Name)
            .Select(sb => new SuperAdminSubjectDto
            {
                Id = sb.Id,
                Name = sb.Name,
                Code = sb.Code,
                AssignedClassesCount = _context.ClassSubjects.IgnoreQueryFilters().Count(cs => cs.SubjectId == sb.Id && cs.IsActive)
            })
            .ToListAsync();

        // Timetable Summary
        var days = new[] { DayOfWeek.Monday, DayOfWeek.Tuesday, DayOfWeek.Wednesday, DayOfWeek.Thursday, DayOfWeek.Friday, DayOfWeek.Saturday };
        var timetableSlots = await _context.TimetableEntries
            .IgnoreQueryFilters()
            .Where(t => t.InstituteId == id && t.IsActive)
            .ToListAsync();

        var timetableSummary = new List<TimetableDaySummaryDto>();
        foreach (var day in days)
        {
            var daySlots = timetableSlots.Where(t => t.DayOfWeek == day).ToList();
            timetableSummary.Add(new TimetableDaySummaryDto
            {
                DayOfWeek = day.ToString(),
                TotalSlots = daySlots.Count,
                ActiveSubjects = daySlots.Select(t => t.SubjectId).Distinct().Count(),
                ActiveTeachers = daySlots.Select(t => t.StaffId).Distinct().Count()
            });
        }

        await LogAuditAsync("ViewInstituteDetails", id, $"Accessed complete drill-down for institute '{inst.Name}' (Code: {inst.Code}).");

        return Ok(new SuperAdminInstituteDetailDto
        {
            Id = inst.Id,
            Name = inst.Name,
            Code = inst.Code,
            Address = inst.Address,
            City = inst.City,
            State = inst.State,
            ContactEmail = inst.ContactEmail,
            ContactPhone = inst.ContactPhone,
            LogoPath = inst.LogoPath,
            IsActive = inst.IsActive,
            CreatedAt = inst.CreatedAt,
            StaffCount = staffCount,
            StudentCount = studentCount,
            ClassCount = classCount,
            ParentCount = parentCount,
            TodayAttendancePercent = todayPct,
            MonthAttendancePercent = monthPct,
            ClassStrength = classStrengths,
            StaffList = staffList,
            StudentList = studentList,
            Subjects = subjects,
            TimetableSummary = timetableSummary
        });
    }

    [HttpPut("institutes/{id}/status")]
    public async Task<ActionResult> ToggleInstituteStatus(int id, [FromBody] ToggleInstituteStatusRequest request)
    {
        var inst = await _context.Institutes.IgnoreQueryFilters().FirstOrDefaultAsync(i => i.Id == id);
        if (inst == null) return NotFound(new { message = "Institute not found." });

        inst.IsActive = request.IsActive;
        await _context.SaveChangesAsync();

        string actionDesc = request.IsActive ? "Activated" : "Deactivated / Disabled";
        await LogAuditAsync("ToggleInstituteStatus", id, $"{actionDesc} institute '{inst.Name}' (Code: {inst.Code}).");

        return Ok(new { message = $"Institute '{inst.Name}' has been successfully {actionDesc.ToLower()}." });
    }

    [HttpGet("students/{id}/attendance")]
    public async Task<ActionResult<SuperAdminStudentAttendanceHistoryDto>> GetStudentAttendanceHistory(int id)
    {
        var student = await _context.Students
            .IgnoreQueryFilters()
            .Include(s => s.Class)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (student == null) return NotFound(new { message = "Student not found." });

        var inst = await _context.Institutes
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(i => i.Id == student.InstituteId);

        var instName = inst?.Name ?? "Institute";

        var records = await _context.AttendanceRecords
            .IgnoreQueryFilters()
            .Include(a => a.Period)
            .Include(a => a.TimetableEntry)
                .ThenInclude(t => t.Subject)
            .Include(a => a.TimetableEntry)
                .ThenInclude(t => t.Staff)
            .Where(a => a.StudentId == id && a.IsActive)
            .OrderByDescending(a => a.Date)
            .ThenBy(a => a.Period.PeriodNumber)
            .ToListAsync();

        int total = records.Count;
        int present = records.Count(r => r.Status == AttendanceStatus.Present);
        int absent = records.Count(r => r.Status == AttendanceStatus.Absent);
        int late = records.Count(r => r.Status == AttendanceStatus.Late);
        int onLeave = records.Count(r => r.Status == AttendanceStatus.OnLeave);
        double pct = total > 0 ? Math.Round((present + (late * 0.5) + onLeave) / (double)total * 100, 1) : 100.0;

        var recordDtos = records.Select(r => new SuperAdminStudentAttendanceRecordDto
        {
            Date = r.Date.ToString("yyyy-MM-dd"),
            PeriodName = r.Period?.Name ?? $"Period {r.PeriodId}",
            TimeRange = r.Period != null ? $"{r.Period.StartTime:hh\\:mm} - {r.Period.EndTime:hh\\:mm}" : "",
            SubjectName = r.TimetableEntry?.Subject?.Name ?? "General",
            StaffName = r.TimetableEntry?.Staff?.FullName ?? "Instructor",
            Status = r.Status,
            Remarks = r.Remarks
        }).ToList();

        await LogAuditAsync("DrillDownStudentAttendance", student.InstituteId, $"Drilled down to full attendance history for student '{student.FullName}' (Roll: {student.RollNo}) in institute '{instName}'.");

        return Ok(new SuperAdminStudentAttendanceHistoryDto
        {
            StudentId = student.Id,
            FullName = student.FullName,
            RollNo = student.RollNo,
            ClassName = student.Class.Name,
            Section = student.Section,
            InstituteName = instName,
            TotalSessions = total,
            PresentSessions = present,
            AbsentSessions = absent,
            LateSessions = late,
            OnLeaveSessions = onLeave,
            AttendancePercentage = pct,
            Records = recordDtos
        });
    }

    [HttpGet("audit-logs")]
    public async Task<ActionResult<List<AuditLogItemDto>>> GetAuditLogs(
        [FromQuery] string? search,
        [FromQuery] int? instituteId)
    {
        var query = _context.AuditLogs
            .IgnoreQueryFilters()
            .Include(a => a.Institute)
            .AsQueryable();

        if (instituteId.HasValue)
        {
            query = query.Where(a => a.InstituteId == instituteId.Value);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(a =>
                a.Action.ToLower().Contains(term) ||
                a.UserEmail.ToLower().Contains(term) ||
                a.Details.ToLower().Contains(term));
        }

        var logs = await query
            .OrderByDescending(a => a.CreatedAt)
            .Take(100)
            .Select(a => new AuditLogItemDto
            {
                Id = a.Id,
                InstituteId = a.InstituteId,
                InstituteName = a.Institute != null ? a.Institute.Name : "Platform Wide",
                UserId = a.UserId,
                UserEmail = a.UserEmail,
                Action = a.Action,
                Details = a.Details,
                IpAddress = a.IpAddress,
                Timestamp = a.CreatedAt
            })
            .ToListAsync();

        return Ok(logs);
    }

    private async Task LogAuditAsync(string action, int? instituteId, string details)
    {
        try
        {
            var userIdStr = User.FindFirstValue(ClaimTypes.NameIdentifier);
            int userId = int.TryParse(userIdStr, out var parsedId) ? parsedId : 1;
            var userEmail = User.FindFirstValue(ClaimTypes.Email) ?? User.Identity?.Name ?? "superadmin@platform";
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
        catch
        {
            // Fail-safe: Audit logging should not crash business operations
        }
    }
}
