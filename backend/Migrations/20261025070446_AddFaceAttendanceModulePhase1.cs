using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace StudentAttendance.Api.Migrations
{
    /// <inheritdoc />
    public partial class AddFaceAttendanceModulePhase1 : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<double>(
                name: "FaceConfidence",
                table: "AttendanceRecords",
                type: "float",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "Source",
                table: "AttendanceRecords",
                type: "nvarchar(20)",
                maxLength: 20,
                nullable: false,
                defaultValue: "Manual");

            migrationBuilder.CreateTable(
                name: "InstituteFaceSettings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    IsEnabled = table.Column<bool>(type: "bit", nullable: false),
                    MatchThreshold = table.Column<double>(type: "float", nullable: false),
                    LowConfidenceThreshold = table.Column<double>(type: "float", nullable: false),
                    DataRetentionDays = table.Column<int>(type: "int", nullable: false),
                    ConsentNoticeText = table.Column<string>(type: "nvarchar(max)", nullable: false),
                    UpdatedByUserId = table.Column<int>(type: "int", nullable: true),
                    InstituteId = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_InstituteFaceSettings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_InstituteFaceSettings_Institutes_InstituteId",
                        column: x => x.InstituteId,
                        principalTable: "Institutes",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_InstituteFaceSettings_Users_UpdatedByUserId",
                        column: x => x.UpdatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "StudentFaceConsents",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    StudentId = table.Column<int>(type: "int", nullable: false),
                    ParentId = table.Column<int>(type: "int", nullable: true),
                    ConsentGivenBy = table.Column<string>(type: "nvarchar(150)", maxLength: 150, nullable: false),
                    ConsentDate = table.Column<DateTime>(type: "datetime2", nullable: false),
                    Status = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    RecordedByUserId = table.Column<int>(type: "int", nullable: false),
                    WithdrawnDate = table.Column<DateTime>(type: "datetime2", nullable: true),
                    WithdrawnByUserId = table.Column<int>(type: "int", nullable: true),
                    Notes = table.Column<string>(type: "nvarchar(500)", maxLength: 500, nullable: true),
                    InstituteId = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudentFaceConsents", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StudentFaceConsents_Parents_ParentId",
                        column: x => x.ParentId,
                        principalTable: "Parents",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StudentFaceConsents_Students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "Students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StudentFaceConsents_Users_RecordedByUserId",
                        column: x => x.RecordedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StudentFaceConsents_Users_WithdrawnByUserId",
                        column: x => x.WithdrawnByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "StudentFaceEmbeddings",
                columns: table => new
                {
                    Id = table.Column<int>(type: "int", nullable: false)
                        .Annotation("SqlServer:Identity", "1, 1"),
                    StudentId = table.Column<int>(type: "int", nullable: false),
                    PoseType = table.Column<string>(type: "nvarchar(50)", maxLength: 50, nullable: false),
                    EmbeddingVectorEncrypted = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    EncryptionIv = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    EncryptionTag = table.Column<byte[]>(type: "varbinary(max)", nullable: false),
                    QualityScore = table.Column<double>(type: "float", nullable: false),
                    CreatedByUserId = table.Column<int>(type: "int", nullable: false),
                    InstituteId = table.Column<int>(type: "int", nullable: false),
                    IsActive = table.Column<bool>(type: "bit", nullable: false),
                    CreatedAt = table.Column<DateTime>(type: "datetime2", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("PK_StudentFaceEmbeddings", x => x.Id);
                    table.ForeignKey(
                        name: "FK_StudentFaceEmbeddings_Students_StudentId",
                        column: x => x.StudentId,
                        principalTable: "Students",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                    table.ForeignKey(
                        name: "FK_StudentFaceEmbeddings_Users_CreatedByUserId",
                        column: x => x.CreatedByUserId,
                        principalTable: "Users",
                        principalColumn: "Id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "IX_InstituteFaceSettings_InstituteId",
                table: "InstituteFaceSettings",
                column: "InstituteId",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "IX_InstituteFaceSettings_UpdatedByUserId",
                table: "InstituteFaceSettings",
                column: "UpdatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_StudentFaceConsents_InstituteId_StudentId_IsActive",
                table: "StudentFaceConsents",
                columns: new[] { "InstituteId", "StudentId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_StudentFaceConsents_ParentId",
                table: "StudentFaceConsents",
                column: "ParentId");

            migrationBuilder.CreateIndex(
                name: "IX_StudentFaceConsents_RecordedByUserId",
                table: "StudentFaceConsents",
                column: "RecordedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_StudentFaceConsents_StudentId",
                table: "StudentFaceConsents",
                column: "StudentId");

            migrationBuilder.CreateIndex(
                name: "IX_StudentFaceConsents_WithdrawnByUserId",
                table: "StudentFaceConsents",
                column: "WithdrawnByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_StudentFaceEmbeddings_CreatedByUserId",
                table: "StudentFaceEmbeddings",
                column: "CreatedByUserId");

            migrationBuilder.CreateIndex(
                name: "IX_StudentFaceEmbeddings_InstituteId_StudentId_IsActive",
                table: "StudentFaceEmbeddings",
                columns: new[] { "InstituteId", "StudentId", "IsActive" });

            migrationBuilder.CreateIndex(
                name: "IX_StudentFaceEmbeddings_StudentId",
                table: "StudentFaceEmbeddings",
                column: "StudentId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "InstituteFaceSettings");

            migrationBuilder.DropTable(
                name: "StudentFaceConsents");

            migrationBuilder.DropTable(
                name: "StudentFaceEmbeddings");

            migrationBuilder.DropColumn(
                name: "FaceConfidence",
                table: "AttendanceRecords");

            migrationBuilder.DropColumn(
                name: "Source",
                table: "AttendanceRecords");
        }
    }
}
