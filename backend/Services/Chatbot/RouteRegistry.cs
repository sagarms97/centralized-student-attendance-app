using StudentAttendance.Api.Models;

namespace StudentAttendance.Api.Services.Chatbot;

public class AppRouteEntry
{
    public string Key { get; set; } = string.Empty;
    public string Label { get; set; } = string.Empty;
    public string AngularRoute { get; set; } = string.Empty;
    public string[] AllowedRoles { get; set; } = Array.Empty<string>();
    public string[] Keywords { get; set; } = Array.Empty<string>();
    public string Description { get; set; } = string.Empty;
}

public interface IRouteRegistry
{
    IReadOnlyList<AppRouteEntry> GetAllRoutes();
    IReadOnlyList<AppRouteEntry> GetRoutesForRole(string role);
    AppRouteEntry? FindByKey(string key, string role);
    AppRouteEntry? MatchByKeyword(string message, string role);
    IEnumerable<AppRouteEntry> FuzzyMatch(string message, string role, int maxResults = 4);
}

public class RouteRegistry : IRouteRegistry
{
    private readonly List<AppRouteEntry> _routes = new();

    public RouteRegistry()
    {
        InitializeRoutes();
    }

    private void InitializeRoutes()
    {
        // 1. Dashboard
        _routes.Add(new AppRouteEntry
        {
            Key = "dashboard",
            Label = "Dashboard",
            AngularRoute = "/app/dashboard",
            AllowedRoles = new[] { Roles.InstituteAdmin, Roles.Staff, Roles.Parent },
            Keywords = new[] { "dashboard", "home", "main menu", "overview", "portal", "summary", "start" },
            Description = "Central overview dashboard with real-time stats and shortcuts."
        });

        // 2. SuperAdmin Platform Overview
        _routes.Add(new AppRouteEntry
        {
            Key = "super_admin_overview",
            Label = "Platform Overview",
            AngularRoute = "/app/super-admin",
            AllowedRoles = new[] { Roles.SuperAdmin },
            Keywords = new[] { "platform overview", "super admin", "colleges", "institutes", "all colleges", "platform", "tenants" },
            Description = "Global platform metrics, college directory, and institution onboarding."
        });

        // 3. SuperAdmin Audit Logs
        _routes.Add(new AppRouteEntry
        {
            Key = "super_admin_audit_logs",
            Label = "Platform Audit Logs",
            AngularRoute = "/app/super-admin/audit-logs",
            AllowedRoles = new[] { Roles.SuperAdmin },
            Keywords = new[] { "audit logs", "audit trail", "security trail", "security logs", "system logs", "audit", "history" },
            Description = "Immutable audit records tracking all administrative, security, and AI actions."
        });

        // 4. Staff Directory
        _routes.Add(new AppRouteEntry
        {
            Key = "staff_directory",
            Label = "Staff Directory",
            AngularRoute = "/app/staff",
            AllowedRoles = new[] { Roles.InstituteAdmin },
            Keywords = new[] { "staff directory", "staff", "staffs", "teachers", "teacher", "faculty", "professors", "employees", "staff list", "faculty list", "educators" },
            Description = "Manage faculty and staff profiles, view directory, and send registration invitations."
        });

        // 5. Students & Import
        _routes.Add(new AppRouteEntry
        {
            Key = "students_and_import",
            Label = "Students & Import",
            AngularRoute = "/app/students",
            AllowedRoles = new[] { Roles.InstituteAdmin },
            Keywords = new[] { "students & import", "students", "student", "student directory", "student list", "students list", "admissions", "import students", "roster", "pupils", "enrollment" },
            Description = "Manage student admissions, browse student rosters, and bulk import students via Excel."
        });

        // 6. Parent Directory
        _routes.Add(new AppRouteEntry
        {
            Key = "parent_directory",
            Label = "Parent Directory",
            AngularRoute = "/app/parents",
            AllowedRoles = new[] { Roles.InstituteAdmin },
            Keywords = new[] { "parent directory", "parents", "parent", "guardians", "guardian", "parent list", "families" },
            Description = "Manage parent profiles and link parents to their enrolled students."
        });

        // 7. Subjects Setup
        _routes.Add(new AppRouteEntry
        {
            Key = "subjects_setup",
            Label = "Subjects Setup",
            AngularRoute = "/app/subjects",
            AllowedRoles = new[] { Roles.InstituteAdmin },
            Keywords = new[] { "subjects setup", "subjects", "subject", "courses", "course", "add subject", "subject adding", "curriculum", "course catalog", "syllabus" },
            Description = "Manage academic curriculum, create subject codes, and assign department credit hours."
        });

        // 8. Timetable Setup
        _routes.Add(new AppRouteEntry
        {
            Key = "timetable_setup",
            Label = "Timetable Setup",
            AngularRoute = "/app/timetable",
            AllowedRoles = new[] { Roles.InstituteAdmin, Roles.Staff },
            Keywords = new[] { "timetable setup", "timetable", "time table", "schedule", "schedules", "periods", "period", "slots", "routine", "add timetable", "lecture schedule" },
            Description = "Configure class periods, assign faculty to lecture slots, and view timetable grids."
        });

        // 9. Approvals
        _routes.Add(new AppRouteEntry
        {
            Key = "approvals",
            Label = "Approvals",
            AngularRoute = "/app/approvals",
            AllowedRoles = new[] { Roles.InstituteAdmin },
            Keywords = new[] { "approvals", "pending approvals", "account approvals", "registration requests", "user approvals", "verify users", "approval" },
            Description = "Review and approve pending self-registration requests from staff and parents."
        });

        // 10. Mark Attendance
        _routes.Add(new AppRouteEntry
        {
            Key = "mark_attendance",
            Label = "Mark Attendance",
            AngularRoute = "/app/attendance",
            AllowedRoles = new[] { Roles.InstituteAdmin, Roles.Staff },
            Keywords = new[] { "mark attendance", "take attendance", "attendance register", "record attendance", "daily attendance", "attendance sheet", "attendance" },
            Description = "Mark and record daily class session attendance for assigned sections."
        });

        // 11. Period Swaps
        _routes.Add(new AppRouteEntry
        {
            Key = "period_swaps",
            Label = "Period Swaps",
            AngularRoute = "/app/swaps",
            AllowedRoles = new[] { Roles.InstituteAdmin, Roles.Staff },
            Keywords = new[] { "period swaps", "swaps", "swap", "swap requests", "period exchange", "lecture swap", "switch class", "cover class", "substitute" },
            Description = "Propose and respond to lecture period swap exchanges between colleagues."
        });

        // 12. Leave Requests
        _routes.Add(new AppRouteEntry
        {
            Key = "leave_requests",
            Label = "Leave Requests",
            AngularRoute = "/app/leaves",
            AllowedRoles = new[] { Roles.InstituteAdmin, Roles.Staff, Roles.Parent },
            Keywords = new[] { "leave requests", "leaves", "leave", "apply leave", "absence request", "sick leave", "leave approvals", "leave history", "vacation" },
            Description = "Submit, review, and track student and staff leave applications."
        });

        // 13. Reports & Analytics
        _routes.Add(new AppRouteEntry
        {
            Key = "reports_and_analytics",
            Label = "Reports & Analytics",
            AngularRoute = "/app/reports",
            AllowedRoles = new[] { Roles.InstituteAdmin, Roles.Staff },
            Keywords = new[] { "reports & analytics", "reports", "report", "analytics", "attendance reports", "defaulters", "defaulter list", "low attendance", "monthly attendance", "statistics" },
            Description = "Generate attendance percentage reports, monthly trends, and defaulter lists below 75%."
        });

        // 14. Parent Portal
        _routes.Add(new AppRouteEntry
        {
            Key = "parent_portal",
            Label = "Parent Portal & Attendance",
            AngularRoute = "/app/parent-portal",
            AllowedRoles = new[] { Roles.Parent },
            Keywords = new[] { "parent portal", "my children", "child attendance", "kid attendance", "child progress", "children", "my kids" },
            Description = "View real-time daily attendance and status reports for your children."
        });

        // 15. Profile & Security
        _routes.Add(new AppRouteEntry
        {
            Key = "profile",
            Label = "My Profile & Security",
            AngularRoute = "/app/dashboard", // Triggers dialog in UI
            AllowedRoles = new[] { Roles.SuperAdmin, Roles.InstituteAdmin, Roles.Staff, Roles.Parent },
            Keywords = new[] { "profile", "my profile", "account settings", "security", "change password", "credentials", "user details" },
            Description = "Manage personal profile details, account credentials, and password."
        });

        // 16. Help & Documentation
        _routes.Add(new AppRouteEntry
        {
            Key = "help",
            Label = "Help & User Manual",
            AngularRoute = "/app/dashboard",
            AllowedRoles = new[] { Roles.SuperAdmin, Roles.InstituteAdmin, Roles.Staff, Roles.Parent },
            Keywords = new[] { "help", "user manual", "manual", "documentation", "guide", "faq", "how to use", "support" },
            Description = "Application manual, workflow documentation, and FAQs."
        });
    }

