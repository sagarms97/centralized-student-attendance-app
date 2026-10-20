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
public class InstitutesController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;

    public InstitutesController(ApplicationDbContext context, ICurrentTenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    [HttpGet("me")]
    public async Task<ActionResult<InstituteDto>> GetCurrentInstitute()
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue)
        {
            return BadRequest(new { message = "Tenant context not found in token." });
        }

        var institute = await _context.Institutes.FindAsync(tenantId.Value);
        if (institute == null)
        {
            return NotFound(new { message = "Institute not found." });
        }

        return Ok(new InstituteDto
        {
            Id = institute.Id,
            Name = institute.Name,
            Code = institute.Code,
            Address = institute.Address,
            City = institute.City,
            State = institute.State,
            ContactEmail = institute.ContactEmail,
            ContactPhone = institute.ContactPhone,
            LogoPath = institute.LogoPath
        });
    }

    [HttpPut("me")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult<InstituteDto>> UpdateCurrentInstitute([FromBody] InstituteDto dto)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue)
        {
            return BadRequest(new { message = "Tenant context not found in token." });
        }

        var institute = await _context.Institutes.FindAsync(tenantId.Value);
        if (institute == null)
        {
            return NotFound(new { message = "Institute not found." });
        }

        institute.Name = dto.Name.Trim();
        institute.Address = dto.Address.Trim();
        institute.City = dto.City.Trim();
        institute.State = dto.State.Trim();
        institute.ContactEmail = dto.ContactEmail.Trim();
        institute.ContactPhone = dto.ContactPhone.Trim();

        await _context.SaveChangesAsync();

        return Ok(new InstituteDto
        {
            Id = institute.Id,
            Name = institute.Name,
            Code = institute.Code,
            Address = institute.Address,
            City = institute.City,
            State = institute.State,
            ContactEmail = institute.ContactEmail,
            ContactPhone = institute.ContactPhone,
            LogoPath = institute.LogoPath
        });
    }
}
