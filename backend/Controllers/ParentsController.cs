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
public class ParentsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly IPasswordService _passwordService;

    public ParentsController(
        ApplicationDbContext context,
        ICurrentTenantService tenantService,
        IPasswordService passwordService)
    {
        _context = context;
        _tenantService = tenantService;
        _passwordService = passwordService;
    }

    [HttpGet]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin},{Roles.Staff}")]
    public async Task<ActionResult<List<ParentDto>>> GetAll([FromQuery] string? search)
    {
        var query = _context.Parents
            .Include(p => p.ChildrenLinks)
                .ThenInclude(cl => cl.Student)
                    .ThenInclude(s => s.Class)
            .AsQueryable();

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(p =>
                p.FullName.ToLower().Contains(term) ||
                p.Email.ToLower().Contains(term) ||
                p.Phone.Contains(term));
        }

        var parents = await query
            .OrderBy(p => p.FullName)
            .Select(p => new ParentDto
            {
                Id = p.Id,
                UserId = p.UserId,
                FullName = p.FullName,
                Email = p.Email,
                Phone = p.Phone,
                Address = p.Address,
                PhotoPath = p.PhotoPath,
                IsActive = p.IsActive,
                CreatedAt = p.CreatedAt,
                LinkedStudents = p.ChildrenLinks
                    .Where(cl => cl.IsActive && cl.Student.IsActive)
                    .Select(cl => new LinkedStudentDto
                    {
                        StudentId = cl.StudentId,
                        RollNo = cl.Student.RollNo,
                        FullName = cl.Student.FullName,
                        ClassName = cl.Student.Class.Name,
                        Section = cl.Student.Section,
                        Relationship = cl.Relationship
                    }).ToList()
            })
            .ToListAsync();

        return Ok(parents);
    }

    [HttpGet("{id}")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin},{Roles.Staff}")]
    public async Task<ActionResult<ParentDto>> GetById(int id)
    {
        var parent = await _context.Parents
            .Include(p => p.ChildrenLinks)
                .ThenInclude(cl => cl.Student)
                    .ThenInclude(s => s.Class)
            .Where(p => p.Id == id)
            .Select(p => new ParentDto
            {
                Id = p.Id,
                UserId = p.UserId,
                FullName = p.FullName,
                Email = p.Email,
                Phone = p.Phone,
                Address = p.Address,
                PhotoPath = p.PhotoPath,
                IsActive = p.IsActive,
                CreatedAt = p.CreatedAt,
                LinkedStudents = p.ChildrenLinks
                    .Where(cl => cl.IsActive && cl.Student.IsActive)
                    .Select(cl => new LinkedStudentDto
                    {
                        StudentId = cl.StudentId,
                        RollNo = cl.Student.RollNo,
                        FullName = cl.Student.FullName,
                        ClassName = cl.Student.Class.Name,
                        Section = cl.Student.Section,
                        Relationship = cl.Relationship
                    }).ToList()
            })
            .FirstOrDefaultAsync();

        if (parent == null) return NotFound(new { message = "Parent record not found." });
        return Ok(parent);
    }

    [HttpPost]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult<ParentDto>> Create([FromBody] CreateParentRequest request)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        var email = request.Email.Trim().ToLowerInvariant();

        if (await _context.Users.AnyAsync(u => u.Email.ToLower() == email))
        {
            return BadRequest(new { message = $"A user with email '{email}' already exists in the system." });
        }

        // 1. Create User account with Role = Parent
        var user = new User
        {
            InstituteId = tenantId.Value,
            Email = email,
            FullName = request.FullName.Trim(),
            Role = Roles.Parent,
            AccountStatus = AccountStatuses.Active,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        user.PasswordHash = _passwordService.HashPassword(user, request.InitialPassword);
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        // 2. Create Parent profile
        var parent = new Parent
        {
            InstituteId = tenantId.Value,
            UserId = user.Id,
            FullName = request.FullName.Trim(),
            Email = email,
            Phone = request.Phone.Trim(),
            Address = request.Address?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        _context.Parents.Add(parent);
        await _context.SaveChangesAsync();

        // 3. Link initial students if provided
        if (request.LinkedStudents != null && request.LinkedStudents.Count > 0)
        {
            foreach (var link in request.LinkedStudents)
            {
                var studentExists = await _context.Students.AnyAsync(s => s.Id == link.StudentId);
                if (studentExists)
                {
                    _context.ParentStudents.Add(new ParentStudent
                    {
                        InstituteId = tenantId.Value,
                        ParentId = parent.Id,
                        StudentId = link.StudentId,
                        Relationship = string.IsNullOrWhiteSpace(link.Relationship) ? "Parent" : link.Relationship.Trim(),
                        IsActive = true,
                        CreatedAt = DateTime.UtcNow
                    });
                }
            }
            await _context.SaveChangesAsync();
        }

        return CreatedAtAction(nameof(GetById), new { id = parent.Id }, new ParentDto
        {
            Id = parent.Id,
            UserId = parent.UserId,
            FullName = parent.FullName,
            Email = parent.Email,
            Phone = parent.Phone,
            Address = parent.Address,
            IsActive = parent.IsActive,
            CreatedAt = parent.CreatedAt,
            LinkedStudents = new List<LinkedStudentDto>()
        });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult<ParentDto>> Update(int id, [FromBody] UpdateParentRequest request)
    {
        var parent = await _context.Parents.Include(p => p.User).FirstOrDefaultAsync(p => p.Id == id);
        if (parent == null) return NotFound(new { message = "Parent record not found." });

        var email = request.Email.Trim().ToLowerInvariant();
        if (parent.Email != email && await _context.Users.AnyAsync(u => u.Id != parent.UserId && u.Email.ToLower() == email))
        {
            return BadRequest(new { message = $"Email '{email}' is already registered to another account." });
        }

        parent.FullName = request.FullName.Trim();
        parent.Email = email;
        parent.Phone = request.Phone.Trim();
        parent.Address = request.Address?.Trim();
        parent.IsActive = request.IsActive;

        if (parent.User != null)
        {
            parent.User.FullName = parent.FullName;
            parent.User.Email = parent.Email;
            parent.User.IsActive = parent.IsActive;
        }

        await _context.SaveChangesAsync();

        return Ok(new ParentDto
        {
            Id = parent.Id,
            UserId = parent.UserId,
            FullName = parent.FullName,
            Email = parent.Email,
            Phone = parent.Phone,
            Address = parent.Address,
            PhotoPath = parent.PhotoPath,
            IsActive = parent.IsActive,
            CreatedAt = parent.CreatedAt
        });
    }

    [HttpPost("{id}/link-student")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult> LinkStudent(int id, [FromBody] StudentLinkRequest request)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        var parent = await _context.Parents.FindAsync(id);
        if (parent == null) return NotFound(new { message = "Parent not found." });

        var student = await _context.Students.FindAsync(request.StudentId);
        if (student == null) return NotFound(new { message = "Student not found." });

        var existingLink = await _context.ParentStudents
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(ps => ps.InstituteId == tenantId.Value && ps.ParentId == id && ps.StudentId == request.StudentId);

        if (existingLink != null)
        {
            existingLink.Relationship = request.Relationship.Trim();
            existingLink.IsActive = true;
        }
        else
        {
            _context.ParentStudents.Add(new ParentStudent
            {
                InstituteId = tenantId.Value,
                ParentId = id,
                StudentId = request.StudentId,
                Relationship = request.Relationship.Trim(),
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = "Student linked to parent successfully." });
    }

    [HttpDelete("{id}/unlink-student/{studentId}")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult> UnlinkStudent(int id, int studentId)
    {
        var link = await _context.ParentStudents
            .FirstOrDefaultAsync(ps => ps.ParentId == id && ps.StudentId == studentId);

        if (link == null) return NotFound(new { message = "Link not found." });

        _context.ParentStudents.Remove(link);
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> Deactivate(int id)
    {
        var parent = await _context.Parents.Include(p => p.User).FirstOrDefaultAsync(p => p.Id == id);
        if (parent == null) return NotFound(new { message = "Parent record not found." });

        parent.IsActive = false;
        if (parent.User != null)
        {
            parent.User.IsActive = false;
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("my-children")]
    [Authorize(Roles = $"{Roles.Parent},{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult<List<ParentChildOverviewDto>>> GetMyChildren()
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var userRole = User.FindFirstValue(ClaimTypes.Role);

        List<ParentStudent> links;
        if (userRole == Roles.Parent)
        {
            var parent = await _context.Parents.FirstOrDefaultAsync(p => p.UserId == userId);
            if (parent == null)
            {
                return Ok(new List<ParentChildOverviewDto>());
            }

            links = await _context.ParentStudents
                .Include(ps => ps.Student)
                    .ThenInclude(s => s.Class)
                .Where(ps => ps.ParentId == parent.Id && ps.IsActive && ps.Student.IsActive)
                .ToListAsync();
        }
        else
        {
            // Admin can preview children list across the institute
            links = await _context.ParentStudents
                .Include(ps => ps.Student)
                    .ThenInclude(s => s.Class)
                .Where(ps => ps.IsActive && ps.Student.IsActive)
                .Take(20)
                .ToListAsync();
        }

        var today = DateOnly.FromDateTime(DateTime.UtcNow);
        var result = new List<ParentChildOverviewDto>();

        foreach (var link in links)
        {
            var s = link.Student;
            var records = await _context.AttendanceRecords
                .Where(a => a.StudentId == s.Id && a.IsActive)
                .ToListAsync();

            var total = records.Count;
            var present = records.Count(r => r.Status == AttendanceStatus.Present);
            var absent = records.Count(r => r.Status == AttendanceStatus.Absent);
            var late = records.Count(r => r.Status == AttendanceStatus.Late);
            var leave = records.Count(r => r.Status == AttendanceStatus.OnLeave);

            // Attendance % considers Present, Late as 0.5, and OnLeave as excused
            var pct = total > 0 ? Math.Round((present + (late * 0.5) + leave) / total * 100, 1) : 100.0;

            // Check today's records or approved leave for today
            var todayRecords = records.Where(r => r.Date == today).ToList();
            string todayStatus = "Not Marked";

            var hasLeaveToday = await _context.LeaveRequests.AnyAsync(l =>
                l.StudentId == s.Id && l.Status == LeaveStatus.Approved && l.StartDate <= today && l.EndDate >= today);

            if (hasLeaveToday)
            {
                todayStatus = "On Leave";
            }
            else if (todayRecords.Count > 0)
            {
                if (todayRecords.All(r => r.Status == AttendanceStatus.Present)) todayStatus = "Present";
                else if (todayRecords.Any(r => r.Status == AttendanceStatus.Absent)) todayStatus = "Absent";
                else if (todayRecords.Any(r => r.Status == AttendanceStatus.Late)) todayStatus = "Late";
                else todayStatus = todayRecords.First().Status;
            }

            result.Add(new ParentChildOverviewDto
            {
                StudentId = s.Id,
                RollNo = s.RollNo,
                FullName = s.FullName,
                ClassId = s.ClassId,
                ClassName = s.Class.Name,
                Section = s.Section,
                PhotoPath = s.PhotoPath,
                Relationship = link.Relationship,
                TotalSessions = total,
                PresentSessions = present,
                AbsentSessions = absent,
                LateSessions = late,
                OnLeaveSessions = leave,
                AttendancePercentage = pct,
                TodayStatus = todayStatus
            });
        }

        return Ok(result);
    }

    [HttpGet("my-children/{studentId}/attendance")]
    [Authorize(Roles = $"{Roles.Parent},{Roles.InstituteAdmin},{Roles.SuperAdmin},{Roles.Staff}")]
    public async Task<ActionResult<ChildMonthlyCalendarDto>> GetChildAttendance(int studentId, [FromQuery] string? month)
    {
        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var userRole = User.FindFirstValue(ClaimTypes.Role);

        // Security check: if Parent, verify student is linked to them
        if (userRole == Roles.Parent)
        {
            var parent = await _context.Parents.FirstOrDefaultAsync(p => p.UserId == userId);
            if (parent == null) return Forbid();

            var isLinked = await _context.ParentStudents
                .AnyAsync(ps => ps.ParentId == parent.Id && ps.StudentId == studentId && ps.IsActive);
            if (!isLinked)
            {
                return Forbid();
            }
        }

        var student = await _context.Students
            .Include(s => s.Class)
            .FirstOrDefaultAsync(s => s.Id == studentId);

        if (student == null) return NotFound(new { message = "Student not found." });

        // Parse month or default to current month
        int year = DateTime.UtcNow.Year;
        int m = DateTime.UtcNow.Month;
        if (!string.IsNullOrWhiteSpace(month) && month.Contains('-'))
        {
            var parts = month.Split('-');
            if (parts.Length == 2 && int.TryParse(parts[0], out var y) && int.TryParse(parts[1], out var mon))
            {
                year = y;
                m = Math.Clamp(mon, 1, 12);
            }
        }

        var startDate = new DateOnly(year, m, 1);
        var endDate = new DateOnly(year, m, DateTime.DaysInMonth(year, m));

        var records = await _context.AttendanceRecords
            .Include(a => a.Period)
            .Include(a => a.TimetableEntry)
                .ThenInclude(t => t.Subject)
            .Include(a => a.TimetableEntry)
                .ThenInclude(t => t.Staff)
            .Where(a => a.StudentId == studentId && a.Date >= startDate && a.Date <= endDate && a.IsActive)
            .OrderBy(a => a.Date)
            .ThenBy(a => a.Period.PeriodNumber)
            .ToListAsync();

        var approvedLeaves = await _context.LeaveRequests
            .Where(l => l.StudentId == studentId && l.Status == LeaveStatus.Approved &&
                        l.StartDate <= endDate && l.EndDate >= startDate)
            .ToListAsync();

        var dayGroups = records.GroupBy(r => r.Date).ToDictionary(g => g.Key, g => g.ToList());

        var daysList = new List<ChildDailyAttendanceDto>();
        int presentDays = 0;
        int absentDays = 0;
        int lateDays = 0;
        int onLeaveDays = 0;

        for (var d = startDate; d <= endDate; d = d.AddDays(1))
        {
            var matchingLeave = approvedLeaves.FirstOrDefault(l => l.StartDate <= d && l.EndDate >= d);
            bool hasRecords = dayGroups.TryGetValue(d, out var dayRecords);

            if (!hasRecords && matchingLeave == null)
            {
                // Day with no classes / weekend / not yet recorded
                continue;
            }

            var dailyDto = new ChildDailyAttendanceDto
            {
                Date = d.ToString("yyyy-MM-dd"),
                DayOfWeek = d.DayOfWeek.ToString(),
                IsLeave = matchingLeave != null,
                LeaveReason = matchingLeave?.Reason
            };

            if (dayRecords != null && dayRecords.Count > 0)
            {
                foreach (var rec in dayRecords)
                {
                    dailyDto.Periods.Add(new ChildPeriodAttendanceDto
                    {
                        PeriodId = rec.PeriodId,
                        PeriodName = rec.Period.Name,
                        TimeRange = $"{rec.Period.StartTime:hh\\:mm} - {rec.Period.EndTime:hh\\:mm}",
                        SubjectName = rec.TimetableEntry.Subject?.Name ?? "General",
                        StaffName = rec.TimetableEntry.Staff?.FullName ?? "Instructor",
                        Status = rec.Status,
                        Remarks = rec.Remarks
                    });
                }

                if (matchingLeave != null || dayRecords.All(r => r.Status == AttendanceStatus.OnLeave))
                {
                    dailyDto.Status = AttendanceStatus.OnLeave;
                    onLeaveDays++;
                }
                else if (dayRecords.All(r => r.Status == AttendanceStatus.Present))
                {
                    dailyDto.Status = AttendanceStatus.Present;
                    presentDays++;
                }
                else if (dayRecords.Any(r => r.Status == AttendanceStatus.Absent))
                {
                    dailyDto.Status = AttendanceStatus.Absent;
                    absentDays++;
                }
                else if (dayRecords.Any(r => r.Status == AttendanceStatus.Late))
                {
                    dailyDto.Status = AttendanceStatus.Late;
                    lateDays++;
                }
                else
                {
                    dailyDto.Status = "Partial";
                    presentDays++;
                }
            }
            else if (matchingLeave != null)
            {
                dailyDto.Status = AttendanceStatus.OnLeave;
                onLeaveDays++;
            }

            daysList.Add(dailyDto);
        }

        var totalDays = daysList.Count;
        var percentage = totalDays > 0
            ? Math.Round((presentDays + (lateDays * 0.5) + onLeaveDays) / totalDays * 100, 1)
            : 100.0;

        return Ok(new ChildMonthlyCalendarDto
        {
            StudentId = student.Id,
            FullName = student.FullName,
            RollNo = student.RollNo,
            ClassName = student.Class.Name,
            Section = student.Section,
            Month = $"{year:D4}-{m:D2}",
            TotalRecordedDays = totalDays,
            PresentDays = presentDays,
            AbsentDays = absentDays,
            LateDays = lateDays,
            OnLeaveDays = onLeaveDays,
            AttendancePercentage = percentage,
            Days = daysList
        });
    }
}
