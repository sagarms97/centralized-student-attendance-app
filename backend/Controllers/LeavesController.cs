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
public class LeavesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;

    public LeavesController(ApplicationDbContext context, ICurrentTenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    [HttpGet]
    public async Task<ActionResult<List<LeaveRequestDto>>> GetAll(
        [FromQuery] string? status,
        [FromQuery] int? studentId)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var userRole = User.FindFirstValue(ClaimTypes.Role);

        var query = _context.LeaveRequests
            .Include(l => l.Student)
                .ThenInclude(s => s.Class)
            .Include(l => l.Parent)
            .Include(l => l.ReviewedByUser)
            .AsQueryable();

        if (userRole == Roles.Parent)
        {
            var parent = await _context.Parents.FirstOrDefaultAsync(p => p.UserId == userId);
            if (parent == null) return Ok(new List<LeaveRequestDto>());
            query = query.Where(l => l.ParentId == parent.Id);
        }
        else if (userRole == Roles.Staff)
        {
            var staff = await _context.StaffMembers.FirstOrDefaultAsync(s => s.UserId == userId);
            if (staff == null) return Ok(new List<LeaveRequestDto>());

            // Staff sees leave requests for classes they teach
            var assignedClassIds = await _context.TimetableEntries
                .Where(t => t.StaffId == staff.Id)
                .Select(t => t.ClassId)
                .Distinct()
                .ToListAsync();

            query = query.Where(l => assignedClassIds.Contains(l.Student.ClassId));
        }

        if (!string.IsNullOrWhiteSpace(status) && status != "All")
        {
            query = query.Where(l => l.Status == status);
        }

        if (studentId.HasValue)
        {
            query = query.Where(l => l.StudentId == studentId.Value);
        }

        var list = await query
            .OrderByDescending(l => l.CreatedAt)
            .Select(l => new LeaveRequestDto
            {
                Id = l.Id,
                StudentId = l.StudentId,
                StudentName = l.Student.FullName,
                RollNo = l.Student.RollNo,
                ClassName = l.Student.Class.Name,
                Section = l.Student.Section,
                ParentId = l.ParentId,
                ParentName = l.Parent.FullName,
                ParentPhone = l.Parent.Phone,
                StartDate = l.StartDate.ToString("yyyy-MM-dd"),
                EndDate = l.EndDate.ToString("yyyy-MM-dd"),
                DaysCount = l.EndDate.DayNumber - l.StartDate.DayNumber + 1,
                Reason = l.Reason,
                Status = l.Status,
                ReviewedByUserId = l.ReviewedByUserId,
                ReviewedByUserName = l.ReviewedByUser != null ? l.ReviewedByUser.FullName : null,
                ReviewedAt = l.ReviewedAt,
                ReviewRemarks = l.ReviewRemarks,
                CreatedAt = l.CreatedAt
            })
            .ToListAsync();

        return Ok(list);
    }

    [HttpPost]
    [Authorize(Roles = $"{Roles.Parent},{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult<LeaveRequestDto>> Create([FromBody] CreateLeaveRequest request)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        if (!DateOnly.TryParse(request.StartDate, out var start) || !DateOnly.TryParse(request.EndDate, out var end))
        {
            return BadRequest(new { message = "Invalid date format. Use yyyy-MM-dd." });
        }

        if (end < start)
        {
            return BadRequest(new { message = "End date cannot be earlier than start date." });
        }

        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var userRole = User.FindFirstValue(ClaimTypes.Role);

        int parentId;
        if (userRole == Roles.Parent)
        {
            var parent = await _context.Parents.FirstOrDefaultAsync(p => p.UserId == userId);
            if (parent == null) return Forbid();

            // Verify parent ownership of this student
            var isLinked = await _context.ParentStudents
                .AnyAsync(ps => ps.ParentId == parent.Id && ps.StudentId == request.StudentId && ps.IsActive);
            if (!isLinked)
            {
                return Forbid();
            }

            parentId = parent.Id;
        }
        else
        {
            // Admin submitting on behalf of a parent
            var link = await _context.ParentStudents
                .FirstOrDefaultAsync(ps => ps.StudentId == request.StudentId && ps.IsActive);
            if (link == null)
            {
                return BadRequest(new { message = "Selected student has no linked parent profile on file." });
            }
            parentId = link.ParentId;
        }

        var student = await _context.Students
            .Include(s => s.Class)
            .FirstOrDefaultAsync(s => s.Id == request.StudentId);
        if (student == null) return NotFound(new { message = "Student not found." });

        var leave = new LeaveRequest
        {
            InstituteId = tenantId.Value,
            StudentId = request.StudentId,
            ParentId = parentId,
            StartDate = start,
            EndDate = end,
            Reason = request.Reason.Trim(),
            Status = LeaveStatus.Pending,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.LeaveRequests.Add(leave);
        await _context.SaveChangesAsync();

        var parentObj = await _context.Parents.FindAsync(parentId);

        return Ok(new LeaveRequestDto
        {
            Id = leave.Id,
            StudentId = student.Id,
            StudentName = student.FullName,
            RollNo = student.RollNo,
            ClassName = student.Class.Name,
            Section = student.Section,
            ParentId = parentId,
            ParentName = parentObj?.FullName ?? "",
            ParentPhone = parentObj?.Phone ?? "",
            StartDate = leave.StartDate.ToString("yyyy-MM-dd"),
            EndDate = leave.EndDate.ToString("yyyy-MM-dd"),
            DaysCount = end.DayNumber - start.DayNumber + 1,
            Reason = leave.Reason,
            Status = leave.Status,
            CreatedAt = leave.CreatedAt
        });
    }

    [HttpPut("{id}/review")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin},{Roles.Staff}")]
    public async Task<ActionResult<LeaveRequestDto>> Review(int id, [FromBody] ReviewLeaveRequest request)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        var leave = await _context.LeaveRequests
            .Include(l => l.Student)
                .ThenInclude(s => s.Class)
            .Include(l => l.Parent)
            .FirstOrDefaultAsync(l => l.Id == id);

        if (leave == null) return NotFound(new { message = "Leave request not found." });

        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var userRole = User.FindFirstValue(ClaimTypes.Role);

        if (userRole == Roles.Staff)
        {
            var staff = await _context.StaffMembers.FirstOrDefaultAsync(s => s.UserId == userId);
            if (staff == null) return Forbid();

            bool teachesStudentClass = await _context.TimetableEntries
                .AnyAsync(t => t.StaffId == staff.Id && t.ClassId == leave.Student.ClassId);

            if (!teachesStudentClass)
            {
                return Forbid();
            }
        }

        var newStatus = request.Status == LeaveStatus.Approved ? LeaveStatus.Approved : LeaveStatus.Rejected;
        leave.Status = newStatus;
        leave.ReviewedByUserId = userId;
        leave.ReviewedAt = DateTime.UtcNow;
        leave.ReviewRemarks = request.ReviewRemarks?.Trim();

        // If Approved, sync student's attendance records to OnLeave for each timetable entry during the leave date range
        if (newStatus == LeaveStatus.Approved)
        {
            var timetableEntries = await _context.TimetableEntries
                .Where(t => t.ClassId == leave.Student.ClassId && t.Section == leave.Student.Section && t.IsActive)
                .ToListAsync();

            for (var d = leave.StartDate; d <= leave.EndDate; d = d.AddDays(1))
            {
                var dayOfWeek = d.DayOfWeek;
                var daySlots = timetableEntries.Where(t => t.DayOfWeek == dayOfWeek).ToList();

                foreach (var slot in daySlots)
                {
                    var existingRecord = await _context.AttendanceRecords
                        .FirstOrDefaultAsync(a => a.Date == d && a.PeriodId == slot.PeriodId && a.StudentId == leave.StudentId);

                    if (existingRecord != null)
                    {
                        existingRecord.Status = AttendanceStatus.OnLeave;
                        existingRecord.LeaveRequestId = leave.Id;
                        existingRecord.Remarks = $"Approved Leave: {leave.Reason}";
                        existingRecord.MarkedByUserId = userId;
                        existingRecord.MarkedAt = DateTime.UtcNow;
                    }
                    else
                    {
                        _context.AttendanceRecords.Add(new AttendanceRecord
                        {
                            InstituteId = tenantId.Value,
                            Date = d,
                            PeriodId = slot.PeriodId,
                            TimetableEntryId = slot.Id,
                            StudentId = leave.StudentId,
                            Status = AttendanceStatus.OnLeave,
                            Remarks = $"Approved Leave: {leave.Reason}",
                            MarkedByUserId = userId,
                            MarkedAt = DateTime.UtcNow,
                            LeaveRequestId = leave.Id,
                            IsActive = true
                        });
                    }
                }
            }
        }
        else if (newStatus == LeaveStatus.Rejected)
        {
            // If previously linked to attendance, clear leave-generated records
            var linkedRecords = await _context.AttendanceRecords
                .Where(a => a.LeaveRequestId == leave.Id)
                .ToListAsync();

            foreach (var rec in linkedRecords)
            {
                rec.Status = AttendanceStatus.Absent;
                rec.Remarks = $"Leave Rejected: {request.ReviewRemarks}";
            }
        }

        await _context.SaveChangesAsync();

        var reviewer = await _context.Users.FindAsync(userId);

        return Ok(new LeaveRequestDto
        {
            Id = leave.Id,
            StudentId = leave.StudentId,
            StudentName = leave.Student.FullName,
            RollNo = leave.Student.RollNo,
            ClassName = leave.Student.Class.Name,
            Section = leave.Student.Section,
            ParentId = leave.ParentId,
            ParentName = leave.Parent.FullName,
            ParentPhone = leave.Parent.Phone,
            StartDate = leave.StartDate.ToString("yyyy-MM-dd"),
            EndDate = leave.EndDate.ToString("yyyy-MM-dd"),
            DaysCount = leave.EndDate.DayNumber - leave.StartDate.DayNumber + 1,
            Reason = leave.Reason,
            Status = leave.Status,
            ReviewedByUserId = leave.ReviewedByUserId,
            ReviewedByUserName = reviewer?.FullName,
            ReviewedAt = leave.ReviewedAt,
            ReviewRemarks = leave.ReviewRemarks,
            CreatedAt = leave.CreatedAt
        });
    }

    [HttpGet("pending-count")]
    public async Task<ActionResult<int>> GetPendingCount()
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return 0;

        var userId = int.Parse(User.FindFirstValue(ClaimTypes.NameIdentifier)!);
        var userRole = User.FindFirstValue(ClaimTypes.Role);

        if (userRole == Roles.Parent)
        {
            var parent = await _context.Parents.FirstOrDefaultAsync(p => p.UserId == userId);
            if (parent == null) return 0;
            return await _context.LeaveRequests.CountAsync(l => l.ParentId == parent.Id && l.Status == LeaveStatus.Pending);
        }

        if (userRole == Roles.Staff)
        {
            var staff = await _context.StaffMembers.FirstOrDefaultAsync(s => s.UserId == userId);
            if (staff == null) return 0;

            var assignedClassIds = await _context.TimetableEntries
                .Where(t => t.StaffId == staff.Id)
                .Select(t => t.ClassId)
                .Distinct()
                .ToListAsync();

            return await _context.LeaveRequests
                .CountAsync(l => l.Status == LeaveStatus.Pending && assignedClassIds.Contains(l.Student.ClassId));
        }

        return await _context.LeaveRequests.CountAsync(l => l.Status == LeaveStatus.Pending);
    }
}
