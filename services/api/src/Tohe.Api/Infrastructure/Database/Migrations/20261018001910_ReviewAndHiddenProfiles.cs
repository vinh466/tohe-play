using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class ReviewAndHiddenProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "hidden_from_boards_at",
                schema: "identity",
                table: "profiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_integrity_results_held",
                schema: "integrity",
                table: "results",
                column: "id",
                filter: "level = 'Held'");

            migrationBuilder.CreateIndex(
                name: "ix_integrity_decisions_decided",
                schema: "integrity",
                table: "decisions",
                columns: new[] { "result_id", "id" },
                filter: "actor IS NOT NULL OR \"to\" = 'Rejected'");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_integrity_results_held",
                schema: "integrity",
                table: "results");

            migrationBuilder.DropIndex(
                name: "ix_integrity_decisions_decided",
                schema: "integrity",
                table: "decisions");

            migrationBuilder.DropColumn(
                name: "hidden_from_boards_at",
                schema: "identity",
                table: "profiles");
        }
    }
}
