using System.ComponentModel.DataAnnotations;

namespace StudentAttendance.Api.DTOs;

public class StaffDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string EmployeeId { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? SubjectSpecialization { get; set; }
    public string? PhotoPath { get; set; }
    public bool HasPhoto => !string.IsNullOrEmpty(PhotoPath);
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateStaffRequest
{
    [Required, StringLength(50)]
    public string EmployeeId { get; set; } = string.Empty;

    [Required, StringLength(150)]
    public string FullName { get; set; } = string.Empty;

    [Required, EmailAddress, StringLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required, Phone, StringLength(20)]
    public string Phone { get; set; } = string.Empty;

    [StringLength(100)]
    public string? SubjectSpecialization { get; set; }

    [Required, StringLength(100, MinimumLength = 6)]
    public string InitialPassword { get; set; } = "Staff@123456";
}

public class UpdateStaffRequest
{
    [Required, StringLength(150)]
    public string FullName { get; set; } = string.Empty;

    [Required, EmailAddress, StringLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required, Phone, StringLength(20)]
    public string Phone { get; set; } = string.Empty;

    [StringLength(100)]
    public string? SubjectSpecialization { get; set; }

    public bool IsActive { get; set; } = true;
}
