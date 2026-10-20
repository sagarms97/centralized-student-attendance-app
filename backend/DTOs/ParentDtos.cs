using System.ComponentModel.DataAnnotations;

namespace StudentAttendance.Api.DTOs;

public class LinkedStudentDto
{
    public int StudentId { get; set; }
    public string RollNo { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;
    public string Relationship { get; set; } = "Parent";
}

public class ParentDto
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public string FullName { get; set; } = string.Empty;
    public string Email { get; set; } = string.Empty;
    public string Phone { get; set; } = string.Empty;
    public string? Address { get; set; }
    public string? PhotoPath { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
    public List<LinkedStudentDto> LinkedStudents { get; set; } = new();
}

public class StudentLinkRequest
{
    [Required]
    public int StudentId { get; set; }

    [Required, StringLength(50)]
    public string Relationship { get; set; } = "Parent"; // Father, Mother, Guardian
}

public class CreateParentRequest
{
    [Required, StringLength(150)]
    public string FullName { get; set; } = string.Empty;

    [Required, EmailAddress, StringLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required, Phone, StringLength(20)]
    public string Phone { get; set; } = string.Empty;

    [StringLength(250)]
    public string? Address { get; set; }

    [Required, StringLength(100, MinimumLength = 6)]
    public string InitialPassword { get; set; } = "Parent@123456";

    public List<StudentLinkRequest> LinkedStudents { get; set; } = new();
}

public class UpdateParentRequest
{
    [Required, StringLength(150)]
    public string FullName { get; set; } = string.Empty;

    [Required, EmailAddress, StringLength(150)]
    public string Email { get; set; } = string.Empty;

    [Required, Phone, StringLength(20)]
    public string Phone { get; set; } = string.Empty;

    [StringLength(250)]
    public string? Address { get; set; }

    public bool IsActive { get; set; } = true;
}
