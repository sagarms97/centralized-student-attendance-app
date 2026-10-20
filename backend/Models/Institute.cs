namespace StudentAttendance.Api.Models;

public class Institute : ISoftDeletable, IAuditable
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
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public ICollection<User> Users { get; set; } = new List<User>();
    public ICollection<Staff> StaffMembers { get; set; } = new List<Staff>();
    public ICollection<ClassEntity> Classes { get; set; } = new List<ClassEntity>();
    public ICollection<Subject> Subjects { get; set; } = new List<Subject>();
    public ICollection<Period> Periods { get; set; } = new List<Period>();
    public ICollection<Student> Students { get; set; } = new List<Student>();
    public ICollection<TimetableEntry> TimetableEntries { get; set; } = new List<TimetableEntry>();
    public ICollection<PeriodSwapRequest> PeriodSwapRequests { get; set; } = new List<PeriodSwapRequest>();
    public ICollection<AttendanceRecord> AttendanceRecords { get; set; } = new List<AttendanceRecord>();
    public ICollection<Parent> Parents { get; set; } = new List<Parent>();
}
