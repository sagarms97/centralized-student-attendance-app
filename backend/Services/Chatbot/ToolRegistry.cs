using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
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
        RegisterDefaultTools();
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

    private void RegisterDefaultTools()
    {
        #region SuperAdmin Tools
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
                                 $"• **Platform Today's Attendance**: {todayPct}% across {todayRecords.Count} sessions",
                    Data = new { totalInstitutes, activeInstitutes, totalStudents, totalStaff, totalParents, todayPct }
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
                if (logs.Count == 0)
                {
                    return new ToolExecutionResult { ResultText = "No audit log records matched your query." };
                }

                var lines = logs.Select(l => $"• **[{l.CreatedAt:yyyy-MM-dd HH:mm}]** `{l.Action}` by `{l.UserEmail}` ({l.Institute?.Name ?? "Platform"}): {l.Details}");
                return new ToolExecutionResult
                {
                    ResultText = $"**Recent Platform Audit Trail ({logs.Count})**:\n\n" + string.Join("\n", lines),
                    Data = logs.Select(l => new { l.Id, l.Action, l.UserEmail, l.Details, l.CreatedAt })
                };
            }
        });

        Register(new ChatTool
        {
            Name = "list_institutes",
            Description = "Lists registered college tenants with their code, status (Active/Disabled), and city.",
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

                var insts = await query.OrderBy(i => i.Name).Take(10).ToListAsync();
                if (insts.Count == 0) return new ToolExecutionResult { ResultText = "No institutes matched the search criteria." };

                var lines = insts.Select(i => $"• **{i.Name}** (Code: `{i.Code}`) - Status: {(i.IsActive ? "✅ Active" : "❌ Disabled")}, City: {i.City}");
                return new ToolExecutionResult
                {
                    ResultText = $"**Registered Institutes ({insts.Count})**:\n\n" + string.Join("\n", lines) +
                                 $"\n\n[Open Full Institute Directory](/app/super-admin)",
                    Data = insts.Select(i => new { i.Id, i.Name, i.Code, i.IsActive, i.City })
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
        #endregion

        #region InstituteAdmin Tools
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
                        ResultText = $"No attendance has been submitted today ({today:MMM dd, yyyy}) yet. Teachers can mark attendance via the **Mark Attendance** tab."
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
                        ResultText = $"Great news! No students currently fall below the {threshold}% attendance threshold."
                    };
                }

                return new ToolExecutionResult
                {
                    ResultText = $"**Students with Attendance Below {threshold}% ({defaulters.Count})**:\n\n" +
                                 string.Join("\n", defaulters) +
                                 $"\n\n[Open Defaulters Report](/app/reports)",
                    Data = defaulters
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
                if (!int.TryParse(instIdClaim, out var instId))
                {
                    return new ToolExecutionResult { Success = false, ResultText = "Could not resolve institute from credentials." };
                }

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
                                 $"• **Total Students**: {studentCount}",
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
                if (!int.TryParse(instIdClaim, out var instId))
                {
                    return new ToolExecutionResult { Success = false, ResultText = "Unauthorized: Institute identity is missing." };
                }

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
        #endregion

        #region Staff Tools
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
                if (!int.TryParse(userIdStr, out var userId))
                {
                    return new ToolExecutionResult { Success = false, ResultText = "Could not resolve user identity." };
                }

                var staff = await db.StaffMembers.FirstOrDefaultAsync(s => s.UserId == userId && s.IsActive);
                if (staff == null)
                {
                    return new ToolExecutionResult { Success = false, ResultText = "No active staff profile linked to your user account." };
                }

                var todayDayOfWeek = DateTime.UtcNow.DayOfWeek;
                var slots = await db.TimetableEntries
                    .Include(t => t.Class)
                    .Include(t => t.Subject)
                    .Include(t => t.Period)
                    .Where(t => t.StaffId == staff.Id && t.DayOfWeek == todayDayOfWeek && t.IsActive)
                    .OrderBy(t => t.Period.PeriodNumber)
                    .ToListAsync();

                if (slots.Count == 0)
                {
                    return new ToolExecutionResult { ResultText = $"You have no scheduled teaching periods for today (**{todayDayOfWeek}**)." };
                }

                var lines = slots.Select(s => $"• **Period {s.Period.PeriodNumber} ({s.Period.StartTime:hh\\:mm} - {s.Period.EndTime:hh\\:mm})**: {s.Subject.Name} for **{s.Class.Name} - {s.Section}**");
                return new ToolExecutionResult
                {
                    ResultText = $"**Your Teaching Schedule for Today ({todayDayOfWeek})**:\n\n" + string.Join("\n", lines) +
                                 $"\n\n[Open Timetable & Swaps](/app/timetable)",
                    Data = slots.Select(s => new { s.Period.PeriodNumber, Subject = s.Subject.Name, Class = s.Class.Name, s.Section })
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
                if (!int.TryParse(instIdClaim, out var instId))
                {
                    return new ToolExecutionResult { Success = false, ResultText = "Could not resolve institute from credentials." };
                }

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
        #endregion

        #region Parent Tools
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
                if (!int.TryParse(userIdStr, out var userId))
                {
                    return new ToolExecutionResult { Success = false, ResultText = "Could not resolve user identity." };
                }

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
                    ResultText = string.Join("\n\n", summaries) + "\n\n[Open Full Parent Portal](/app/parent-portal)",
                    Data = children.Select(c => new { c.Id, c.FullName, c.RollNo })
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
                if (!int.TryParse(userIdStr, out var userId))
                {
                    return new ToolExecutionResult { Success = false, ResultText = "Could not resolve user identity." };
                }

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
        #endregion
    }
}
