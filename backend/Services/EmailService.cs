using System.Net;
using System.Net.Mail;

namespace StudentAttendance.Api.Services;

public interface IEmailService
{
    Task SendEmailAsync(string toEmail, string subject, string htmlBody, string recipientName = "");
    Task SendPasswordResetEmailAsync(string toEmail, string resetLink, string recipientName);
}

public class SmtpEmailService : IEmailService
{
    private readonly IConfiguration _configuration;
    private readonly ILogger<SmtpEmailService> _logger;

    public SmtpEmailService(IConfiguration configuration, ILogger<SmtpEmailService> logger)
    {
        _configuration = configuration;
        _logger = logger;
    }

    public async Task SendEmailAsync(string toEmail, string subject, string htmlBody, string recipientName = "")
    {
        var host = _configuration["Smtp:Host"];
        var port = int.TryParse(_configuration["Smtp:Port"], out var p) ? p : 587;
        var enableSsl = bool.TryParse(_configuration["Smtp:EnableSsl"], out var ssl) && ssl;
        var senderEmail = _configuration["Smtp:SenderEmail"] ?? "no-reply@eduattend.com";
        var senderName = _configuration["Smtp:SenderName"] ?? "EduAttend Portal";
        var username = _configuration["Smtp:Username"];
        var password = _configuration["Smtp:Password"];

        // In development / test when SMTP username is empty, log email contents directly
        if (string.IsNullOrWhiteSpace(username) || string.IsNullOrWhiteSpace(password))
        {
            _logger.LogInformation("================ EMAIL DISPATCH (DEV MODE) ================\nTO: {ToEmail} ({RecipientName})\nSUBJECT: {Subject}\nBODY:\n{Body}\n===========================================================",
                toEmail, recipientName, subject, htmlBody);
            return;
        }

        try
        {
            using var client = new SmtpClient(host, port)
            {
                EnableSsl = enableSsl,
                Credentials = new NetworkCredential(username, password)
            };

            var mail = new MailMessage
            {
                From = new MailAddress(senderEmail, senderName),
                Subject = subject,
                Body = htmlBody,
                IsBodyHtml = true
            };
            mail.To.Add(new MailAddress(toEmail, recipientName));

            await client.SendMailAsync(mail);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Failed to send email to {ToEmail} via SMTP.", toEmail);
        }
    }

    public Task SendPasswordResetEmailAsync(string toEmail, string resetLink, string recipientName)
    {
        var subject = "EduAttend - Password Reset Request";
        var html = $@"
<div style=""font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 8px;"">
    <h2 style=""color: #1a237e;"">Password Reset Request</h2>
    <p>Hello <strong>{WebUtility.HtmlEncode(recipientName)}</strong>,</p>
    <p>We received a request to reset your password for your EduAttend account. Click the button below to set a new password:</p>
    <p style=""text-align: center; margin: 30px 0;"">
        <a href=""{resetLink}"" style=""background-color: #1a237e; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;"">Reset My Password</a>
    </p>
    <p style=""font-size: 0.9em; color: #64748b;"">This link is valid for <strong>30 minutes</strong> and can only be used once.</p>
    <p style=""font-size: 0.85em; color: #94a3b8;"">If you did not request a password reset, you can safely ignore this email.</p>
    <hr style=""border: none; border-top: 1px solid #e2e8f0; margin: 20px 0;"" />
    <p style=""font-size: 0.75em; color: #94a3b8; text-align: center;"">EduAttend • Centralized Student Attendance System</p>
</div>";

        return SendEmailAsync(toEmail, subject, html, recipientName);
    }
}
