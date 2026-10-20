namespace StudentAttendance.Api.Models;

public static class Roles
{
    public const string SuperAdmin = "SuperAdmin";
    public const string InstituteAdmin = "InstituteAdmin";
    public const string Staff = "Staff";
    public const string Parent = "Parent";
}

public static class AccountStatuses
{
    public const string Active = "Active";
    public const string Invited = "Invited";
    public const string PendingOtp = "PendingOtp";
    public const string PendingApproval = "PendingApproval";
    public const string Rejected = "Rejected";
    public const string Disabled = "Disabled";
}

public class User : ISoftDeletable, IAuditable
{
    public int Id { get; set; }
    public int? InstituteId { get; set; }
    public Institute? Institute { get; set; }
    public string Email { get; set; } = string.Empty;
    public string PasswordHash { get; set; } = string.Empty;
    public string FullName { get; set; } = string.Empty;
    public string Role { get; set; } = Roles.Staff;
    public string AccountStatus { get; set; } = AccountStatuses.Active;
    public string? RejectionReason { get; set; }
    public string? PhotoPath { get; set; }
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public Staff? StaffProfile { get; set; }
    public Parent? ParentProfile { get; set; }
    public ICollection<RefreshToken> RefreshTokens { get; set; } = new List<RefreshToken>();
    public ICollection<PasswordResetToken> PasswordResetTokens { get; set; } = new List<PasswordResetToken>();
}

public class PasswordResetToken : IAuditable
{
    public int Id { get; set; }
    public int? InstituteId { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string TokenHash { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool IsUsed { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
    public bool IsActive => !IsUsed && !IsExpired;
}

public class RefreshToken : IAuditable
{
    public int Id { get; set; }
    public int UserId { get; set; }
    public User User { get; set; } = null!;
    public string Token { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; }
    public bool IsRevoked { get; set; } = false;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

    public bool IsExpired => DateTime.UtcNow >= ExpiresAt;
    public bool IsActive => !IsRevoked && !IsExpired;
}
