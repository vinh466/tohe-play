using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class StudioChecks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropCheckConstraint(
                name: "ck_styles_status",
                schema: "studio",
                table: "styles");

            migrationBuilder.AddColumn<string>(
                name: "reason",
                schema: "studio",
                table: "styles",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "reviewed_at",
                schema: "studio",
                table: "styles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "reviewed_by",
                schema: "studio",
                table: "styles",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "share_alike_allowed",
                schema: "studio",
                table: "pack_versions",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "share_alike_reason",
                schema: "studio",
                table: "pack_versions",
                type: "character varying(1000)",
                maxLength: 1000,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "wang",
                schema: "studio",
                table: "assets",
                type: "jsonb",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "vendors",
                schema: "studio",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    terms_url = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    terms_checked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    note = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_vendors", x => x.id);
                });

            migrationBuilder.AddCheckConstraint(
                name: "ck_styles_status",
                schema: "studio",
                table: "styles",
                sql: "status IN ('draft', 'approved', 'rejected')");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "vendors",
                schema: "studio");

            migrationBuilder.DropCheckConstraint(
                name: "ck_styles_status",
                schema: "studio",
                table: "styles");

            migrationBuilder.DropColumn(
                name: "reason",
                schema: "studio",
                table: "styles");

            migrationBuilder.DropColumn(
                name: "reviewed_at",
                schema: "studio",
                table: "styles");

            migrationBuilder.DropColumn(
                name: "reviewed_by",
                schema: "studio",
                table: "styles");

            migrationBuilder.DropColumn(
                name: "share_alike_allowed",
                schema: "studio",
                table: "pack_versions");

            migrationBuilder.DropColumn(
                name: "share_alike_reason",
                schema: "studio",
                table: "pack_versions");

            migrationBuilder.DropColumn(
                name: "wang",
                schema: "studio",
                table: "assets");

            migrationBuilder.AddCheckConstraint(
                name: "ck_styles_status",
                schema: "studio",
                table: "styles",
                sql: "status IN ('draft', 'approved')");
        }
    }
}
