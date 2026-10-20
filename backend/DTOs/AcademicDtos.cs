using System.ComponentModel.DataAnnotations;

namespace StudentAttendance.Api.DTOs;

public class ClassDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Sections { get; set; } = string.Empty;
    public List<string> SectionList => Sections.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries).ToList();
    public int StudentCount { get; set; }
    public bool IsActive { get; set; }
}

public class CreateClassRequest
{
    [Required, StringLength(50)]
    public string Name { get; set; } = string.Empty;

    [Required, StringLength(100)]
    public string Sections { get; set; } = "A,B";
}

public class SubjectDto
{
    public int Id { get; set; }
    public string Name { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
    public bool IsActive { get; set; }
}

public class CreateSubjectRequest
{
    [Required, StringLength(100)]
    public string Name { get; set; } = string.Empty;

    [Required, StringLength(50)]
    public string Code { get; set; } = string.Empty;
}
