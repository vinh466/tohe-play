using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class PublicBoards : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "asked_child_at",
                schema: "identity",
                table: "profiles",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "on_public_boards",
                schema: "identity",
                table: "profiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateIndex(
                name: "ix_integrity_results_game_id_board_at",
                schema: "integrity",
                table: "results",
                columns: new[] { "game_id", "board", "at" });

            // Adults are on public boards as new adult profiles are; children stay off until their owner asks them (D-06).
            migrationBuilder.Sql("UPDATE identity.profiles SET on_public_boards = (kind = 'Adult');");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_integrity_results_game_id_board_at",
                schema: "integrity",
                table: "results");

            migrationBuilder.DropColumn(
                name: "asked_child_at",
                schema: "identity",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "on_public_boards",
                schema: "identity",
                table: "profiles");
        }
    }
}
