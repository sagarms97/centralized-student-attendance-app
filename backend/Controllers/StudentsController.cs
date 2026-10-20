using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using StudentAttendance.Api.Data;
using StudentAttendance.Api.DTOs;
using StudentAttendance.Api.Models;
using StudentAttendance.Api.Services;

namespace StudentAttendance.Api.Controllers;

[ApiController]
[Route("api/[controller]")]
[Authorize]
public class StudentsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;
    private readonly IExcelImportService _excelService;

    public StudentsController(
        ApplicationDbContext context,
        ICurrentTenantService tenantService,
        IExcelImportService excelService)
    {
        _context = context;
        _tenantService = tenantService;
        _excelService = excelService;
    }

    [HttpGet]
    public async Task<ActionResult<object>> GetAll(
        [FromQuery] int? classId,
        [FromQuery] string? section,
        [FromQuery] string? search,
        [FromQuery] int page = 1,
        [FromQuery] int pageSize = 50)
    {
        var query = _context.Students
            .Include(s => s.Class)
            .AsQueryable();

        if (classId.HasValue)
        {
            query = query.Where(s => s.ClassId == classId.Value);
        }

        if (!string.IsNullOrWhiteSpace(section))
        {
            var sec = section.Trim().ToUpper();
            query = query.Where(s => s.Section.ToUpper() == sec);
        }

        if (!string.IsNullOrWhiteSpace(search))
        {
            var term = search.Trim().ToLower();
            query = query.Where(s =>
                s.RollNo.ToLower().Contains(term) ||
                s.FirstName.ToLower().Contains(term) ||
                s.LastName.ToLower().Contains(term) ||
                (s.Email != null && s.Email.ToLower().Contains(term)) ||
                s.ParentPhone.Contains(term));
        }

        var totalCount = await query.CountAsync();

        var items = await query
            .OrderBy(s => s.Class.Name)
            .ThenBy(s => s.Section)
            .ThenBy(s => s.RollNo)
            .Skip((page - 1) * pageSize)
            .Take(pageSize)
            .Select(s => new StudentDto
            {
                Id = s.Id,
                RollNo = s.RollNo,
                FirstName = s.FirstName,
                LastName = s.LastName,
                FullName = s.FullName,
                ClassId = s.ClassId,
                ClassName = s.Class.Name,
                Section = s.Section,
                ParentPhone = s.ParentPhone,
                Email = s.Email,
                PhotoPath = s.PhotoPath,
                IsActive = s.IsActive,
                CreatedAt = s.CreatedAt
            })
            .ToListAsync();

        return Ok(new
        {
            TotalCount = totalCount,
            Page = page,
            PageSize = pageSize,
            TotalPages = (int)Math.Ceiling(totalCount / (double)pageSize),
            Items = items
        });
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<StudentDto>> GetById(int id)
    {
        var s = await _context.Students
            .Include(st => st.Class)
            .Where(st => st.Id == id)
            .Select(st => new StudentDto
            {
                Id = st.Id,
                RollNo = st.RollNo,
                FirstName = st.FirstName,
                LastName = st.LastName,
                FullName = st.FullName,
                ClassId = st.ClassId,
                ClassName = st.Class.Name,
                Section = st.Section,
                ParentPhone = st.ParentPhone,
                Email = st.Email,
                PhotoPath = st.PhotoPath,
                IsActive = st.IsActive,
                CreatedAt = st.CreatedAt
            })
            .FirstOrDefaultAsync();

        if (s == null) return NotFound(new { message = "Student not found." });
        return Ok(s);
    }

    [HttpPost]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult<StudentDto>> Create([FromBody] CreateStudentRequest request)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        var rollNo = request.RollNo.Trim();
        if (await _context.Students.AnyAsync(s => s.RollNo.ToLower() == rollNo.ToLower()))
        {
            return BadRequest(new { message = $"Student with Roll Number '{rollNo}' already exists in your institute." });
        }

        var cls = await _context.Classes.FindAsync(request.ClassId);
        if (cls == null) return BadRequest(new { message = "Selected class does not exist." });

        var student = new Student
        {
            InstituteId = tenantId.Value,
            RollNo = rollNo,
            FirstName = request.FirstName.Trim(),
            LastName = request.LastName.Trim(),
            ClassId = request.ClassId,
            Section = request.Section.Trim().ToUpperInvariant(),
            ParentPhone = request.ParentPhone.Trim(),
            Email = request.Email?.Trim().ToLowerInvariant(),
            IsActive = true,
            CreatedAt = DateTime.UtcNow
        };

        _context.Students.Add(student);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = student.Id }, new StudentDto
        {
            Id = student.Id,
            RollNo = student.RollNo,
            FirstName = student.FirstName,
            LastName = student.LastName,
            FullName = student.FullName,
            ClassId = student.ClassId,
            ClassName = cls.Name,
            Section = student.Section,
            ParentPhone = student.ParentPhone,
            Email = student.Email,
            IsActive = student.IsActive,
            CreatedAt = student.CreatedAt
        });
    }

    [HttpPut("{id}")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult<StudentDto>> Update(int id, [FromBody] UpdateStudentRequest request)
    {
        var student = await _context.Students.Include(s => s.Class).FirstOrDefaultAsync(s => s.Id == id);
        if (student == null) return NotFound(new { message = "Student not found." });

        var rollNo = request.RollNo.Trim();
        if (student.RollNo != rollNo && await _context.Students.AnyAsync(s => s.Id != id && s.RollNo.ToLower() == rollNo.ToLower()))
        {
            return BadRequest(new { message = $"Another student with Roll Number '{rollNo}' already exists." });
        }

        var cls = await _context.Classes.FindAsync(request.ClassId);
        if (cls == null) return BadRequest(new { message = "Selected class does not exist." });

        student.RollNo = rollNo;
        student.FirstName = request.FirstName.Trim();
        student.LastName = request.LastName.Trim();
        student.ClassId = request.ClassId;
        student.Section = request.Section.Trim().ToUpperInvariant();
        student.ParentPhone = request.ParentPhone.Trim();
        student.Email = request.Email?.Trim().ToLowerInvariant();
        student.IsActive = request.IsActive;

        await _context.SaveChangesAsync();

        return Ok(new StudentDto
        {
            Id = student.Id,
            RollNo = student.RollNo,
            FirstName = student.FirstName,
            LastName = student.LastName,
            FullName = student.FullName,
            ClassId = student.ClassId,
            ClassName = cls.Name,
            Section = student.Section,
            ParentPhone = student.ParentPhone,
            Email = student.Email,
            PhotoPath = student.PhotoPath,
            IsActive = student.IsActive,
            CreatedAt = student.CreatedAt
        });
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<IActionResult> Deactivate(int id)
    {
        var student = await _context.Students.FindAsync(id);
        if (student == null) return NotFound(new { message = "Student not found." });

        student.IsActive = false;
        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpGet("import-template")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public IActionResult DownloadImportTemplate()
    {
        var bytes = _excelService.GenerateStudentTemplate();
        return File(bytes, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Student_Import_Template.xlsx");
    }

    [HttpPost("import-preview")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult<ExcelImportPreviewResult>> PreviewImport(IFormFile file)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "Please upload a valid Excel file." });
        }

        var ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".xlsx" && ext != ".xls")
        {
            return BadRequest(new { message = "Invalid file format. Please upload an Excel (.xlsx) file." });
        }

        using var stream = file.OpenReadStream();
        var preview = await _excelService.PreviewStudentImportAsync(tenantId.Value, stream);
        return Ok(preview);
    }

    [HttpPost("import-confirm")]
    [Authorize(Roles = $"{Roles.InstituteAdmin},{Roles.SuperAdmin}")]
    public async Task<ActionResult> ConfirmImport([FromBody] ConfirmImportRequest request)
    {
        var tenantId = _tenantService.InstituteId;
        if (!tenantId.HasValue) return BadRequest(new { message = "Missing tenant context." });

        if (request.Students == null || request.Students.Count == 0)
        {
            return BadRequest(new { message = "No valid student records provided for import." });
        }

        // Fetch existing roll numbers to guarantee zero collision even if concurrent inserts occurred
        var existingRollNos = await _context.Students
            .Where(s => s.InstituteId == tenantId.Value && s.IsActive)
            .Select(s => s.RollNo.ToLower())
            .ToListAsync();
        var existingRollSet = new HashSet<string>(existingRollNos);

        var studentsToAdd = new List<Student>();
        var skippedCount = 0;

        foreach (var req in request.Students)
        {
            var roll = req.RollNo.Trim().ToLowerInvariant();
            if (existingRollSet.Contains(roll))
            {
                skippedCount++;
                continue;
            }

            existingRollSet.Add(roll);
            studentsToAdd.Add(new Student
            {
                InstituteId = tenantId.Value,
                RollNo = req.RollNo.Trim(),
                FirstName = req.FirstName.Trim(),
                LastName = req.LastName.Trim(),
                ClassId = req.ClassId,
                Section = req.Section.Trim().ToUpperInvariant(),
                ParentPhone = req.ParentPhone.Trim(),
                Email = req.Email?.Trim().ToLowerInvariant(),
                IsActive = true,
                CreatedAt = DateTime.UtcNow
            });
        }

        if (studentsToAdd.Count > 0)
        {
            await _context.Students.AddRangeAsync(studentsToAdd);
            await _context.SaveChangesAsync();
        }

        return Ok(new
        {
            message = $"Bulk import complete. Imported: {studentsToAdd.Count}, Skipped: {skippedCount}.",
            importedCount = studentsToAdd.Count,
            skippedCount = skippedCount
        });
    }
}
