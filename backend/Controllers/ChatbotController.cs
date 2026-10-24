using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudentAttendance.Api.DTOs;
using StudentAttendance.Api.Services;
using StudentAttendance.Api.Services.Chatbot;

namespace StudentAttendance.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ChatbotController : ControllerBase
{
    private readonly IChatbotService _chatbotService;
    private readonly ISpeechToTextService _speechToTextService;

    public ChatbotController(IChatbotService chatbotService, ISpeechToTextService speechToTextService)
    {
        _chatbotService = chatbotService;
        _speechToTextService = speechToTextService;
    }

    [HttpPost("message")]
    public async Task<ActionResult<ChatMessageResponse>> SendMessage([FromBody] ChatMessageRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.Message))
        {
            return BadRequest(new { message = "Message content cannot be empty." });
        }

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var response = await _chatbotService.ProcessMessageAsync(User, request.Message, ip);
        return Ok(response);
    }

    [HttpPost("confirm-action")]
    public async Task<ActionResult<ConfirmActionResponse>> ConfirmAction([FromBody] ConfirmActionRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.ActionType) || string.IsNullOrWhiteSpace(request.PayloadJson))
        {
            return BadRequest(new { message = "Invalid confirmation request parameters." });
        }

        var ip = HttpContext.Connection.RemoteIpAddress?.ToString();
        var response = await _chatbotService.ExecuteConfirmedActionAsync(User, request, ip);

        if (!response.Success)
        {
            return BadRequest(response);
        }

        return Ok(response);
    }

    [HttpGet("suggestions")]
    public ActionResult<List<string>> GetSuggestions()
    {
        var suggestions = _chatbotService.GetSuggestedChips(User);
        return Ok(suggestions);
    }

    [HttpPost("transcribe")]
    [RequestSizeLimit(5 * 1024 * 1024)] // 5MB limit
    public async Task<ActionResult<TranscribeResponse>> TranscribeAudio([FromForm] IFormFile? audio, [FromForm] string language = "en-IN")
    {
        if (audio == null || audio.Length == 0)
        {
            return BadRequest(new TranscribeResponse { Success = false, Error = "No audio file was uploaded." });
        }

        if (audio.Length > 5 * 1024 * 1024)
        {
            return BadRequest(new TranscribeResponse { Success = false, Error = "Audio file exceeds maximum allowed size of 5MB." });
        }

        var userId = User.FindFirst(ClaimTypes.NameIdentifier)?.Value ?? "anonymous";
        await using var stream = audio.OpenReadStream();
        var result = await _speechToTextService.TranscribeAudioAsync(stream, audio.FileName, audio.ContentType, language, userId);

        if (!result.Success)
        {
            return BadRequest(new TranscribeResponse { Success = false, Error = result.ErrorMessage });
        }

        return Ok(new TranscribeResponse { Success = true, Transcript = result.Transcript, Language = result.DetectedLanguage });
    }
}
