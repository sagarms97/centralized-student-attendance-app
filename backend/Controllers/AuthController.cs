using System.Security.Cryptography;
using System.Text;
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
    private readonly IEmailService _emailService;
    private readonly INotificationService _notificationService;
    private readonly IConfiguration _configuration;

    public AuthController(
        ApplicationDbContext context,
        ITokenService tokenService,
        IPasswordService passwordService,
        ICurrentTenantService tenantService,
        IEmailService emailService,
        INotificationService notificationService,
        IConfiguration configuration)
    {
        _context = context;
        _tokenService = tokenService;
        _passwordService = passwordService;
        _tenantService = tenantService;
        _emailService = emailService;
        _notificationService = notificationService;
        _configuration = configuration;
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
                .Include(u => u.ParentProfile)
                .FirstOrDefaultAsync(u => u.InstituteId == institute.Id && u.Email == email);
        }
        else
        {
            user = await _context.Users
                .Include(u => u.Institute)
                .Include(u => u.StaffProfile)
                .Include(u => u.ParentProfile)
                .FirstOrDefaultAsync(u => u.Email == email);
        }

        if (user == null || !_passwordService.VerifyPassword(user, user.PasswordHash, request.Password))
        {
            return Unauthorized(new { message = "Invalid email or password." });
        }

        if (!user.IsActive || user.AccountStatus == AccountStatuses.Disabled)
        {
            return Unauthorized(new { message = "Your account has been deactivated. Please contact your administrator." });
        }

        if (user.AccountStatus == AccountStatuses.PendingApproval)
        {
            return Unauthorized(new { message = "Registration successful. Please wait for admin approval." });
        }

        if (user.AccountStatus == AccountStatuses.PendingOtp)
        {
            return Unauthorized(new { message = "Please verify your 6-digit OTP before logging in." });
        }

        if (user.AccountStatus == AccountStatuses.Rejected)
        {
            return Unauthorized(new { message = "Your registration request has been rejected by the administrator." });
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
                AccountStatus = user.AccountStatus,
                PhotoPath = user.PhotoPath ?? user.StaffProfile?.PhotoPath ?? user.ParentProfile?.PhotoPath,
                StaffId = user.StaffProfile?.Id,
                ParentId = user.ParentProfile?.Id
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
            .Include(r => r.User)
            .ThenInclude(u => u.ParentProfile)
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
                AccountStatus = user.AccountStatus,
                PhotoPath = user.PhotoPath ?? user.StaffProfile?.PhotoPath ?? user.ParentProfile?.PhotoPath,
                StaffId = user.StaffProfile?.Id,
                ParentId = user.ParentProfile?.Id
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
            .Include(u => u.ParentProfile)
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
                AccountStatus = user.AccountStatus,
                PhotoPath = user.PhotoPath ?? user.StaffProfile?.PhotoPath ?? user.ParentProfile?.PhotoPath,
                StaffId = user.StaffProfile?.Id,
                ParentId = user.ParentProfile?.Id
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

    [HttpPost("forgot-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ForgotPassword([FromBody] ForgotPasswordRequest request)
    {
        // Safe generic response to avoid exposing email presence
        const string safeMessage = "If an account matching those details exists, a password reset link has been dispatched to your email.";

        var code = request.InstituteCode.Trim().ToUpperInvariant();
        var email = request.Email.Trim().ToLowerInvariant();

        var institute = await _context.Institutes.FirstOrDefaultAsync(i => i.Code == code);
        if (institute == null)
        {
            return Ok(new { message = safeMessage });
        }

        var user = await _context.Users
            .FirstOrDefaultAsync(u => u.InstituteId == institute.Id && u.Email.ToLower() == email && u.IsActive);

        if (user == null)
        {
            return Ok(new { message = safeMessage });
        }

        // Invalidate prior unused tokens
        var existingTokens = await _context.PasswordResetTokens
            .Where(t => t.UserId == user.Id && !t.IsUsed)
            .ToListAsync();
        foreach (var t in existingTokens) t.IsUsed = true;

        // Generate cryptographically random token
        var rawToken = Convert.ToHexString(RandomNumberGenerator.GetBytes(32));
        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(rawToken)));

        var resetToken = new PasswordResetToken
        {
            InstituteId = institute.Id,
            UserId = user.Id,
            TokenHash = tokenHash,
            ExpiresAt = DateTime.UtcNow.AddMinutes(30),
            IsUsed = false,
            CreatedAt = DateTime.UtcNow
        };

        _context.PasswordResetTokens.Add(resetToken);
        await _context.SaveChangesAsync();

        var frontendUrl = _configuration["FrontendUrl"] ?? "http://localhost:4200";
        var resetLink = $"{frontendUrl}/reset-password?token={rawToken}";

        await _emailService.SendPasswordResetEmailAsync(user.Email, resetLink, user.FullName);

        return Ok(new { message = safeMessage });
    }

    [HttpPost("reset-password")]
    [AllowAnonymous]
    public async Task<IActionResult> ResetPassword([FromBody] ResetPasswordRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return BadRequest(new { message = "Reset token is required." });
        }

        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(request.Token.Trim())));

        var resetToken = await _context.PasswordResetTokens
            .Include(t => t.User)
            .FirstOrDefaultAsync(t => t.TokenHash == tokenHash);

        if (resetToken == null || resetToken.IsUsed || resetToken.IsExpired)
        {
            return BadRequest(new { message = "The password reset link is invalid or has expired. Please request a new one." });
        }

        resetToken.IsUsed = true;

        resetToken.User.PasswordHash = _passwordService.HashPassword(resetToken.User, request.NewPassword);

        // Revoke active refresh tokens for security
        var activeRefreshTokens = await _context.RefreshTokens
            .Where(r => r.UserId == resetToken.UserId && !r.IsRevoked)
            .ToListAsync();
        foreach (var r in activeRefreshTokens) r.IsRevoked = true;

        await _context.SaveChangesAsync();

        return Ok(new { message = "Your password has been reset successfully. You may now log in with your new password." });
    }

    [HttpPost("register-invite")]
    [AllowAnonymous]
    public async Task<IActionResult> RegisterWithInvite([FromBody] RegisterWithInviteRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Token))
        {
            return BadRequest(new { message = "Invitation token is required." });
        }

        var tokenHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(request.Token.Trim())));

        var invite = await _context.UserInvites
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(ui => ui.TokenHash == tokenHash && ui.IsActive);

        if (invite == null || invite.IsUsed || invite.ExpiresAt <= DateTime.UtcNow)
        {
            return BadRequest(new { message = "This invitation link is invalid or has expired. Please request a new invite from your administrator." });
        }

        var institute = await _context.Institutes
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(i => i.Id == invite.InstituteId);

        if (institute == null)
        {
            return BadRequest(new { message = "Invalid institute." });
        }

        var email = invite.Email.ToLowerInvariant();
        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.InstituteId == institute.Id && u.Email.ToLower() == email);

        if (user == null)
        {
            user = new User
            {
                InstituteId = institute.Id,
                Email = email,
                FullName = string.IsNullOrWhiteSpace(request.FullName) ? invite.FullName : request.FullName.Trim(),
                Role = invite.Role,
                AccountStatus = AccountStatuses.PendingOtp,
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            };
            user.PasswordHash = _passwordService.HashPassword(user, request.Password);
            _context.Users.Add(user);
        }
        else
        {
            user.FullName = string.IsNullOrWhiteSpace(request.FullName) ? user.FullName : request.FullName.Trim();
            user.AccountStatus = AccountStatuses.PendingOtp;
            user.PasswordHash = _passwordService.HashPassword(user, request.Password);
        }

        invite.IsUsed = true;
        await _context.SaveChangesAsync();

        // Generate 6-digit OTP
        var otpCode = RandomNumberGenerator.GetInt32(100000, 999999).ToString("D6");
        var otpHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(otpCode)));

        // Invalidate prior registration OTPs for this email
        var priorOtps = await _context.OtpVerifications
            .IgnoreQueryFilters()
            .Where(o => o.InstituteId == institute.Id && o.Email == email && o.Purpose == "RegistrationOtp" && !o.IsVerified)
            .ToListAsync();
        foreach (var po in priorOtps) po.IsActive = false;

        var otpRecord = new OtpVerification
        {
            InstituteId = institute.Id,
            UserId = user.Id,
            Email = email,
            Purpose = "RegistrationOtp",
            OtpHash = otpHash,
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            Attempts = 0,
            IsVerified = false,
            LastResentAt = DateTime.UtcNow,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        _context.OtpVerifications.Add(otpRecord);
        await _context.SaveChangesAsync();

        // Dispatch OTP
        await _notificationService.SendOtpAsync(email, request.Phone ?? invite.Phone, user.FullName, otpCode);

        return Ok(new
        {
            message = "Registration details submitted. A 6-digit verification code has been sent to your email.",
            email = email,
            instituteCode = institute.Code,
            fullName = user.FullName
        });
    }

    [HttpPost("verify-registration-otp")]
    [AllowAnonymous]
    public async Task<IActionResult> VerifyRegistrationOtp([FromBody] VerifyRegistrationOtpRequest request)
    {
        var code = request.InstituteCode.Trim().ToUpperInvariant();
        var email = request.Email.Trim().ToLowerInvariant();

        var institute = await _context.Institutes.IgnoreQueryFilters().FirstOrDefaultAsync(i => i.Code == code);
        if (institute == null) return BadRequest(new { message = "Invalid institute code." });

        var user = await _context.Users
            .IgnoreQueryFilters()
            .FirstOrDefaultAsync(u => u.InstituteId == institute.Id && u.Email.ToLower() == email);

        if (user == null) return BadRequest(new { message = "User not found." });

        var otpRecord = await _context.OtpVerifications
            .IgnoreQueryFilters()
            .Where(o => o.InstituteId == institute.Id && o.Email == email && o.Purpose == "RegistrationOtp" && o.IsActive && !o.IsVerified)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync();

        if (otpRecord == null || otpRecord.ExpiresAt <= DateTime.UtcNow)
        {
            return BadRequest(new { message = "The verification code has expired. Please request a new code." });
        }

        if (otpRecord.Attempts >= 5)
        {
            return BadRequest(new { message = "Too many failed attempts. Please request a new verification code." });
        }

        otpRecord.Attempts++;

        var inputHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(request.Otp.Trim())));
        if (otpRecord.OtpHash != inputHash)
        {
            await _context.SaveChangesAsync();
            var remaining = 5 - otpRecord.Attempts;
            return BadRequest(new { message = $"Incorrect verification code. {remaining} attempt(s) remaining." });
        }

        otpRecord.IsVerified = true;
        user.AccountStatus = AccountStatuses.PendingApproval;

        // Create or update corresponding domain profile in inactive state
        if (user.Role == Roles.Staff)
        {
            var staff = await _context.StaffMembers.IgnoreQueryFilters().FirstOrDefaultAsync(s => s.UserId == user.Id);
            if (staff == null)
            {
                _context.StaffMembers.Add(new Staff
                {
                    InstituteId = institute.Id,
                    UserId = user.Id,
                    FullName = user.FullName,
                    Email = user.Email,
                    EmployeeId = $"EMP-{user.Id:D3}",
                    Phone = "",
                    IsActive = false,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }
        else if (user.Role == Roles.Parent)
        {
            var parent = await _context.Parents.IgnoreQueryFilters().FirstOrDefaultAsync(p => p.UserId == user.Id);
            if (parent == null)
            {
                _context.Parents.Add(new Parent
                {
                    InstituteId = institute.Id,
                    UserId = user.Id,
                    FullName = user.FullName,
                    Email = user.Email,
                    Phone = "",
                    IsActive = false,
                    CreatedAt = DateTime.UtcNow
                });
            }
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            message = "Registration successful! Your account is now pending administrator approval. You will receive an email once approved."
        });
    }

    [HttpPost("resend-registration-otp")]
    [AllowAnonymous]
    public async Task<IActionResult> ResendRegistrationOtp([FromBody] ResendRegistrationOtpRequest request)
    {
        var code = request.InstituteCode.Trim().ToUpperInvariant();
        var email = request.Email.Trim().ToLowerInvariant();

        var institute = await _context.Institutes.IgnoreQueryFilters().FirstOrDefaultAsync(i => i.Code == code);
        if (institute == null) return BadRequest(new { message = "Invalid institute." });

        var user = await _context.Users.IgnoreQueryFilters().FirstOrDefaultAsync(u => u.InstituteId == institute.Id && u.Email.ToLower() == email);
        if (user == null) return BadRequest(new { message = "User not found." });

        var latestOtp = await _context.OtpVerifications
            .IgnoreQueryFilters()
            .Where(o => o.InstituteId == institute.Id && o.Email == email && o.Purpose == "RegistrationOtp" && o.IsActive)
            .OrderByDescending(o => o.CreatedAt)
            .FirstOrDefaultAsync();

        // 60-second cooldown
        if (latestOtp != null && DateTime.UtcNow < latestOtp.LastResentAt.AddSeconds(60))
        {
            var waitSec = (int)(latestOtp.LastResentAt.AddSeconds(60) - DateTime.UtcNow).TotalSeconds;
            return BadRequest(new { message = $"Please wait {waitSec} second(s) before requesting a new code." });
        }

        if (latestOtp != null) latestOtp.IsActive = false;

        var otpCode = RandomNumberGenerator.GetInt32(100000, 999999).ToString("D6");
        var otpHash = Convert.ToHexString(SHA256.HashData(Encoding.UTF8.GetBytes(otpCode)));

        var newOtp = new OtpVerification
        {
            InstituteId = institute.Id,
            UserId = user.Id,
            Email = email,
            Purpose = "RegistrationOtp",
            OtpHash = otpHash,
            ExpiresAt = DateTime.UtcNow.AddMinutes(10),
            Attempts = 0,
            IsVerified = false,
            LastResentAt = DateTime.UtcNow,
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };
        _context.OtpVerifications.Add(newOtp);
        await _context.SaveChangesAsync();

        await _notificationService.SendOtpAsync(email, "", user.FullName, otpCode);

        return Ok(new { message = "A new verification code has been dispatched to your email." });
    }
}
