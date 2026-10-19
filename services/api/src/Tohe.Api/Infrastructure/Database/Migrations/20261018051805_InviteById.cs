using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class InviteById : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_results_room_id",
                schema: "rooms",
                table: "results");

            migrationBuilder.AddColumn<string>(
                name: "invites",
                schema: "identity",
                table: "profiles",
                type: "character varying(12)",
                maxLength: 12,
                nullable: false,
                defaultValue: "Anyone");

            // Adults are asked to tables by anyone with their ID; children only within their account (ADR 0033).
            migrationBuilder.Sql("UPDATE identity.profiles SET invites = 'Account' WHERE kind = 'Child';");

            migrationBuilder.CreateIndex(
                name: "ix_rooms_results_room_id_hand",
                schema: "rooms",
                table: "results",
                columns: new[] { "room_id", "hand" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "ix_rooms_results_room_id_hand",
                schema: "rooms",
                table: "results");

            migrationBuilder.DropColumn(
                name: "invites",
                schema: "identity",
                table: "profiles");

            migrationBuilder.CreateIndex(
                name: "ix_results_room_id",
                schema: "rooms",
                table: "results",
                column: "room_id");
        }
    }
}
