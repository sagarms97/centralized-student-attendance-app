using System.IdentityModel.Tokens.Jwt;
using System.Security.Claims;
using System.Security.Cryptography;
using System.Text;
using Microsoft.IdentityModel.Tokens;
using StudentAttendance.Api.Models;

namespace StudentAttendance.Api.Services;

public interface ITokenService
{
    (string Token, DateTime ExpiresAt) GenerateAccessToken(User user, string? instituteCode = null);
    RefreshToken GenerateRefreshToken(int userId);
}

public class TokenService : ITokenService
{
    private readonly IConfiguration _configuration;

    public TokenService(IConfiguration configuration)
    {
        _configuration = configuration;
    }

    public (string Token, DateTime ExpiresAt) GenerateAccessToken(User user, string? instituteCode = null)
    {
        var secret = _configuration["Jwt:Secret"] ?? "SuperSecretKeyForStudentAttendanceManagementApp2026!#$";
        var issuer = _configuration["Jwt:Issuer"] ?? "StudentAttendanceApi";
        var audience = _configuration["Jwt:Audience"] ?? "StudentAttendanceClient";
        var key = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(secret));
        var creds = new SigningCredentials(key, SecurityAlgorithms.HmacSha256);

        var claims = new List<Claim>
        {
            new(ClaimTypes.NameIdentifier, user.Id.ToString()),
            new(ClaimTypes.Email, user.Email),
            new(ClaimTypes.Name, user.FullName),
            new(ClaimTypes.Role, user.Role),
        };

        if (user.InstituteId.HasValue)
        {
            claims.Add(new Claim("institute_id", user.InstituteId.Value.ToString()));
            claims.Add(new Claim(ClaimTypes.GroupSid, user.InstituteId.Value.ToString()));
        }

        if (!string.IsNullOrEmpty(instituteCode))
        {
            claims.Add(new Claim("institute_code", instituteCode));
        }

        var expires = DateTime.UtcNow.AddHours(4); // 4 hours access token
        var token = new JwtSecurityToken(
            issuer: issuer,
            audience: audience,
            claims: claims,
            expires: expires,
            signingCredentials: creds
        );

        return (new JwtSecurityTokenHandler().WriteToken(token), expires);
    }

    public RefreshToken GenerateRefreshToken(int userId)
    {
        var randomBytes = new byte[64];
        using var rng = RandomNumberGenerator.Create();
        rng.GetBytes(randomBytes);

        return new RefreshToken
        {
            UserId = userId,
            Token = Convert.ToBase64String(randomBytes),
            ExpiresAt = DateTime.UtcNow.AddDays(7),
            CreatedAt = DateTime.UtcNow,
            IsRevoked = false
        };
    }
}
