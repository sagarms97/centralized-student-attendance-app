using System.Security.Claims;

namespace StudentAttendance.Api.Services;

public interface ICurrentTenantService
{
    int? InstituteId { get; }
    void SetTenantId(int tenantId);
}

public class CurrentTenantService : ICurrentTenantService
{
    private readonly IHttpContextAccessor _httpContextAccessor;
    private int? _overrideTenantId;

    public CurrentTenantService(IHttpContextAccessor httpContextAccessor)
    {
        _httpContextAccessor = httpContextAccessor;
    }

    public int? InstituteId
    {
        get
        {
            if (_overrideTenantId.HasValue)
                return _overrideTenantId.Value;

            var user = _httpContextAccessor.HttpContext?.User;
            if (user == null) return null;

            var claim = user.FindFirst("institute_id")?.Value
                        ?? user.FindFirst(ClaimTypes.GroupSid)?.Value;

            if (int.TryParse(claim, out var id))
            {
                return id;
            }

            return null;
        }
    }

    public void SetTenantId(int tenantId)
    {
        _overrideTenantId = tenantId;
    }
}
