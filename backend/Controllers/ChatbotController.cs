using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using StudentAttendance.Api.DTOs;
using StudentAttendance.Api.Services;

namespace StudentAttendance.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class ChatbotController : ControllerBase
{
    private readonly IChatbotService _chatbotService;

    public ChatbotController(IChatbotService chatbotService)
    {
        _chatbotService = chatbotService;
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
}
