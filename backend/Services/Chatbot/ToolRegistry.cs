using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using StudentAttendance.Api.Data;
using StudentAttendance.Api.DTOs;
using StudentAttendance.Api.Models;

namespace StudentAttendance.Api.Services.Chatbot;

public interface IToolRegistry
{
    IEnumerable<ChatTool> GetAllTools();
    IEnumerable<ChatTool> GetToolsForRole(string role);
    ChatTool? GetTool(string name);
    void Register(ChatTool tool);
}

public class ToolRegistry : IToolRegistry
{
    private readonly Dictionary<string, ChatTool> _tools = new(StringComparer.OrdinalIgnoreCase);

    public ToolRegistry()
    {
        RegisterSuperAdminTools();
        RegisterInstituteAdminTools();
        RegisterStaffTools();
        RegisterParentTools();
    }

    public void Register(ChatTool tool)
    {
        _tools[tool.Name] = tool;
    }

    public IEnumerable<ChatTool> GetAllTools() => _tools.Values;

    public IEnumerable<ChatTool> GetToolsForRole(string role)
    {
        return _tools.Values.Where(t => t.AllowedRoles.Contains(role, StringComparer.OrdinalIgnoreCase));
    }

    public ChatTool? GetTool(string name)
    {
        _tools.TryGetValue(name, out var tool);
        return tool;
    }

    #region SuperAdmin Read & Write Tools
    private void RegisterSuperAdminTools()
    {
        Register(new ChatTool
        {
            Name = "get_platform_overview",
            Description = "Retrieves global platform-wide statistics: total colleges/institutes (active vs disabled), total students, staff, registered parents, and today's overall attendance rate across all tenants.",
            AllowedRoles = new[] { Roles.SuperAdmin },
            ParametersSchema = new { type = "object", properties = new { } },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                var totalInstitutes = await db.Institutes.IgnoreQueryFilters().CountAsync();
                var activeInstitutes = await db.Institutes.IgnoreQueryFilters().CountAsync(i => i.IsActive);
                var totalStudents = await db.Students.IgnoreQueryFilters().CountAsync(s => s.IsActive);
                var totalStaff = await db.StaffMembers.IgnoreQueryFilters().CountAsync(s => s.IsActive);
                var totalParents = await db.Parents.IgnoreQueryFilters().CountAsync(p => p.IsActive);

                var today = DateOnly.FromDateTime(DateTime.UtcNow);
                var todayRecords = await db.AttendanceRecords.IgnoreQueryFilters()
                    .Where(a => a.Date == today && a.IsActive)
                    .ToListAsync();

                double todayPct = 0.0;
                if (todayRecords.Count > 0)
                {
                    var p = todayRecords.Count(r => r.Status == AttendanceStatus.Present);
                    var l = todayRecords.Count(r => r.Status == AttendanceStatus.Late);
                    var lv = todayRecords.Count(r => r.Status == AttendanceStatus.OnLeave);
                    todayPct = Math.Round((p + (l * 0.5) + lv) / (double)todayRecords.Count * 100, 1);
                }

                return new ToolExecutionResult
                {
                    ResultText = $"**Platform Overview Metrics**:\n\n" +
                                 $"• **Total Colleges/Institutes**: {totalInstitutes} ({activeInstitutes} Active, {totalInstitutes - activeInstitutes} Disabled)\n" +
                                 $"• **Total Students**: {totalStudents}\n" +
                                 $"• **Total Staff Members**: {totalStaff}\n" +
                                 $"• **Total Registered Parents**: {totalParents}\n" +
                                 $"• **Platform Today's Attendance**: {todayPct}% across {todayRecords.Count} sessions\n\n" +
                                 $"[Open Platform Dashboard](/app/super-admin)",
                    Data = new { totalInstitutes, activeInstitutes, totalStudents, totalStaff, totalParents, todayPct }
                };
            }
        });

