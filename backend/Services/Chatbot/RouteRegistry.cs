using StudentAttendance.Api.DTOs;
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
    List<ChatSuggestionOption> GetSuggestionsForRoute(AppRouteEntry route, string role);
    List<ChatSuggestionOption> GetDefaultSuggestionsForRole(string role);
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

    public List<ChatSuggestionOption> GetSuggestionsForRoute(AppRouteEntry route, string role)
    {
        var list = new List<ChatSuggestionOption>();

        // 1. Primary action is always navigation to this route (if allowed for role)
        if (route.AllowedRoles.Contains(role, StringComparer.OrdinalIgnoreCase))
        {
            list.Add(new ChatSuggestionOption
            {
                Label = $"Open {route.Label}",
                Action = "navigate",
                Route = route.AngularRoute,
                RouteKey = route.Key
            });
        }

        // 2. Add ready-made question options based on route and role
        switch (route.Key)
        {
            case "reports_and_analytics":
                if (string.Equals(role, Roles.InstituteAdmin, StringComparison.OrdinalIgnoreCase))
                {
                    list.Add(new ChatSuggestionOption { Label = "Today's attendance summary", Action = "send_message", Query = "Today's attendance summary" });
                    list.Add(new ChatSuggestionOption { Label = "Students with low attendance", Action = "send_message", Query = "Students with low attendance" });
                    list.Add(new ChatSuggestionOption { Label = "Monthly attendance report", Action = "send_message", Query = "Monthly attendance report" });
                }
                else
                {
                    list.Add(new ChatSuggestionOption { Label = "Class attendance report", Action = "send_message", Query = "Class attendance report" });
                    list.Add(new ChatSuggestionOption { Label = "Students with low attendance", Action = "send_message", Query = "Students with low attendance" });
                }
                break;

            case "leave_requests":
                if (string.Equals(role, Roles.InstituteAdmin, StringComparison.OrdinalIgnoreCase))
                {
                    list.Add(new ChatSuggestionOption { Label = "Show pending leave requests", Action = "send_message", Query = "Show pending leave requests" });
                    list.Add(new ChatSuggestionOption { Label = "Open Approvals", Action = "navigate", Route = "/app/approvals", RouteKey = "approvals" });
                    list.Add(new ChatSuggestionOption { Label = "Leave requests summary", Action = "send_message", Query = "Leave requests summary" });
                }
                else if (string.Equals(role, Roles.Parent, StringComparison.OrdinalIgnoreCase))
                {
                    list.Add(new ChatSuggestionOption { Label = "Apply for leave", Action = "send_message", Query = "Apply leave for my child from tomorrow for 2 days due to fever" });
                    list.Add(new ChatSuggestionOption { Label = "View leave history", Action = "send_message", Query = "Show my leave history" });
                }
                else
                {
                    list.Add(new ChatSuggestionOption { Label = "Apply for leave", Action = "send_message", Query = "Apply for leave" });
                    list.Add(new ChatSuggestionOption { Label = "My leave history", Action = "send_message", Query = "My leave history" });
                }
                break;

            case "staff_directory":
                list.Add(new ChatSuggestionOption { Label = "Show staff directory", Action = "send_message", Query = "Show staff directory" });
                list.Add(new ChatSuggestionOption { Label = "How do I add a new faculty member?", Action = "send_message", Query = "How do I add a faculty member?" });
                break;

            case "students_and_import":
                list.Add(new ChatSuggestionOption { Label = "Show student directory", Action = "send_message", Query = "Show student directory" });
                list.Add(new ChatSuggestionOption { Label = "Show class strength and sections", Action = "send_message", Query = "Show class strength and sections" });
                break;

            case "parent_directory":
                list.Add(new ChatSuggestionOption { Label = "Show parent directory", Action = "send_message", Query = "Show parent directory" });
                list.Add(new ChatSuggestionOption { Label = "Link parent to student", Action = "send_message", Query = "How do I link a parent to a student?" });
                break;

            case "subjects_setup":
                list.Add(new ChatSuggestionOption { Label = "List all subjects", Action = "send_message", Query = "List all subjects" });
                list.Add(new ChatSuggestionOption { Label = "Add new subject", Action = "send_message", Query = "Add subject" });
                break;

            case "timetable_setup":
                if (string.Equals(role, Roles.Staff, StringComparison.OrdinalIgnoreCase))
                {
                    list.Add(new ChatSuggestionOption { Label = "Show my timetable today", Action = "send_message", Query = "Show my timetable" });
                    list.Add(new ChatSuggestionOption { Label = "Open Period Swaps", Action = "navigate", Route = "/app/swaps", RouteKey = "period_swaps" });
                }
                else
                {
                    list.Add(new ChatSuggestionOption { Label = "View timetable schedule", Action = "send_message", Query = "How do I setup timetable?" });
                    list.Add(new ChatSuggestionOption { Label = "Open Period Swaps", Action = "navigate", Route = "/app/swaps", RouteKey = "period_swaps" });
                }
                break;

            case "approvals":
                list.Add(new ChatSuggestionOption { Label = "Show pending approvals", Action = "send_message", Query = "Show pending approvals" });
                list.Add(new ChatSuggestionOption { Label = "Show pending leave requests", Action = "send_message", Query = "Show pending leave requests" });
                break;

            case "mark_attendance":
                if (string.Equals(role, Roles.Staff, StringComparison.OrdinalIgnoreCase))
                {
                    list.Add(new ChatSuggestionOption { Label = "My classes today", Action = "send_message", Query = "My classes today" });
                    list.Add(new ChatSuggestionOption { Label = "Check institute attendance", Action = "send_message", Query = "Check institute attendance" });
                }
                else
                {
                    list.Add(new ChatSuggestionOption { Label = "Today's attendance summary", Action = "send_message", Query = "Today's attendance summary" });
                    list.Add(new ChatSuggestionOption { Label = "Students with low attendance", Action = "send_message", Query = "Students with low attendance" });
                }
                break;

            case "period_swaps":
                list.Add(new ChatSuggestionOption { Label = "Show pending swaps", Action = "send_message", Query = "Check my pending swaps" });
                list.Add(new ChatSuggestionOption { Label = "Open Timetable Setup", Action = "navigate", Route = "/app/timetable", RouteKey = "timetable_setup" });
                break;

            case "super_admin_overview":
                list.Add(new ChatSuggestionOption { Label = "Platform overview stats", Action = "send_message", Query = "Platform Overview" });
                list.Add(new ChatSuggestionOption { Label = "List all colleges", Action = "send_message", Query = "List institutes" });
                list.Add(new ChatSuggestionOption { Label = "Open Audit Logs", Action = "navigate", Route = "/app/super-admin/audit-logs", RouteKey = "super_admin_audit_logs" });
                break;

            case "super_admin_audit_logs":
                list.Add(new ChatSuggestionOption { Label = "Recent audit logs", Action = "send_message", Query = "Show recent audit logs" });
                list.Add(new ChatSuggestionOption { Label = "Open Platform Overview", Action = "navigate", Route = "/app/super-admin", RouteKey = "super_admin_overview" });
                break;

            case "parent_portal":
                list.Add(new ChatSuggestionOption { Label = "My children's attendance", Action = "send_message", Query = "How is my child's attendance?" });
                list.Add(new ChatSuggestionOption { Label = "Apply for student leave", Action = "send_message", Query = "Apply leave for my child from tomorrow for 2 days due to fever" });
                break;

            default:
                if (string.Equals(role, Roles.InstituteAdmin, StringComparison.OrdinalIgnoreCase))
                {
                    list.Add(new ChatSuggestionOption { Label = "Today's attendance summary", Action = "send_message", Query = "Today's attendance summary" });
                    list.Add(new ChatSuggestionOption { Label = "Open Reports & Analytics", Action = "navigate", Route = "/app/reports", RouteKey = "reports_and_analytics" });
                }
                break;
        }

        return list.Take(4).ToList();
    }

    public List<ChatSuggestionOption> GetDefaultSuggestionsForRole(string role)
    {
        return role switch
        {
            Roles.SuperAdmin => new List<ChatSuggestionOption>
            {
                new() { Label = "Open Platform Overview", Action = "navigate", Route = "/app/super-admin", RouteKey = "super_admin_overview" },
                new() { Label = "Open Platform Audit Logs", Action = "navigate", Route = "/app/super-admin/audit-logs", RouteKey = "super_admin_audit_logs" },
                new() { Label = "Platform overview stats", Action = "send_message", Query = "Platform Overview" },
                new() { Label = "List all colleges", Action = "send_message", Query = "List institutes" }
            },
            Roles.InstituteAdmin => new List<ChatSuggestionOption>
            {
                new() { Label = "Open Dashboard", Action = "navigate", Route = "/app/dashboard", RouteKey = "dashboard" },
                new() { Label = "Open Reports & Analytics", Action = "navigate", Route = "/app/reports", RouteKey = "reports_and_analytics" },
                new() { Label = "Today's attendance summary", Action = "send_message", Query = "Today's attendance summary" },
                new() { Label = "Show pending leave requests", Action = "send_message", Query = "Show pending leave requests" }
            },
            Roles.Staff => new List<ChatSuggestionOption>
            {
                new() { Label = "Open Timetable Setup", Action = "navigate", Route = "/app/timetable", RouteKey = "timetable_setup" },
                new() { Label = "Open Mark Attendance", Action = "navigate", Route = "/app/attendance", RouteKey = "mark_attendance" },
                new() { Label = "Show my timetable today", Action = "send_message", Query = "Show my timetable" },
                new() { Label = "Apply for leave", Action = "send_message", Query = "Apply for leave" }
            },
            Roles.Parent => new List<ChatSuggestionOption>
            {
                new() { Label = "Open Parent Portal", Action = "navigate", Route = "/app/parent-portal", RouteKey = "parent_portal" },
                new() { Label = "Open Leave Requests", Action = "navigate", Route = "/app/leaves", RouteKey = "leave_requests" },
                new() { Label = "My children's attendance", Action = "send_message", Query = "How is my child's attendance?" },
                new() { Label = "Apply for student leave", Action = "send_message", Query = "Apply leave for my child from tomorrow for 2 days due to fever" }
            },
            _ => new List<ChatSuggestionOption>
            {
                new() { Label = "Open Dashboard", Action = "navigate", Route = "/app/dashboard", RouteKey = "dashboard" },
                new() { Label = "Help & Manual", Action = "navigate", Route = "/app/dashboard", RouteKey = "help" }
            }
        };
    }
}
