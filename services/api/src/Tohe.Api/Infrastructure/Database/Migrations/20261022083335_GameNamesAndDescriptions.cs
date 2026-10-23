using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class GameNamesAndDescriptions : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "descriptions",
                schema: "registry",
                table: "games",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'{}'::jsonb");

            migrationBuilder.AddColumn<string>(
                name: "names",
                schema: "registry",
                table: "games",
                type: "jsonb",
                nullable: false,
                defaultValueSql: "'{}'::jsonb");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "descriptions",
                schema: "registry",
                table: "games");

            migrationBuilder.DropColumn(
                name: "names",
                schema: "registry",
                table: "games");
        }
    }
}
