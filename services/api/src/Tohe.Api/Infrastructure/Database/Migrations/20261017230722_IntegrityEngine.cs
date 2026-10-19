using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class IntegrityEngine : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "integrity");

            migrationBuilder.CreateTable(
                name: "results",
                schema: "integrity",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    kind = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    profile_id = table.Column<Guid>(type: "uuid", nullable: false),
                    account_id = table.Column<Guid>(type: "uuid", nullable: false),
                    game_id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    board = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    value = table.Column<double>(type: "double precision", nullable: false),
                    place = table.Column<int>(type: "integer", nullable: true),
                    source = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    final = table.Column<bool>(type: "boolean", nullable: false),
                    level = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    @public = table.Column<bool>(name: "public", type: "boolean", nullable: false),
                    at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    device_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    rule_version = table.Column<int>(type: "integer", nullable: false),
                    decided_by = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_integrity_results", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "decisions",
                schema: "integrity",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    result_id = table.Column<long>(type: "bigint", nullable: false),
                    from = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: true),
                    to = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    reason = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    details = table.Column<string>(type: "jsonb", nullable: true),
                    rule_version = table.Column<int>(type: "integer", nullable: false),
                    actor = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_decisions", x => x.id);
                    table.ForeignKey(
                        name: "fk_decisions_integrity_results_result_id",
                        column: x => x.result_id,
                        principalSchema: "integrity",
                        principalTable: "results",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_decisions_result_id",
                schema: "integrity",
                table: "decisions",
                column: "result_id");

            migrationBuilder.CreateIndex(
                name: "ix_integrity_results_profile_id_game_id_at",
                schema: "integrity",
                table: "results",
                columns: new[] { "profile_id", "game_id", "at" });

            migrationBuilder.CreateIndex(
                name: "ix_results_account_id_game_id_board_at",
                schema: "integrity",
                table: "results",
                columns: new[] { "account_id", "game_id", "board", "at" });

            migrationBuilder.CreateIndex(
                name: "ix_results_profile_id_game_id_board_value",
                schema: "integrity",
                table: "results",
                columns: new[] { "profile_id", "game_id", "board", "value" });

            migrationBuilder.CreateIndex(
                name: "ix_results_source",
                schema: "integrity",
                table: "results",
                column: "source",
                unique: true);

            // Decisions are history: nothing rewrites them (ADR 0029). Results so far come in as they were trusted —
            // runs as reported, hands as refereed, public only with two people at the table — each with its decision.
            migrationBuilder.Sql("""
                CREATE FUNCTION integrity.decisions_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    RAISE EXCEPTION 'integrity.decisions is append-only';
                END
                $$;
                CREATE TRIGGER decisions_no_change BEFORE UPDATE OR DELETE ON integrity.decisions
                    FOR EACH ROW EXECUTE FUNCTION integrity.decisions_append_only();
                CREATE TRIGGER decisions_no_truncate BEFORE TRUNCATE ON integrity.decisions
                    FOR EACH STATEMENT EXECUTE FUNCTION integrity.decisions_append_only();

                INSERT INTO integrity.results
                    (kind, profile_id, account_id, game_id, board, value, place, source, final, level, "public", at, device_at, rule_version)
                SELECT 'Run', s.profile_id, p.account_id, s.game_id, s.board, s.value, NULL,
                       'run:' || replace(s.profile_id::text, '-', '') || ':' || replace(s.client_id::text, '-', ''),
                       s.final, 'Reported', TRUE, s.recorded_at, s.achieved_at, 0
                FROM progress.scores s
                JOIN identity.profiles p ON p.id = s.profile_id;

                INSERT INTO integrity.results
                    (kind, profile_id, account_id, game_id, board, value, place, source, final, level, "public", at, device_at, rule_version)
                SELECT 'Hand', r.profile_id, r.account_id, r.game_id, 'hands', r.points, r.place,
                       'hand:' || replace(r.room_id::text, '-', '') || ':' || r.hand || ':' || r.seat,
                       TRUE, 'Verified',
                       (SELECT count(*) FROM rooms.results o
                        WHERE o.room_id = r.room_id AND o.hand = r.hand AND o.profile_id IS NOT NULL) >= 2,
                       r.at, NULL, 0
                FROM rooms.results r
                WHERE r.profile_id IS NOT NULL AND r.account_id IS NOT NULL;

                INSERT INTO integrity.decisions (result_id, "from", "to", reason, rule_version, at)
                SELECT id, NULL, level, 'imported', 0, at FROM integrity.results;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TRIGGER decisions_no_truncate ON integrity.decisions;
                DROP TRIGGER decisions_no_change ON integrity.decisions;
                DROP FUNCTION integrity.decisions_append_only();
                """);

            migrationBuilder.DropTable(
                name: "decisions",
                schema: "integrity");

            migrationBuilder.DropTable(
                name: "results",
                schema: "integrity");
        }
    }
}
