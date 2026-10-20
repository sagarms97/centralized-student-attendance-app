using System.ComponentModel.DataAnnotations;

namespace StudentAttendance.Api.DTOs;

public class UserProfileDto
{
    public int Id { get; set; }
    public int? InstituteId { get; set; }
    public string? InstituteName { get; set; }
    public string? InstituteCode { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string AccountStatus { get; set; } = string.Empty;
    public string? PhotoPath { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
    public string? EmployeeId { get; set; }
    public string? SubjectSpecialization { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class ChangePasswordRequest
{
    [Required]
    public string CurrentPassword { get; set; } = string.Empty;

    [Required, MinLength(6, ErrorMessage = "New password must be at least 6 characters.")]
    public string NewPassword { get; set; } = string.Empty;

    [Required, Compare(nameof(NewPassword), ErrorMessage = "Passwords do not match.")]
    public string ConfirmPassword { get; set; } = string.Empty;
}

public class ForgotPasswordRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string InstituteCode { get; set; } = string.Empty;
}

public class ResetPasswordRequest
{
    [Required]
    public string Token { get; set; } = string.Empty;

    [Required, MinLength(6, ErrorMessage = "New password must be at least 6 characters.")]
    public string NewPassword { get; set; } = string.Empty;

    [Required, Compare(nameof(NewPassword), ErrorMessage = "Passwords do not match.")]
    public string ConfirmPassword { get; set; } = string.Empty;
}
