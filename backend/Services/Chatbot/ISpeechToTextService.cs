namespace StudentAttendance.Api.Services.Chatbot;

public class TranscriptionResult
{
    public bool Success { get; set; }
    public string Transcript { get; set; } = string.Empty;
    public string? ErrorMessage { get; set; }
    public string DetectedLanguage { get; set; } = "en-IN";
}

public interface ISpeechToTextService
{
    Task<TranscriptionResult> TranscribeAudioAsync(Stream audioStream, string fileName, string contentType, string language, string userId);
}
