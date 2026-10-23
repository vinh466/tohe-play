using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class LinkAndTableLanguages : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "language",
                schema: "links",
                table: "share_links",
                type: "character varying(2)",
                maxLength: 2,
                nullable: false,
                defaultValue: "vi");

            migrationBuilder.AddColumn<string>(
                name: "language",
                schema: "rooms",
                table: "rooms",
                type: "character varying(2)",
                maxLength: 2,
                nullable: false,
                defaultValue: "vi");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "language",
                schema: "links",
                table: "share_links");

            migrationBuilder.DropColumn(
                name: "language",
                schema: "rooms",
                table: "rooms");
        }
    }
}
