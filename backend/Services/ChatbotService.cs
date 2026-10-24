using System.Security.Claims;
using System.Text.Json;
using System.Text.RegularExpressions;
using Microsoft.EntityFrameworkCore;
using StudentAttendance.Api.Data;
using StudentAttendance.Api.DTOs;
using StudentAttendance.Api.Models;

namespace StudentAttendance.Api.Services;

public interface IChatbotService
{
    Task<ChatMessageResponse> ProcessMessageAsync(ClaimsPrincipal userPrincipal, string rawMessage, string? ipAddress);
    Task<ConfirmActionResponse> ExecuteConfirmedActionAsync(ClaimsPrincipal userPrincipal, ConfirmActionRequest request, string? ipAddress);
    List<string> GetSuggestedChips(ClaimsPrincipal userPrincipal);
}

public class ChatbotService : IChatbotService
{
    private readonly ApplicationDbContext _context;
    private readonly IConfiguration _configuration;

    public ChatbotService(ApplicationDbContext context, IConfiguration configuration)
    {
        _context = context;
        _configuration = configuration;
    }

    public List<string> GetSuggestedChips(ClaimsPrincipal userPrincipal)
    {
        var role = userPrincipal.FindFirstValue(ClaimTypes.Role) ?? string.Empty;

        return role switch
        {
            Roles.SuperAdmin => new List<string>
            {
                "Platform Overview",
                "How many institutes are active?",
                "Show recent audit logs",
                "List all colleges"
            },
            Roles.InstituteAdmin => new List<string>
            {
                "Today's Attendance Summary",
                "List students with low attendance",
                "Create Subject: Artificial Intelligence (AI-201)",
                "Show staff count and subjects"
            },
            Roles.Staff => new List<string>
            {
                "My classes today",
                "How many students are present today?",
                "Check institute attendance",
                "Show staff directory"
            },
            Roles.Parent => new List<string>
            {
                "How is my child's attendance?",
                "Was my child present today?",
                "Apply leave for my child from tomorrow for 2 days due to fever",
                "Show recent attendance status"
            },
            _ => new List<string> { "Help", "What can you do?" }
        };
    }

    public async Task<ChatMessageResponse> ProcessMessageAsync(ClaimsPrincipal userPrincipal, string rawMessage, string? ipAddress)
    {
        var userIdStr = userPrincipal.FindFirstValue(ClaimTypes.NameIdentifier);
        int userId = int.TryParse(userIdStr, out var uId) ? uId : 0;
        var role = userPrincipal.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        var email = userPrincipal.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var instituteIdClaim = userPrincipal.FindFirstValue("institute_id");
        int? instituteId = int.TryParse(instituteIdClaim, out var instIdVal) ? instIdVal : null;

        var msg = rawMessage.Trim().ToLowerInvariant();

        return role switch
        {
            Roles.SuperAdmin => await HandleSuperAdminMessageAsync(msg, rawMessage, userId, email, ipAddress),
            Roles.InstituteAdmin => await HandleAdminMessageAsync(msg, rawMessage, userId, email, instituteId, ipAddress),
            Roles.Staff => await HandleStaffMessageAsync(msg, rawMessage, userId, email, instituteId, ipAddress),
            Roles.Parent => await HandleParentMessageAsync(msg, rawMessage, userId, email, instituteId, ipAddress),
            _ => new ChatMessageResponse
            {
                Reply = "I am EduAttend AI Assistant. Please log in with a valid account to use conversational tools.",
                Role = role,
                SuggestedChips = new List<string> { "Help" }
            }
        };
    }