    public IReadOnlyList<AppRouteEntry> GetAllRoutes() => _routes.AsReadOnly();

    public IReadOnlyList<AppRouteEntry> GetRoutesForRole(string role)
    {
        return _routes.Where(r => r.AllowedRoles.Contains(role, StringComparer.OrdinalIgnoreCase)).ToList().AsReadOnly();
    }

    public AppRouteEntry? FindByKey(string key, string role)
    {
        var cleanKey = (key ?? "").Trim().ToLowerInvariant();
        return _routes.FirstOrDefault(r =>
            string.Equals(r.Key, cleanKey, StringComparison.OrdinalIgnoreCase) &&
            r.AllowedRoles.Contains(role, StringComparer.OrdinalIgnoreCase));
    }

    public AppRouteEntry? MatchByKeyword(string message, string role)
    {
        var cleanMsg = (message ?? "").Trim().ToLowerInvariant();
        var allowed = GetRoutesForRole(role);

        // 1. Check if message explicitly mentions any registered key from ALL routes
        var globalKey = _routes
            .Where(r => cleanMsg.Contains(r.Key))
            .OrderByDescending(r => r.Key.Length)
            .FirstOrDefault();

        if (globalKey != null)
        {
            // If the user's role is allowed for this explicit key, return it.
            // If NOT allowed, return null so caller knows it was an unauthorized key.
            return globalKey.AllowedRoles.Contains(role, StringComparer.OrdinalIgnoreCase) ? globalKey : null;
        }

        // 2. Exact match with label or key
        var exact = allowed.FirstOrDefault(r =>
            string.Equals(r.Key, cleanMsg, StringComparison.OrdinalIgnoreCase) ||
            string.Equals(r.Label, cleanMsg, StringComparison.OrdinalIgnoreCase));
        if (exact != null) return exact;

        // 3. Exact match with any keyword
        var kwExact = allowed.FirstOrDefault(r =>
            r.Keywords.Any(k => string.Equals(k, cleanMsg, StringComparison.OrdinalIgnoreCase)));
        if (kwExact != null) return kwExact;

        // 4. Substring match by longest keyword (also normalizing underscores to spaces for comparison)
        var msgWithSpaces = cleanMsg.Replace('_', ' ');
        var kwSub = allowed
            .Where(r => r.Keywords.Any(k => cleanMsg.Contains(k) || msgWithSpaces.Contains(k)))
            .OrderByDescending(r => r.Keywords.Where(k => cleanMsg.Contains(k) || msgWithSpaces.Contains(k)).Max(k => k.Length))
            .FirstOrDefault();

        return kwSub;
    }

