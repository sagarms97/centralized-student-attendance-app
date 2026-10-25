using ClosedXML.Excel;
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
public class ReportsController : ControllerBase
{
    private readonly ApplicationDbContext _context;
    private readonly ICurrentTenantService _tenantService;

    public ReportsController(ApplicationDbContext context, ICurrentTenantService tenantService)
    {
        _context = context;
        _tenantService = tenantService;
    }

    [HttpGet("daily")]
    public async Task<ActionResult<List<DailyAttendanceReportItem>>> GetDailyReport(
        [FromQuery] string? startDate,
        [FromQuery] string? endDate,
        [FromQuery] int? classId,
        [FromQuery] int? subjectId)
    {
        DateOnly start = DateOnly.TryParse(startDate, out var s) ? s : DateOnly.FromDateTime(DateTime.UtcNow.AddDays(-7));
        DateOnly end = DateOnly.TryParse(endDate, out var e) ? e : DateOnly.FromDateTime(DateTime.UtcNow);

        var query = _context.AttendanceRecords
            .Include(a => a.Student)
                .ThenInclude(st => st.Class)
            .Include(a => a.Period)
            .Include(a => a.TimetableEntry)
                .ThenInclude(t => t.Subject)
            .Include(a => a.TimetableEntry)
                .ThenInclude(t => t.Staff)
            .Where(a => a.Date >= start && a.Date <= end);

        if (classId.HasValue)
        {
            query = query.Where(a => a.Student.ClassId == classId.Value);
        }

        if (subjectId.HasValue)
        {
            query = query.Where(a => a.TimetableEntry.SubjectId == subjectId.Value);
        }

        var records = await query.ToListAsync();

        var grouped = records
            .GroupBy(a => new
            {
                a.Date,
                a.PeriodId,
                a.TimetableEntryId,
                ClassId = a.Student.ClassId,
                ClassName = a.Student.Class.Name,
                a.Student.Section,
                PeriodName = a.Period.Name,
                SubjectName = a.TimetableEntry.Subject.Name,
                StaffName = a.TimetableEntry.Staff.FullName
            })
            .Select(g =>
            {
                var faceCount = g.Count(x => x.Source == "Face");
                var manualCount = g.Count(x => x.Source != "Face");
                var confidences = g.Where(x => x.Source == "Face" && x.FaceConfidence.HasValue)
                                   .Select(x => x.FaceConfidence!.Value)
                                   .ToList();
                double? avgConf = confidences.Count > 0 ? Math.Round(confidences.Average() * 100, 1) : null;
                string source = faceCount > 0 ? (manualCount > 0 ? "Mixed" : "Face") : "Manual";

                return new DailyAttendanceReportItem
                {
                    Date = g.Key.Date.ToString("yyyy-MM-dd"),
                    ClassId = g.Key.ClassId,
                    ClassName = g.Key.ClassName,
                    Section = g.Key.Section,
                    PeriodName = g.Key.PeriodName,
                    SubjectName = g.Key.SubjectName,
                    StaffName = g.Key.StaffName,
                    TotalStudents = g.Count(),
                    PresentCount = g.Count(x => x.Status == AttendanceStatus.Present),
                    AbsentCount = g.Count(x => x.Status == AttendanceStatus.Absent),
                    LateCount = g.Count(x => x.Status == AttendanceStatus.Late),
                    Source = source,
                    FaceVerifiedCount = faceCount,
                    ManualCount = manualCount,
                    AverageFaceConfidence = avgConf
                };
            })
            .OrderByDescending(r => r.Date)
            .ThenBy(r => r.ClassName)
            .ThenBy(r => r.PeriodName)
            .ToList();

        return Ok(grouped);
    }

