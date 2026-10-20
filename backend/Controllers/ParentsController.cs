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
}
