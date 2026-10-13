using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class Initial : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "registry");

            migrationBuilder.CreateTable(
                name: "games",
                schema: "registry",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    version = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    name = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    description = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    path = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    entry = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    icon = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    orientation = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    capabilities = table.Column<string[]>(type: "text[]", nullable: false),
                    tags = table.Column<string[]>(type: "text[]", nullable: false),
                    min_age = table.Column<int>(type: "integer", nullable: false),
                    size_kb = table.Column<int>(type: "integer", nullable: false),
                    listed = table.Column<bool>(type: "boolean", nullable: false),
                    first_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_games", x => x.id);
                });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "games",
                schema: "registry");
        }
    }
}
