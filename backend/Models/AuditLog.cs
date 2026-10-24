namespace StudentAttendance.Api.Models;

public class AuditLog : IAuditable
{
    public int Id { get; set; }
    public int? InstituteId { get; set; }
    public Institute? Institute { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string UserEmail { get; set; } = string.Empty;
    public string Action { get; set; } = string.Empty;
    public string Details { get; set; } = string.Empty;
    public string? IpAddress { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
