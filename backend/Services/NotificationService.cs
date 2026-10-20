using System.Net;

namespace StudentAttendance.Api.Services;

public interface INotificationChannel
{
    string ChannelName { get; }
    bool IsEnabled { get; }
    Task SendInviteAsync(string recipientEmail, string recipientPhone, string recipientName, string inviteLink, string role, string instituteName);
    Task SendOtpAsync(string recipientEmail, string recipientPhone, string recipientName, string otpCode);
    Task SendApprovalStatusAsync(string recipientEmail, string recipientPhone, string recipientName, bool isApproved, string instituteName, string? rejectionReason = null);
}

public interface INotificationService
{
    Task SendInviteAsync(string recipientEmail, string recipientPhone, string recipientName, string inviteLink, string role, string instituteName);
    Task SendOtpAsync(string recipientEmail, string recipientPhone, string recipientName, string otpCode);
    Task SendApprovalStatusAsync(string recipientEmail, string recipientPhone, string recipientName, bool isApproved, string instituteName, string? rejectionReason = null);
}

public class EmailNotificationChannel : INotificationChannel
{
    private readonly IEmailService _emailService;
    private readonly IConfiguration _configuration;

    public string ChannelName => "Email";
    public bool IsEnabled => _configuration.GetValue<bool>("Notifications:Email:Enabled", true);

    public EmailNotificationChannel(IEmailService emailService, IConfiguration configuration)
    {
        _emailService = emailService;
        _configuration = configuration;
    }

    public async Task SendInviteAsync(string recipientEmail, string recipientPhone, string recipientName, string inviteLink, string role, string instituteName)
    {
        if (!IsEnabled) return;

        var subject = $"Invitation to join {instituteName} as {role}";
        var html = $@"
<div style=""font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;"">
    <h2 style=""color: #1a237e;"">Welcome to {WebUtility.HtmlEncode(instituteName)}</h2>
    <p>Hello <strong>{WebUtility.HtmlEncode(recipientName)}</strong>,</p>
    <p>You have been invited to join the <strong>{WebUtility.HtmlEncode(instituteName)}</strong> student attendance portal as a <strong>{WebUtility.HtmlEncode(role)}</strong>.</p>
    <p>Please click the button below to complete your registration, verify your contact details with a one-time passcode, and set your password:</p>
    <p style=""text-align: center; margin: 30px 0;"">
        <a href=""{inviteLink}"" style=""background-color: #1a237e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;"">Complete Registration</a>
    </p>
    <p style=""font-size: 0.9em; color: #64748b;"">Or copy and paste this link into your browser:<br /><a href=""{inviteLink}"" style=""color: #3f51b5; word-break: break-all;"">{inviteLink}</a></p>
    <p style=""font-size: 0.85em; color: #94a3b8;"">This link is valid for 7 days and can only be used once.</p>
    <hr style=""border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;"" />
    <p style=""font-size: 0.75em; color: #94a3b8; text-align: center;"">EduAttend • Centralized Student Attendance System</p>
</div>";

        await _emailService.SendEmailAsync(recipientEmail, subject, html, recipientName);
    }

    public async Task SendOtpAsync(string recipientEmail, string recipientPhone, string recipientName, string otpCode)
    {
        if (!IsEnabled) return;

        var subject = $"Your EduAttend Registration Verification Code: {otpCode}";
        var html = $@"
<div style=""font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;"">
    <h2 style=""color: #1a237e;"">Email Verification Code</h2>
    <p>Hello <strong>{WebUtility.HtmlEncode(recipientName)}</strong>,</p>
    <p>Thank you for registering. Please enter the following 6-digit one-time passcode (OTP) on the verification screen to verify your email address:</p>
    <div style=""text-align: center; margin: 25px 0;"">
        <span style=""display: inline-block; font-size: 2rem; font-weight: bold; letter-spacing: 6px; color: #1a237e; background: #e8eaf6; padding: 12px 24px; border-radius: 8px; border: 1px dashed #3f51b5;"">
            {otpCode}
        </span>
    </div>
    <p style=""font-size: 0.9em; color: #64748b;"">This code will expire in <strong>10 minutes</strong>. For your security, do not share this code with anyone.</p>
    <hr style=""border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;"" />
    <p style=""font-size: 0.75em; color: #94a3b8; text-align: center;"">EduAttend • Centralized Student Attendance System</p>
</div>";

        await _emailService.SendEmailAsync(recipientEmail, subject, html, recipientName);
    }

