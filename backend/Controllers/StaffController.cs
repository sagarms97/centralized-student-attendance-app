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
public class StaffController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly IFileStorageService _fileStorageService;
    private readonly IPasswordService _passwordService;

    public StaffController(
        ApplicationDbContext context,
        ICurrentTenantService tenantService,
        IFileStorageService fileStorageService,
        IPasswordService passwordService)
    {
        _context = context;
        _tenantService = tenantService;
        _fileStorageService = fileStorageService;
        _passwordService = passwordService;
    }

    [HttpGet]
    public async Task<ActionResult<List<StaffDto>>> GetAll([FromQuery] bool includeInactive = false)
    {
        var query = _context.StaffMembers.AsQueryable();
        if (includeInactive)
        {
            query = query.IgnoreQueryFilters().Where(s => s.InstituteId == _tenantService.InstituteId);
        }

        var staff = await query
            .OrderBy(s => s.FullName)
            .Select(s => new StaffDto
            {
                Id = s.Id,
                UserId = s.UserId,
                EmployeeId = s.EmployeeId,
                FullName = s.FullName,
                Email = s.Email,
                Phone = s.Phone,
                SubjectSpecialization = s.SubjectSpecialization,
                PhotoPath = s.PhotoPath,
                IsActive = s.IsActive,
                CreatedAt = s.CreatedAt
            })
            .ToListAsync();

        return Ok(staff);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<StaffDto>> GetById(int id)
    {
        var staff = await _context.StaffMembers
            .Where(s => s.Id == id)
            .Select(s => new StaffDto
            {
                Id = s.Id,
                UserId = s.UserId,
                EmployeeId = s.EmployeeId,
                FullName = s.FullName,
                Email = s.Email,
                Phone = s.Phone,
                SubjectSpecialization = s.SubjectSpecialization,
                PhotoPath = s.PhotoPath,
                IsActive = s.IsActive,
                CreatedAt = s.CreatedAt
            })
            .FirstOrDefaultAsync();

        if (staff == null) return NotFound(new { message = "Staff member not found." });
        return Ok(staff);
    }

    [HttpPost]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult<StaffDto>> Create([FromBody] CreateStaffRequest request)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        var empId = request.EmployeeId.Trim();
        var email = request.Email.Trim().ToLowerInvariant();

        if (await _context.StaffMembers.AnyAsync(s => s.EmployeeId.ToLower() == empId.ToLower()))
        {
            return BadRequest(new { message = $"Employee ID '{empId}' is already registered." });
        }

        if (await _context.Users.AnyAsync(u => u.Email.ToLower() == email))
        {
            return BadRequest(new { message = $"User with email '{email}' already exists in your institute." });
        }

        // 1. Auto-create login user account for staff
        var user = new User
        {
            InstituteId = tenantId.Value,
            Email = email,
            FullName = request.FullName.Trim(),
            Role = Roles.Staff,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        user.PasswordHash = _passwordService.HashPassword(user, request.InitialPassword);
        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        // 2. Create staff profile
        var staff = new Staff
        {
            InstituteId = tenantId.Value,
            UserId = user.Id,
            EmployeeId = empId,
            FullName = request.FullName.Trim(),
            Email = email,
            Phone = request.Phone.Trim(),
            SubjectSpecialization = request.SubjectSpecialization?.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.StaffMembers.Add(staff);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = staff.Id }, new StaffDto
        {
            Id = staff.Id,
            UserId = staff.UserId,
            EmployeeId = staff.EmployeeId,
            FullName = staff.FullName,
            Email = staff.Email,
            Phone = staff.Phone,
            SubjectSpecialization = staff.SubjectSpecialization,
            IsActive = staff.IsActive,
            CreatedAt = staff.CreatedAt
        });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult<StaffDto>> Update(int id, [FromBody] UpdateStaffRequest request)
    {
        var staff = await _context.StaffMembers.Include(s => s.User).FirstOrDefaultAsync(s => s.Id == id);
        if (staff == null) return NotFound(new { message = "Staff member not found." });

        var email = request.Email.Trim().ToLowerInvariant();
        if (staff.Email != email && await _context.Users.AnyAsync(u => u.Id != staff.UserId && u.Email.ToLower() == email))
        {
            return BadRequest(new { message = $"Email '{email}' is already in use by another user." });
        }

        staff.FullName = request.FullName.Trim();
        staff.Email = email;
        staff.Phone = request.Phone.Trim();
        staff.SubjectSpecialization = request.SubjectSpecialization?.Trim();
        staff.IsActive = request.IsActive;

        if (staff.User != null)
        {
            staff.User.FullName = staff.FullName;
            staff.User.Email = staff.Email;
            staff.User.IsActive = staff.IsActive;
        }

        await _context.SaveChangesAsync();

        return Ok(new StaffDto
        {
            Id = staff.Id,
            UserId = staff.UserId,
            EmployeeId = staff.EmployeeId,
            FullName = staff.FullName,
            Email = staff.Email,
            Phone = staff.Phone,
            SubjectSpecialization = staff.SubjectSpecialization,
            PhotoPath = staff.PhotoPath,
            IsActive = staff.IsActive,
            CreatedAt = staff.CreatedAt
        });
    }

    [HttpPost("{id}/photo")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult> UploadPhoto(int id, IFormFile file)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        var staff = await _context.StaffMembers.FindAsync(id);
        if (staff == null) return NotFound(new { message = "Staff member not found." });

        // Delete old photo if present
        if (!string.IsNullOrEmpty(staff.PhotoPath))
        {
            _fileStorageService.DeleteStaffPhoto(tenantId.Value, staff.PhotoPath);
        }

        var fileName = await _fileStorageService.SaveStaffPhotoAsync(tenantId.Value, file);
        staff.PhotoPath = fileName;
        await _context.SaveChangesAsync();

        return Ok(new { photoPath = fileName, message = "Photo uploaded successfully." });
    }

    [HttpGet("{id}/photo")]
    public async Task<IActionResult> GetPhoto(int id)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        var staff = await _context.StaffMembers.FindAsync(id);
        if (staff == null || string.IsNullOrEmpty(staff.PhotoPath))
        {
            return NotFound(new { message = "No photo found for this staff member." });
        }

        var fileResult = _fileStorageService.GetStaffPhoto(tenantId.Value, staff.PhotoPath);
        if (fileResult == null)
        {
            return NotFound(new { message = "Photo file not found on disk." });
        }

        return File(fileResult.Value.Stream, fileResult.Value.ContentType);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> Deactivate(int id)
    {
        var staff = await _context.StaffMembers.Include(s => s.User).FirstOrDefaultAsync(s => s.Id == id);
        if (staff == null) return NotFound(new { message = "Staff member not found." });

        staff.IsActive = false;
        if (staff.User != null)
        {
            staff.User.IsActive = false;
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }
}
