using ClosedXML.Excel;
using Microsoft.EntityFrameworkCore;
using StudentAttendance.Api.Data;
using StudentAttendance.Api.DTOs;

namespace StudentAttendance.Api.Services;

public interface IExcelImportService
{
    byte[] GenerateStudentTemplate();
    Task<ExcelImportPreviewResult> PreviewStudentImportAsync(int instituteId, Stream excelStream);
}

public class ExcelImportService : IExcelImportService
{
    private readonly ApplicationDbContext _context;

    public ExcelImportService(ApplicationDbContext context)
    {
        _context = context;
    }

    public byte[] GenerateStudentTemplate()
    {
        using var workbook = new XLWorkbook();
        var worksheet = workbook.Worksheets.Add("Students");

        // Headers
        var headers = new[]
        {
            "RollNo",
            "FirstName",
            "LastName",
            "ClassName",
            "Section",
            "ParentPhone",
            "Email"
        };

        for (int i = 0; i < headers.Length; i++)
        {
            var cell = worksheet.Cell(1, i + 1);
            cell.Value = headers[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromArgb(26, 35, 126); // Primary Indigo
            cell.Style.Font.FontColor = XLColor.White;
            cell.Style.Alignment.Horizontal = XLAlignmentHorizontalValues.Center;
        }

        // Sample Data Rows
        var sampleRows = new[]
        {
            new[] { "R101", "John", "Smith", "Grade 10", "A", "+1234567890", "john.smith@example.com" },
            new[] { "R102", "Emma", "Watson", "Grade 10", "A", "+1234567891", "emma.watson@example.com" },
            new[] { "R103", "Liam", "Johnson", "Grade 10", "B", "+1234567892", "" }
        };

        for (int r = 0; r < sampleRows.Length; r++)
        {
            for (int c = 0; c < sampleRows[r].Length; c++)
            {
                worksheet.Cell(r + 2, c + 1).Value = sampleRows[r][c];
            }
        }

        worksheet.Columns().AdjustToContents();

        using var memoryStream = new MemoryStream();
        workbook.SaveAs(memoryStream);
        return memoryStream.ToArray();
    }

    public async Task<ExcelImportPreviewResult> PreviewStudentImportAsync(int instituteId, Stream excelStream)
    {
        using var workbook = new XLWorkbook(excelStream);
        var worksheet = workbook.Worksheets.FirstOrDefault();

        var result = new ExcelImportPreviewResult();
        if (worksheet == null)
        {
            return result;
        }

        // Fetch existing classes for this institute
        var classes = await _context.Classes
            .Where(c => c.InstituteId == instituteId && c.IsActive)
            .ToListAsync();
        var classDict = classes.ToDictionary(c => c.Name.Trim().ToLowerInvariant(), c => c);

        // Fetch existing roll numbers for this institute
        var existingRollNos = await _context.Students
            .Where(s => s.InstituteId == instituteId && s.IsActive)
            .Select(s => s.RollNo.Trim().ToLowerInvariant())
            .ToListAsync();
        var existingRollSet = new HashSet<string>(existingRollNos);

        var seenInFileRollNos = new HashSet<string>();

        var rows = worksheet.RowsUsed().Skip(1); // Skip header row
        int rowNumber = 1;

        foreach (var row in rows)
        {
            rowNumber++;
            var rollNo = row.Cell(1).GetString().Trim();
            var firstName = row.Cell(2).GetString().Trim();
            var lastName = row.Cell(3).GetString().Trim();
            var className = row.Cell(4).GetString().Trim();
            var section = row.Cell(5).GetString().Trim();
            var parentPhone = row.Cell(6).GetString().Trim();
            var email = row.Cell(7).GetString().Trim();

            // Skip completely empty rows
            if (string.IsNullOrWhiteSpace(rollNo) && string.IsNullOrWhiteSpace(firstName) && string.IsNullOrWhiteSpace(className))
            {
                continue;
            }

            var previewRow = new ExcelImportRowPreview
            {
                RowNumber = rowNumber,
                RollNo = rollNo,
                FirstName = firstName,
                LastName = lastName,
                ClassName = className,
                Section = string.IsNullOrWhiteSpace(section) ? "A" : section.ToUpperInvariant(),
                ParentPhone = parentPhone,
                Email = string.IsNullOrWhiteSpace(email) ? null : email,
                IsValid = true
            };

            // Validations
            if (string.IsNullOrWhiteSpace(rollNo))
            {
                previewRow.IsValid = false;
                previewRow.Errors.Add("Roll number is required.");
            }
            else
            {
                var lowerRoll = rollNo.ToLowerInvariant();
                if (existingRollSet.Contains(lowerRoll))
                {
                    previewRow.IsValid = false;
                    previewRow.Errors.Add($"Roll number '{rollNo}' already exists in institute database.");
                }
                else if (seenInFileRollNos.Contains(lowerRoll))
                {
                    previewRow.IsValid = false;
                    previewRow.Errors.Add($"Duplicate roll number '{rollNo}' within uploaded file.");
                }
                else
                {
                    seenInFileRollNos.Add(lowerRoll);
                }
            }

            if (string.IsNullOrWhiteSpace(firstName))
            {
                previewRow.IsValid = false;
                previewRow.Errors.Add("First name is required.");
            }

            if (string.IsNullOrWhiteSpace(lastName))
            {
                previewRow.IsValid = false;
                previewRow.Errors.Add("Last name is required.");
            }

            if (string.IsNullOrWhiteSpace(className))
            {
                previewRow.IsValid = false;
                previewRow.Errors.Add("Class name is required.");
            }
            else
            {
                var lowerClass = className.ToLowerInvariant();
                if (classDict.TryGetValue(lowerClass, out var matchedClass))
                {
                    previewRow.ClassId = matchedClass.Id;
                    previewRow.ClassName = matchedClass.Name; // normalized name
                }
                else
                {
                    previewRow.IsValid = false;
                    previewRow.Errors.Add($"Class '{className}' does not exist. Please create the class first.");
                }
            }

            if (string.IsNullOrWhiteSpace(parentPhone))
            {
                previewRow.IsValid = false;
                previewRow.Errors.Add("Parent phone number is required.");
            }

            result.Rows.Add(previewRow);
        }

        result.TotalRows = result.Rows.Count;
        result.ValidRowsCount = result.Rows.Count(r => r.IsValid);
        result.InvalidRowsCount = result.Rows.Count(r => !r.IsValid);

        return result;
    }
}
