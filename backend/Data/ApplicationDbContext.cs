using Microsoft.EntityFrameworkCore;
using StudentAttendance.Api.Models;
using StudentAttendance.Api.Services;

namespace StudentAttendance.Api.Data;

public class ApplicationDbContext : DbContext
{
    private readonly ICurrentTenantService _tenantService;

    public ApplicationDbContext(
        DbContextOptions<ApplicationDbContext> options,
        ICurrentTenantService tenantService) : base(options)
    {
        _tenantService = tenantService;
    }

    public DbSet<Institute> Institutes => Set<Institute>();
    public DbSet<User> Users => Set<User>();
    public DbSet<RefreshToken> RefreshTokens => Set<RefreshToken>();
    public DbSet<Staff> StaffMembers => Set<Staff>();
    public DbSet<ClassEntity> Classes => Set<ClassEntity>();
    public DbSet<Subject> Subjects => Set<Subject>();
    public DbSet<Period> Periods => Set<Period>();
    public DbSet<Student> Students => Set<Student>();
    public DbSet<TimetableEntry> TimetableEntries => Set<TimetableEntry>();
    public DbSet<PeriodSwapRequest> PeriodSwapRequests => Set<PeriodSwapRequest>();
    public DbSet<AttendanceRecord> AttendanceRecords => Set<AttendanceRecord>();
    public DbSet<Parent> Parents => Set<Parent>();
    public DbSet<ParentStudent> ParentStudents => Set<ParentStudent>();
    public DbSet<LeaveRequest> LeaveRequests => Set<LeaveRequest>();
    public DbSet<ClassSubject> ClassSubjects => Set<ClassSubject>();
    public DbSet<PasswordResetToken> PasswordResetTokens => Set<PasswordResetToken>();

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        // Global query filter for multi-tenancy & soft delete
        modelBuilder.Entity<Staff>().HasQueryFilter(e => (_tenantService.InstituteId == null || e.InstituteId == _tenantService.InstituteId) && e.IsActive);
        modelBuilder.Entity<ClassEntity>().HasQueryFilter(e => (_tenantService.InstituteId == null || e.InstituteId == _tenantService.InstituteId) && e.IsActive);
        modelBuilder.Entity<Subject>().HasQueryFilter(e => (_tenantService.InstituteId == null || e.InstituteId == _tenantService.InstituteId) && e.IsActive);
        modelBuilder.Entity<Period>().HasQueryFilter(e => (_tenantService.InstituteId == null || e.InstituteId == _tenantService.InstituteId) && e.IsActive);
        modelBuilder.Entity<Student>().HasQueryFilter(e => (_tenantService.InstituteId == null || e.InstituteId == _tenantService.InstituteId) && e.IsActive);
        modelBuilder.Entity<TimetableEntry>().HasQueryFilter(e => (_tenantService.InstituteId == null || e.InstituteId == _tenantService.InstituteId) && e.IsActive);
        modelBuilder.Entity<PeriodSwapRequest>().HasQueryFilter(e => (_tenantService.InstituteId == null || e.InstituteId == _tenantService.InstituteId) && e.IsActive);
        modelBuilder.Entity<AttendanceRecord>().HasQueryFilter(e => (_tenantService.InstituteId == null || e.InstituteId == _tenantService.InstituteId) && e.IsActive);
        modelBuilder.Entity<Parent>().HasQueryFilter(e => (_tenantService.InstituteId == null || e.InstituteId == _tenantService.InstituteId) && e.IsActive);
        modelBuilder.Entity<ParentStudent>().HasQueryFilter(e => (_tenantService.InstituteId == null || e.InstituteId == _tenantService.InstituteId) && e.IsActive);
        modelBuilder.Entity<LeaveRequest>().HasQueryFilter(e => (_tenantService.InstituteId == null || e.InstituteId == _tenantService.InstituteId) && e.IsActive);
        modelBuilder.Entity<ClassSubject>().HasQueryFilter(e => (_tenantService.InstituteId == null || e.InstituteId == _tenantService.InstituteId) && e.IsActive);
        modelBuilder.Entity<PasswordResetToken>().HasQueryFilter(e => (_tenantService.InstituteId == null || e.InstituteId == _tenantService.InstituteId));

        modelBuilder.Entity<Institute>().HasQueryFilter(e => e.IsActive);
        modelBuilder.Entity<User>().HasQueryFilter(e => (_tenantService.InstituteId == null || e.InstituteId == _tenantService.InstituteId || e.InstituteId == null) && e.IsActive);
        modelBuilder.Entity<RefreshToken>().HasQueryFilter(e => !e.IsRevoked);

        // Institute
        modelBuilder.Entity<Institute>(entity =>
        {
            entity.HasIndex(i => i.Code).IsUnique();
            entity.Property(i => i.Name).HasMaxLength(150).IsRequired();
            entity.Property(i => i.Code).HasMaxLength(50).IsRequired();
            entity.Property(i => i.ContactEmail).HasMaxLength(150).IsRequired();
        });

