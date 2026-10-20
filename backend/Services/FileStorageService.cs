namespace StudentAttendance.Api.Services;

public interface IFileStorageService
{
    Task<string> SaveStaffPhotoAsync(int instituteId, IFormFile file);
    (Stream Stream, string ContentType)? GetStaffPhoto(int instituteId, string fileName);
    void DeleteStaffPhoto(int instituteId, string? fileName);
}

public class FileStorageService : IFileStorageService
{
    private readonly string _baseStoragePath;
    private readonly string[] _allowedExtensions = { ".jpg", ".jpeg", ".png", ".webp" };
    private const long MaxFileSize = 2 * 1024 * 1024; // 2MB

    public FileStorageService(IWebHostEnvironment environment)
    {
        _baseStoragePath = Path.Combine(environment.ContentRootPath, "App_Data", "Storage");
    }

    public async Task<string> SaveStaffPhotoAsync(int instituteId, IFormFile file)
    {
        if (file == null || file.Length == 0)
        {
            throw new InvalidOperationException("No file was uploaded.");
        }

        if (file.Length > MaxFileSize)
        {
            throw new InvalidOperationException("File size exceeds maximum limit of 2MB.");
        }

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (!_allowedExtensions.Contains(ext))
        {
            throw new InvalidOperationException("Invalid file type. Only JPG, PNG, and WebP images are permitted.");
        }

        var instituteStaffDir = Path.Combine(_baseStoragePath, "Institutes", instituteId.ToString(), "Staff");
        Directory.CreateDirectory(instituteStaffDir);

        var uniqueFileName = $"{Guid.NewGuid():N}{ext}";
        var filePath = Path.Combine(instituteStaffDir, uniqueFileName);

        using (var stream = new FileStream(filePath, FileMode.Create))
        {
            await file.CopyToAsync(stream);
        }

        return uniqueFileName;
    }

    public (Stream Stream, string ContentType)? GetStaffPhoto(int instituteId, string fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName)) return null;

        var cleanFileName = Path.GetFileName(fileName);
        var filePath = Path.Combine(_baseStoragePath, "Institutes", instituteId.ToString(), "Staff", cleanFileName);

        if (!File.Exists(filePath))
        {
            return null;
        }

        var ext = Path.GetExtension(cleanFileName).ToLowerInvariant();
        var contentType = ext switch
        {
            ".jpg" or ".jpeg" => "image/jpeg",
            ".png" => "image/png",
            ".webp" => "image/webp",
            _ => "application/octet-stream"
        };

        var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.Read);
        return (stream, contentType);
    }

    public void DeleteStaffPhoto(int instituteId, string? fileName)
    {
        if (string.IsNullOrWhiteSpace(fileName)) return;
        var cleanFileName = Path.GetFileName(fileName);
        var filePath = Path.Combine(_baseStoragePath, "Institutes", instituteId.ToString(), "Staff", cleanFileName);
        if (File.Exists(filePath))
        {
            try { File.Delete(filePath); } catch { }
        }
    }
}
