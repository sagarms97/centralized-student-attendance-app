using System.Security.Claims;
using System.Text;
using System.Text.Json;
using System.Text.RegularExpressions;

namespace StudentAttendance.Api.Services.Chatbot;

public class LlmDecision
{
    public string? SelectedToolName { get; set; }
    public JsonElement Arguments { get; set; }
    public string? DirectReply { get; set; }
}

public interface ILlmService
{
    Task<LlmDecision> RouteAndSelectToolAsync(ClaimsPrincipal user, string userMessage, IEnumerable<ChatTool> availableTools);
}

public class LlmService : ILlmService
{
    private readonly IConfiguration _configuration;
    private readonly IHttpClientFactory _httpClientFactory;
    private readonly ILogger<LlmService> _logger;

    public LlmService(IConfiguration configuration, IHttpClientFactory httpClientFactory, ILogger<LlmService> logger)
    {
        _configuration = configuration;
        _httpClientFactory = httpClientFactory;
        _logger = logger;
    }

    public async Task<LlmDecision> RouteAndSelectToolAsync(ClaimsPrincipal user, string userMessage, IEnumerable<ChatTool> availableTools)
    {
        var apiKey = _configuration["AiChatbot:ApiKey"] ?? string.Empty;
        var model = _configuration["AiChatbot:Model"] ?? "gemini-1.5-flash";

        // If an API key is configured, attempt LLM Function Calling via Gemini REST API
        if (!string.IsNullOrWhiteSpace(apiKey) && !apiKey.StartsWith("YOUR_", StringComparison.OrdinalIgnoreCase))
        {
            try
            {
                var llmResult = await CallGeminiFunctionCallingAsync(apiKey, model, user, userMessage, availableTools);
                if (llmResult != null) return llmResult;
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Gemini LLM call failed. Falling back to built-in semantic tool dispatcher.");
            }
        }

        // Deterministic Built-In Semantic Tool Matcher Fallback
        return ExecuteBuiltInSemanticMatcher(user, userMessage, availableTools);
    }

    private async Task<LlmDecision?> CallGeminiFunctionCallingAsync(
        string apiKey,
        string model,
        ClaimsPrincipal user,
        string userMessage,
        IEnumerable<ChatTool> availableTools)
    {
        var client = _httpClientFactory.CreateClient("GeminiLlm");
        var url = $"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={apiKey}";

        var role = user.FindFirstValue(ClaimTypes.Role) ?? "User";

        var functionDeclarations = availableTools.Select(t => new
        {
            name = t.Name,
            description = t.Description,
            parameters = t.ParametersSchema
        }).ToList();

        var systemPrompt = $"You are EduAttend AI Assistant for an educational institute management system.\n" +
                           $"The user is authenticated with Role: '{role}'.\n" +
                           $"RULES:\n" +
                           $"1. Strictly pick a function from the provided tools when the user's question relates to institute operations, attendance, timetable, or actions.\n" +
                           $"2. Never hallucinate or invent attendance numbers, dates, or student stats. Data must come exclusively from tool execution.\n" +
                           $"3. If no tool fits or the user asks for unauthorized capabilities, respond politely explaining what tools are available for their role '{role}'.";

        var payload = new
        {
            systemInstruction = new
            {
                parts = new[] { new { text = systemPrompt } }
            },
            contents = new[]
            {
                new
                {
                    role = "user",
                    parts = new[] { new { text = userMessage } }
                }
            },
            tools = new[]
            {
                new { functionDeclarations }
            },
            generationConfig = new
            {
                temperature = 0.1
            }
        };

        var jsonContent = new StringContent(JsonSerializer.Serialize(payload), Encoding.UTF8, "application/json");
        var response = await client.PostAsync(url, jsonContent);

        if (!response.IsSuccessStatusCode)
        {
            _logger.LogWarning("Gemini API returned status code {StatusCode}", response.StatusCode);
            return null;
        }

        var resJson = await response.Content.ReadAsStringAsync();
        using var doc = JsonDocument.Parse(resJson);
        var root = doc.RootElement;

        if (root.TryGetProperty("candidates", out var candidates) && candidates.GetArrayLength() > 0)
        {
            var firstCandidate = candidates[0];
            if (firstCandidate.TryGetProperty("content", out var content) &&
                content.TryGetProperty("parts", out var parts) && parts.GetArrayLength() > 0)
            {
                foreach (var part in parts.EnumerateArray())
                {
                    if (part.TryGetProperty("functionCall", out var functionCall))
                    {
                        var fnName = functionCall.GetProperty("name").GetString();
                        var args = functionCall.GetProperty("args");
                        return new LlmDecision
                        {
                            SelectedToolName = fnName,
                            Arguments = args.Clone()
                        };
                    }

                    if (part.TryGetProperty("text", out var textProp))
                    {
                        return new LlmDecision
                        {
                            DirectReply = textProp.GetString()
                        };
                    }
                }
            }
        }

        return null;
    }