    #region Super Admin Handler
    private async Task<ChatMessageResponse> HandleSuperAdminMessageAsync(string msg, string rawMsg, int userId, string email, string? ip)
    {
        var chips = new List<string>
        {
            "Platform Overview",
            "Show recent audit logs",
            "List all colleges",
            "Attendance rate across platform"
        };

        // 1. Overview / Metrics
        if (msg.Contains("overview") || msg.Contains("how many institute") || msg.Contains("stats") || msg.Contains("platform"))
        {
            var totalInstitutes = await _context.Institutes.IgnoreQueryFilters().CountAsync();
            var activeInstitutes = await _context.Institutes.IgnoreQueryFilters().CountAsync(i => i.IsActive);
            var totalStudents = await _context.Students.IgnoreQueryFilters().CountAsync(s => s.IsActive);
            var totalStaff = await _context.StaffMembers.IgnoreQueryFilters().CountAsync(s => s.IsActive);
            var totalParents = await _context.Parents.IgnoreQueryFilters().CountAsync(p => p.IsActive);

            return new ChatMessageResponse
            {
                Reply = $"**Platform Overview Metrics**:\n\n" +
                        $"• **Total Colleges/Institutes**: {totalInstitutes} ({activeInstitutes} Active, {totalInstitutes - activeInstitutes} Disabled)\n" +
                        $"• **Total Students**: {totalStudents}\n" +
                        $"• **Total Staff Members**: {totalStaff}\n" +
                        $"• **Total Registered Parents**: {totalParents}\n\n" +
                        $"Would you like me to drill down into a specific college or list recent platform audit logs?",
                Role = Roles.SuperAdmin,
                SuggestedChips = chips
            };
        }

        // 2. Audit Logs
        if (msg.Contains("audit") || msg.Contains("log") || msg.Contains("security") || msg.Contains("history"))
        {
            var recent = await _context.AuditLogs.IgnoreQueryFilters()
                .OrderByDescending(a => a.CreatedAt)
                .Take(5)
                .ToListAsync();

            if (recent.Count == 0)
            {
                return new ChatMessageResponse
                {
                    Reply = "No audit logs have been recorded yet in the platform.",
                    Role = Roles.SuperAdmin,
                    SuggestedChips = chips
                };
            }

            var logLines = recent.Select(l => $"• **[{l.CreatedAt:yyyy-MM-dd HH:mm}]** `{l.Action}` by `{l.UserEmail}`: {l.Details}");
            return new ChatMessageResponse
            {
                Reply = $"**Recent Platform Audit Trail (Last 5)**:\n\n" + string.Join("\n", logLines),
                Role = Roles.SuperAdmin,
                SuggestedChips = chips
            };
        }

        // 3. List colleges
        if (msg.Contains("list") || msg.Contains("college") || msg.Contains("institutes"))
        {
            var insts = await _context.Institutes.IgnoreQueryFilters().Take(10).ToListAsync();
            var lines = insts.Select(i => $"• **{i.Name}** (Code: `{i.Code}`) - Status: {(i.IsActive ? "✅ Active" : "❌ Disabled")}, City: {i.City}");
            return new ChatMessageResponse
            {
                Reply = $"**Registered Institutes** ({insts.Count}):\n\n" + string.Join("\n", lines),
                Role = Roles.SuperAdmin,
                SuggestedChips = chips
            };
        }

        // 4. Action Proposal: Toggle Institute Status
        if (msg.Contains("disable") || msg.Contains("deactivate") || msg.Contains("enable") || msg.Contains("activate"))
        {
            bool enable = msg.Contains("enable") || msg.Contains("activate");
            var match = Regex.Match(rawMsg, @"(?:institute|college|code)\s+([A-Za-z0-9\-_]+)", RegexOptions.IgnoreCase);
            string codeOrName = match.Success ? match.Groups[1].Value : string.Empty;

            var targetInst = await _context.Institutes.IgnoreQueryFilters()
                .FirstOrDefaultAsync(i => i.Code == codeOrName || i.Name.ToLower().Contains(codeOrName.ToLower()));

            if (targetInst != null)
            {
                var payload = JsonSerializer.Serialize(new { instituteId = targetInst.Id, isActive = enable });
                var actionVerb = enable ? "Activate" : "Deactivate";

                return new ChatMessageResponse
                {
                    Reply = $"I have prepared an action to **{actionVerb}** the institute **{targetInst.Name}** (Code: `{targetInst.Code}`).\n\nPlease confirm below to apply this change to the platform.",
                    Role = Roles.SuperAdmin,
                    Proposal = new ChatbotActionProposal
                    {
                        ActionType = "ToggleInstituteStatus",
                        Title = $"{actionVerb} Institute",
                        Summary = $"{actionVerb} college '{targetInst.Name}' (Code: {targetInst.Code}) across the platform.",
                        Parameters = new Dictionary<string, string>
                        {
                            ["Institute ID"] = targetInst.Id.ToString(),
                            ["Institute Name"] = targetInst.Name,
                            ["Institute Code"] = targetInst.Code,
                            ["New Status"] = enable ? "Active" : "Disabled"
                        },
                        PayloadJson = payload
                    },
                    SuggestedChips = chips
                };
            }
        }

        // Fallback
        return new ChatMessageResponse
        {
            Reply = "Hello Super Admin! I can help you monitor platform health, inspect registered colleges, review audit trails, or toggle college statuses. What would you like to check?",
            Role = Roles.SuperAdmin,
            SuggestedChips = chips
        };
    }
    #endregion