    public async Task SendApprovalStatusAsync(string recipientEmail, string recipientPhone, string recipientName, bool isApproved, string instituteName, string? rejectionReason = null)
    {
        if (!IsEnabled) return;

        var subject = isApproved
            ? $"Account Approved - Welcome to {instituteName}"
            : $"Registration Update - {instituteName}";

        var statusContent = isApproved
            ? $@"
    <div style=""background: #e8f5e9; border: 1px solid #a5d6a7; padding: 16px; border-radius: 8px; color: #2e7d32;"">
        <h3 style=""margin-top: 0;"">🎉 Account Approved!</h3>
        <p>Your registration has been approved by the institute administrator. You can now log in using your email and password.</p>
    </div>"
            : $@"
    <div style=""background: #ffebee; border: 1px solid #ffcdd2; padding: 16px; border-radius: 8px; color: #c62828;"">
        <h3 style=""margin-top: 0;"">Registration Not Approved</h3>
        <p>Your registration request was not approved by the administrator.</p>
        {(string.IsNullOrWhiteSpace(rejectionReason) ? "" : $"<p><strong>Reason provided:</strong> {WebUtility.HtmlEncode(rejectionReason)}</p>")}
        <p>If you believe this is a mistake, please contact your institute administrator.</p>
    </div>";

        var html = $@"
<div style=""font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;"">
    <h2 style=""color: #1a237e;"">{WebUtility.HtmlEncode(instituteName)}</h2>
    <p>Hello <strong>{WebUtility.HtmlEncode(recipientName)}</strong>,</p>
    {statusContent}
    <hr style=""border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;"" />
    <p style=""font-size: 0.75em; color: #94a3b8; text-align: center;"">EduAttend • Centralized Student Attendance System</p>
</div>";

        await _emailService.SendEmailAsync(recipientEmail, subject, html, recipientName);
    }
}

public class WhatsAppNotificationChannel : INotificationChannel
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<WhatsAppNotificationChannel> _logger;

    public string ChannelName => "WhatsApp";
    public bool IsEnabled => _configuration.GetValue<bool>("Notifications:WhatsApp:Enabled", false);

    public WhatsAppNotificationChannel(IConfiguration configuration, ILogger<WhatsAppNotificationChannel> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public Task SendInviteAsync(string recipientEmail, string recipientPhone, string recipientName, string inviteLink, string role, string instituteName)
    {
        if (!IsEnabled)
        {
            _logger.LogDebug("WhatsApp notification channel disabled via configuration. Skipped invite to {Phone}", recipientPhone);
            return Task.CompletedTask;
        }

        // Future WhatsApp Business API template dispatch stub
        _logger.LogInformation("[WhatsApp Channel] Dispatched template 'invite_template' to {Phone} for {RecipientName}", recipientPhone, recipientName);
        return Task.CompletedTask;
    }

    public Task SendOtpAsync(string recipientEmail, string recipientPhone, string recipientName, string otpCode)
    {
        if (!IsEnabled) return Task.CompletedTask;

        _logger.LogInformation("[WhatsApp Channel] Dispatched OTP template to {Phone}", recipientPhone);
        return Task.CompletedTask;
    }

    public Task SendApprovalStatusAsync(string recipientEmail, string recipientPhone, string recipientName, bool isApproved, string instituteName, string? rejectionReason = null)
    {
        if (!IsEnabled) return Task.CompletedTask;

        _logger.LogInformation("[WhatsApp Channel] Dispatched approval status ({Status}) to {Phone}", isApproved ? "Approved" : "Rejected", recipientPhone);
        return Task.CompletedTask;
    }
}

public class NotificationService : INotificationService
{
    private readonly IEnumerable<INotificationChannel> _channels;

    public NotificationService(IEnumerable<INotificationChannel> channels)
    {
        _channels = channels;
    }

    public async Task SendInviteAsync(string recipientEmail, string recipientPhone, string recipientName, string inviteLink, string role, string instituteName)
    {
        foreach (var channel in _channels.Where(c => c.IsEnabled))
        {
            await channel.SendInviteAsync(recipientEmail, recipientPhone, recipientName, inviteLink, role, instituteName);
        }
    }

    public async Task SendOtpAsync(string recipientEmail, string recipientPhone, string recipientName, string otpCode)
    {
        foreach (var channel in _channels.Where(c => c.IsEnabled))
        {
            await channel.SendOtpAsync(recipientEmail, recipientPhone, recipientName, otpCode);
        }
    }

    public async Task SendApprovalStatusAsync(string recipientEmail, string recipientPhone, string recipientName, bool isApproved, string instituteName, string? rejectionReason = null)
    {
        foreach (var channel in _channels.Where(c => c.IsEnabled))
        {
            await channel.SendApprovalStatusAsync(recipientEmail, recipientPhone, recipientName, isApproved, instituteName, rejectionReason);
        }
    }
}