    private LlmDecision ExecuteBuiltInSemanticMatcher(
        ClaimsPrincipal user,
        string userMessage,
        IEnumerable<ChatTool> availableTools)
    {
        var msg = userMessage.Trim().ToLowerInvariant();
        var toolList = availableTools.ToList();
        var role = user.FindFirstValue(ClaimTypes.Role) ?? "User";

        JsonElement emptyArgs;
        using (var d = JsonDocument.Parse("{}")) { emptyArgs = d.RootElement.Clone(); }

        #region SuperAdmin Tools Semantic Routing
        // Helper to extract institute code or name
        string ExtractCodeOrName(string input)
        {
            var codeMatch = Regex.Match(input, @"\b([A-Za-z]{2,10}-[0-9]{3,4})\b");
            if (codeMatch.Success) return codeMatch.Groups[1].Value;

            var match = Regex.Match(input, @"(?:for\s+college|for\s+institute|in\s+college|in\s+institute|for|in|about|college|institute)\s+([A-Za-z0-9\-_]+)", RegexOptions.IgnoreCase);
            if (match.Success && !string.Equals(match.Groups[1].Value, "college", StringComparison.OrdinalIgnoreCase) && !string.Equals(match.Groups[1].Value, "institute", StringComparison.OrdinalIgnoreCase))
            {
                return match.Groups[1].Value.Trim();
            }
            return "MIT-001";
        }

        // 1. History of student attendance
        if (toolList.Any(t => t.Name == "get_student_attendance_history") &&
            (msg.Contains("attendance history") || msg.Contains("student attendance") || msg.Contains("sessions for student")))
        {
            var match = Regex.Match(userMessage, @"(?:for\s+student|for|student)\s+([A-Za-z0-9\-\s]+)", RegexOptions.IgnoreCase);
            string term = match.Success && !string.Equals(match.Groups[1].Value.Trim(), "student", StringComparison.OrdinalIgnoreCase) ? match.Groups[1].Value.Trim() : "Sagar";
            var jsonArgs = JsonSerializer.Serialize(new { studentIdentifier = term });
            using var d = JsonDocument.Parse(jsonArgs);
            return new LlmDecision { SelectedToolName = "get_student_attendance_history", Arguments = d.RootElement.Clone() };
        }

        // 2. Institute Staff list
        if (toolList.Any(t => t.Name == "get_institute_staff_list") &&
            (msg.Contains("staff in") || msg.Contains("staff for") || msg.Contains("teachers in") || msg.Contains("faculty in")))
        {
            string codeOrName = ExtractCodeOrName(userMessage);
            var jsonArgs = JsonSerializer.Serialize(new { codeOrName });
            using var d = JsonDocument.Parse(jsonArgs);
            return new LlmDecision { SelectedToolName = "get_institute_staff_list", Arguments = d.RootElement.Clone() };
        }

        // 3. Institute Student list
        if (toolList.Any(t => t.Name == "get_institute_student_list") &&
            (msg.Contains("students in") || msg.Contains("students for") || msg.Contains("student roster for") || msg.Contains("roster in")))
        {
            string codeOrName = ExtractCodeOrName(userMessage);
            var jsonArgs = JsonSerializer.Serialize(new { codeOrName });
            using var d = JsonDocument.Parse(jsonArgs);
            return new LlmDecision { SelectedToolName = "get_institute_student_list", Arguments = d.RootElement.Clone() };
        }

        // 4. Institute Subjects list
        if (toolList.Any(t => t.Name == "get_institute_subjects") &&
            (msg.Contains("subjects in") || msg.Contains("subjects for") || msg.Contains("courses in")))
        {
            string codeOrName = ExtractCodeOrName(userMessage);
            var jsonArgs = JsonSerializer.Serialize(new { codeOrName });
            using var d = JsonDocument.Parse(jsonArgs);
            return new LlmDecision { SelectedToolName = "get_institute_subjects", Arguments = d.RootElement.Clone() };
        }

        // 5. Institute Timetable summary
        if (toolList.Any(t => t.Name == "get_institute_timetable_summary") &&
            (msg.Contains("timetable summary") || msg.Contains("schedule summary for") || msg.Contains("teaching slots in")))
        {
            string codeOrName = ExtractCodeOrName(userMessage);
            var jsonArgs = JsonSerializer.Serialize(new { codeOrName });
            using var d = JsonDocument.Parse(jsonArgs);
            return new LlmDecision { SelectedToolName = "get_institute_timetable_summary", Arguments = d.RootElement.Clone() };
        }

        // 6. Institute Detail drill-down
        if (toolList.Any(t => t.Name == "get_institute_detail") &&
            (msg.Contains("detail for") || msg.Contains("drill down") || msg.Contains("college info") || msg.Contains("institute info") || msg.Contains("show college")))
        {
            string codeOrName = ExtractCodeOrName(userMessage);
            var jsonArgs = JsonSerializer.Serialize(new { codeOrName });
            using var d = JsonDocument.Parse(jsonArgs);
            return new LlmDecision { SelectedToolName = "get_institute_detail", Arguments = d.RootElement.Clone() };
        }

        // 7. Platform Overview
        if (toolList.Any(t => t.Name == "get_platform_overview") &&
            (msg.Contains("overview") || msg.Contains("platform") || msg.Contains("stats") || msg.Contains("how many institute") || msg.Contains("total college")))
        {
            return new LlmDecision { SelectedToolName = "get_platform_overview", Arguments = emptyArgs };
        }

        // 8. Audit Logs
        if (toolList.Any(t => t.Name == "get_recent_audit_logs") &&
            (msg.Contains("audit") || msg.Contains("log") || msg.Contains("security") || msg.Contains("trail") || msg.Contains("history")))
        {
            return new LlmDecision { SelectedToolName = "get_recent_audit_logs", Arguments = emptyArgs };
        }

        // 9. List Colleges
        if (toolList.Any(t => t.Name == "list_institutes") &&
            (msg.Contains("list") || msg.Contains("colleges") || msg.Contains("institutes") || msg.Contains("directory")))
        {
            return new LlmDecision { SelectedToolName = "list_institutes", Arguments = emptyArgs };
        }

        // 10. Toggle status
        if (toolList.Any(t => t.Name == "toggle_institute_status") &&
            (msg.Contains("disable") || msg.Contains("deactivate") || msg.Contains("enable") || msg.Contains("activate")))
        {
            bool activate = msg.Contains("enable") || msg.Contains("activate");
            var match = Regex.Match(userMessage, @"(?:institute|college|code)\s+([A-Za-z0-9\-_]+)", RegexOptions.IgnoreCase);
            string codeOrName = match.Success ? match.Groups[1].Value : "MIT-001";

            var jsonArgs = JsonSerializer.Serialize(new { codeOrName, activate });
            using var d = JsonDocument.Parse(jsonArgs);
            return new LlmDecision { SelectedToolName = "toggle_institute_status", Arguments = d.RootElement.Clone() };
        }
        #endregion

        #region InstituteAdmin Tools Semantic Routing
        // 1. Pending Approvals
        if (toolList.Any(t => t.Name == "get_pending_approvals") &&
            (msg.Contains("pending approval") || msg.Contains("approvals") || msg.Contains("account approval") || msg.Contains("registration request")))
        {
            return new LlmDecision { SelectedToolName = "get_pending_approvals", Arguments = emptyArgs };
        }

        // 2. Class Strength
        if (toolList.Any(t => t.Name == "list_classes_and_strength") &&
            (msg.Contains("class strength") || msg.Contains("classes and section") || msg.Contains("class list") || msg.Contains("how many classes")))
        {
            return new LlmDecision { SelectedToolName = "list_classes_and_strength", Arguments = emptyArgs };
        }

        // 3. Staff Directory
        if (toolList.Any(t => t.Name == "list_staff_directory") &&
            (msg.Contains("staff directory") || msg.Contains("list staff") || msg.Contains("teachers list") || msg.Contains("our teachers") || msg.Contains("faculty members")))
        {
            return new LlmDecision { SelectedToolName = "list_staff_directory", Arguments = emptyArgs };
        }

        // 4. Students Directory
        if (toolList.Any(t => t.Name == "list_institute_students") &&
            (msg.Contains("list student") || msg.Contains("student roster") || msg.Contains("all student") || msg.Contains("search student")))
        {
            return new LlmDecision { SelectedToolName = "list_institute_students", Arguments = emptyArgs };
        }

        // 5. Subjects List
        if (toolList.Any(t => t.Name == "list_institute_subjects") &&
            (msg.Contains("list subject") || msg.Contains("subjects configured") || msg.Contains("all subject") || msg.Contains("course catalog")))
        {
            return new LlmDecision { SelectedToolName = "list_institute_subjects", Arguments = emptyArgs };
        }

        // 6. Today's Attendance
        if (toolList.Any(t => t.Name == "get_today_attendance_summary") &&
            (msg.Contains("attendance") || msg.Contains("today") || msg.Contains("snapshot") || msg.Contains("present") || msg.Contains("absent")))
        {
            return new LlmDecision { SelectedToolName = "get_today_attendance_summary", Arguments = emptyArgs };
        }

        // 7. Defaulters
        if (toolList.Any(t => t.Name == "get_low_attendance_defaulters") &&
            (msg.Contains("low") || msg.Contains("defaulter") || msg.Contains("shortage") || msg.Contains("75")))
        {
            return new LlmDecision { SelectedToolName = "get_low_attendance_defaulters", Arguments = emptyArgs };
        }

        // 8. Institute Metrics
        if (toolList.Any(t => t.Name == "get_institute_metrics") &&
            (msg.Contains("staff") || msg.Contains("teacher") || msg.Contains("subject") || msg.Contains("classes") || msg.Contains("strength") || msg.Contains("count")))
        {
            if (!msg.Contains("create") && !msg.Contains("add"))
            {
                return new LlmDecision { SelectedToolName = "get_institute_metrics", Arguments = emptyArgs };
            }
        }

        // 9. Create Subject
        if (toolList.Any(t => t.Name == "create_subject") &&
            (msg.Contains("create") || msg.Contains("add subject") || msg.Contains("new subject")))
        {
            string name = "New Subject";
            string code = "SUB-" + new Random().Next(100, 999);

            var codeMatch = Regex.Match(userMessage, @"(?:code|code:|\()\s*([A-Za-z0-9\-]+)\)?", RegexOptions.IgnoreCase);
            if (codeMatch.Success) code = codeMatch.Groups[1].Value.ToUpperInvariant();

            var nameMatch = Regex.Match(userMessage, @"(?:subject|create|add)\s*:?\s*([A-Za-z\s]+?)(?:\s+with\s+code|\s*\(|\s+code:|$)", RegexOptions.IgnoreCase);
            if (nameMatch.Success && !string.IsNullOrWhiteSpace(nameMatch.Groups[1].Value))
            {
                name = nameMatch.Groups[1].Value.Trim();
            }

            var jsonArgs = JsonSerializer.Serialize(new { name, code });
            using var d = JsonDocument.Parse(jsonArgs);
            return new LlmDecision { SelectedToolName = "create_subject", Arguments = d.RootElement.Clone() };
        }
        #endregion

        #region Staff Tools Semantic Routing
        // 1. Class attendance status
        if (toolList.Any(t => t.Name == "get_class_attendance_status") &&
            (msg.Contains("attendance status for my class") || msg.Contains("is attendance marked") || msg.Contains("classes marked today") || msg.Contains("pending attendance")))
        {
            return new LlmDecision { SelectedToolName = "get_class_attendance_status", Arguments = emptyArgs };
        }

        // 2. Pending swaps
        if (toolList.Any(t => t.Name == "get_my_pending_swaps") &&
            (msg.Contains("swap") || msg.Contains("pending swap") || msg.Contains("period swap")))
        {
            return new LlmDecision { SelectedToolName = "get_my_pending_swaps", Arguments = emptyArgs };
        }

        // 3. Timetable today
        if (toolList.Any(t => t.Name == "get_my_timetable_today") &&
            (msg.Contains("class") || msg.Contains("schedule") || msg.Contains("timetable") || msg.Contains("today") || msg.Contains("period")))
        {
            return new LlmDecision { SelectedToolName = "get_my_timetable_today", Arguments = emptyArgs };
        }

        // 4. Institute Attendance today
        if (toolList.Any(t => t.Name == "get_institute_attendance_today") &&
            (msg.Contains("attendance") || msg.Contains("present") || msg.Contains("absent")))
        {
            return new LlmDecision { SelectedToolName = "get_institute_attendance_today", Arguments = emptyArgs };
        }
        #endregion

        #region Parent Tools Semantic Routing
        // 1. Leave history
        if (toolList.Any(t => t.Name == "get_leave_history") &&
            (msg.Contains("leave history") || msg.Contains("my leave") || msg.Contains("past leave") || msg.Contains("leave status")))
        {
            return new LlmDecision { SelectedToolName = "get_leave_history", Arguments = emptyArgs };
        }

        // 2. Parent profile
        if (toolList.Any(t => t.Name == "get_parent_profile") &&
            (msg.Contains("my profile") || msg.Contains("parent detail") || msg.Contains("my detail") || msg.Contains("linked children")))
        {
            return new LlmDecision { SelectedToolName = "get_parent_profile", Arguments = emptyArgs };
        }

        // 3. Children attendance
        if (toolList.Any(t => t.Name == "get_my_children_attendance") &&
            (msg.Contains("attendance") || msg.Contains("present") || msg.Contains("absent") || msg.Contains("child") || msg.Contains("how is") || msg.Contains("status")))
        {
            return new LlmDecision { SelectedToolName = "get_my_children_attendance", Arguments = emptyArgs };
        }

        // 4. Submit leave
        if (toolList.Any(t => t.Name == "submit_leave_request") &&
            (msg.Contains("leave") || msg.Contains("sick") || msg.Contains("fever") || msg.Contains("apply leave")))
        {
            int days = 1;
            if (msg.Contains("2 day") || msg.Contains("two day")) days = 2;
            else if (msg.Contains("3 day") || msg.Contains("three day")) days = 3;

            string reason = "Medical reasons";
            if (msg.Contains("fever")) reason = "Fever and unwell";
            else if (msg.Contains("family") || msg.Contains("function")) reason = "Family function";

            var jsonArgs = JsonSerializer.Serialize(new { days, reason });
            using var d = JsonDocument.Parse(jsonArgs);
            return new LlmDecision { SelectedToolName = "submit_leave_request", Arguments = d.RootElement.Clone() };
        }
        #endregion

        // Polite, unsupported / out-of-role response detailing permitted capabilities
        var availableToolsDescription = string.Join("\n", toolList.Select(t => $"• `{t.Name}`: {t.Description}"));
        var reply = $"I couldn't match your request to an authorized tool for your role (**{role}**).\n\n" +
                    $"Here are the tools you have permission to use:\n\n{availableToolsDescription}\n\n" +
                    $"You can ask natural questions corresponding to any of these tools!";

        return new LlmDecision
        {
            DirectReply = reply
        };
    }
}