    #region Institute Admin Handler
    private async Task<ChatMessageResponse> HandleAdminMessageAsync(string msg, string rawMsg, int userId, string email, int? instituteId, string? ip)
    {
        var chips = new List<string>
        {
            "Today's Attendance Summary",
            "List low attendance students",
            "Create Subject: Artificial Intelligence (AI-201)",
            "How many staff members are active?"
        };

        if (!instituteId.HasValue)
        {
            return new ChatMessageResponse
            {
                Reply = "You are not currently linked to an institute.",
                Role = Roles.InstituteAdmin,
                SuggestedChips = chips
            };
        }

        int instId = instituteId.Value;

        // 1. Today's Attendance Summary
        if (msg.Contains("attendance") || msg.Contains("today") || msg.Contains("present") || msg.Contains("absent"))
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var records = await _context.AttendanceRecords
                .Where(a => a.InstituteId == instId && a.Date == today && a.IsActive)
                .ToListAsync();

            if (records.Count == 0)
            {
                return new ChatMessageResponse
                {
                    Reply = $"No attendance has been submitted today ({today:MMM dd, yyyy}) yet. Teachers can mark attendance via the **Mark Attendance** tab.",
                    Role = Roles.InstituteAdmin,
                    SuggestedChips = chips
                };
            }

            var present = records.Count(r => r.Status == AttendanceStatus.Present);
            var absent = records.Count(r => r.Status == AttendanceStatus.Absent);
            var late = records.Count(r => r.Status == AttendanceStatus.Late);
            var leave = records.Count(r => r.Status == AttendanceStatus.OnLeave);
            double pct = Math.Round((present + (late * 0.5) + leave) / (double)records.Count * 100, 1);

            return new ChatMessageResponse
            {
                Reply = $"**Today's Attendance Snapshot ({today:MMM dd, yyyy})**:\n\n" +
                        $"• **Overall Attendance**: `{pct}%`\n" +
                        $"• **Total Session Entries**: {records.Count}\n" +
                        $"• **Present**: {present}\n" +
                        $"• **Absent**: {absent}\n" +
                        $"• **Late**: {late}\n" +
                        $"• **On Approved Leave**: {leave}",
                Role = Roles.InstituteAdmin,
                SuggestedChips = chips
            };
        }

        // 2. Low attendance / Defaulters
        if (msg.Contains("low") || msg.Contains("defaulter") || msg.Contains("shortage") || msg.Contains("below 75"))
        {
            var students = await _context.Students
                .Include(s => s.Class)
                .Where(s => s.InstituteId == instId && s.IsActive)
                .ToListAsync();

            var defaulters = new List<string>();
            foreach (var st in students)
            {
                var sRecs = await _context.AttendanceRecords
                    .Where(a => a.StudentId == st.Id && a.IsActive)
                    .ToListAsync();

                if (sRecs.Count > 0)
                {
                    var p = sRecs.Count(r => r.Status == AttendanceStatus.Present);
                    var l = sRecs.Count(r => r.Status == AttendanceStatus.Late);
                    var lv = sRecs.Count(r => r.Status == AttendanceStatus.OnLeave);
                    double pct = Math.Round((p + (l * 0.5) + lv) / (double)sRecs.Count * 100, 1);
                    if (pct < 75.0)
                    {
                        defaulters.Add($"• **{st.FullName}** (Roll: `{st.RollNo}`, Class: {st.Class.Name}-{st.Section}): `{pct}%` attendance ({sRecs.Count} sessions)");
                    }
                }
            }

            if (defaulters.Count == 0)
            {
                return new ChatMessageResponse
                {
                    Reply = "Great news! Currently there are **no students** below the 75% attendance threshold.",
                    Role = Roles.InstituteAdmin,
                    SuggestedChips = chips
                };
            }

            return new ChatMessageResponse
            {
                Reply = $"**Students with Attendance Below 75% ({defaulters.Count})**:\n\n" + string.Join("\n", defaulters),
                Role = Roles.InstituteAdmin,
                SuggestedChips = chips
            };
        }