    public IEnumerable<AppRouteEntry> FuzzyMatch(string message, string role, int maxResults = 4)
    {
        var cleanMsg = (message ?? "").Trim().ToLowerInvariant();
        var allowed = GetRoutesForRole(role);
        var words = cleanMsg.Split(new[] { ' ', ',', '.', '?', '!', '/', '-' }, StringSplitOptions.RemoveEmptyEntries);

        var scored = allowed.Select(r =>
        {
            int score = 0;
            if (string.Equals(r.Key, cleanMsg, StringComparison.OrdinalIgnoreCase)) score += 50;
            if (string.Equals(r.Label, cleanMsg, StringComparison.OrdinalIgnoreCase)) score += 50;

            foreach (var kw in r.Keywords)
            {
                if (string.Equals(kw, cleanMsg, StringComparison.OrdinalIgnoreCase)) score += 40;
                else if (cleanMsg.Contains(kw)) score += 20;
                else if (kw.Contains(cleanMsg) && cleanMsg.Length > 2) score += 15;
            }

            foreach (var w in words)
            {
                if (w.Length < 3) continue;
                if (r.Label.ToLowerInvariant().Contains(w)) score += 10;
                if (r.Keywords.Any(k => k.Contains(w))) score += 8;
            }

            return new { Route = r, Score = score };
        })
        .Where(x => x.Score > 0)
        .OrderByDescending(x => x.Score)
        .Take(maxResults)
        .Select(x => x.Route);

        return scored;
    }
}
