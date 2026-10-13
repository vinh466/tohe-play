using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class Progress : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "progress");

            migrationBuilder.CreateTable(
                name: "saves",
                schema: "progress",
                columns: table => new
                {
                    profile_id = table.Column<Guid>(type: "uuid", nullable: false),
                    game_id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    data = table.Column<string>(type: "jsonb", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    previous_data = table.Column<string>(type: "jsonb", nullable: true),
                    previous_updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_saves", x => new { x.profile_id, x.game_id });
                });

            migrationBuilder.CreateTable(
                name: "scores",
                schema: "progress",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    profile_id = table.Column<Guid>(type: "uuid", nullable: false),
                    game_id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    board = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    value = table.Column<double>(type: "double precision", nullable: false),
                    achieved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    recorded_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    client_id = table.Column<Guid>(type: "uuid", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_scores", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_scores_game_id_board_profile_id",
                schema: "progress",
                table: "scores",
                columns: new[] { "game_id", "board", "profile_id" });

            migrationBuilder.CreateIndex(
                name: "ix_scores_profile_id_client_id",
                schema: "progress",
                table: "scores",
                columns: new[] { "profile_id", "client_id" },
                unique: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "saves",
                schema: "progress");

            migrationBuilder.DropTable(
                name: "scores",
                schema: "progress");
        }
    }
}
