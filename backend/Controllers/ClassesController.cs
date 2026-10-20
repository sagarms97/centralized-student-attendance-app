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
public class ClassesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;

    public ClassesController(ApplicationDbContext context, ICurrentTenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    [HttpGet]
    public async Task<ActionResult<List<ClassDto>>> GetAll()
    {
        var classes = await _context.Classes
            .Select(c => new ClassDto
            {
                Id = c.Id,
                Name = c.Name,
                Sections = c.Sections,
                StudentCount = c.Students.Count(s => s.IsActive),
                IsActive = c.IsActive
            })
            .OrderBy(c => c.Name)
            .ToListAsync();

        return Ok(classes);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<ClassDto>> GetById(int id)
    {
        var cls = await _context.Classes
            .Where(c => c.Id == id)
            .Select(c => new ClassDto
            {
                Id = c.Id,
                Name = c.Name,
                Sections = c.Sections,
                StudentCount = c.Students.Count(s => s.IsActive),
                IsActive = c.IsActive
            })
            .FirstOrDefaultAsync();

        if (cls == null) return NotFound(new { message = "Class not found." });
        return Ok(cls);
    }

    [HttpPost]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult<ClassDto>> Create([FromBody] CreateClassRequest request)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        var name = request.Name.Trim();
        if (await _context.Classes.AnyAsync(c => c.Name.ToLower() == name.ToLower()))
        {
            return BadRequest(new { message = $"Class '{name}' already exists in your institute." });
        }

        var cls = new ClassEntity
        {
            Name = name,
            Sections = string.IsNullOrWhiteSpace(request.Sections) ? "A,B" : request.Sections.Trim()
        };

        _context.Classes.Add(cls);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = cls.Id }, new ClassDto
        {
            Id = cls.Id,
            Name = cls.Name,
            Sections = cls.Sections,
            StudentCount = 0,
            IsActive = cls.IsActive
        });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult<ClassDto>> Update(int id, [FromBody] CreateClassRequest request)
    {
        var cls = await _context.Classes.FindAsync(id);
        if (cls == null) return NotFound(new { message = "Class not found." });

        var name = request.Name.Trim();
        if (await _context.Classes.AnyAsync(c => c.Id != id && c.Name.ToLower() == name.ToLower()))
        {
            return BadRequest(new { message = $"Another class with name '{name}' already exists." });
        }

        cls.Name = name;
        cls.Sections = request.Sections.Trim();
        await _context.SaveChangesAsync();

        return Ok(new ClassDto
        {
            Id = cls.Id,
            Name = cls.Name,
            Sections = cls.Sections,
            StudentCount = await _context.Students.CountAsync(s => s.ClassId == id && s.IsActive),
            IsActive = cls.IsActive
        });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> Delete(int id)
    {
        var cls = await _context.Classes.FindAsync(id);
        if (cls == null) return NotFound(new { message = "Class not found." });

        cls.IsActive = false; // Soft delete
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