        Register(new ChatTool
        {
            Name = "list_institutes",
            Description = "Lists registered college tenants with their code, status (Active/Disabled), and city. Caps at top 5 with show more link.",
            AllowedRoles = new[] { Roles.SuperAdmin },
            ParametersSchema = new
            {
                type = "object",
                properties = new
                {
                    search = new { type = "string", description = "Optional filter term by institute name or code." },
                    status = new { type = "string", description = "Status filter: 'All', 'Active', or 'Inactive'." }
                }
            },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                string? search = args.TryGetProperty("search", out var sProp) ? sProp.GetString() : null;
                string? status = args.TryGetProperty("status", out var stProp) ? stProp.GetString() : null;

                var query = db.Institutes.IgnoreQueryFilters().AsQueryable();
                if (!string.IsNullOrWhiteSpace(search))
                {
                    var term = search.ToLower().Trim();
                    query = query.Where(i => i.Name.ToLower().Contains(term) || i.Code.ToLower().Contains(term) || i.City.ToLower().Contains(term));
                }
                if (string.Equals(status, "Active", StringComparison.OrdinalIgnoreCase)) query = query.Where(i => i.IsActive);
                else if (string.Equals(status, "Inactive", StringComparison.OrdinalIgnoreCase)) query = query.Where(i => !i.IsActive);

                var totalCount = await query.CountAsync();
                var insts = await query.OrderBy(i => i.Name).Take(5).ToListAsync();
                if (insts.Count == 0) return new ToolExecutionResult { ResultText = "No institutes matched the search criteria." };

                var lines = insts.Select(i => $"• **{i.Name}** (Code: `{i.Code}`) - {(i.IsActive ? "✅ Active" : "❌ Disabled")}, {i.City}");
                string footer = totalCount > 5 ? $"\n*Showing top 5 of {totalCount} colleges.*" : "";

                return new ToolExecutionResult
                {
                    ResultText = $"**Registered Colleges ({totalCount})**:\n\n" + string.Join("\n", lines) + footer +
                                 $"\n\n[Open Complete College Directory](/app/super-admin)",
                    Data = insts.Select(i => new { i.Id, i.Name, i.Code, i.IsActive, i.City })
                };
            }
        });

        Register(new ChatTool
        {
            Name = "get_institute_detail",
            Description = "Retrieves complete metrics and drill-down summary for a specific college: staff count, student count, class strengths, today's attendance %, and contact info.",
            AllowedRoles = new[] { Roles.SuperAdmin },
            ParametersSchema = new
            {
                type = "object",
                properties = new
                {
                    codeOrName = new { type = "string", description = "College code (e.g. 'MIT-001') or name." }
                },
                required = new[] { "codeOrName" }
            },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                string codeOrName = args.TryGetProperty("codeOrName", out var cProp) ? cProp.GetString() ?? "" : "";

                var inst = await db.Institutes.IgnoreQueryFilters()
                    .FirstOrDefaultAsync(i => i.Code == codeOrName || i.Name.ToLower().Contains(codeOrName.ToLower()));

                if (inst == null)
                {
                    return new ToolExecutionResult { Success = false, ResultText = $"Could not locate any college matching '{codeOrName}'." };
                }

                int studentCount = await db.Students.IgnoreQueryFilters().CountAsync(s => s.InstituteId == inst.Id && s.IsActive);
                int staffCount = await db.StaffMembers.IgnoreQueryFilters().CountAsync(s => s.InstituteId == inst.Id && s.IsActive);
                int classCount = await db.Classes.IgnoreQueryFilters().CountAsync(c => c.InstituteId == inst.Id && c.IsActive);
                int subjectCount = await db.Subjects.IgnoreQueryFilters().CountAsync(sb => sb.InstituteId == inst.Id && sb.IsActive);

                var today = DateOnly.FromDateTime(DateTime.UtcNow);
                var attRecords = await db.AttendanceRecords.IgnoreQueryFilters()
                    .Where(a => a.InstituteId == inst.Id && a.Date == today && a.IsActive)
                    .ToListAsync();

                double todayPct = 100.0;
                if (attRecords.Count > 0)
                {
                    var p = attRecords.Count(r => r.Status == AttendanceStatus.Present);
                    var l = attRecords.Count(r => r.Status == AttendanceStatus.Late);
                    var lv = attRecords.Count(r => r.Status == AttendanceStatus.OnLeave);
                    todayPct = Math.Round((p + (l * 0.5) + lv) / (double)attRecords.Count * 100, 1);
                }

                return new ToolExecutionResult
                {
                    ResultText = $"### 🏛️ **{inst.Name}** (Code: `{inst.Code}`)\n\n" +
                                 $"• **Status**: {(inst.IsActive ? "✅ Active" : "❌ Disabled")}\n" +
                                 $"• **Location**: {inst.City}, {inst.State} ({inst.Address})\n" +
                                 $"• **Contact**: `{inst.ContactEmail}`, Phone: {inst.ContactPhone}\n" +
                                 $"• **Students**: {studentCount} enrolled\n" +
                                 $"• **Staff**: {staffCount} active faculty\n" +
                                 $"• **Classes Configured**: {classCount}\n" +
                                 $"• **Subjects Offered**: {subjectCount}\n" +
                                 $"• **Today's Attendance**: {todayPct}% ({attRecords.Count} sessions recorded)\n\n" +
                                 $"[Open Full College Drill-Down Screen](/app/super-admin/institutes/{inst.Id})",
                    Data = new { inst.Id, inst.Name, inst.Code, studentCount, staffCount, classCount, todayPct }
                };
            }
        });

        Register(new ChatTool
        {
            Name = "get_institute_staff_list",
            Description = "Lists staff members working at a specific college with their Employee ID, email, and specialization.",
            AllowedRoles = new[] { Roles.SuperAdmin },
            ParametersSchema = new
            {
                type = "object",
                properties = new
                {
                    codeOrName = new { type = "string", description = "College code or name." },
                    limit = new { type = "integer", description = "Number of staff to retrieve (default 5)." }
                },
                required = new[] { "codeOrName" }
            },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                string codeOrName = args.TryGetProperty("codeOrName", out var cProp) ? cProp.GetString() ?? "" : "";
                int limit = 5;
                if (args.TryGetProperty("limit", out var lProp) && lProp.TryGetInt32(out var pL)) limit = Math.Clamp(pL, 1, 20);

                var inst = await db.Institutes.IgnoreQueryFilters()
                    .FirstOrDefaultAsync(i => i.Code == codeOrName || i.Name.ToLower().Contains(codeOrName.ToLower()));
                if (inst == null) return new ToolExecutionResult { Success = false, ResultText = $"College '{codeOrName}' not found." };

                var query = db.StaffMembers.IgnoreQueryFilters().Where(s => s.InstituteId == inst.Id && s.IsActive);
                int totalStaff = await query.CountAsync();
                var staff = await query.OrderBy(s => s.FullName).Take(limit).ToListAsync();

                if (staff.Count == 0) return new ToolExecutionResult { ResultText = $"No active staff found for {inst.Name}." };

                var lines = staff.Select(s => $"• **{s.FullName}** (ID: `{s.EmployeeId}`, Email: `{s.Email}`): *{s.SubjectSpecialization ?? "General"}*");
                string more = totalStaff > limit ? $"\n*Showing top {limit} of {totalStaff} staff members.*" : "";

                return new ToolExecutionResult
                {
                    ResultText = $"**Staff Directory for {inst.Name} ({totalStaff})**:\n\n" + string.Join("\n", lines) + more +
                                 $"\n\n[Open Staff Tab in College Drill-Down](/app/super-admin/institutes/{inst.Id})",
                    Data = staff.Select(s => new { s.Id, s.FullName, s.EmployeeId, s.Email })
                };
            }
        });

        Register(new ChatTool
        {
            Name = "get_institute_student_list",
            Description = "Lists students enrolled at a specific college with their roll number, class, section, and attendance %.",
            AllowedRoles = new[] { Roles.SuperAdmin },
            ParametersSchema = new
            {
                type = "object",
                properties = new
                {
                    codeOrName = new { type = "string", description = "College code or name." },
                    limit = new { type = "integer", description = "Number of students to display (default 5)." }
                },
                required = new[] { "codeOrName" }
            },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                string codeOrName = args.TryGetProperty("codeOrName", out var cProp) ? cProp.GetString() ?? "" : "";
                int limit = 5;
                if (args.TryGetProperty("limit", out var lProp) && lProp.TryGetInt32(out var pL)) limit = Math.Clamp(pL, 1, 20);

                var inst = await db.Institutes.IgnoreQueryFilters()
                    .FirstOrDefaultAsync(i => i.Code == codeOrName || i.Name.ToLower().Contains(codeOrName.ToLower()));
                if (inst == null) return new ToolExecutionResult { Success = false, ResultText = $"College '{codeOrName}' not found." };

                var query = db.Students.IgnoreQueryFilters().Include(s => s.Class).Where(s => s.InstituteId == inst.Id && s.IsActive);
                int totalStudents = await query.CountAsync();
                var students = await query.OrderBy(s => s.RollNo).Take(limit).ToListAsync();

                if (students.Count == 0) return new ToolExecutionResult { ResultText = $"No active students found for {inst.Name}." };

                var lines = new List<string>();
                foreach (var st in students)
                {
                    var sRecs = await db.AttendanceRecords.IgnoreQueryFilters()
                        .Where(a => a.StudentId == st.Id && a.IsActive)
                        .ToListAsync();

                    double pct = 100.0;
                    if (sRecs.Count > 0)
                    {
                        var p = sRecs.Count(r => r.Status == AttendanceStatus.Present);
                        var l = sRecs.Count(r => r.Status == AttendanceStatus.Late);
                        var lv = sRecs.Count(r => r.Status == AttendanceStatus.OnLeave);
                        pct = Math.Round((p + (l * 0.5) + lv) / (double)sRecs.Count * 100, 1);
                    }
                    lines.Add($"• **{st.FullName}** (Roll: `{st.RollNo}`, Class: {st.Class.Name}-{st.Section}): `{pct}%` attendance");
                }

                string more = totalStudents > limit ? $"\n*Showing top {limit} of {totalStudents} students.*" : "";
                return new ToolExecutionResult
                {
                    ResultText = $"**Students Enrolled at {inst.Name} ({totalStudents})**:\n\n" + string.Join("\n", lines) + more +
                                 $"\n\n[Open Student Roster in College Drill-Down](/app/super-admin/institutes/{inst.Id})",
                    Data = students.Select(s => new { s.Id, s.FullName, s.RollNo })
                };
            }
        });

        Register(new ChatTool
        {
            Name = "get_student_attendance_history",
            Description = "Drills down into a student's full attendance history across sessions with present/absent counts and remarks.",
            AllowedRoles = new[] { Roles.SuperAdmin },
            ParametersSchema = new
            {
                type = "object",
                properties = new
                {
                    studentIdentifier = new { type = "string", description = "Student name or roll number (e.g. 'Rahul', 'GD1-01')." }
                },
                required = new[] { "studentIdentifier" }
            },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                string idTerm = args.TryGetProperty("studentIdentifier", out var stProp) ? stProp.GetString() ?? "" : "";

                var student = await db.Students.IgnoreQueryFilters()
                    .Include(s => s.Class)
                    .FirstOrDefaultAsync(s => s.RollNo == idTerm || s.FirstName.ToLower().Contains(idTerm.ToLower()) || (s.FirstName + " " + s.LastName).ToLower().Contains(idTerm.ToLower()));

                if (student == null) return new ToolExecutionResult { Success = false, ResultText = $"No student found matching '{idTerm}'." };

                var records = await db.AttendanceRecords.IgnoreQueryFilters()
                    .Include(a => a.TimetableEntry)
                        .ThenInclude(t => t.Subject)
                    .Include(a => a.Period)
                    .Where(a => a.StudentId == student.Id && a.IsActive)
                    .OrderByDescending(a => a.Date)
                    .ToListAsync();

                int total = records.Count;
                int p = records.Count(r => r.Status == AttendanceStatus.Present);
                int aCount = records.Count(r => r.Status == AttendanceStatus.Absent);
                int l = records.Count(r => r.Status == AttendanceStatus.Late);
                int lv = records.Count(r => r.Status == AttendanceStatus.OnLeave);
                double pct = total > 0 ? Math.Round((p + (l * 0.5) + lv) / (double)total * 100, 1) : 100.0;

                var recent5 = records.Take(5).Select(r => $"• **{r.Date:yyyy-MM-dd}** (Period {r.Period?.PeriodNumber}, {r.TimetableEntry?.Subject?.Name}): **{r.Status}** {(string.IsNullOrWhiteSpace(r.Remarks) ? "" : " - " + r.Remarks)}");
                string recentText = records.Count > 0 ? "\n\n**Last 5 Sessions Recorded**:\n" + string.Join("\n", recent5) : "\n\n*No attendance sessions recorded yet.*";

                return new ToolExecutionResult
                {
                    ResultText = $"### 🎓 Attendance History: **{student.FullName}**\n\n" +
                                 $"• **Roll Number**: `{student.RollNo}`\n" +
                                 $"• **Class**: {student.Class.Name} - Section {student.Section}\n" +
                                 $"• **Overall Attendance**: `{pct}%`\n" +
                                 $"• **Breakdown**: {p} Present, {aCount} Absent, {l} Late, {lv} On Leave (Total {total} sessions)" +
                                 recentText +
                                 $"\n\n[Open Student Record in College Drill-Down](/app/super-admin/institutes/{student.InstituteId})",
                    Data = new { student.Id, student.FullName, pct, total, p, aCount, l, lv }
                };
            }
        });

        Register(new ChatTool
        {
            Name = "get_institute_subjects",
            Description = "Lists academic subjects configured for a college with their subject codes.",
            AllowedRoles = new[] { Roles.SuperAdmin },
            ParametersSchema = new
            {
                type = "object",
                properties = new
                {
                    codeOrName = new { type = "string", description = "College code or name." }
                },
                required = new[] { "codeOrName" }
            },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                string codeOrName = args.TryGetProperty("codeOrName", out var cProp) ? cProp.GetString() ?? "" : "";
                var inst = await db.Institutes.IgnoreQueryFilters()
                    .FirstOrDefaultAsync(i => i.Code == codeOrName || i.Name.ToLower().Contains(codeOrName.ToLower()));
                if (inst == null) return new ToolExecutionResult { Success = false, ResultText = $"College '{codeOrName}' not found." };

                var subjects = await db.Subjects.IgnoreQueryFilters()
                    .Where(sb => sb.InstituteId == inst.Id && sb.IsActive)
                    .OrderBy(sb => sb.Name)
                    .ToListAsync();

                if (subjects.Count == 0) return new ToolExecutionResult { ResultText = $"No subjects configured yet for {inst.Name}." };

                var lines = subjects.Select(sb => $"• **{sb.Name}** (Code: `{sb.Code}`)");
                return new ToolExecutionResult
                {
                    ResultText = $"**Subjects Configured at {inst.Name} ({subjects.Count})**:\n\n" + string.Join("\n", lines) +
                                 $"\n\n[Open Subjects Tab](/app/super-admin/institutes/{inst.Id})",
                    Data = subjects.Select(sb => new { sb.Id, sb.Name, sb.Code })
                };
            }
        });

        Register(new ChatTool
        {
            Name = "get_institute_timetable_summary",
            Description = "Summarizes the weekly timetable distribution (scheduled teaching slots) for a college.",
            AllowedRoles = new[] { Roles.SuperAdmin },
            ParametersSchema = new
            {
                type = "object",
                properties = new
                {
                    codeOrName = new { type = "string", description = "College code or name." }
                },
                required = new[] { "codeOrName" }
            },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                string codeOrName = args.TryGetProperty("codeOrName", out var cProp) ? cProp.GetString() ?? "" : "";
                var inst = await db.Institutes.IgnoreQueryFilters()
                    .FirstOrDefaultAsync(i => i.Code == codeOrName || i.Name.ToLower().Contains(codeOrName.ToLower()));
                if (inst == null) return new ToolExecutionResult { Success = false, ResultText = $"College '{codeOrName}' not found." };

                var entries = await db.TimetableEntries.IgnoreQueryFilters()
                    .Where(t => t.InstituteId == inst.Id && t.IsActive)
                    .ToListAsync();

                var days = Enum.GetValues<DayOfWeek>().Where(d => d != DayOfWeek.Sunday);
                var summaryLines = days.Select(d =>
                {
                    int slots = entries.Count(e => e.DayOfWeek == d);
                    int teachers = entries.Where(e => e.DayOfWeek == d).Select(e => e.StaffId).Distinct().Count();
                    return $"• **{d}**: {slots} teaching periods scheduled ({teachers} active teachers)";
                });

                return new ToolExecutionResult
                {
                    ResultText = $"**Weekly Timetable Schedule Summary: {inst.Name}**:\n\n" + string.Join("\n", summaryLines) +
                                 $"\n\n[Open Timetable in College Drill-Down](/app/super-admin/institutes/{inst.Id})",
                    Data = entries.Count
                };
            }
        });

        Register(new ChatTool
        {
            Name = "get_recent_audit_logs",
            Description = "Fetches the most recent platform security and administrative audit trail records.",
            AllowedRoles = new[] { Roles.SuperAdmin },
            ParametersSchema = new
            {
                type = "object",
                properties = new
                {
                    limit = new { type = "integer", description = "Number of audit logs to retrieve (1 to 20, default 5)." },
                    search = new { type = "string", description = "Optional keyword to search in action or details." }
                }
            },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                int limit = 5;
                if (args.TryGetProperty("limit", out var lProp) && lProp.TryGetInt32(out var parsedL))
                {
                    limit = Math.Clamp(parsedL, 1, 20);
                }

                string? search = args.TryGetProperty("search", out var sProp) ? sProp.GetString() : null;

                var query = db.AuditLogs.IgnoreQueryFilters().Include(a => a.Institute).AsQueryable();
                if (!string.IsNullOrWhiteSpace(search))
                {
                    var term = search.ToLower().Trim();
                    query = query.Where(a => a.Action.ToLower().Contains(term) || a.Details.ToLower().Contains(term));
                }

                var logs = await query.OrderByDescending(a => a.CreatedAt).Take(limit).ToListAsync();
                if (logs.Count == 0) return new ToolExecutionResult { ResultText = "No audit log records matched your query." };

                var lines = logs.Select(l => $"• **[{l.CreatedAt:yyyy-MM-dd HH:mm}]** `{l.Action}` by `{l.UserEmail}` ({l.Institute?.Name ?? "Platform"}): {l.Details}");
                return new ToolExecutionResult
                {
                    ResultText = $"**Recent Platform Audit Trail ({logs.Count})**:\n\n" + string.Join("\n", lines) +
                                 $"\n\n[Open Full Platform Audit Log Viewer](/app/super-admin/audit-logs)",
                    Data = logs.Select(l => new { l.Id, l.Action, l.UserEmail, l.Details, l.CreatedAt })
                };
            }
        });

        Register(new ChatTool
        {
            Name = "toggle_institute_status",
            Description = "Activates or deactivates an institute tenant across the platform. Generates a confirmation card.",
            AllowedRoles = new[] { Roles.SuperAdmin },
            IsMutating = true,
            ParametersSchema = new
            {
                type = "object",
                properties = new
                {
                    codeOrName = new { type = "string", description = "College code (e.g. 'MIT-001') or college name." },
                    activate = new { type = "boolean", description = "True to activate, false to deactivate." }
                },
                required = new[] { "codeOrName", "activate" }
            },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                string codeOrName = args.TryGetProperty("codeOrName", out var cProp) ? cProp.GetString() ?? "" : "";
                bool activate = args.TryGetProperty("activate", out var aProp) && aProp.GetBoolean();

                var targetInst = await db.Institutes.IgnoreQueryFilters()
                    .FirstOrDefaultAsync(i => i.Code == codeOrName || i.Name.ToLower().Contains(codeOrName.ToLower()));

                if (targetInst == null)
                {
                    return new ToolExecutionResult { Success = false, ResultText = $"Could not locate any college matching '{codeOrName}'." };
                }

                string verb = activate ? "Activate" : "Deactivate";
                var payload = JsonSerializer.Serialize(new { instituteId = targetInst.Id, isActive = activate });

                return new ToolExecutionResult
                {
                    IsProposal = true,
                    ResultText = $"I have prepared an action to **{verb}** the institute **{targetInst.Name}** (Code: `{targetInst.Code}`).\n\nPlease verify and confirm below:",
                    Proposal = new ChatbotActionProposal
                    {
                        ActionType = "ToggleInstituteStatus",
                        Title = $"{verb} Institute",
                        Summary = $"{verb} college '{targetInst.Name}' (Code: {targetInst.Code}) across the platform.",
                        Parameters = new Dictionary<string, string>
                        {
                            ["Institute ID"] = targetInst.Id.ToString(),
                            ["Institute Name"] = targetInst.Name,
                            ["Institute Code"] = targetInst.Code,
                            ["New Status"] = activate ? "Active" : "Disabled"
                        },
                        PayloadJson = payload
                    }
                };
            }
        });
    }
    #endregion

    #region InstituteAdmin Read & Write Tools
    private void RegisterInstituteAdminTools()
    {
        Register(new ChatTool
        {
            Name = "get_today_attendance_summary",
            Description = "Retrieves today's attendance summary for the authenticated institute, including present/absent counts and overall attendance %.",
            AllowedRoles = new[] { Roles.InstituteAdmin },
            ParametersSchema = new { type = "object", properties = new { } },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                var instIdClaim = user.FindFirstValue("institute_id");
                if (!int.TryParse(instIdClaim, out var instId))
                {
                    return new ToolExecutionResult { Success = false, ResultText = "Could not resolve your institute ID from security claims." };
                }

                var today = DateOnly.FromDateTime(DateTime.UtcNow);
                var records = await db.AttendanceRecords
                    .Where(a => a.InstituteId == instId && a.Date == today && a.IsActive)
                    .ToListAsync();

                if (records.Count == 0)
                {
                    return new ToolExecutionResult
                    {
                        ResultText = $"No attendance has been submitted today ({today:MMM dd, yyyy}) yet.\n\n[Mark Attendance Now](/app/attendance)"
                    };
                }

                var present = records.Count(r => r.Status == AttendanceStatus.Present);
                var absent = records.Count(r => r.Status == AttendanceStatus.Absent);
                var late = records.Count(r => r.Status == AttendanceStatus.Late);
                var leave = records.Count(r => r.Status == AttendanceStatus.OnLeave);
                double pct = Math.Round((present + (late * 0.5) + leave) / (double)records.Count * 100, 1);

                return new ToolExecutionResult
                {
                    ResultText = $"**Today's Attendance Snapshot ({today:MMM dd, yyyy})**:\n\n" +
                                 $"• **Overall Attendance**: `{pct}%`\n" +
                                 $"• **Total Session Entries**: {records.Count}\n" +
                                 $"• **Present**: {present}\n" +
                                 $"• **Absent**: {absent}\n" +
                                 $"• **Late**: {late}\n" +
                                 $"• **On Approved Leave**: {leave}\n\n" +
                                 $"[View Full Analytics & Reports](/app/reports)",
                    Data = new { pct, total = records.Count, present, absent, late, leave }
                };
            }
        });

        Register(new ChatTool
        {
            Name = "get_low_attendance_defaulters",
            Description = "Finds students enrolled in the institute with attendance strictly below 75%.",
            AllowedRoles = new[] { Roles.InstituteAdmin },
            ParametersSchema = new
            {
                type = "object",
                properties = new
                {
                    threshold = new { type = "number", description = "Attendance percentage threshold (default 75.0)." }
                }
            },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                var instIdClaim = user.FindFirstValue("institute_id");
                if (!int.TryParse(instIdClaim, out var instId))
                {
                    return new ToolExecutionResult { Success = false, ResultText = "Could not resolve institute from credentials." };
                }

                double threshold = 75.0;
                if (args.TryGetProperty("threshold", out var tProp) && tProp.TryGetDouble(out var parsedT))
                {
                    threshold = Math.Clamp(parsedT, 10.0, 100.0);
                }

                var students = await db.Students
                    .Include(s => s.Class)
                    .Where(s => s.InstituteId == instId && s.IsActive)
                    .ToListAsync();

                var defaulters = new List<string>();
                foreach (var st in students)
                {
                    var sRecs = await db.AttendanceRecords
                        .Where(a => a.StudentId == st.Id && a.IsActive)
                        .ToListAsync();

                    if (sRecs.Count > 0)
                    {
                        var p = sRecs.Count(r => r.Status == AttendanceStatus.Present);
                        var l = sRecs.Count(r => r.Status == AttendanceStatus.Late);
                        var lv = sRecs.Count(r => r.Status == AttendanceStatus.OnLeave);
                        double pct = Math.Round((p + (l * 0.5) + lv) / (double)sRecs.Count * 100, 1);
                        if (pct < threshold)
                        {
                            defaulters.Add($"• **{st.FullName}** (Roll: `{st.RollNo}`, Class: {st.Class.Name}-{st.Section}): `{pct}%` ({sRecs.Count} sessions)");
                        }
                    }
                }

                if (defaulters.Count == 0)
                {
                    return new ToolExecutionResult
                    {
                        ResultText = $"Great news! No students currently fall below the {threshold}% attendance threshold.\n\n[Open Defaulters Report](/app/reports)"
                    };
                }

                int totalDefaulters = defaulters.Count;
                var displayList = defaulters.Take(5);
                string moreText = totalDefaulters > 5 ? $"\n*Showing top 5 of {totalDefaulters} defaulters.*" : "";

                return new ToolExecutionResult
                {
                    ResultText = $"**Students Below {threshold}% Attendance ({totalDefaulters})**:\n\n" +
                                 string.Join("\n", displayList) + moreText +
                                 $"\n\n[Open Complete Defaulters Report](/app/reports)",
                    Data = defaulters
                };
            }
        });

        Register(new ChatTool
        {
            Name = "list_classes_and_strength",
            Description = "Lists class grades and sections in the institute with student enrollment strength.",
            AllowedRoles = new[] { Roles.InstituteAdmin },
            ParametersSchema = new { type = "object", properties = new { } },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                var instIdClaim = user.FindFirstValue("institute_id");
                if (!int.TryParse(instIdClaim, out var instId)) return new ToolExecutionResult { Success = false, ResultText = "Missing institute claim." };

                var classes = await db.Classes
                    .Include(c => c.Students)
                    .Where(c => c.InstituteId == instId && c.IsActive)
                    .OrderBy(c => c.Name)
                    .ToListAsync();

                if (classes.Count == 0) return new ToolExecutionResult { ResultText = "No classes configured for this institute yet." };

                var lines = classes.Select(c => $"• **{c.Name}** (Sections: `{c.Sections}`): **{c.Students.Count(s => s.IsActive)}** enrolled students");
                return new ToolExecutionResult
                {
                    ResultText = $"**Class Strength & Sections ({classes.Count} Classes)**:\n\n" + string.Join("\n", lines) +
                                 $"\n\n[Manage Classes & Students](/app/students)",
                    Data = classes.Select(c => new { c.Id, c.Name, Count = c.Students.Count })
                };
            }
        });

        Register(new ChatTool
        {
            Name = "list_staff_directory",
            Description = "Lists faculty and staff members belonging to the institute with contact emails and specializations.",
            AllowedRoles = new[] { Roles.InstituteAdmin },
            ParametersSchema = new
            {
                type = "object",
                properties = new
                {
                    search = new { type = "string", description = "Optional name or specialization search term." }
                }
            },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                var instIdClaim = user.FindFirstValue("institute_id");
                if (!int.TryParse(instIdClaim, out var instId)) return new ToolExecutionResult { Success = false, ResultText = "Missing institute claim." };

                string? search = args.TryGetProperty("search", out var sProp) ? sProp.GetString() : null;
                var query = db.StaffMembers.Where(s => s.InstituteId == instId && s.IsActive);
                if (!string.IsNullOrWhiteSpace(search))
                {
                    var term = search.ToLower().Trim();
                    query = query.Where(s => s.FullName.ToLower().Contains(term) || (s.SubjectSpecialization != null && s.SubjectSpecialization.ToLower().Contains(term)));
                }

                int totalCount = await query.CountAsync();
                var staff = await query.OrderBy(s => s.FullName).Take(5).ToListAsync();
                if (staff.Count == 0) return new ToolExecutionResult { ResultText = "No staff members matched your query." };

                var lines = staff.Select(s => $"• **{s.FullName}** (Emp ID: `{s.EmployeeId}`, Email: `{s.Email}`): *{s.SubjectSpecialization ?? "General"}*");
                string more = totalCount > 5 ? $"\n*Showing top 5 of {totalCount} staff members.*" : "";

                return new ToolExecutionResult
                {
                    ResultText = $"**Institute Faculty Directory ({totalCount})**:\n\n" + string.Join("\n", lines) + more +
                                 $"\n\n[Open Staff Directory Screen](/app/staff)",
                    Data = staff.Select(s => new { s.Id, s.FullName, s.EmployeeId, s.Email })
                };
            }
        });

        Register(new ChatTool
        {
            Name = "list_institute_students",
            Description = "Lists students enrolled in the institute with roll numbers and class sections.",
            AllowedRoles = new[] { Roles.InstituteAdmin },
            ParametersSchema = new
            {
                type = "object",
                properties = new
                {
                    search = new { type = "string", description = "Optional student name or roll number filter." }
                }
            },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                var instIdClaim = user.FindFirstValue("institute_id");
                if (!int.TryParse(instIdClaim, out var instId)) return new ToolExecutionResult { Success = false, ResultText = "Missing institute claim." };

                string? search = args.TryGetProperty("search", out var sProp) ? sProp.GetString() : null;
                var query = db.Students.Include(s => s.Class).Where(s => s.InstituteId == instId && s.IsActive);
                if (!string.IsNullOrWhiteSpace(search))
                {
                    var term = search.ToLower().Trim();
                    query = query.Where(s => s.FirstName.ToLower().Contains(term) || s.LastName.ToLower().Contains(term) || s.RollNo.ToLower().Contains(term));
                }

                int total = await query.CountAsync();
                var students = await query.OrderBy(s => s.RollNo).Take(5).ToListAsync();
                if (students.Count == 0) return new ToolExecutionResult { ResultText = "No students found matching your search." };

                var lines = students.Select(s => $"• **{s.FullName}** (Roll: `{s.RollNo}`, Class: {s.Class.Name} - {s.Section})");
                string more = total > 5 ? $"\n*Showing top 5 of {total} students.*" : "";

                return new ToolExecutionResult
                {
                    ResultText = $"**Institute Students Roster ({total})**:\n\n" + string.Join("\n", lines) + more +
                                 $"\n\n[Open Students Management](/app/students)",
                    Data = students.Select(s => new { s.Id, s.FullName, s.RollNo })
                };
            }
        });

        Register(new ChatTool
        {
            Name = "list_institute_subjects",
            Description = "Lists all configured academic subjects and course codes for the institute.",
            AllowedRoles = new[] { Roles.InstituteAdmin },
            ParametersSchema = new { type = "object", properties = new { } },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                var instIdClaim = user.FindFirstValue("institute_id");
                if (!int.TryParse(instIdClaim, out var instId)) return new ToolExecutionResult { Success = false, ResultText = "Missing institute claim." };

                var subs = await db.Subjects.Where(s => s.InstituteId == instId && s.IsActive).OrderBy(s => s.Name).ToListAsync();
                if (subs.Count == 0) return new ToolExecutionResult { ResultText = "No subjects configured yet for this institute." };

                var lines = subs.Select(s => $"• **{s.Name}** (Code: `{s.Code}`)");
                return new ToolExecutionResult
                {
                    ResultText = $"**Institute Academic Subjects ({subs.Count})**:\n\n" + string.Join("\n", lines) +
                                 $"\n\n[Manage Subject Directory](/app/subjects)",
                    Data = subs.Select(s => new { s.Id, s.Name, s.Code })
                };
            }
        });

        Register(new ChatTool
        {
            Name = "get_pending_approvals",
            Description = "Checks for pending staff and parent user registration requests requiring admin approval.",
            AllowedRoles = new[] { Roles.InstituteAdmin },
            ParametersSchema = new { type = "object", properties = new { } },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                var instIdClaim = user.FindFirstValue("institute_id");
                if (!int.TryParse(instIdClaim, out var instId)) return new ToolExecutionResult { Success = false, ResultText = "Missing institute claim." };

                var pendingUsers = await db.Users
                    .Where(u => u.InstituteId == instId && u.AccountStatus == AccountStatuses.PendingApproval && u.IsActive)
                    .OrderByDescending(u => u.CreatedAt)
                    .ToListAsync();

                if (pendingUsers.Count == 0)
                {
                    return new ToolExecutionResult { ResultText = "No pending approval requests. All user accounts are up to date!" };
                }

                var lines = pendingUsers.Take(5).Select(u => $"• **{u.FullName}** (`{u.Email}`) - Role: `{u.Role}`, Registered: {u.CreatedAt:MMM dd, yyyy}");
                string more = pendingUsers.Count > 5 ? $"\n*and {pendingUsers.Count - 5} more pending approval...*" : "";

                return new ToolExecutionResult
                {
                    ResultText = $"**Pending Registration Approvals ({pendingUsers.Count})**:\n\n" + string.Join("\n", lines) + more +
                                 $"\n\n[Review & Approve Accounts](/app/approvals)",
                    Data = pendingUsers.Count
                };
            }
        });

        Register(new ChatTool
        {
            Name = "get_institute_metrics",
            Description = "Returns the institute's active staff count, subjects count, classes count, and student count.",
            AllowedRoles = new[] { Roles.InstituteAdmin },
            ParametersSchema = new { type = "object", properties = new { } },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                var instIdClaim = user.FindFirstValue("institute_id");
                if (!int.TryParse(instIdClaim, out var instId)) return new ToolExecutionResult { Success = false, ResultText = "Could not resolve institute from credentials." };

                var staffCount = await db.StaffMembers.CountAsync(s => s.InstituteId == instId && s.IsActive);
                var subCount = await db.Subjects.CountAsync(s => s.InstituteId == instId && s.IsActive);
                var classCount = await db.Classes.CountAsync(c => c.InstituteId == instId && c.IsActive);
                var studentCount = await db.Students.CountAsync(s => s.InstituteId == instId && s.IsActive);

                return new ToolExecutionResult
                {
                    ResultText = $"**Institute Operational Directory Metrics**:\n\n" +
                                 $"• **Active Staff**: {staffCount}\n" +
                                 $"• **Total Subjects Configured**: {subCount}\n" +
                                 $"• **Total Classes**: {classCount}\n" +
                                 $"• **Total Students**: {studentCount}\n\n" +
                                 $"[Open Analytics Dashboard](/app/dashboard)",
                    Data = new { staffCount, subCount, classCount, studentCount }
                };
            }
        });

        Register(new ChatTool
        {
            Name = "create_subject",
            Description = "Registers a new academic subject with name and code for the institute. Generates a confirmation card.",
            AllowedRoles = new[] { Roles.InstituteAdmin },
            IsMutating = true,
            ParametersSchema = new
            {
                type = "object",
                properties = new
                {
                    name = new { type = "string", description = "Subject name (e.g. 'Robotics', 'Data Science')." },
                    code = new { type = "string", description = "Unique subject code (e.g. 'ROB-101', 'DS-201')." }
                },
                required = new[] { "name", "code" }
            },
            Handler = async (user, args, sp) =>
            {
                await Task.CompletedTask;
                var instIdClaim = user.FindFirstValue("institute_id");
                if (!int.TryParse(instIdClaim, out var instId)) return new ToolExecutionResult { Success = false, ResultText = "Unauthorized: Institute identity missing." };

                string name = args.TryGetProperty("name", out var nProp) ? nProp.GetString() ?? "New Subject" : "New Subject";
                string code = args.TryGetProperty("code", out var cProp) ? cProp.GetString() ?? "SUB-001" : "SUB-001";
                code = code.Trim().ToUpperInvariant();

                var payload = JsonSerializer.Serialize(new { instituteId = instId, name = name.Trim(), code });

                return new ToolExecutionResult
                {
                    IsProposal = true,
                    ResultText = $"I have prepared the action to register the new subject **{name}** with code `{code}`.\n\nPlease verify and tap **Confirm & Execute** below:",
                    Proposal = new ChatbotActionProposal
                    {
                        ActionType = "CreateSubject",
                        Title = "Create New Subject",
                        Summary = $"Register subject '{name}' (Code: {code}) in your institute directory.",
                        Parameters = new Dictionary<string, string>
                        {
                            ["Subject Name"] = name,
                            ["Subject Code"] = code,
                            ["Institute ID"] = instId.ToString()
                        },
                        PayloadJson = payload
                    }
                };
            }
        });
    }
    #endregion

    #region Staff Read & Write Tools
    private void RegisterStaffTools()
    {
        Register(new ChatTool
        {
            Name = "get_my_timetable_today",
            Description = "Retrieves the authenticated teacher's scheduled teaching periods, classes, and subjects for today.",
            AllowedRoles = new[] { Roles.Staff },
            ParametersSchema = new { type = "object", properties = new { } },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                var userIdStr = user.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!int.TryParse(userIdStr, out var userId)) return new ToolExecutionResult { Success = false, ResultText = "Could not resolve user identity." };

                var staff = await db.StaffMembers.FirstOrDefaultAsync(s => s.UserId == userId && s.IsActive);
                if (staff == null) return new ToolExecutionResult { Success = false, ResultText = "No active staff profile linked to your user account." };

                var todayDayOfWeek = DateTime.UtcNow.DayOfWeek;
                var slots = await db.TimetableEntries
                    .Include(t => t.Class)
                    .Include(t => t.Subject)
                    .Include(t => t.Period)
                    .Where(t => t.StaffId == staff.Id && t.DayOfWeek == todayDayOfWeek && t.IsActive)
                    .OrderBy(t => t.Period.PeriodNumber)
                    .ToListAsync();

                if (slots.Count == 0) return new ToolExecutionResult { ResultText = $"You have no scheduled teaching periods for today (**{todayDayOfWeek}**).\n\n[Open Full Weekly Timetable](/app/timetable)" };

                var lines = slots.Select(s => $"• **Period {s.Period.PeriodNumber} ({s.Period.StartTime:hh\\:mm} - {s.Period.EndTime:hh\\:mm})**: {s.Subject.Name} for **{s.Class.Name} - {s.Section}**");
                return new ToolExecutionResult
                {
                    ResultText = $"**Your Teaching Schedule for Today ({todayDayOfWeek})**:\n\n" + string.Join("\n", lines) +
                                 $"\n\n[Open Timetable & Manage Swaps](/app/timetable)",
                    Data = slots.Select(s => new { s.Period.PeriodNumber, Subject = s.Subject.Name, Class = s.Class.Name, s.Section })
                };
            }
        });

        Register(new ChatTool
        {
            Name = "get_class_attendance_status",
            Description = "Checks today's attendance marking status for all classes assigned to the authenticated teacher.",
            AllowedRoles = new[] { Roles.Staff },
            ParametersSchema = new { type = "object", properties = new { } },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                var userIdStr = user.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!int.TryParse(userIdStr, out var userId)) return new ToolExecutionResult { Success = false, ResultText = "Missing user identity." };

                var staff = await db.StaffMembers.FirstOrDefaultAsync(s => s.UserId == userId && s.IsActive);
                if (staff == null) return new ToolExecutionResult { Success = false, ResultText = "Staff profile not found." };

                var today = DateOnly.FromDateTime(DateTime.UtcNow);
                var todayDay = DateTime.UtcNow.DayOfWeek;

                var slots = await db.TimetableEntries
                    .Include(t => t.Class)
                    .Include(t => t.Subject)
                    .Include(t => t.Period)
                    .Where(t => t.StaffId == staff.Id && t.DayOfWeek == todayDay && t.IsActive)
                    .ToListAsync();

                if (slots.Count == 0) return new ToolExecutionResult { ResultText = "You have no scheduled teaching slots today to mark attendance for." };

                var statusLines = new List<string>();
                foreach (var sl in slots)
                {
                    bool marked = await db.AttendanceRecords.AnyAsync(a =>
                        a.TimetableEntryId == sl.Id &&
                        a.Date == today &&
                        a.IsActive);

                    string icon = marked ? "✅ Marked" : "⏳ Pending";
                    statusLines.Add($"• **Period {sl.Period.PeriodNumber} ({sl.Subject.Name} - {sl.Class.Name} {sl.Section})**: {icon}");
                }

                return new ToolExecutionResult
                {
                    ResultText = $"**Today's Teaching Periods Attendance Status**:\n\n" + string.Join("\n", statusLines) +
                                 $"\n\n[Mark Attendance Now](/app/attendance)",
                    Data = statusLines
                };
            }
        });

        Register(new ChatTool
        {
            Name = "get_my_pending_swaps",
            Description = "Checks the status of your requested and received timetable period swap requests.",
            AllowedRoles = new[] { Roles.Staff },
            ParametersSchema = new { type = "object", properties = new { } },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                var userIdStr = user.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!int.TryParse(userIdStr, out var userId)) return new ToolExecutionResult { Success = false, ResultText = "Missing user identity." };

                var staff = await db.StaffMembers.FirstOrDefaultAsync(s => s.UserId == userId && s.IsActive);
                if (staff == null) return new ToolExecutionResult { Success = false, ResultText = "Staff profile not found." };

                var swaps = await db.PeriodSwapRequests
                    .Include(s => s.RequesterStaff)
                    .Include(s => s.TargetStaff)
                    .Include(s => s.TimetableEntry)
                        .ThenInclude(t => t.Subject)
                    .Where(s => (s.RequesterStaffId == staff.Id || s.TargetStaffId == staff.Id) && s.Status == SwapStatus.Pending && s.IsActive)
                    .OrderByDescending(s => s.SwapDate)
                    .ToListAsync();

                if (swaps.Count == 0)
                {
                    return new ToolExecutionResult { ResultText = "You have no pending period swap requests.\n\n[Request Period Swap](/app/swaps)" };
                }

                var lines = swaps.Select(s =>
                {
                    string dir = s.RequesterStaffId == staff.Id ? $"Sent to **{s.TargetStaff.FullName}**" : $"Received from **{s.RequesterStaff.FullName}**";
                    return $"• **{s.SwapDate:yyyy-MM-dd}** ({s.TimetableEntry.Subject.Name}): {dir} - Status: `{s.Status}`";
                });

                return new ToolExecutionResult
                {
                    ResultText = $"**Your Pending Period Swap Requests ({swaps.Count})**:\n\n" + string.Join("\n", lines) +
                                 $"\n\n[Open Swaps Management](/app/swaps)",
                    Data = new { count = swaps.Count }
                };
            }
        });

        Register(new ChatTool
        {
            Name = "get_institute_attendance_today",
            Description = "Provides today's total recorded attendance entries, present, and absent counts across the institute.",
            AllowedRoles = new[] { Roles.Staff },
            ParametersSchema = new { type = "object", properties = new { } },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                var instIdClaim = user.FindFirstValue("institute_id");
                if (!int.TryParse(instIdClaim, out var instId)) return new ToolExecutionResult { Success = false, ResultText = "Could not resolve institute from credentials." };

                var today = DateOnly.FromDateTime(DateTime.UtcNow);
                var records = await db.AttendanceRecords
                    .Where(a => a.InstituteId == instId && a.Date == today && a.IsActive)
                    .ToListAsync();

                return new ToolExecutionResult
                {
                    ResultText = $"**Institute Attendance Overview Today**:\n\n" +
                                 $"• Total Recorded Sessions: {records.Count}\n" +
                                 $"• Present Count: {records.Count(r => r.Status == AttendanceStatus.Present)}\n" +
                                 $"• Absent Count: {records.Count(r => r.Status == AttendanceStatus.Absent)}\n\n" +
                                 $"[Mark Attendance For Your Classes](/app/attendance)",
                    Data = new { total = records.Count }
                };
            }
        });

        Register(new ChatTool
        {
            Name = "request_period_swap",
            Description = "Initiates a timetable period swap request with another teacher for a specific date and reason. Generates a confirmation card.",
            AllowedRoles = new[] { Roles.Staff },
            IsMutating = true,
            ParametersSchema = new
            {
                type = "object",
                properties = new
                {
                    targetTeacherName = new { type = "string", description = "Name or email of the colleague teacher to swap periods with." },
                    date = new { type = "string", description = "Target date for the swap in yyyy-MM-dd format (or 'tomorrow')." },
                    periodNumber = new { type = "integer", description = "The period number to swap (e.g. 1, 2, 3)." },
                    reason = new { type = "string", description = "Reason for the period swap request." }
                },
                required = new[] { "targetTeacherName" }
            },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                var userIdStr = user.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!int.TryParse(userIdStr, out var userId)) return new ToolExecutionResult { Success = false, ResultText = "Missing user identity." };

                var staff = await db.StaffMembers.FirstOrDefaultAsync(s => s.UserId == userId && s.IsActive);
                if (staff == null) return new ToolExecutionResult { Success = false, ResultText = "Staff profile not found." };

                string targetName = args.TryGetProperty("targetTeacherName", out var tnProp) ? tnProp.GetString() ?? "" : "";
                var targetStaff = await db.StaffMembers
                    .Where(s => s.InstituteId == staff.InstituteId && s.Id != staff.Id && s.IsActive)
                    .FirstOrDefaultAsync(s => s.FullName.ToLower().Contains(targetName.ToLower()) || s.Email.ToLower().Contains(targetName.ToLower()));

                if (targetStaff == null)
                {
                    targetStaff = await db.StaffMembers
                        .Where(s => s.InstituteId == staff.InstituteId && s.Id != staff.Id && s.IsActive)
                        .FirstOrDefaultAsync();
                }

                if (targetStaff == null)
                {
                    return new ToolExecutionResult { Success = false, ResultText = "Could not locate a colleague faculty member to swap periods with in your institute." };
                }

                var swapDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1));
                if (args.TryGetProperty("date", out var dProp) && DateOnly.TryParse(dProp.GetString(), out var parsedDate))
                {
                    swapDate = parsedDate;
                }

                int periodNum = 1;
                if (args.TryGetProperty("periodNumber", out var pProp) && pProp.TryGetInt32(out var parsedP))
                {
                    periodNum = parsedP;
                }

                string reason = args.TryGetProperty("reason", out var rProp) ? rProp.GetString() ?? "Personal arrangement" : "Personal arrangement";

                var dayOfWeek = swapDate.ToDateTime(TimeOnly.MinValue).DayOfWeek;
                var slot = await db.TimetableEntries
                    .Include(t => t.Subject)
                    .Include(t => t.Class)
                    .Include(t => t.Period)
                    .Where(t => t.StaffId == staff.Id && t.DayOfWeek == dayOfWeek && t.IsActive)
                    .FirstOrDefaultAsync(t => t.Period.PeriodNumber == periodNum)
                    ?? await db.TimetableEntries
                        .Include(t => t.Subject)
                        .Include(t => t.Class)
                        .Include(t => t.Period)
                        .Where(t => t.StaffId == staff.Id && t.IsActive)
                        .FirstOrDefaultAsync();

                if (slot == null)
                {
                    return new ToolExecutionResult { Success = false, ResultText = "You do not have any teaching periods scheduled to swap on that day." };
                }

                var payload = JsonSerializer.Serialize(new
                {
                    timetableEntryId = slot.Id,
                    requesterStaffId = staff.Id,
                    targetStaffId = targetStaff.Id,
                    swapDate = swapDate.ToString("yyyy-MM-dd"),
                    reason
                });

                return new ToolExecutionResult
                {
                    IsProposal = true,
                    ResultText = $"I have prepared a **Period Swap Request** with **{targetStaff.FullName}** for **Period {slot.Period.PeriodNumber} ({slot.Subject.Name})** on **{swapDate:MMM dd, yyyy}**.\n\nPlease review and tap **Confirm & Submit** below:",
                    Proposal = new ChatbotActionProposal
                    {
                        ActionType = "RequestPeriodSwap",
                        Title = "Request Timetable Period Swap",
                        Summary = $"Swap Period {slot.Period.PeriodNumber} ({slot.Subject.Name} - {slot.Class.Name}) on {swapDate:yyyy-MM-dd} with {targetStaff.FullName}.",
                        Parameters = new Dictionary<string, string>
                        {
                            ["Colleague"] = targetStaff.FullName,
                            ["Period"] = $"Period {slot.Period.PeriodNumber} ({slot.Period.StartTime:hh\\:mm} - {slot.Period.EndTime:hh\\:mm})",
                            ["Subject"] = $"{slot.Subject.Name} ({slot.Class.Name} - {slot.Section})",
                            ["Swap Date"] = swapDate.ToString("yyyy-MM-dd"),
                            ["Reason"] = reason
                        },
                        PayloadJson = payload
                    }
                };
            }
        });
    }
    #endregion

    #region Parent Read & Write Tools
    private void RegisterParentTools()
    {
        Register(new ChatTool
        {
            Name = "get_my_children_attendance",
            Description = "Retrieves attendance percentage and today's session status for the authenticated parent's linked children.",
            AllowedRoles = new[] { Roles.Parent },
            ParametersSchema = new { type = "object", properties = new { } },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                var userIdStr = user.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!int.TryParse(userIdStr, out var userId)) return new ToolExecutionResult { Success = false, ResultText = "Could not resolve user identity." };

                var parent = await db.Parents
                    .Include(p => p.ChildrenLinks)
                        .ThenInclude(cl => cl.Student)
                            .ThenInclude(s => s.Class)
                    .FirstOrDefaultAsync(p => p.UserId == userId);

                if (parent == null || parent.ChildrenLinks.Count == 0)
                {
                    return new ToolExecutionResult
                    {
                        ResultText = "Your account is not linked to any student profile yet. Please contact your school administrator to link your child."
                    };
                }

                var children = parent.ChildrenLinks.Select(cl => cl.Student).Where(s => s.IsActive).ToList();
                var summaries = new List<string>();
                foreach (var child in children)
                {
                    var sRecords = await db.AttendanceRecords
                        .Where(a => a.StudentId == child.Id && a.IsActive)
                        .OrderByDescending(a => a.Date)
                        .ToListAsync();

                    double pct = 100.0;
                    if (sRecords.Count > 0)
                    {
                        var p = sRecords.Count(r => r.Status == AttendanceStatus.Present);
                        var l = sRecords.Count(r => r.Status == AttendanceStatus.Late);
                        var lv = sRecords.Count(r => r.Status == AttendanceStatus.OnLeave);
                        pct = Math.Round((p + (l * 0.5) + lv) / (double)sRecords.Count * 100, 1);
                    }

                    var todayRec = sRecords.FirstOrDefault(r => r.Date == DateOnly.FromDateTime(DateTime.UtcNow));
                    string todayStatus = todayRec != null ? $"Today: **{todayRec.Status}**" : "Today: *No classes marked yet*";

                    summaries.Add($"### 🎓 **{child.FullName}** (Roll: `{child.RollNo}`, Class: {child.Class.Name} - {child.Section})\n" +
                                  $"• **Overall Attendance**: `{pct}%` across {sRecords.Count} recorded sessions\n" +
                                  $"• {todayStatus}");
                }

                return new ToolExecutionResult
                {
                    ResultText = string.Join("\n\n", summaries) + "\n\n[Open Full Parent Portal & Calendar](/app/parent-portal)",
                    Data = children.Select(c => new { c.Id, c.FullName, c.RollNo })
                };
            }
        });

        Register(new ChatTool
        {
            Name = "get_leave_history",
            Description = "Fetches submitted student leave applications and their approval status (Pending, Approved, Rejected).",
            AllowedRoles = new[] { Roles.Parent },
            ParametersSchema = new { type = "object", properties = new { } },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                var userIdStr = user.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!int.TryParse(userIdStr, out var userId)) return new ToolExecutionResult { Success = false, ResultText = "Could not resolve user identity." };

                var parent = await db.Parents.FirstOrDefaultAsync(p => p.UserId == userId);
                if (parent == null) return new ToolExecutionResult { Success = false, ResultText = "Parent profile not found." };

                var leaves = await db.LeaveRequests
                    .Include(l => l.Student)
                    .Where(l => l.ParentId == parent.Id && l.IsActive)
                    .OrderByDescending(l => l.StartDate)
                    .Take(5)
                    .ToListAsync();

                if (leaves.Count == 0)
                {
                    return new ToolExecutionResult { ResultText = "You have not submitted any leave requests yet.\n\n[Apply For Student Leave](/app/leaves)" };
                }

                var lines = leaves.Select(l =>
                {
                    string statusBadge = l.Status == LeaveStatus.Approved ? "✅ Approved" : (l.Status == LeaveStatus.Rejected ? "❌ Rejected" : "⏳ Pending");
                    return $"• **{l.Student.FullName}**: {l.StartDate:yyyy-MM-dd} to {l.EndDate:yyyy-MM-dd} ({l.Reason}) - {statusBadge}";
                });

                return new ToolExecutionResult
                {
                    ResultText = $"**Your Recent Leave Applications ({leaves.Count})**:\n\n" + string.Join("\n", lines) +
                                 $"\n\n[Open Leave History & Applications](/app/leaves)",
                    Data = leaves.Select(l => new { l.Id, l.Status, l.StartDate, l.EndDate })
                };
            }
        });

        Register(new ChatTool
        {
            Name = "get_parent_profile",
            Description = "Displays the parent's registered contact info and linked children details.",
            AllowedRoles = new[] { Roles.Parent },
            ParametersSchema = new { type = "object", properties = new { } },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                var userIdStr = user.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!int.TryParse(userIdStr, out var userId)) return new ToolExecutionResult { Success = false, ResultText = "Could not resolve user identity." };

                var parent = await db.Parents
                    .Include(p => p.ChildrenLinks)
                        .ThenInclude(cl => cl.Student)
                            .ThenInclude(s => s.Class)
                    .FirstOrDefaultAsync(p => p.UserId == userId);

                if (parent == null) return new ToolExecutionResult { Success = false, ResultText = "Parent profile not found." };

                var childNames = parent.ChildrenLinks.Select(cl => $"{cl.Student.FullName} ({cl.Student.Class.Name} - {cl.Student.Section})");

                return new ToolExecutionResult
                {
                    ResultText = $"### 👨‍👩‍👦 **Parent Profile: {parent.FullName}**\n\n" +
                                 $"• **Email**: `{parent.Email}`\n" +
                                 $"• **Phone**: {parent.Phone}\n" +
                                 $"• **Linked Children**: {string.Join(", ", childNames)}\n\n" +
                                 $"[Open Parent Portal](/app/parent-portal)",
                    Data = new { parent.Id, parent.FullName, parent.Email, parent.Phone }
                };
            }
        });

        Register(new ChatTool
        {
            Name = "submit_leave_request",
            Description = "Prepares a formal leave application for a child. Generates a confirmation card.",
            AllowedRoles = new[] { Roles.Parent },
            IsMutating = true,
            ParametersSchema = new
            {
                type = "object",
                properties = new
                {
                    days = new { type = "integer", description = "Number of days for the leave (default 1)." },
                    reason = new { type = "string", description = "Reason for leave (e.g. 'Fever', 'Family function')." }
                }
            },
            Handler = async (user, args, sp) =>
            {
                var db = sp.GetRequiredService<ApplicationDbContext>();
                var userIdStr = user.FindFirstValue(ClaimTypes.NameIdentifier);
                if (!int.TryParse(userIdStr, out var userId)) return new ToolExecutionResult { Success = false, ResultText = "Could not resolve user identity." };

                var parent = await db.Parents
                    .Include(p => p.ChildrenLinks)
                        .ThenInclude(cl => cl.Student)
                            .ThenInclude(s => s.Class)
                    .FirstOrDefaultAsync(p => p.UserId == userId);

                if (parent == null || parent.ChildrenLinks.Count == 0)
                {
                    return new ToolExecutionResult { Success = false, ResultText = "No linked children found for your account." };
                }

                var targetChild = parent.ChildrenLinks.First().Student;
                int days = 1;
                if (args.TryGetProperty("days", out var dProp) && dProp.TryGetInt32(out var parsedD))
                {
                    days = Math.Clamp(parsedD, 1, 14);
                }

                string reason = args.TryGetProperty("reason", out var rProp) ? rProp.GetString() ?? "Medical leave" : "Medical leave";

                var startDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1));
                var endDate = startDate.AddDays(days - 1);

                var payload = JsonSerializer.Serialize(new
                {
                    studentId = targetChild.Id,
                    parentId = parent.Id,
                    instituteId = targetChild.InstituteId,
                    startDate = startDate.ToString("yyyy-MM-dd"),
                    endDate = endDate.ToString("yyyy-MM-dd"),
                    reason
                });

                return new ToolExecutionResult
                {
                    IsProposal = true,
                    ResultText = $"I have prepared a **Leave Application** for **{targetChild.FullName}** from **{startDate:MMM dd, yyyy}** to **{endDate:MMM dd, yyyy}**.\n\nPlease review and tap **Confirm & Submit** below:",
                    Proposal = new ChatbotActionProposal
                    {
                        ActionType = "SubmitLeave",
                        Title = "Submit Student Leave Request",
                        Summary = $"Leave application for {targetChild.FullName} ({startDate:yyyy-MM-dd} to {endDate:yyyy-MM-dd}).",
                        Parameters = new Dictionary<string, string>
                        {
                            ["Student Name"] = targetChild.FullName,
                            ["Class"] = $"{targetChild.Class.Name} - {targetChild.Section}",
                            ["Start Date"] = startDate.ToString("yyyy-MM-dd"),
                            ["End Date"] = endDate.ToString("yyyy-MM-dd"),
                            ["Reason"] = reason
                        },
                        PayloadJson = payload
                    }
                };
            }
        });

        Register(new ChatTool
        {
            Name = "navigate_to_page",
            Description = "Provides direct navigation links to application screens and menus. Accepts a registered route key (e.g. 'dashboard', 'staff_directory', 'students_and_import', 'parent_directory', 'subjects_setup', 'timetable_setup', 'approvals', 'mark_attendance', 'period_swaps', 'leave_requests', 'reports_and_analytics', 'profile', 'help').",
            AllowedRoles = new[] { Roles.SuperAdmin, Roles.InstituteAdmin, Roles.Staff, Roles.Parent },
            ParametersSchema = new
            {
                type = "object",
                properties = new
                {
                    routeKey = new { type = "string", description = "The registered route key to navigate to. Never pass a raw URL or free text." }
                },
                required = new[] { "routeKey" }
            },
            Handler = (user, args, sp) =>
            {
                var routeRegistry = sp.GetRequiredService<IRouteRegistry>();
                var role = user.FindFirstValue(ClaimTypes.Role) ?? Roles.Staff;

                // Support routeKey or fallback destination parameter
                string targetKey = "";
                if (args.TryGetProperty("routeKey", out var rkProp) && !string.IsNullOrWhiteSpace(rkProp.GetString()))
                {
                    targetKey = rkProp.GetString()!.Trim();
                }
                else if (args.TryGetProperty("destination", out var dProp) && !string.IsNullOrWhiteSpace(dProp.GetString()))
                {
                    targetKey = dProp.GetString()!.Trim();
                }

                if (string.IsNullOrWhiteSpace(targetKey))
                {
                    return Task.FromResult(new ToolExecutionResult
                    {
                        Success = false,
                        ResultText = "Please provide a valid route key to navigate."
                    });
                }

                // Never accept free-text URLs (e.g. raw paths starting with '/' or 'http')
                if (targetKey.StartsWith("/") || targetKey.StartsWith("http", StringComparison.OrdinalIgnoreCase))
                {
                    return Task.FromResult(new ToolExecutionResult
                    {
                        Success = false,
                        ResultText = "Free-text URLs are not permitted. Please use registered menu route keys only."
                    });
                }

                // 1. Look up by exact key
                var matchedRoute = routeRegistry.FindByKey(targetKey, role);

                // 2. If not found by exact key, try keyword match for this role
                if (matchedRoute == null)
                {
                    matchedRoute = routeRegistry.MatchByKeyword(targetKey, role);
                }

                // 3. Security check: Check if route exists globally but user role lacks permission
                if (matchedRoute == null)
                {
                    var allRoutes = routeRegistry.GetAllRoutes();
                    var existingOtherRoleRoute = allRoutes.FirstOrDefault(r =>
                        string.Equals(r.Key, targetKey, StringComparison.OrdinalIgnoreCase) ||
                        r.Keywords.Any(k => string.Equals(k, targetKey, StringComparison.OrdinalIgnoreCase)));

                    if (existingOtherRoleRoute != null)
                    {
                        return Task.FromResult(new ToolExecutionResult
                        {
                            Success = false,
                            ResultText = $"Security Policy Violation: Your role '{role}' is not authorized to access '{existingOtherRoleRoute.Label}'."
                        });
                    }

                    var validKeys = routeRegistry.GetRoutesForRole(role).Select(r => $"• `{r.Key}` ({r.Label})");
                    return Task.FromResult(new ToolExecutionResult
                    {
                        Success = false,
                        ResultText = $"Unknown navigation target '{targetKey}'. Please select one of the valid screens for your role:\n\n{string.Join("\n", validKeys)}"
                    });
                }

                return Task.FromResult(new ToolExecutionResult
                {
                    Success = true,
                    ResultText = $"I can take you directly there!\n\n👉 **[{matchedRoute.Label}]({matchedRoute.AngularRoute})**\n{matchedRoute.Description}\n\nTap the button or link above to open this menu.",
                    Data = new
                    {
                        type = "navigate",
                        route = matchedRoute.AngularRoute,
                        label = matchedRoute.Label,
                        routeKey = matchedRoute.Key
                    }
                });
            }
        });
    }
    #endregion
}