        // 3. Staff & Subjects Overview
        if (msg.Contains("staff") || msg.Contains("teacher") || msg.Contains("subject") || msg.Contains("classes"))
        {
            // If it's a create subject command, let step 4 handle it!
            if (!msg.Contains("create") && !msg.Contains("add subject"))
            {
                var staffCount = await _context.StaffMembers.CountAsync(s => s.InstituteId == instId && s.IsActive);
                var subCount = await _context.Subjects.CountAsync(s => s.InstituteId == instId && s.IsActive);
                var classCount = await _context.Classes.CountAsync(c => c.InstituteId == instId && c.IsActive);
                var studentCount = await _context.Students.CountAsync(s => s.InstituteId == instId && s.IsActive);

                return new ChatMessageResponse
                {
                    Reply = $"**Institute Operational Metrics**:\n\n" +
                            $"• **Active Staff**: {staffCount}\n" +
                            $"• **Total Subjects Configured**: {subCount}\n" +
                            $"• **Total Classes**: {classCount}\n" +
                            $"• **Total Students**: {studentCount}",
                    Role = Roles.InstituteAdmin,
                    SuggestedChips = chips
                };
            }
        }

        // 4. Action Proposal: Create Subject
        if (msg.Contains("create") || msg.Contains("add subject") || msg.Contains("new subject"))
        {
            string name = "New Subject";
            string code = "SUB-" + new Random().Next(100, 999);

            var codeMatch = Regex.Match(rawMsg, @"(?:code|code:|\()\s*([A-Za-z0-9\-]+)\)?", RegexOptions.IgnoreCase);
            if (codeMatch.Success)
            {
                code = codeMatch.Groups[1].Value.ToUpperInvariant();
            }

            var nameMatch = Regex.Match(rawMsg, @"(?:subject|create|add)\s*:?\s*([A-Za-z\s]+?)(?:\s+with\s+code|\s*\(|\s+code:|$)", RegexOptions.IgnoreCase);
            if (nameMatch.Success && !string.IsNullOrWhiteSpace(nameMatch.Groups[1].Value))
            {
                name = nameMatch.Groups[1].Value.Trim();
            }

            var payload = JsonSerializer.Serialize(new { instituteId = instId, name = name, code = code });

            return new ChatMessageResponse
            {
                Reply = $"I have prepared the action to register the new subject **{name}** with subject code `{code}`.\n\nPlease verify the parameters and tap **Confirm & Execute** below:",
                Role = Roles.InstituteAdmin,
                Proposal = new ChatbotActionProposal
                {
                    ActionType = "CreateSubject",
                    Title = "Create New Subject",
                    Summary = $"Register subject '{name}' (Code: {code}) in your institute directory.",
                    Parameters = new Dictionary<string, string>
                    {
                        ["Subject Name"] = name,
                        ["Subject Code"] = code,
                        ["Institute"] = instId.ToString()
                    },
                    PayloadJson = payload
                },
                SuggestedChips = chips
            };
        }

