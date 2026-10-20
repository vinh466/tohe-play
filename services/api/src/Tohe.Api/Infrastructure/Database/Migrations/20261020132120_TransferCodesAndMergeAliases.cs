using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class TransferCodesAndMergeAliases : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "profile_aliases",
                schema: "identity",
                columns: table => new
                {
                    old_id = table.Column<Guid>(type: "uuid", nullable: false),
                    profile_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_profile_aliases", x => x.old_id);
                    table.ForeignKey(
                        name: "fk_profile_aliases_profiles_profile_id",
                        column: x => x.profile_id,
                        principalSchema: "identity",
                        principalTable: "profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "profile_moves",
                schema: "identity",
                columns: table => new
                {
                    device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    profile_id = table.Column<Guid>(type: "uuid", nullable: false),
                    moved_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_profile_moves", x => new { x.device_id, x.profile_id });
                    table.ForeignKey(
                        name: "fk_profile_moves_devices_device_id",
                        column: x => x.device_id,
                        principalSchema: "identity",
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "profile_transfers",
                schema: "identity",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    profile_id = table.Column<Guid>(type: "uuid", nullable: false),
                    from_device_id = table.Column<Guid>(type: "uuid", nullable: false),
                    to_device_id = table.Column<Guid>(type: "uuid", nullable: true),
                    code_hash = table.Column<string>(type: "character(64)", fixedLength: true, maxLength: 64, nullable: true),
                    secret_hash = table.Column<byte[]>(type: "bytea", maxLength: 32, nullable: false),
                    data = table.Column<string>(type: "jsonb", nullable: false),
                    state = table.Column<string>(type: "character varying(10)", maxLength: 10, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    done_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_profile_transfers", x => x.id);
                    table.ForeignKey(
                        name: "fk_profile_transfers_devices_from_device_id",
                        column: x => x.from_device_id,
                        principalSchema: "identity",
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_profile_transfers_devices_to_device_id",
                        column: x => x.to_device_id,
                        principalSchema: "identity",
                        principalTable: "devices",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                    table.ForeignKey(
                        name: "fk_profile_transfers_profiles_profile_id",
                        column: x => x.profile_id,
                        principalSchema: "identity",
                        principalTable: "profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_profile_aliases_profile_id",
                schema: "identity",
                table: "profile_aliases",
                column: "profile_id");

            migrationBuilder.CreateIndex(
                name: "ix_profile_moves_moved_at",
                schema: "identity",
                table: "profile_moves",
                column: "moved_at");

            migrationBuilder.CreateIndex(
                name: "ix_profile_transfers_expires_at",
                schema: "identity",
                table: "profile_transfers",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "ix_profile_transfers_from_device_id",
                schema: "identity",
                table: "profile_transfers",
                column: "from_device_id");

            migrationBuilder.CreateIndex(
                name: "ix_profile_transfers_profile_id",
                schema: "identity",
                table: "profile_transfers",
                column: "profile_id",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_profile_transfers_secret_hash",
                schema: "identity",
                table: "profile_transfers",
                column: "secret_hash",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_profile_transfers_to_device_id",
                schema: "identity",
                table: "profile_transfers",
                column: "to_device_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "profile_aliases",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "profile_moves",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "profile_transfers",
                schema: "identity");
        }
    }
}
