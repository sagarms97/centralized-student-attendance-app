namespace StudentAttendance.Api.DTOs;

public class ChatMessageRequest
{
    public string Message { get; set; } = string.Empty;
}

public class ChatbotActionProposal
{
    public string ActionId { get; set; } = Guid.NewGuid().ToString("N");
    public string ActionType { get; set; } = string.Empty; // e.g. "CreateSubject", "SubmitLeave", "ToggleInstituteStatus"
    public string Title { get; set; } = string.Empty;
    public string Summary { get; set; } = string.Empty;
    public Dictionary<string, string> Parameters { get; set; } = new();
    public string PayloadJson { get; set; } = string.Empty;
    public DateTime ExpiresAt { get; set; } = DateTime.UtcNow.AddMinutes(10);
}

public class ChatMessageResponse
{
    public string Reply { get; set; } = string.Empty;
    public string Role { get; set; } = string.Empty;
    public ChatbotActionProposal? Proposal { get; set; }
    public List<string> SuggestedChips { get; set; } = new();
    public object? ActionData { get; set; }
}

public class ConfirmActionRequest
{
    public string ActionId { get; set; } = string.Empty;
    public string ActionType { get; set; } = string.Empty;
    public string PayloadJson { get; set; } = string.Empty;
}

public class ConfirmActionResponse
{
    public bool Success { get; set; }
    public string Message { get; set; } = string.Empty;
    public object? ResultData { get; set; }
}

public class TranscribeResponse
{
    public bool Success { get; set; }
    public string Transcript { get; set; } = string.Empty;
    public string Language { get; set; } = "en-IN";
    public string? Error { get; set; }
}
