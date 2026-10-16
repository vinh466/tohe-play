using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class RoomHistoryAndSpectators : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "allow_spectators",
                schema: "rooms",
                table: "rooms",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.CreateTable(
                name: "hands",
                schema: "rooms",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    room_id = table.Column<Guid>(type: "uuid", nullable: false),
                    game_id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    game_version = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    hand = table.Column<int>(type: "integer", nullable: false),
                    seed = table.Column<int>(type: "integer", nullable: false),
                    options = table.Column<string>(type: "jsonb", nullable: false),
                    carry = table.Column<string>(type: "jsonb", nullable: true),
                    seats = table.Column<string>(type: "jsonb", nullable: false),
                    result = table.Column<string>(type: "jsonb", nullable: false),
                    finished_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_hands", x => x.id);
                    table.ForeignKey(
                        name: "fk_hands_rooms_room_id",
                        column: x => x.room_id,
                        principalSchema: "rooms",
                        principalTable: "rooms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "results",
                schema: "rooms",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    room_id = table.Column<Guid>(type: "uuid", nullable: false),
                    game_id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    hand = table.Column<int>(type: "integer", nullable: false),
                    seat = table.Column<int>(type: "integer", nullable: false),
                    profile_id = table.Column<Guid>(type: "uuid", nullable: true),
                    household_id = table.Column<Guid>(type: "uuid", nullable: true),
                    place = table.Column<int>(type: "integer", nullable: false),
                    points = table.Column<int>(type: "integer", nullable: false),
                    at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_results", x => x.id);
                    table.ForeignKey(
                        name: "fk_results_rooms_room_id",
                        column: x => x.room_id,
                        principalSchema: "rooms",
                        principalTable: "rooms",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_hands_room_id_hand",
                schema: "rooms",
                table: "hands",
                columns: new[] { "room_id", "hand" },
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_results_household_id_game_id_at",
                schema: "rooms",
                table: "results",
                columns: new[] { "household_id", "game_id", "at" });

            migrationBuilder.CreateIndex(
                name: "ix_results_profile_id_game_id_at",
                schema: "rooms",
                table: "results",
                columns: new[] { "profile_id", "game_id", "at" });

            migrationBuilder.CreateIndex(
                name: "ix_results_room_id",
                schema: "rooms",
                table: "results",
                column: "room_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "hands",
                schema: "rooms");

            migrationBuilder.DropTable(
                name: "results",
                schema: "rooms");

            migrationBuilder.DropColumn(
                name: "allow_spectators",
                schema: "rooms",
                table: "rooms");
        }
    }
}
