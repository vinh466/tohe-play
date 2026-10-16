using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class Rooms : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "rooms");

            migrationBuilder.AddColumn<bool>(
                name: "play_with_others",
                schema: "households",
                table: "profiles",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "rooms",
                schema: "registry",
                table: "games",
                type: "jsonb",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "rooms",
                schema: "rooms",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character(6)", fixedLength: true, maxLength: 6, nullable: false),
                    game_id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    game_version = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    rules_path = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    host_profile_id = table.Column<Guid>(type: "uuid", nullable: false),
                    host_household_id = table.Column<Guid>(type: "uuid", nullable: false),
                    is_public = table.Column<bool>(type: "boolean", nullable: false),
                    household_only = table.Column<bool>(type: "boolean", nullable: false),
                    locked = table.Column<bool>(type: "boolean", nullable: false),
                    seats = table.Column<int>(type: "integer", nullable: false),
                    bots_fill = table.Column<bool>(type: "boolean", nullable: false),
                    bot_level = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: true),
                    bots_take_over = table.Column<bool>(type: "boolean", nullable: false),
                    turn_seconds = table.Column<int>(type: "integer", nullable: false),
                    options = table.Column<string>(type: "jsonb", nullable: false),
                    seat_list = table.Column<string>(type: "jsonb", nullable: false),
                    status = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    hand = table.Column<int>(type: "integer", nullable: false),
                    seed = table.Column<int>(type: "integer", nullable: false),
                    hand_seats = table.Column<string>(type: "jsonb", nullable: false),
                    carry = table.Column<string>(type: "jsonb", nullable: true),
                    hand_carry = table.Column<string>(type: "jsonb", nullable: true),
                    scores = table.Column<string>(type: "jsonb", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    closed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_rooms", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "actions",
                schema: "rooms",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    room_id = table.Column<Guid>(type: "uuid", nullable: false),
                    hand = table.Column<int>(type: "integer", nullable: false),
                    seat = table.Column<int>(type: "integer", nullable: false),
                    action = table.Column<string>(type: "jsonb", nullable: false),
                    at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_actions", x => x.id);
                    table.ForeignKey(
                        name: "fk_actions_rooms_room_id",
                        column: x => x.room_id,
                        principalSchema: "rooms",
                        principalTable: "rooms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_actions_room_id_hand_id",
                schema: "rooms",
                table: "actions",
                columns: new[] { "room_id", "hand", "id" });

            migrationBuilder.CreateIndex(
                name: "ix_rooms_code",
                schema: "rooms",
                table: "rooms",
                column: "code",
                unique: true,
                filter: "closed_at IS NULL");

            migrationBuilder.CreateIndex(
                name: "ix_rooms_game_id_status",
                schema: "rooms",
                table: "rooms",
                columns: new[] { "game_id", "status" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "actions",
                schema: "rooms");

            migrationBuilder.DropTable(
                name: "rooms",
                schema: "rooms");

            migrationBuilder.DropColumn(
                name: "play_with_others",
                schema: "households",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "rooms",
                schema: "registry",
                table: "games");
        }
    }
}
