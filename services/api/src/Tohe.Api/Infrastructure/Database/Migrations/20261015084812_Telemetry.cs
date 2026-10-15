using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class Telemetry : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "telemetry");

            migrationBuilder.AddColumn<bool>(
                name: "telemetry_enabled",
                schema: "households",
                table: "households",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.CreateTable(
                name: "daily",
                schema: "telemetry",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    day = table.Column<DateOnly>(type: "date", nullable: false),
                    source = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: false),
                    game_id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    game_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    os = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    browser = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    device_class = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    kind = table.Column<string>(type: "character varying(6)", maxLength: 6, nullable: false),
                    name = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    fingerprint = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    message = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    stack = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    sessions = table.Column<int>(type: "integer", nullable: false),
                    devices = table.Column<int>(type: "integer", nullable: false),
                    total = table.Column<long>(type: "bigint", nullable: false),
                    value_p50 = table.Column<double>(type: "double precision", nullable: true),
                    value_p95 = table.Column<double>(type: "double precision", nullable: true),
                    value_max = table.Column<double>(type: "double precision", nullable: true),
                    buckets = table.Column<long[]>(type: "bigint[]", nullable: true),
                    slowest_max = table.Column<double>(type: "double precision", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_daily", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "rollups",
                schema: "telemetry",
                columns: table => new
                {
                    day = table.Column<DateOnly>(type: "date", nullable: false),
                    done_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_rollups", x => x.day);
                });

            migrationBuilder.CreateTable(
                name: "sessions",
                schema: "telemetry",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    client_session_id = table.Column<Guid>(type: "uuid", nullable: false),
                    first_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    last_seen_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    hub_version = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    os = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    os_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    browser = table.Column<string>(type: "character varying(30)", maxLength: 30, nullable: false),
                    browser_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: false),
                    device_class = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    viewport_width = table.Column<int>(type: "integer", nullable: false),
                    viewport_height = table.Column<int>(type: "integer", nullable: false),
                    pixel_ratio = table.Column<double>(type: "double precision", nullable: false),
                    cores = table.Column<int>(type: "integer", nullable: true),
                    memory_gb = table.Column<double>(type: "double precision", nullable: true),
                    display_mode = table.Column<string>(type: "character varying(12)", maxLength: 12, nullable: false),
                    theme = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false),
                    locale = table.Column<string>(type: "character varying(5)", maxLength: 5, nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_sessions", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "events",
                schema: "telemetry",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    session_id = table.Column<long>(type: "bigint", nullable: false),
                    received_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    source = table.Column<string>(type: "character varying(4)", maxLength: 4, nullable: false),
                    game_id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: true),
                    game_version = table.Column<string>(type: "character varying(20)", maxLength: 20, nullable: true),
                    kind = table.Column<string>(type: "character varying(6)", maxLength: 6, nullable: false),
                    name = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true),
                    fingerprint = table.Column<string>(type: "character varying(400)", maxLength: 400, nullable: true),
                    message = table.Column<string>(type: "character varying(300)", maxLength: 300, nullable: true),
                    stack = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    count = table.Column<int>(type: "integer", nullable: false),
                    value = table.Column<double>(type: "double precision", nullable: true),
                    buckets = table.Column<int[]>(type: "integer[]", nullable: true),
                    slowest_ms = table.Column<double>(type: "double precision", nullable: true),
                    step_p50ms = table.Column<double>(type: "double precision", nullable: true),
                    step_p95ms = table.Column<double>(type: "double precision", nullable: true),
                    renderer = table.Column<string>(type: "character varying(6)", maxLength: 6, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_events", x => x.id);
                    table.ForeignKey(
                        name: "fk_events_telemetry_sessions_session_id",
                        column: x => x.session_id,
                        principalSchema: "telemetry",
                        principalTable: "sessions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_daily_day_game_id",
                schema: "telemetry",
                table: "daily",
                columns: new[] { "day", "game_id" });

            migrationBuilder.CreateIndex(
                name: "ix_daily_kind_fingerprint",
                schema: "telemetry",
                table: "daily",
                columns: new[] { "kind", "fingerprint" });

            migrationBuilder.CreateIndex(
                name: "ix_events_kind_fingerprint",
                schema: "telemetry",
                table: "events",
                columns: new[] { "kind", "fingerprint" });

            migrationBuilder.CreateIndex(
                name: "ix_events_received_at",
                schema: "telemetry",
                table: "events",
                column: "received_at");

            migrationBuilder.CreateIndex(
                name: "ix_events_session_id",
                schema: "telemetry",
                table: "events",
                column: "session_id");

            migrationBuilder.CreateIndex(
                name: "ix_sessions_device_id_client_session_id",
                schema: "telemetry",
                table: "sessions",
                columns: new[] { "device_id", "client_session_id" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_sessions_last_seen_at",
                schema: "telemetry",
                table: "sessions",
                column: "last_seen_at");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "daily",
                schema: "telemetry");

            migrationBuilder.DropTable(
                name: "events",
                schema: "telemetry");

            migrationBuilder.DropTable(
                name: "rollups",
                schema: "telemetry");

            migrationBuilder.DropTable(
                name: "sessions",
                schema: "telemetry");

            migrationBuilder.DropColumn(
                name: "telemetry_enabled",
                schema: "households",
                table: "households");
        }
    }
}
