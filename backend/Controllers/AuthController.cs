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
public class AuthController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ITokenService _tokenService;
    private readonly IPasswordService _passwordService;
    private readonly ICurrentTenantService _tenantService;

    public AuthController(
        ApplicationDbContext context,
        ITokenService tokenService,
        IPasswordService passwordService,
        ICurrentTenantService tenantService)
    {
        _context = context;
        _tokenService = tokenService;
        _passwordService = passwordService;
        _tenantService = tenantService;
    }

    [HttpPost("register-institute")]
    public async Task<ActionResult<AuthResponse>> RegisterInstitute([FromBody] RegisterInstituteRequest request)
    {
        var code = request.InstituteCode.Trim().ToUpperInvariant();

        // Ensure institute code is unique
        if (await _context.Institutes.AnyAsync(i => i.Code == code))
        {
            return BadRequest(new { message = $"Institute code '{code}' is already taken. Please choose a different code." });
        }

        var institute = new Institute
        {
            Name = request.CollegeName.Trim(),
            Code = code,
            Address = request.Address.Trim(),
            City = request.City.Trim(),
            State = request.State.Trim(),
            ContactEmail = request.ContactEmail.Trim().ToLowerInvariant(),
            ContactPhone = request.ContactPhone.Trim(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Institutes.Add(institute);
        await _context.SaveChangesAsync();

        // Create Admin user
        var adminUser = new User
        {
            InstituteId = institute.Id,
            Email = request.AdminEmail.Trim().ToLowerInvariant(),
            FullName = request.AdminName.Trim(),
            Role = Roles.InstituteAdmin,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        adminUser.PasswordHash = _passwordService.HashPassword(adminUser, request.AdminPassword);

        _context.Users.Add(adminUser);
        await _context.SaveChangesAsync();

        // Generate tokens
        var (accessToken, expiresAt) = _tokenService.GenerateAccessToken(adminUser, institute.Code);
        var refreshToken = _tokenService.GenerateRefreshToken(adminUser.Id);

        _context.RefreshTokens.Add(refreshToken);
        await _context.SaveChangesAsync();

        return Ok(new AuthResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken.Token,
            ExpiresAt = expiresAt,
            User = new UserDto
            {
                Id = adminUser.Id,
                InstituteId = adminUser.InstituteId,
                FullName = adminUser.FullName,
                Email = adminUser.Email,
                Role = adminUser.Role
            },
            Institute = new InstituteDto
            {
                Id = institute.Id,
                Name = institute.Name,
                Code = institute.Code,
                Address = institute.Address,
                City = institute.City,
                State = institute.State,
                ContactEmail = institute.ContactEmail,
                ContactPhone = institute.ContactPhone
            }
        });
    }

    [HttpPost("login")]
    public async Task<ActionResult<AuthResponse>> Login([FromBody] LoginRequest request)
    {
        var email = request.Email.Trim().ToLowerInvariant();

        User? user;
        if (!string.IsNullOrWhiteSpace(request.InstituteCode))
        {
            var code = request.InstituteCode.Trim().ToUpperInvariant();
            var institute = await _context.Institutes.FirstOrDefaultAsync(i => i.Code == code);
            if (institute == null)
            {
                return Unauthorized(new { message = "Invalid institute code or credentials." });
            }

            user = await _context.Users
                .Include(u => u.Institute)
                .Include(u => u.StaffProfile)
                .FirstOrDefaultAsync(u => u.InstituteId == institute.Id && u.Email == email);
        }
        else
        {
            user = await _context.Users
                .Include(u => u.Institute)
                .Include(u => u.StaffProfile)
                .FirstOrDefaultAsync(u => u.Email == email);
        }

        if (user == null || !_passwordService.VerifyPassword(user, user.PasswordHash, request.Password))
        {
            return Unauthorized(new { message = "Invalid email or password." });
        }

        if (!user.IsActive)
        {
            return Unauthorized(new { message = "Your account has been deactivated. Please contact your administrator." });
        }

        var (accessToken, expiresAt) = _tokenService.GenerateAccessToken(user, user.Institute?.Code);
        var refreshToken = _tokenService.GenerateRefreshToken(user.Id);

        _context.RefreshTokens.Add(refreshToken);
        await _context.SaveChangesAsync();

        return Ok(new AuthResponse
        {
            AccessToken = accessToken,
            RefreshToken = refreshToken.Token,
            ExpiresAt = expiresAt,
            User = new UserDto
            {
                Id = user.Id,
                InstituteId = user.InstituteId,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role,
                StaffId = user.StaffProfile?.Id
            },
            Institute = user.Institute != null ? new InstituteDto
            {
                Id = user.Institute.Id,
                Name = user.Institute.Name,
                Code = user.Institute.Code,
                Address = user.Institute.Address,
                City = user.Institute.City,
                State = user.Institute.State,
                ContactEmail = user.Institute.ContactEmail,
                ContactPhone = user.Institute.ContactPhone,
                LogoPath = user.Institute.LogoPath
            } : null
        });
    }

    [HttpPost("refresh-token")]
    public async Task<ActionResult<AuthResponse>> RefreshToken([FromBody] RefreshTokenRequest request)
    {
        var existingToken = await _context.RefreshTokens
            .Include(r => r.User)
            .ThenInclude(u => u.Institute)
            .Include(r => r.User)
            .ThenInclude(u => u.StaffProfile)
            .FirstOrDefaultAsync(r => r.Token == request.RefreshToken);

        if (existingToken == null || !existingToken.IsActive)
        {
            return Unauthorized(new { message = "Invalid or expired refresh token." });
        }

        // Revoke the old token
        existingToken.IsRevoked = true;

        var user = existingToken.User;
        var (accessToken, expiresAt) = _tokenService.GenerateAccessToken(user, user.Institute?.Code);
        var newRefreshToken = _tokenService.GenerateRefreshToken(user.Id);

        _context.RefreshTokens.Add(newRefreshToken);
        await _context.SaveChangesAsync();

        return Ok(new AuthResponse
        {
            AccessToken = accessToken,
            RefreshToken = newRefreshToken.Token,
            ExpiresAt = expiresAt,
            User = new UserDto
            {
                Id = user.Id,
                InstituteId = user.InstituteId,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role,
                StaffId = user.StaffProfile?.Id
            },
            Institute = user.Institute != null ? new InstituteDto
            {
                Id = user.Institute.Id,
                Name = user.Institute.Name,
                Code = user.Institute.Code,
                Address = user.Institute.Address,
                City = user.Institute.City,
                State = user.Institute.State,
                ContactEmail = user.Institute.ContactEmail,
                ContactPhone = user.Institute.ContactPhone,
                LogoPath = user.Institute.LogoPath
            } : null
        });
    }

    [HttpGet("me")]
    [Authorize]
    public async Task<ActionResult<object>> GetCurrentUser()
    {
        var userIdClaim = User.FindFirst(System.Security.Claims.ClaimTypes.NameIdentifier)?.Value;
        if (!int.TryParse(userIdClaim, out var userId))
        {
            return Unauthorized();
        }

        var user = await _context.Users
            .Include(u => u.Institute)
            .Include(u => u.StaffProfile)
            .FirstOrDefaultAsync(u => u.Id == userId);

        if (user == null)
        {
            return NotFound(new { message = "User not found." });
        }

        return Ok(new
        {
            User = new UserDto
            {
                Id = user.Id,
                InstituteId = user.InstituteId,
                FullName = user.FullName,
                Email = user.Email,
                Role = user.Role,
                StaffId = user.StaffProfile?.Id
            },
            Institute = user.Institute != null ? new InstituteDto
            {
                Id = user.Institute.Id,
                Name = user.Institute.Name,
                Code = user.Institute.Code,
                Address = user.Institute.Address,
                City = user.Institute.City,
                State = user.Institute.State,
                ContactEmail = user.Institute.ContactEmail,
                ContactPhone = user.Institute.ContactPhone,
                LogoPath = user.Institute.LogoPath
            } : null
        });
    }
}
