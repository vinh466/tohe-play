using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class RankedRuns : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "ranked",
                schema: "registry",
                table: "games",
                type: "jsonb",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "ranked_runs",
                schema: "integrity",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    profile_id = table.Column<Guid>(type: "uuid", nullable: false),
                    account_id = table.Column<Guid>(type: "uuid", nullable: false),
                    game_id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    game_path = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    verify = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    board = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    min_ms_per_move = table.Column<int>(type: "integer", nullable: false),
                    max_moves = table.Column<int>(type: "integer", nullable: false),
                    seed = table.Column<int>(type: "integer", nullable: false),
                    state = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    started_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    finished_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    moves = table.Column<string>(type: "jsonb", nullable: true),
                    move_count = table.Column<int>(type: "integer", nullable: false),
                    claimed = table.Column<double>(type: "double precision", nullable: true),
                    replayed = table.Column<double>(type: "double precision", nullable: true),
                    attempts = table.Column<int>(type: "integer", nullable: false),
                    result_id = table.Column<long>(type: "bigint", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_ranked_runs", x => x.id);
                    table.ForeignKey(
                        name: "fk_ranked_runs_integrity_results_result_id",
                        column: x => x.result_id,
                        principalSchema: "integrity",
                        principalTable: "results",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_ranked_runs_profile_id_game_id_state",
                schema: "integrity",
                table: "ranked_runs",
                columns: new[] { "profile_id", "game_id", "state" });

            migrationBuilder.CreateIndex(
                name: "ix_ranked_runs_result_id",
                schema: "integrity",
                table: "ranked_runs",
                column: "result_id");

            migrationBuilder.CreateIndex(
                name: "ix_ranked_runs_state_finished_at",
                schema: "integrity",
                table: "ranked_runs",
                columns: new[] { "state", "finished_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "ranked_runs",
                schema: "integrity");

            migrationBuilder.DropColumn(
                name: "ranked",
                schema: "registry",
                table: "games");
        }
    }
}
