namespace StudentAttendance.Api.Models;

public interface IMustHaveTenant
{
    int InstituteId { get; set; }
}

public interface ISoftDeletable
{
    bool IsActive { get; set; }
}

public interface IAuditable
{
    DateTime CreatedAt { get; set; }
}

public abstract class BaseTenantEntity : IMustHaveTenant, ISoftDeletable, IAuditable
{
    public int Id { get; set; }
    public int InstituteId { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
}