        // User
        modelBuilder.Entity<User>(entity =>
        {
            entity.HasIndex(u => new { u.InstituteId, u.Email }).IsUnique();
            entity.Property(u => u.Email).HasMaxLength(150).IsRequired();
            entity.Property(u => u.FullName).HasMaxLength(150).IsRequired();
            entity.Property(u => u.Role).HasMaxLength(50).IsRequired();

            entity.HasOne(u => u.Institute)
                  .WithMany(i => i.Users)
                  .HasForeignKey(u => u.InstituteId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // Staff
        modelBuilder.Entity<Staff>(entity =>
        {
            entity.HasIndex(s => new { s.InstituteId, s.EmployeeId }).IsUnique();
            entity.Property(s => s.EmployeeId).HasMaxLength(50).IsRequired();
            entity.Property(s => s.FullName).HasMaxLength(150).IsRequired();
            entity.Property(s => s.Email).HasMaxLength(150).IsRequired();

            entity.HasOne(s => s.User)
                  .WithOne(u => u.StaffProfile)
                  .HasForeignKey<Staff>(s => s.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // Class
        modelBuilder.Entity<ClassEntity>(entity =>
        {
            entity.HasIndex(c => new { c.InstituteId, c.Name }).IsUnique();
            entity.Property(c => c.Name).HasMaxLength(50).IsRequired();
        });

        // Subject
        modelBuilder.Entity<Subject>(entity =>
        {
            entity.HasIndex(s => new { s.InstituteId, s.Code }).IsUnique();
            entity.Property(s => s.Name).HasMaxLength(100).IsRequired();
            entity.Property(s => s.Code).HasMaxLength(50).IsRequired();
        });

        // Period
        modelBuilder.Entity<Period>(entity =>
        {
            entity.HasIndex(p => new { p.InstituteId, p.PeriodNumber }).IsUnique();
            entity.Property(p => p.Name).HasMaxLength(50).IsRequired();
        });

        // Student
        modelBuilder.Entity<Student>(entity =>
        {
            entity.HasIndex(s => new { s.InstituteId, s.RollNo }).IsUnique();
            entity.HasIndex(s => new { s.InstituteId, s.ClassId, s.Section });
            entity.Property(s => s.RollNo).HasMaxLength(50).IsRequired();
            entity.Property(s => s.FirstName).HasMaxLength(100).IsRequired();
            entity.Property(s => s.LastName).HasMaxLength(100).IsRequired();
            entity.Property(s => s.Section).HasMaxLength(10).IsRequired();
            entity.Property(s => s.ParentPhone).HasMaxLength(20).IsRequired();

            entity.HasOne(s => s.Class)
                  .WithMany(c => c.Students)
                  .HasForeignKey(s => s.ClassId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // TimetableEntry
        modelBuilder.Entity<TimetableEntry>(entity =>
        {
            // Double booking prevention for Staff
            entity.HasIndex(t => new { t.InstituteId, t.DayOfWeek, t.PeriodId, t.StaffId }).IsUnique();
            // Double booking prevention for Class & Section
            entity.HasIndex(t => new { t.InstituteId, t.DayOfWeek, t.PeriodId, t.ClassId, t.Section }).IsUnique();

            entity.HasOne(t => t.Class)
                  .WithMany(c => c.TimetableEntries)
                  .HasForeignKey(t => t.ClassId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(t => t.Period)
                  .WithMany(p => p.TimetableEntries)
                  .HasForeignKey(t => t.PeriodId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(t => t.Subject)
                  .WithMany(s => s.TimetableEntries)
                  .HasForeignKey(t => t.SubjectId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(t => t.Staff)
                  .WithMany(st => st.TimetableEntries)
                  .HasForeignKey(t => t.StaffId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // PeriodSwapRequest
        modelBuilder.Entity<PeriodSwapRequest>(entity =>
        {
            entity.HasIndex(r => new { r.InstituteId, r.SwapDate, r.Status });

            entity.HasOne(r => r.TimetableEntry)
                  .WithMany(t => t.SwapRequests)
                  .HasForeignKey(r => r.TimetableEntryId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(r => r.RequesterStaff)
                  .WithMany(s => s.RequestedSwaps)
                  .HasForeignKey(r => r.RequesterStaffId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(r => r.TargetStaff)
                  .WithMany(s => s.ReceivedSwaps)
                  .HasForeignKey(r => r.TargetStaffId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(r => r.ReviewedByUser)
                  .WithMany()
                  .HasForeignKey(r => r.ReviewedByUserId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // AttendanceRecord
        modelBuilder.Entity<AttendanceRecord>(entity =>
        {
            // Unique constraint on (InstituteId, Date, PeriodId, StudentId)
            entity.HasIndex(a => new { a.InstituteId, a.Date, a.PeriodId, a.StudentId }).IsUnique();
            entity.HasIndex(a => new { a.InstituteId, a.Date });
            entity.HasIndex(a => new { a.InstituteId, a.StudentId, a.Date });

            entity.HasOne(a => a.Student)
                  .WithMany(s => s.AttendanceRecords)
                  .HasForeignKey(a => a.StudentId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(a => a.Period)
                  .WithMany(p => p.AttendanceRecords)
                  .HasForeignKey(a => a.PeriodId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(a => a.TimetableEntry)
                  .WithMany(t => t.AttendanceRecords)
                  .HasForeignKey(a => a.TimetableEntryId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(a => a.MarkedByUser)
                  .WithMany()
                  .HasForeignKey(a => a.MarkedByUserId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // Parent
        modelBuilder.Entity<Parent>(entity =>
        {
            entity.HasIndex(p => new { p.InstituteId, p.Email }).IsUnique();
            entity.Property(p => p.FullName).HasMaxLength(150).IsRequired();
            entity.Property(p => p.Email).HasMaxLength(150).IsRequired();
            entity.Property(p => p.Phone).HasMaxLength(20).IsRequired();

            entity.HasOne(p => p.User)
                  .WithOne(u => u.ParentProfile)
                  .HasForeignKey<Parent>(p => p.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });

        // ParentStudent
        modelBuilder.Entity<ParentStudent>(entity =>
        {
            entity.HasIndex(ps => new { ps.InstituteId, ps.ParentId, ps.StudentId }).IsUnique();
            entity.Property(ps => ps.Relationship).HasMaxLength(50).IsRequired();

            entity.HasOne(ps => ps.Parent)
                  .WithMany(p => p.ChildrenLinks)
                  .HasForeignKey(ps => ps.ParentId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(ps => ps.Student)
                  .WithMany(s => s.ParentLinks)
                  .HasForeignKey(ps => ps.StudentId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // LeaveRequest
        modelBuilder.Entity<LeaveRequest>(entity =>
        {
            entity.HasIndex(lr => new { lr.InstituteId, lr.StudentId, lr.Status });

            entity.HasOne(lr => lr.Student)
                  .WithMany(s => s.LeaveRequests)
                  .HasForeignKey(lr => lr.StudentId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(lr => lr.Parent)
                  .WithMany(p => p.LeaveRequests)
                  .HasForeignKey(lr => lr.ParentId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(lr => lr.ReviewedByUser)
                  .WithMany()
                  .HasForeignKey(lr => lr.ReviewedByUserId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // ClassSubject
        modelBuilder.Entity<ClassSubject>(entity =>
        {
            entity.HasIndex(cs => new { cs.InstituteId, cs.ClassId, cs.SubjectId }).IsUnique();

            entity.HasOne(cs => cs.Class)
                  .WithMany(c => c.ClassSubjects)
                  .HasForeignKey(cs => cs.ClassId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(cs => cs.Subject)
                  .WithMany(s => s.ClassSubjects)
                  .HasForeignKey(cs => cs.SubjectId)
                  .OnDelete(DeleteBehavior.Restrict);

            entity.HasOne(cs => cs.DefaultStaff)
                  .WithMany(st => st.DefaultAssignedClassSubjects)
                  .HasForeignKey(cs => cs.DefaultStaffId)
                  .OnDelete(DeleteBehavior.Restrict);
        });

        // PasswordResetToken
        modelBuilder.Entity<PasswordResetToken>(entity =>
        {
            entity.HasIndex(rt => rt.TokenHash);
            entity.Property(rt => rt.TokenHash).HasMaxLength(256).IsRequired();

            entity.HasOne(rt => rt.User)
                  .WithMany(u => u.PasswordResetTokens)
                  .HasForeignKey(rt => rt.UserId)
                  .OnDelete(DeleteBehavior.Cascade);
        });
    }

    public override Task<int> SaveChangesAsync(CancellationToken cancellationToken = default)
    {
        var tenantId = _tenantService.InstituteId;

        foreach (var entry in ChangeTracker.Entries())
        {
            if (entry.Entity is IMustHaveTenant tenantEntity && entry.State == EntityState.Added)
            {
                if (tenantEntity.InstituteId == 0 && tenantId.HasValue)
                {
                    tenantEntity.InstituteId = tenantId.Value;
                }
            }

            if (entry.Entity is IAuditable auditableEntity && entry.State == EntityState.Added)
            {
                if (auditableEntity.CreatedAt == default)
                {
                    auditableEntity.CreatedAt = DateTime.UtcNow;
                }
            }

            if (entry.State == EntityState.Deleted && entry.Entity is ISoftDeletable softDeletable)
            {
                entry.State = EntityState.Modified;
                softDeletable.IsActive = false;
            }
        }

        return base.SaveChangesAsync(cancellationToken);
    }
}
