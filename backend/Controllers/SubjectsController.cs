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
            .Select(s => new SubjectDto
            {
                Id = s.Id,
                Name = s.Name,
                Code = s.Code,
                IsActive = s.IsActive
            })
            .OrderBy(s => s.Name)
            .ToListAsync();

        return Ok(subjects);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<SubjectDto>> GetById(int id)
    {
        var subject = await _context.Subjects
            .Where(s => s.Id == id)
            .Select(s => new SubjectDto
            {
                Id = s.Id,
                Name = s.Name,
                Code = s.Code,
                IsActive = s.IsActive
            })
            .FirstOrDefaultAsync();

        if (subject == null) return NotFound(new { message = "Subject not found." });
        return Ok(subject);
    }

    [HttpPost]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult<SubjectDto>> Create([FromBody] CreateSubjectRequest request)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        var code = request.Code.Trim().ToUpperInvariant();
        if (await _context.Subjects.AnyAsync(s => s.Code.ToUpper() == code))
        {
            return BadRequest(new { message = $"Subject with code '{code}' already exists." });
        }

        var subject = new Subject
        {
            Name = request.Name.Trim(),
            Code = code
        };

        _context.Subjects.Add(subject);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = subject.Id }, new SubjectDto
        {
            Id = subject.Id,
            Name = subject.Name,
            Code = subject.Code,
            IsActive = subject.IsActive
        });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> Delete(int id)
    {
        var subject = await _context.Subjects.FindAsync(id);
        if (subject == null) return NotFound(new { message = "Subject not found." });

        subject.IsActive = false;
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
