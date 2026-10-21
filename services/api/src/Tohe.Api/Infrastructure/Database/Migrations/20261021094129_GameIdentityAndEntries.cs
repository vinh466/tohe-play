using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class GameIdentityAndEntries : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "payload",
                schema: "links",
                table: "share_links",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<string[]>(
                name: "entries",
                schema: "registry",
                table: "games",
                type: "text[]",
                nullable: false,
                defaultValueSql: "'{}'::text[]");

            migrationBuilder.AddColumn<string>(
                name: "identity_play",
                schema: "registry",
                table: "games",
                type: "character varying(8)",
                maxLength: 8,
                nullable: false,
                defaultValue: "any");

            migrationBuilder.AddColumn<string>(
                name: "identity_rooms",
                schema: "registry",
                table: "games",
                type: "character varying(8)",
                maxLength: 8,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "payload",
                schema: "links",
                table: "share_links");

            migrationBuilder.DropColumn(
                name: "entries",
                schema: "registry",
                table: "games");

            migrationBuilder.DropColumn(
                name: "identity_play",
                schema: "registry",
                table: "games");

            migrationBuilder.DropColumn(
                name: "identity_rooms",
                schema: "registry",
                table: "games");
        }
    }
}
