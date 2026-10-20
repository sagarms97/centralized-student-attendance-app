using System.ComponentModel.DataAnnotations;

namespace StudentAttendance.Api.DTOs;

public class SubjectDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public bool IsActive { get; set; } = true;
    public int AssignedClassCount { get; set; }
    public List<ClassSubjectAssignmentDto> AssignedClasses { get; set; } = new();
}

public class ClassSubjectAssignmentDto
{
    public int ClassSubjectId { get; set; }
    public int ClassId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public int? DefaultStaffId { get; set; }
    public string? DefaultStaffName { get; set; }
}

public class CreateSubjectRequest
{
    [Required, StringLength(100, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    [Required, StringLength(50, MinimumLength = 1)]
    public string Code { get; set; } = string.Empty;

    public List<ClassStaffAssignmentInput>? ClassAssignments { get; set; }
}

public class UpdateSubjectRequest
{
    [Required, StringLength(100, MinimumLength = 2)]
    public string Name { get; set; } = string.Empty;

    [Required, StringLength(50, MinimumLength = 1)]
    public string Code { get; set; } = string.Empty;
}

public class ClassStaffAssignmentInput
{
    public int ClassId { get; set; }
    public int? DefaultStaffId { get; set; }
}

public class SubjectStaffAssignmentInput
{
    public int SubjectId { get; set; }
    public int? DefaultStaffId { get; set; }
}

public class AssignSubjectToClassesRequest
{
    [Required]
    public List<ClassStaffAssignmentInput> Assignments { get; set; } = new();
}

public class AssignSubjectsToClassRequest
{
    [Required]
    public int ClassId { get; set; }
    [Required]
    public List<SubjectStaffAssignmentInput> Assignments { get; set; } = new();
}

public class ClassSubjectDto
{
    public int Id { get; set; }
    public int ClassId { get; set; }
    public string ClassName { get; set; } = string.Empty;
    public int SubjectId { get; set; }
    public string SubjectName { get; set; } = string.Empty;
    public string SubjectCode { get; set; } = string.Empty;
    public int? DefaultStaffId { get; set; }
    public string? DefaultStaffName { get; set; }
}