        // Fallback
        return new ChatMessageResponse
        {
            Reply = "Hello Administrator! I can help you monitor student attendance, find defaulters, review staff counts, or create new subjects with confirmation cards. What would you like to do?",
            Role = Roles.InstituteAdmin,
            SuggestedChips = chips
        };
    }
    #endregion

    #region Staff Handler
    private async Task<ChatMessageResponse> HandleStaffMessageAsync(string msg, string rawMsg, int userId, string email, int? instituteId, string? ip)
    {
        var chips = new List<string>
        {
            "My classes today",
            "How many students are present today?",
            "Check institute attendance",
            "Show staff directory"
        };

        if (!instituteId.HasValue)
        {
            return new ChatMessageResponse
            {
                Reply = "You are not assigned to an active institute.",
                Role = Roles.Staff,
                SuggestedChips = chips
            };
        }

        int instId = instituteId.Value;
        var staff = await _context.StaffMembers.FirstOrDefaultAsync(s => s.UserId == userId && s.InstituteId == instId);

        // 1. My Classes Today
        if (msg.Contains("class") || msg.Contains("schedule") || msg.Contains("today") || msg.Contains("timetable"))
        {
            if (staff == null)
            {
                return new ChatMessageResponse
                {
                    Reply = "Your user account is not linked to an active staff profile.",
                    Role = Roles.Staff,
                    SuggestedChips = chips
                };
            }

            var todayDayOfWeek = DateTime.UtcNow.DayOfWeek;
            var slots = await _context.TimetableEntries
                .Include(t => t.Class)
                .Include(t => t.Subject)
                .Include(t => t.Period)
                .Where(t => t.StaffId == staff.Id && t.DayOfWeek == todayDayOfWeek && t.IsActive)
                .OrderBy(t => t.Period.PeriodNumber)
                .ToListAsync();

            if (slots.Count == 0)
            {
                return new ChatMessageResponse
                {
                    Reply = $"You have no scheduled teaching periods for today (**{todayDayOfWeek}**).",
                    Role = Roles.Staff,
                    SuggestedChips = chips
                };
            }

            var lines = slots.Select(s => $"• **Period {s.Period.PeriodNumber} ({s.Period.StartTime:hh\\:mm} - {s.Period.EndTime:hh\\:mm})**: {s.Subject.Name} for **{s.Class.Name} - {s.Section}**");

            return new ChatMessageResponse
            {
                Reply = $"**Your Teaching Schedule for Today ({todayDayOfWeek})**:\n\n" + string.Join("\n", lines),
                Role = Roles.Staff,
                SuggestedChips = chips
            };
        }

        // 2. Present/Absent today in institute
        if (msg.Contains("present") || msg.Contains("absent") || msg.Contains("attendance"))
        {
            var today = DateOnly.FromDateTime(DateTime.UtcNow);
            var records = await _context.AttendanceRecords
                .Where(a => a.InstituteId == instId && a.Date == today && a.IsActive)
                .ToListAsync();

            int total = records.Count;
            int present = records.Count(r => r.Status == AttendanceStatus.Present);
            int absent = records.Count(r => r.Status == AttendanceStatus.Absent);

            return new ChatMessageResponse
            {
                Reply = $"**Institute Attendance Today**:\n\n" +
                        $"• Total Recorded Sessions: {total}\n" +
                        $"• Present Count: {present}\n" +
                        $"• Absent Count: {absent}\n\n" +
                        $"You can quickly mark attendance for your periods from the **Mark Attendance** tab.",
                Role = Roles.Staff,
                SuggestedChips = chips
            };
        }

        // Fallback
        return new ChatMessageResponse
        {
            Reply = $"Hello {(staff != null ? staff.FullName : "Teacher")}! I can help you check today's teaching schedule, look up attendance counts, or check timetable slots. How can I assist you?",
            Role = Roles.Staff,
            SuggestedChips = chips
        };
    }
    #endregion

    #region Parent Handler
    private async Task<ChatMessageResponse> HandleParentMessageAsync(string msg, string rawMsg, int userId, string email, int? instituteId, string? ip)
    {
        var chips = new List<string>
        {
            "How is my child's attendance?",
            "Was my child present today?",
            "Apply leave for my child from tomorrow for 2 days due to fever",
            "Show recent attendance status"
        };

        var parent = await _context.Parents
            .Include(p => p.ChildrenLinks)
                .ThenInclude(ps => ps.Student)
                    .ThenInclude(s => s.Class)
            .FirstOrDefaultAsync(p => p.UserId == userId);

        if (parent == null || parent.ChildrenLinks.Count == 0)
        {
            return new ChatMessageResponse
            {
                Reply = "Your account is not linked to any student profile yet. Please ask your institute administrator to link your child to your parent account.",
                Role = Roles.Parent,
                SuggestedChips = chips
            };
        }

        var children = parent.ChildrenLinks.Select(ps => ps.Student).Where(s => s.IsActive).ToList();
        if (children.Count == 0)
        {
            return new ChatMessageResponse
            {
                Reply = "No active student records found for your account.",
                Role = Roles.Parent,
                SuggestedChips = chips
            };
        }

        // 1. Attendance Overview for children
        if (msg.Contains("attendance") || msg.Contains("present") || msg.Contains("absent") || msg.Contains("how is") || msg.Contains("status"))
        {
            var summaries = new List<string>();
            foreach (var child in children)
            {
                var sRecords = await _context.AttendanceRecords
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
                              $"• **Overall Attendance**: `{pct}%` across {sRecords.Count} sessions\n" +
                              $"• {todayStatus}");
            }

            return new ChatMessageResponse
            {
                Reply = string.Join("\n\n", summaries),
                Role = Roles.Parent,
                SuggestedChips = chips
            };
        }

        // 2. Action Proposal: Submit Leave Request
        if (msg.Contains("leave") || msg.Contains("sick") || msg.Contains("fever") || msg.Contains("absent tomorrow") || msg.Contains("apply leave"))
        {
            var targetChild = children.First(); // Default to first child
            var startDate = DateOnly.FromDateTime(DateTime.UtcNow.AddDays(1));
            var endDate = startDate;
            string reason = "Medical reasons / Not feeling well";

            if (msg.Contains("2 day") || msg.Contains("two day"))
            {
                endDate = startDate.AddDays(1);
            }
            else if (msg.Contains("3 day") || msg.Contains("three day"))
            {
                endDate = startDate.AddDays(2);
            }

            if (msg.Contains("fever")) reason = "Fever and unwell";
            else if (msg.Contains("family") || msg.Contains("function")) reason = "Family function / travel";
            else if (msg.Contains("sick")) reason = "Sick leave";

            var payload = JsonSerializer.Serialize(new
            {
                studentId = targetChild.Id,
                parentId = parent.Id,
                instituteId = targetChild.InstituteId,
                startDate = startDate.ToString("yyyy-MM-dd"),
                endDate = endDate.ToString("yyyy-MM-dd"),
                reason = reason
            });

            return new ChatMessageResponse
            {
                Reply = $"I have prepared a **Leave Application** for **{targetChild.FullName}** from **{startDate:MMM dd, yyyy}** to **{endDate:MMM dd, yyyy}**.\n\nPlease review the details below and tap **Confirm & Submit** to send it to the school for approval:",
                Role = Roles.Parent,
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
                },
                SuggestedChips = chips
            };
        }

        // Fallback
        return new ChatMessageResponse
        {
            Reply = $"Hello! I am here to help you monitor your {(children.Count > 1 ? "children's" : "child's")} attendance and apply for leaves. How can I help you today?",
            Role = Roles.Parent,
            SuggestedChips = chips
        };
    }
    #endregion

    public async Task<ConfirmActionResponse> ExecuteConfirmedActionAsync(ClaimsPrincipal userPrincipal, ConfirmActionRequest request, string? ipAddress)
    {
        var userIdStr = userPrincipal.FindFirstValue(ClaimTypes.NameIdentifier);
        int userId = int.TryParse(userIdStr, out var uId) ? uId : 0;
        var role = userPrincipal.FindFirstValue(ClaimTypes.Role) ?? string.Empty;
        var email = userPrincipal.FindFirstValue(ClaimTypes.Email) ?? string.Empty;
        var instituteIdClaim = userPrincipal.FindFirstValue("institute_id");
        int? instituteId = int.TryParse(instituteIdClaim, out var instIdVal) ? instIdVal : null;

        switch (request.ActionType)
        {
            case "CreateSubject":
            {
                if (role != Roles.InstituteAdmin && role != Roles.SuperAdmin)
                {
                    return new ConfirmActionResponse { Success = false, Message = "Only Administrators can create new subjects." };
                }

                using var doc = JsonDocument.Parse(request.PayloadJson);
                var root = doc.RootElement;
                string name = root.GetProperty("name").GetString() ?? "New Subject";
                string code = root.GetProperty("code").GetString() ?? "SUB-001";
                int targetInstId = root.TryGetProperty("instituteId", out var instProp) ? instProp.GetInt32() : (instituteId ?? 1);

                // Check duplicate code
                bool exists = await _context.Subjects.IgnoreQueryFilters()
                    .AnyAsync(s => s.InstituteId == targetInstId && s.Code == code);

                if (exists)
                {
                    return new ConfirmActionResponse { Success = false, Message = $"Subject with code '{code}' already exists." };
                }

                var sub = new Subject
                {
                    InstituteId = targetInstId,
                    Name = name,
                    Code = code,
                    IsActive = true,
                    CreatedAt = DateTime.UtcNow
                };

                _context.Subjects.Add(sub);
                await _context.SaveChangesAsync();

                // Log to AuditLogs
                _context.AuditLogs.Add(new AuditLog
                {
                    InstituteId = targetInstId,
                    UserId = userId,
                    UserEmail = email,
                    Action = "Chatbot.CreateSubject",
                    Details = $"Created subject '{name}' (Code: {code}) via AI Assistant confirmation.",
                    IpAddress = ipAddress,
                    CreatedAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();

                return new ConfirmActionResponse
                {
                    Success = true,
                    Message = $"Subject '{name}' (Code: {code}) was successfully created!",
                    ResultData = new { sub.Id, sub.Name, sub.Code }
                };
            }

            case "SubmitLeave":
            {
                if (role != Roles.Parent)
                {
                    return new ConfirmActionResponse { Success = false, Message = "Only Parents can submit leave requests." };
                }

                using var doc = JsonDocument.Parse(request.PayloadJson);
                var root = doc.RootElement;
                int studentId = root.GetProperty("studentId").GetInt32();
                int parentId = root.GetProperty("parentId").GetInt32();
                int targetInstId = root.GetProperty("instituteId").GetInt32();
                var sDate = DateOnly.Parse(root.GetProperty("startDate").GetString()!);
                var eDate = DateOnly.Parse(root.GetProperty("endDate").GetString()!);
                string reason = root.GetProperty("reason").GetString() ?? "Medical leave";

                var leave = new LeaveRequest
                {
                    InstituteId = targetInstId,
                    StudentId = studentId,
                    ParentId = parentId,
                    StartDate = sDate,
                    EndDate = eDate,
                    Reason = reason,
                    Status = LeaveStatus.Pending,
                    CreatedAt = DateTime.UtcNow
                };

                _context.LeaveRequests.Add(leave);
                await _context.SaveChangesAsync();

                // Log to AuditLogs
                _context.AuditLogs.Add(new AuditLog
                {
                    InstituteId = targetInstId,
                    UserId = userId,
                    UserEmail = email,
                    Action = "Chatbot.SubmitLeave",
                    Details = $"Submitted leave request for Student ID {studentId} ({sDate} to {eDate}) via AI Assistant.",
                    IpAddress = ipAddress,
                    CreatedAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();

                return new ConfirmActionResponse
                {
                    Success = true,
                    Message = $"Leave request successfully submitted for approval! Dates: {sDate:yyyy-MM-dd} to {eDate:yyyy-MM-dd}.",
                    ResultData = new { leave.Id, leave.Status }
                };
            }

            case "ToggleInstituteStatus":
            {
                if (role != Roles.SuperAdmin)
                {
                    return new ConfirmActionResponse { Success = false, Message = "Only Super Administrators can toggle institute status." };
                }

                using var doc = JsonDocument.Parse(request.PayloadJson);
                var root = doc.RootElement;
                int instId = root.GetProperty("instituteId").GetInt32();
                bool isActive = root.GetProperty("isActive").GetBoolean();

                var inst = await _context.Institutes.IgnoreQueryFilters().FirstOrDefaultAsync(i => i.Id == instId);
                if (inst == null)
                {
                    return new ConfirmActionResponse { Success = false, Message = "Institute not found." };
                }

                inst.IsActive = isActive;
                await _context.SaveChangesAsync();

                string verb = isActive ? "Activated" : "Deactivated / Disabled";
                _context.AuditLogs.Add(new AuditLog
                {
                    InstituteId = instId,
                    UserId = userId,
                    UserEmail = email,
                    Action = "Chatbot.ToggleInstituteStatus",
                    Details = $"{verb} institute '{inst.Name}' (Code: {inst.Code}) via AI Assistant.",
                    IpAddress = ipAddress,
                    CreatedAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();

                return new ConfirmActionResponse
                {
                    Success = true,
                    Message = $"Institute '{inst.Name}' successfully {verb.ToLower()}!",
                    ResultData = new { inst.Id, inst.IsActive }
                };
            }

            default:
                return new ConfirmActionResponse
                {
                    Success = false,
                    Message = $"Unknown action type '{request.ActionType}'."
                };
        }
    }
}
