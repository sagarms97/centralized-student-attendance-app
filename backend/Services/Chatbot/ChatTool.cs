using System.Security.Claims;
using System.Text.Json;
using StudentAttendance.Api.DTOs;

namespace StudentAttendance.Api.Services.Chatbot;

public class ToolExecutionResult
{
    public bool Success { get; set; } = true;
    public string ResultText { get; set; } = string.Empty;
    public object? Data { get; set; }
    public bool IsProposal { get; set; } = false;
    public ChatbotActionProposal? Proposal { get; set; }
    public List<ChatSuggestionOption>? Suggestions { get; set; }
}

public class ChatTool
{
    public string Name { get; set; } = string.Empty;
    public string Description { get; set; } = string.Empty;
    public object ParametersSchema { get; set; } = new { type = "object", properties = new { } };
    public string[] AllowedRoles { get; set; } = Array.Empty<string>();
    public bool IsMutating { get; set; } = false;

    public Func<ClaimsPrincipal, JsonElement, IServiceProvider, Task<ToolExecutionResult>> Handler { get; set; } = null!;
}
