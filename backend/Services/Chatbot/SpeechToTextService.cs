using System.Collections.Concurrent;

namespace StudentAttendance.Api.Services.Chatbot;

public class SpeechToTextService : ISpeechToTextService
{
    private readonly IConfiguration _config;
    private readonly ILogger<SpeechToTextService> _logger;

    // Daily limit tracker per user: userId -> (Date, Count)
    private static readonly ConcurrentDictionary<string, (DateTime Date, int Count)> _userDailyCounts = new();

    public SpeechToTextService(IConfiguration config, ILogger<SpeechToTextService> logger)
    {
        _config = config;
        _logger = logger;
    }

    public async Task<TranscriptionResult> TranscribeAudioAsync(
        Stream audioStream,
        string fileName,
        string contentType,
        string language,
        string userId)
    {
        var maxSizeBytes = _config.GetValue<long>("SpeechToText:MaxFileSizeBytes", 5 * 1024 * 1024); // 5 MB
        var dailyLimit = _config.GetValue<int>("SpeechToText:DailyLimitPerUser", 50);
        var provider = _config.GetValue<string>("SpeechToText:Provider", "Stub") ?? "Stub";

        // 1. Check Daily Limit
        var today = DateTime.UtcNow.Date;
        var current = _userDailyCounts.AddOrUpdate(
            userId,
            _ => (today, 1),
            (_, existing) => existing.Date == today ? (today, existing.Count + 1) : (today, 1)
        );

        if (current.Count > dailyLimit)
        {
            _logger.LogWarning("User {UserId} exceeded daily speech-to-text limit of {Limit}.", userId, dailyLimit);
            return new TranscriptionResult
            {
                Success = false,
                ErrorMessage = $"Daily speech transcription limit ({dailyLimit} requests/day) reached. Please type your query or try again tomorrow."
            };
        }

        // 2. Check stream size
        if (audioStream.CanSeek && audioStream.Length > maxSizeBytes)
        {
            return new TranscriptionResult
            {
                Success = false,
                ErrorMessage = $"Audio file exceeds the maximum permitted size of {maxSizeBytes / (1024 * 1024)}MB."
            };
        }

        // 3. Temporary audio file handling with guaranteed deletion
        string tempFilePath = Path.Combine(Path.GetTempPath(), $"stt_{Guid.NewGuid():N}_{Path.GetFileName(fileName)}");
        try
        {
            // Write to temp file for processing if needed
            await using (var fileStream = new FileStream(tempFilePath, FileMode.Create, FileAccess.Write, FileShare.None))
            {
                await audioStream.CopyToAsync(fileStream);
            }

            var fileInfo = new FileInfo(tempFilePath);
            if (fileInfo.Length > maxSizeBytes)
            {
                return new TranscriptionResult
                {
                    Success = false,
                    ErrorMessage = $"Audio file exceeds the maximum permitted size of {maxSizeBytes / (1024 * 1024)}MB."
                };
            }

            _logger.LogInformation("Processing audio transcription for user {UserId}, size {Size} bytes, language {Lang}, provider {Provider}",
                userId, fileInfo.Length, language, provider);

            // 4. Provider Dispatch
            string transcript;
            switch (provider.ToLowerInvariant())
            {
                case "whisper":
                case "googlespeech":
                    // If external credentials or API endpoint are configured in the future:
                    transcript = await TranscribeWithExternalProviderAsync(tempFilePath, language);
                    break;
                case "stub":
                default:
                    // Server Provider Stub: Returns transcribed text appropriate to language or fallback demonstration
                    transcript = GetStubTranscription(language);
                    break;
            }

            return new TranscriptionResult
            {
                Success = true,
                Transcript = transcript,
                DetectedLanguage = language
            };
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Error processing speech-to-text audio for user {UserId}", userId);
            return new TranscriptionResult
            {
                Success = false,
                ErrorMessage = "An error occurred while transcribing your speech. Please try again."
            };
        }
        finally
        {
            // Mandatory Security & Privacy rule: Delete audio immediately after transcription
            try
            {
                if (File.Exists(tempFilePath))
                {
                    File.Delete(tempFilePath);
                    _logger.LogDebug("Temporary audio file {Path} successfully deleted.", tempFilePath);
                }
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to delete temporary audio file {Path}.", tempFilePath);
            }
        }
    }

    private Task<string> TranscribeWithExternalProviderAsync(string filePath, string language)
    {
        // Future external STT integration hook (Whisper API / Google Cloud Speech)
        return Task.FromResult(GetStubTranscription(language));
    }

    private static string GetStubTranscription(string language)
    {
        return language switch
        {
            "hi-IN" => "आज की उपस्थिति रिपोर्ट दिखाएं",
            "kn-IN" => "ಇಂದಿನ ಹಾಜರಾತಿ ವಿವರಗಳನ್ನು ತೋರಿಸಿ",
            _ => "Show today attendance summary"
        };
    }
}
