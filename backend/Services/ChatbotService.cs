using System.Security.Claims;
using System.Text.Json;
using Microsoft.EntityFrameworkCore;
using StudentAttendance.Api.Data;
using StudentAttendance.Api.DTOs;
using StudentAttendance.Api.Models;
using StudentAttendance.Api.Services.Chatbot;

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
    private readonly IToolRegistry _toolRegistry;
    private readonly ILlmService _llmService;
    private readonly IServiceProvider _serviceProvider;
    private readonly ILogger<ChatbotService> _logger;

    public ChatbotService(
        ApplicationDbContext context,
        IToolRegistry toolRegistry,
        ILlmService llmService,
        IServiceProvider serviceProvider,
        ILogger<ChatbotService> logger)
    {
        _context = context;
        _toolRegistry = toolRegistry;
        _llmService = llmService;
        _serviceProvider = serviceProvider;
        _logger = logger;
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
                "Show my timetable"
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

        var chips = GetSuggestedChips(userPrincipal);

        if (string.IsNullOrWhiteSpace(role))
        {
            return new ChatMessageResponse
            {
                Reply = "I am EduAttend AI Assistant. Please sign in to access role-specific intelligence.",
                Role = "Guest",
                SuggestedChips = new List<string> { "Sign In" }
            };
        }

        // 1. Get filtered tools for this role
        var allowedTools = _toolRegistry.GetToolsForRole(role).ToList();

        // 2. Route via LLM or Semantic Intent Matcher
        var decision = await _llmService.RouteAndSelectToolAsync(userPrincipal, rawMessage, allowedTools);

        // 3. If a tool was selected, execute it with security checks
        if (!string.IsNullOrWhiteSpace(decision.SelectedToolName))
        {
            var tool = allowedTools.FirstOrDefault(t => string.Equals(t.Name, decision.SelectedToolName, StringComparison.OrdinalIgnoreCase));
            if (tool == null)
            {
                return new ChatMessageResponse
                {
                    Reply = $"Security Policy Violation: You do not have permission to execute tool `{decision.SelectedToolName}` with your role (**{role}**).",
                    Role = role,
                    SuggestedChips = chips
                };
            }

            try
            {
                var toolResult = await tool.Handler(userPrincipal, decision.Arguments, _serviceProvider);

                // Audit Log recording tool call
                try
                {
                    _context.AuditLogs.Add(new AuditLog
                    {
                        InstituteId = instituteId,
                        UserId = userId,
                        UserEmail = email,
                        Action = $"Chatbot.ToolCall:{tool.Name}",
                        Details = $"Invoked tool '{tool.Name}' via natural language prompt: \"{rawMessage}\"",
                        IpAddress = ipAddress,
                        CreatedAt = DateTime.UtcNow
                    });
                    await _context.SaveChangesAsync();
                }
                catch (Exception ex)
                {
                    _logger.LogWarning(ex, "Failed to write audit log for tool call {ToolName}", tool.Name);
                }

                return new ChatMessageResponse
                {
                    Reply = toolResult.ResultText,
                    Role = role,
                    Proposal = toolResult.Proposal,
                    SuggestedChips = chips
                };
            }
            catch (Exception ex)
            {
                _logger.LogError(ex, "Error executing tool {ToolName}", tool.Name);
                return new ChatMessageResponse
                {
                    Reply = $"An error occurred while executing tool `{tool.Name}`. Please try again.",
                    Role = role,
                    SuggestedChips = chips
                };
            }
        }

        // 4. Return direct text decision
        return new ChatMessageResponse
        {
            Reply = decision.DirectReply ?? "I couldn't process your request. Please ask a question related to your role or select one of the suggested shortcuts below.",
            Role = role,
            SuggestedChips = chips
        };
    }

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

            case "RequestPeriodSwap":
            {
                if (role != Roles.Staff)
                {
                    return new ConfirmActionResponse { Success = false, Message = "Only teaching staff can submit period swap requests." };
                }

                using var doc = JsonDocument.Parse(request.PayloadJson);
                var root = doc.RootElement;
                int timetableEntryId = root.GetProperty("timetableEntryId").GetInt32();
                int requesterStaffId = root.GetProperty("requesterStaffId").GetInt32();
                int targetStaffId = root.GetProperty("targetStaffId").GetInt32();
                var swapDate = DateOnly.Parse(root.GetProperty("swapDate").GetString()!);
                string reason = root.GetProperty("reason").GetString() ?? "Schedule adjustment";

                var targetStaff = await _context.StaffMembers.FirstOrDefaultAsync(s => s.Id == targetStaffId);
                int targetInstId = instituteId ?? (targetStaff?.InstituteId ?? 1);

                var swapRequest = new PeriodSwapRequest
                {
                    InstituteId = targetInstId,
                    TimetableEntryId = timetableEntryId,
                    RequesterStaffId = requesterStaffId,
                    TargetStaffId = targetStaffId,
                    SwapDate = swapDate,
                    Reason = reason,
                    Status = SwapStatus.Pending,
                    CreatedAt = DateTime.UtcNow
                };

                _context.PeriodSwapRequests.Add(swapRequest);
                await _context.SaveChangesAsync();

                _context.AuditLogs.Add(new AuditLog
                {
                    InstituteId = targetInstId,
                    UserId = userId,
                    UserEmail = email,
                    Action = "Chatbot.RequestPeriodSwap",
                    Details = $"Requested period swap with faculty ID {targetStaffId} for date {swapDate:yyyy-MM-dd} via AI Assistant.",
                    IpAddress = ipAddress,
                    CreatedAt = DateTime.UtcNow
                });
                await _context.SaveChangesAsync();

                return new ConfirmActionResponse
                {
                    Success = true,
                    Message = $"Period swap request for {swapDate:yyyy-MM-dd} was sent to {targetStaff?.FullName ?? "your colleague"}!",
                    ResultData = new { swapRequest.Id, swapRequest.Status }
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
