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
public class SubjectsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;

    public SubjectsController(ApplicationDbContext context, ICurrentTenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    [HttpGet]
    public async Task<ActionResult<List<SubjectDto>>> GetAll()
    {
        var subjects = await _context.Subjects
            .Include(s => s.ClassSubjects)
                .ThenInclude(cs => cs.Class)
            .Include(s => s.ClassSubjects)
                .ThenInclude(cs => cs.DefaultStaff)
            .OrderBy(s => s.Name)
            .ToListAsync();

        var result = subjects.Select(s => new SubjectDto
        {
            Id = s.Id,
            Name = s.Name,
            Code = s.Code,
            IsActive = s.IsActive,
            AssignedClassCount = s.ClassSubjects.Count,
            AssignedClasses = s.ClassSubjects.Select(cs => new ClassSubjectAssignmentDto
            {
                ClassSubjectId = cs.Id,
                ClassId = cs.ClassId,
                ClassName = cs.Class.Name,
                DefaultStaffId = cs.DefaultStaffId,
                DefaultStaffName = cs.DefaultStaff?.FullName
            }).ToList()
        }).ToList();

        return Ok(result);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<SubjectDto>> GetById(int id)
    {
        var s = await _context.Subjects
            .Include(sub => sub.ClassSubjects)
                .ThenInclude(cs => cs.Class)
            .Include(sub => sub.ClassSubjects)
                .ThenInclude(cs => cs.DefaultStaff)
            .FirstOrDefaultAsync(sub => sub.Id == id);

        if (s == null) return NotFound(new { message = "Subject not found." });

        return Ok(new SubjectDto
        {
            Id = s.Id,
            Name = s.Name,
            Code = s.Code,
            IsActive = s.IsActive,
            AssignedClassCount = s.ClassSubjects.Count,
            AssignedClasses = s.ClassSubjects.Select(cs => new ClassSubjectAssignmentDto
            {
                ClassSubjectId = cs.Id,
                ClassId = cs.ClassId,
                ClassName = cs.Class.Name,
                DefaultStaffId = cs.DefaultStaffId,
                DefaultStaffName = cs.DefaultStaff?.FullName
            }).ToList()
        });
    }

    [HttpGet("by-class/{classId}")]
    public async Task<ActionResult<List<ClassSubjectDto>>> GetSubjectsForClass(int classId)
    {
        var classSubjects = await _context.ClassSubjects
            .Include(cs => cs.Class)
            .Include(cs => cs.Subject)
            .Include(cs => cs.DefaultStaff)
            .Where(cs => cs.ClassId == classId)
            .OrderBy(cs => cs.Subject.Name)
            .ToListAsync();

        if (classSubjects.Count == 0)
        {
            var allSubjects = await _context.Subjects.OrderBy(s => s.Name).ToListAsync();
            var classObj = await _context.Classes.FindAsync(classId);
            return Ok(allSubjects.Select(s => new ClassSubjectDto
            {
                Id = 0,
                ClassId = classId,
                ClassName = classObj?.Name ?? string.Empty,
                SubjectId = s.Id,
                SubjectName = s.Name,
                SubjectCode = s.Code
            }).ToList());
        }

        return Ok(classSubjects.Select(cs => new ClassSubjectDto
        {
            Id = cs.Id,
            ClassId = cs.ClassId,
            ClassName = cs.Class.Name,
            SubjectId = cs.SubjectId,
            SubjectName = cs.Subject.Name,
            SubjectCode = cs.Subject.Code,
            DefaultStaffId = cs.DefaultStaffId,
            DefaultStaffName = cs.DefaultStaff?.FullName
        }).ToList());
    }

    [HttpPost]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult<SubjectDto>> Create([FromBody] CreateSubjectRequest request)
    {
        var code = request.Code.Trim().ToUpperInvariant();
        var name = request.Name.Trim();

        if (await _context.Subjects.AnyAsync(s => s.Code == code))
        {
            return BadRequest(new { message = $"A subject with code '{code}' already exists." });
        }

        var subject = new Subject
        {
            Name = name,
            Code = code
        };

        _context.Subjects.Add(subject);
        await _context.SaveChangesAsync();

        if (request.ClassAssignments != null && request.ClassAssignments.Count > 0)
        {
            foreach (var a in request.ClassAssignments)
            {
                if (await _context.Classes.AnyAsync(c => c.Id == a.ClassId))
                {
                    _context.ClassSubjects.Add(new ClassSubject
                    {
                        ClassId = a.ClassId,
                        SubjectId = subject.Id,
                        DefaultStaffId = a.DefaultStaffId
                    });
                }
            }
            await _context.SaveChangesAsync();
        }

        return CreatedAtAction(nameof(GetById), new { id = subject.Id }, await GetByIdInternal(subject.Id));
    }

    [HttpPut("{id}")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult<SubjectDto>> Update(int id, [FromBody] UpdateSubjectRequest request)
    {
        var subject = await _context.Subjects.FindAsync(id);
        if (subject == null) return NotFound(new { message = "Subject not found." });

        var code = request.Code.Trim().ToUpperInvariant();
        var name = request.Name.Trim();

        if (subject.Code != code && await _context.Subjects.AnyAsync(s => s.Id != id && s.Code == code))
        {
            return BadRequest(new { message = $"A subject with code '{code}' already exists." });
        }

        subject.Name = name;
        subject.Code = code;
        await _context.SaveChangesAsync();

        return Ok(await GetByIdInternal(subject.Id));
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> Delete(int id)
    {
        var subject = await _context.Subjects.FindAsync(id);
        if (subject == null) return NotFound(new { message = "Subject not found." });

        var hasTimetable = await _context.TimetableEntries.AnyAsync(t => t.SubjectId == id);
        if (hasTimetable)
        {
            return BadRequest(new { message = "Cannot delete subject because it is scheduled in active timetables. Remove timetable entries first." });
        }

        _context.Subjects.Remove(subject);

        var classSubjects = await _context.ClassSubjects.Where(cs => cs.SubjectId == id).ToListAsync();
        _context.ClassSubjects.RemoveRange(classSubjects);

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPost("{id}/assign-classes")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult<SubjectDto>> AssignClasses(int id, [FromBody] AssignSubjectToClassesRequest request)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        var subject = await _context.Subjects.FindAsync(id);
        if (subject == null) return NotFound(new { message = "Subject not found." });

        var existing = await _context.ClassSubjects
            .IgnoreQueryFilters()
            .Where(cs => cs.InstituteId == tenantId.Value && cs.SubjectId == id)
            .ToListAsync();

        var desiredClassIds = request.Assignments.Select(a => a.ClassId).ToHashSet();

        foreach (var ex in existing.Where(ex => !desiredClassIds.Contains(ex.ClassId) && ex.IsActive))
        {
            ex.IsActive = false;
        }

        foreach (var assignment in request.Assignments)
        {
            var match = existing.FirstOrDefault(e => e.ClassId == assignment.ClassId);
            if (match != null)
            {
                match.IsActive = true;
                match.DefaultStaffId = assignment.DefaultStaffId;
            }
            else
            {
                _context.ClassSubjects.Add(new ClassSubject
                {
                    InstituteId = tenantId.Value,
                    SubjectId = id,
                    ClassId = assignment.ClassId,
                    DefaultStaffId = assignment.DefaultStaffId,
                    IsActive = true
                });
            }
        }

        await _context.SaveChangesAsync();
        return Ok(await GetByIdInternal(id));
    }

    [HttpPost("assign-class-subjects")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult> AssignClassSubjects([FromBody] AssignSubjectsToClassRequest request)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        var classObj = await _context.Classes.FindAsync(request.ClassId);
        if (classObj == null) return NotFound(new { message = "Class not found." });

        var existing = await _context.ClassSubjects
            .IgnoreQueryFilters()
            .Where(cs => cs.InstituteId == tenantId.Value && cs.ClassId == request.ClassId)
            .ToListAsync();

        var desiredSubjectIds = request.Assignments.Select(a => a.SubjectId).ToHashSet();

        foreach (var ex in existing.Where(ex => !desiredSubjectIds.Contains(ex.SubjectId) && ex.IsActive))
        {
            ex.IsActive = false;
        }

        foreach (var assignment in request.Assignments)
        {
            var match = existing.FirstOrDefault(e => e.SubjectId == assignment.SubjectId);
            if (match != null)
            {
                match.IsActive = true;
                match.DefaultStaffId = assignment.DefaultStaffId;
            }
            else
            {
                _context.ClassSubjects.Add(new ClassSubject
                {
                    InstituteId = tenantId.Value,
                    ClassId = request.ClassId,
                    SubjectId = assignment.SubjectId,
                    DefaultStaffId = assignment.DefaultStaffId,
                    IsActive = true
                });
            }
        }

        await _context.SaveChangesAsync();
        return Ok(new { message = "Class subjects updated successfully." });
    }

    private async Task<SubjectDto> GetByIdInternal(int id)
    {
        var s = await _context.Subjects
            .Include(sub => sub.ClassSubjects)
                .ThenInclude(cs => cs.Class)
            .Include(sub => sub.ClassSubjects)
                .ThenInclude(cs => cs.DefaultStaff)
            .FirstAsync(sub => sub.Id == id);

        return new SubjectDto
        {
            Id = s.Id,
            Name = s.Name,
            Code = s.Code,
            IsActive = s.IsActive,
            AssignedClassCount = s.ClassSubjects.Count,
            AssignedClasses = s.ClassSubjects.Select(cs => new ClassSubjectAssignmentDto
            {
                ClassSubjectId = cs.Id,
                ClassId = cs.ClassId,
                ClassName = cs.Class.Name,
                DefaultStaffId = cs.DefaultStaffId,
                DefaultStaffName = cs.DefaultStaff?.FullName
            }).ToList()
        };
    }
}
