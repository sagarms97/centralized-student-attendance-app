using System.ComponentModel.DataAnnotations;

namespace StudentAttendance.Api.DTOs;

public class SendInviteRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required, StringLength(150, MinimumLength = 2)]
    public string FullName { get; set; } = string.Empty;

    [Required, Phone]
    public string Phone { get; set; } = string.Empty;

    [Required]
    public string Role { get; set; } = "Staff"; // Staff or Parent

    // Staff specifics
    public string? EmployeeId { get; set; }
    public string? SubjectSpecialization { get; set; }

    // Parent specifics
    public List<int>? LinkedStudentIds { get; set; }
}

public class SendInviteResponse
{
    public int InviteId { get; set; }
    public string Email { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string InviteLink { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
}

public class ValidateInviteResponse
{
    public bool IsValid { get; set; }
    public string? Message { get; set; }
    public string? Email { get; set; }
    public string? FullName { get; set; }
    public string? Phone { get; set; }
    public string? Role { get; set; }
    public string? InstituteName { get; set; }
    public string? InstituteCode { get; set; }
    public string? EmployeeId { get; set; }
    public string? SubjectSpecialization { get; set; }
}

public class RegisterWithInviteRequest
{
    [Required]
    public string Token { get; set; } = string.Empty;

    [Required, MinLength(6)]
    public string Password { get; set; } = string.Empty;

    [Required, Compare(nameof(Password), ErrorMessage = "Passwords do not match")]
    public string ConfirmPassword { get; set; } = string.Empty;

    public string? FullName { get; set; }
    public string? Phone { get; set; }
    public string? Address { get; set; }
}

public class VerifyRegistrationOtpRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string InstituteCode { get; set; } = string.Empty;

    [Required, StringLength(6, MinimumLength = 6)]
    public string Otp { get; set; } = string.Empty;
}

public class ResendRegistrationOtpRequest
{
    [Required, EmailAddress]
    public string Email { get; set; } = string.Empty;

    [Required]
    public string InstituteCode { get; set; } = string.Empty;
}

public class PendingApprovalUserDto
{
    public int UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public string AccountStatus { get; set; } = string.Empty;
    public string? EmployeeId { get; set; }
    public string? SubjectSpecialization { get; set; }
    public string? Address { get; set; }
    public int LinkedStudentsCount { get; set; }
    public List<string> LinkedStudents { get; set; } = new();
    public DateTime CreatedAt { get; set; }
}

public class RejectApprovalRequest
{
    [Required, StringLength(500, MinimumLength = 3)]
    public string Reason { get; set; } = string.Empty;
}
