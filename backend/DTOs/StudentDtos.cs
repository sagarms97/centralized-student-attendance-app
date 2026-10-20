using System.ComponentModel.DataAnnotations;

namespace StudentAttendance.Api.DTOs;

public class StudentDto
{
    public int Id { get; set; }
    public string RollNo { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public int ClassId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public string Section { get; set; } = string.Empty;
    public string ParentPhone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public string? PhotoPath { get; set; }
    public bool IsActive { get; set; }
    public DateTime CreatedAt { get; set; }
}

public class CreateStudentRequest
{
    [Required, StringLength(50)]
    public string RollNo { get; set; } = string.Empty;

    [Required, StringLength(100)]
    public string FirstName { get; set; } = string.Empty;

    [Required, StringLength(100)]
    public string LastName { get; set; } = string.Empty;

    [Required]
    public int ClassId { get; set; }

    [Required, StringLength(10)]
    public string Section { get; set; } = "A";

    [Required, Phone, StringLength(20)]
    public string ParentPhone { get; set; } = string.Empty;

    [EmailAddress, StringLength(150)]
    public string? Email { get; set; }
}

public class UpdateStudentRequest : CreateStudentRequest
{
    public bool IsActive { get; set; } = true;
}

public class ExcelImportRowPreview
{
    public int RowNumber { get; set; }
    public string RollNo { get; set; } = string.Empty;
    public string FirstName { get; set; } = string.Empty;
    public string LastName { get; set; } = string.Empty;
    public string ClassName { get; set; } = string.Empty;
    public int? ClassId { get; set; }
    public string Section { get; set; } = string.Empty;
    public string ParentPhone { get; set; } = string.Empty;
    public string? Email { get; set; }
    public bool IsValid { get; set; }
    public List<string> Errors { get; set; } = new();
}

public class ExcelImportPreviewResult
{
    public int TotalRows { get; set; }
    public int ValidRowsCount { get; set; }
    public int InvalidRowsCount { get; set; }
    public List<ExcelImportRowPreview> Rows { get; set; } = new();
}

public class ConfirmImportRequest
{
    public List<CreateStudentRequest> Students { get; set; } = new();
}
