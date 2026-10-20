using System.ComponentModel.DataAnnotations;

namespace StudentAttendance.Api.DTOs;

public class RegisterInstituteRequest
{
    [Required, StringLength(150, MinimumLength = 2)]
    public string CollegeName { get; set; } = string.Empty;

    [Required, StringLength(50, MinimumLength = 2)]
    public string InstituteCode { get; set; } = string.Empty;

    [Required, StringLength(250)]
    public string Address { get; set; } = string.Empty;

    [Required, StringLength(100)]
    public string City { get; set; } = string.Empty;

    [Required, StringLength(100)]
    public string State { get; set; } = string.Empty;

    [Required, EmailAddress, StringLength(150)]
    public string ContactEmail { get; set; } = string.Empty;

    [Required, Phone, StringLength(20)]
    public string ContactPhone { get; set; } = string.Empty;

    [Required, StringLength(150, MinimumLength = 2)]
    public string AdminName { get; set; } = string.Empty;

    [Required, EmailAddress, StringLength(150)]
    public string AdminEmail { get; set; } = string.Empty;

    [Required, StringLength(100, MinimumLength = 6)]
    public string AdminPassword { get; set; } = string.Empty;
}

public class LoginRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string Password { get; set; } = string.Empty;

    public string? InstituteCode { get; set; }
}

public class RefreshTokenRequest
{
    [Required]
    public string RefreshToken { get; set; } = string.Empty;
}

public class AuthResponse
{
    public string AccessToken { get; set; } = string.Empty;
    public string RefreshToken { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public UserDto User { get; set; } = null!;
    public InstituteDto? Institute { get; set; }
}

public class UserDto
{
    public int Id { get; set; }
    public int? InstituteId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public int? StaffId { get; set; }
}

public class InstituteDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public string Address { get; set; } = string.Empty;
    public string City { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string ContactEmail { get; set; } = string.Empty;
    public string ContactPhone { get; set; } = string.Empty;
    public string? LogoPath { get; set; }
}
