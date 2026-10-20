using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class ShareLinks : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "links");

            migrationBuilder.CreateTable(
                name: "share_links",
                schema: "links",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    code = table.Column<string>(type: "character(8)", fixedLength: true, maxLength: 8, nullable: false),
                    kind = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    game_id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    game_version = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    level = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    maker_profile_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    max_uses = table.Column<int>(type: "integer", nullable: true),
                    uses = table.Column<int>(type: "integer", nullable: false),
                    revoked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_share_links", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "share_link_days",
                schema: "links",
                columns: table => new
                {
                    link_id = table.Column<Guid>(type: "uuid", nullable: false),
                    day = table.Column<DateOnly>(type: "date", nullable: false),
                    opened = table.Column<int>(type: "integer", nullable: false),
                    played = table.Column<int>(type: "integer", nullable: false),
                    accounts_made = table.Column<int>(type: "integer", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_share_link_days", x => new { x.link_id, x.day });
                    table.ForeignKey(
                        name: "fk_share_link_days_share_links_link_id",
                        column: x => x.link_id,
                        principalSchema: "links",
                        principalTable: "share_links",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_rooms_code_closed_at",
                schema: "rooms",
                table: "rooms",
                columns: new[] { "code", "closed_at" },
                filter: "closed_at IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_share_links_code",
                schema: "links",
                table: "share_links",
                column: "code",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_share_links_maker_profile_id_created_at",
                schema: "links",
                table: "share_links",
                columns: new[] { "maker_profile_id", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "share_link_days",
                schema: "links");

            migrationBuilder.DropTable(
                name: "share_links",
                schema: "links");

            migrationBuilder.DropIndex(
                name: "ix_rooms_code_closed_at",
                schema: "rooms",
                table: "rooms");
        }
    }
}