    [HttpGet("students")]
    public async Task<ActionResult<List<StudentAttendanceSummaryDto>>> GetStudentReport(
        [FromQuery] int? classId,
        [FromQuery] string? section,
        [FromQuery] int? subjectId,
        [FromQuery] string? startDate,
        [FromQuery] string? endDate,
        [FromQuery] double defaulterThreshold = 75.0)
    {
        DateOnly start = DateOnly.TryParse(startDate, out var s) ? s : DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-1));
        DateOnly end = DateOnly.TryParse(endDate, out var e) ? e : DateOnly.FromDateTime(DateTime.UtcNow);

        var studentsQuery = _context.Students
            .Include(st => st.Class)
            .Where(st => st.IsActive);

        if (classId.HasValue)
        {
            studentsQuery = studentsQuery.Where(st => st.ClassId == classId.Value);
        }

        if (!string.IsNullOrWhiteSpace(section))
        {
            var sec = section.Trim().ToUpper();
            studentsQuery = studentsQuery.Where(st => st.Section.ToUpper() == sec);
        }

        var students = await studentsQuery.OrderBy(st => st.RollNo).ToListAsync();
        var studentIds = students.Select(st => st.Id).ToList();

        var attQuery = _context.AttendanceRecords
            .Where(a => studentIds.Contains(a.StudentId) && a.Date >= start && a.Date <= end);

        if (subjectId.HasValue)
        {
            attQuery = attQuery.Where(a => a.TimetableEntry.SubjectId == subjectId.Value);
        }

        var attendanceList = await attQuery.ToListAsync();
        var attByStudent = attendanceList.GroupBy(a => a.StudentId).ToDictionary(g => g.Key, g => g.ToList());

        var result = new List<StudentAttendanceSummaryDto>();

        foreach (var stud in students)
        {
            attByStudent.TryGetValue(stud.Id, out var records);
            records ??= new List<AttendanceRecord>();

            var total = records.Count;
            var present = records.Count(r => r.Status == AttendanceStatus.Present);
            var absent = records.Count(r => r.Status == AttendanceStatus.Absent);
            var late = records.Count(r => r.Status == AttendanceStatus.Late);
            var percent = total > 0 ? Math.Round((present + (late * 0.5)) / total * 100, 1) : 100.0;

            var faceSessions = records.Count(r => r.Source == "Face" && (r.Status == AttendanceStatus.Present || r.Status == AttendanceStatus.Late));
            var manualSessions = records.Count(r => r.Source != "Face" && (r.Status == AttendanceStatus.Present || r.Status == AttendanceStatus.Late));

            result.Add(new StudentAttendanceSummaryDto
            {
                StudentId = stud.Id,
                RollNo = stud.RollNo,
                FullName = stud.FullName,
                ClassName = stud.Class.Name,
                Section = stud.Section,
                TotalSessions = total,
                PresentSessions = present,
                AbsentSessions = absent,
                LateSessions = late,
                FaceVerifiedSessions = faceSessions,
                ManualSessions = manualSessions,
                IsDefaulter = total > 0 && percent < defaulterThreshold
            });
        }

        return Ok(result.OrderBy(r => r.AttendancePercentage).ToList());
    }

    [HttpGet("class-summary")]
    public async Task<ActionResult<List<ClassSummaryDto>>> GetClassSummary(
        [FromQuery] string? startDate,
        [FromQuery] string? endDate)
    {
        DateOnly start = DateOnly.TryParse(startDate, out var s) ? s : DateOnly.FromDateTime(DateTime.UtcNow.AddMonths(-1));
        DateOnly end = DateOnly.TryParse(endDate, out var e) ? e : DateOnly.FromDateTime(DateTime.UtcNow);

        var classes = await _context.Classes.Where(c => c.IsActive).ToListAsync();
        var students = await _context.Students.Where(s => s.IsActive).ToListAsync();
        var attendance = await _context.AttendanceRecords
            .Include(a => a.Student)
            .Where(a => a.Date >= start && a.Date <= end)
            .ToListAsync();

        var summaries = new List<ClassSummaryDto>();

        foreach (var cls in classes)
        {
            var sections = cls.Sections.Split(',', StringSplitOptions.RemoveEmptyEntries | StringSplitOptions.TrimEntries);
            foreach (var sec in sections)
            {
                var enrolled = students.Count(s => s.ClassId == cls.Id && s.Section.Equals(sec, StringComparison.OrdinalIgnoreCase));
                var classAtt = attendance.Where(a => a.Student.ClassId == cls.Id && a.Student.Section.Equals(sec, StringComparison.OrdinalIgnoreCase)).ToList();

                var distinctSessions = classAtt.Select(a => new { a.Date, a.PeriodId }).Distinct().Count();
                var totalMarks = classAtt.Count;
                var presentMarks = classAtt.Count(a => a.Status == AttendanceStatus.Present);
                var lateMarks = classAtt.Count(a => a.Status == AttendanceStatus.Late);

                var avg = totalMarks > 0 ? Math.Round((presentMarks + (lateMarks * 0.5)) / totalMarks * 100, 1) : 0.0;

                summaries.Add(new ClassSummaryDto
                {
                    ClassId = cls.Id,
                    ClassName = cls.Name,
                    Section = sec,
                    TotalEnrolled = enrolled,
                    TotalSessionsConducted = distinctSessions,
                    AverageAttendancePercentage = avg
                });
            }
        }

        return Ok(summaries);
    }

    [HttpGet("export-excel")]
    public async Task<IActionResult> ExportToExcel(
        [FromQuery] int? classId,
        [FromQuery] string? section,
        [FromQuery] double defaulterThreshold = 75.0)
    {
        var studentReport = await GetStudentReport(classId, section, null, null, null, defaulterThreshold);
        var items = (studentReport.Result as OkObjectResult)?.Value as List<StudentAttendanceSummaryDto> ?? new List<StudentAttendanceSummaryDto>();

        using var workbook = new XLWorkbook();
        var worksheet = workbook.Worksheets.Add("Attendance Report");

        var headers = new[]
        {
            "Roll No",
            "Student Name",
            "Class",
            "Section",
            "Total Sessions",
            "Present",
            "Absent",
            "Late",
            "Face Verified",
            "Manual",
            "Attendance %",
            "Defaulter Status"
        };

        for (int i = 0; i < headers.Length; i++)
        {
            var cell = worksheet.Cell(1, i + 1);
            cell.Value = headers[i];
            cell.Style.Font.Bold = true;
            cell.Style.Fill.BackgroundColor = XLColor.FromArgb(26, 35, 126);
            cell.Style.Font.FontColor = XLColor.White;
        }

        for (int r = 0; r < items.Count; r++)
        {
            var item = items[r];
            worksheet.Cell(r + 2, 1).Value = item.RollNo;
            worksheet.Cell(r + 2, 2).Value = item.FullName;
            worksheet.Cell(r + 2, 3).Value = item.ClassName;
            worksheet.Cell(r + 2, 4).Value = item.Section;
            worksheet.Cell(r + 2, 5).Value = item.TotalSessions;
            worksheet.Cell(r + 2, 6).Value = item.PresentSessions;
            worksheet.Cell(r + 2, 7).Value = item.AbsentSessions;
            worksheet.Cell(r + 2, 8).Value = item.LateSessions;
            worksheet.Cell(r + 2, 9).Value = item.FaceVerifiedSessions;
            worksheet.Cell(r + 2, 10).Value = item.ManualSessions;
            worksheet.Cell(r + 2, 11).Value = $"{item.AttendancePercentage}%";
            var defCell = worksheet.Cell(r + 2, 12);
            defCell.Value = item.IsDefaulter ? "DEFAULTER" : "Normal";
            if (item.IsDefaulter)
            {
                defCell.Style.Font.FontColor = XLColor.Red;
                defCell.Style.Font.Bold = true;
            }
        }

        worksheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        return File(stream.ToArray(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", "Student_Attendance_Report.xlsx");
    }

    [HttpGet("export-pdf")]
    public async Task<IActionResult> ExportToPdf(
        [FromQuery] int? classId,
        [FromQuery] string? section,
        [FromQuery] double defaulterThreshold = 75.0)
    {
        var studentReport = await GetStudentReport(classId, section, null, null, null, defaulterThreshold);
        var items = (studentReport.Result as OkObjectResult)?.Value as List<StudentAttendanceSummaryDto> ?? new List<StudentAttendanceSummaryDto>();

        // Generate clean printable HTML report rendered as PDF-ready format
        var tenantId = _tenantService.InstituteId;
        var institute = await _context.Institutes.FindAsync(tenantId);

        var html = $@"
<!DOCTYPE html>
<html>
<head>
<meta charset='utf-8'>
<title>Attendance Report</title>
<style>
  body {{ font-family: Arial, sans-serif; margin: 30px; color: #333; }}
  .header {{ text-align: center; border-bottom: 2px solid #1a237e; padding-bottom: 12px; margin-bottom: 20px; }}
  .header h1 {{ margin: 0; color: #1a237e; font-size: 24px; }}
  .header p {{ margin: 4px 0 0 0; color: #666; font-size: 14px; }}
  table {{ width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }}
  th {{ background: #1a237e; color: white; padding: 8px; text-align: left; }}
  td {{ border-bottom: 1px solid #ddd; padding: 8px; }}
  .defaulter {{ color: #d32f2f; font-weight: bold; }}
  .footer {{ margin-top: 30px; font-size: 11px; color: #888; text-align: right; }}
</style>
</head>
<body>
  <div class='header'>
    <h1>{institute?.Name ?? "Institution Attendance Report"}</h1>
    <p>Official Student Attendance & Defaulters Summary | Generated on {DateTime.UtcNow:MMMM dd, yyyy}</p>
  </div>
  <table>
    <thead>
      <tr>
        <th>Roll No</th>
        <th>Student Name</th>
        <th>Class</th>
        <th>Section</th>
        <th>Conducted</th>
        <th>Present</th>
        <th>Absent</th>
        <th>Face Verified</th>
        <th>Manual</th>
        <th>Attendance %</th>
        <th>Status</th>
      </tr>
    </thead>
    <tbody>
      {string.Join("", items.Select(i => $@"
      <tr>
        <td>{i.RollNo}</td>
        <td>{i.FullName}</td>
        <td>{i.ClassName}</td>
        <td>{i.Section}</td>
        <td>{i.TotalSessions}</td>
        <td>{i.PresentSessions}</td>
        <td>{i.AbsentSessions}</td>
        <td>{i.FaceVerifiedSessions}</td>
        <td>{i.ManualSessions}</td>
        <td>{i.AttendancePercentage}%</td>
        <td class='{(i.IsDefaulter ? "defaulter" : "")}'>{(i.IsDefaulter ? "DEFAULTER" : "Good Standing")}</td>
      </tr>"))}
    </tbody>
  </table>
  <div class='footer'>
    Report generated by Student Attendance Management System PWA.
  </div>
</body>
</html>";

        var bytes = System.Text.Encoding.UTF8.GetBytes(html);
        return File(bytes, "text/html", "Student_Attendance_Report.html");
    }
}
