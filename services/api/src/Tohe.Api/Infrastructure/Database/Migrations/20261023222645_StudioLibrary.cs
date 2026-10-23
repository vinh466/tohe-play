using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class StudioLibrary : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.CreateTable(
                name: "audit",
                schema: "studio",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    action = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    agent_id = table.Column<Guid>(type: "uuid", nullable: true),
                    account_id = table.Column<Guid>(type: "uuid", nullable: true),
                    target = table.Column<string>(type: "character varying(120)", maxLength: 120, nullable: false),
                    version_id = table.Column<Guid>(type: "uuid", nullable: true),
                    details = table.Column<string>(type: "jsonb", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_studio_audit", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "styles",
                schema: "studio",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    name = table.Column<string>(type: "character varying(80)", maxLength: 80, nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    tile_size = table.Column<int>(type: "integer", nullable: true),
                    view = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    palette = table.Column<string[]>(type: "text[]", nullable: true),
                    outline = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_by_agent = table.Column<Guid>(type: "uuid", nullable: true),
                    created_by_account = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_styles", x => x.id);
                    table.CheckConstraint("ck_styles_creator", "(created_by_agent IS NULL) <> (created_by_account IS NULL)");
                    table.CheckConstraint("ck_styles_status", "status IN ('draft', 'approved')");
                    table.CheckConstraint("ck_styles_view", "view IN ('top-down', 'side', 'isometric', 'other')");
                });

            migrationBuilder.CreateTable(
                name: "packs",
                schema: "studio",
                columns: table => new
                {
                    id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    style_id = table.Column<string>(type: "character varying(40)", nullable: false),
                    description = table.Column<string>(type: "character varying(500)", maxLength: 500, nullable: true),
                    created_by_agent = table.Column<Guid>(type: "uuid", nullable: true),
                    created_by_account = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_packs", x => x.id);
                    table.CheckConstraint("ck_packs_creator", "(created_by_agent IS NULL) <> (created_by_account IS NULL)");
                    table.ForeignKey(
                        name: "fk_packs_studio_styles_style_id",
                        column: x => x.style_id,
                        principalSchema: "studio",
                        principalTable: "styles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateTable(
                name: "style_samples",
                schema: "studio",
                columns: table => new
                {
                    style_id = table.Column<string>(type: "character varying(40)", nullable: false),
                    sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ext = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    bytes = table.Column<long>(type: "bigint", nullable: false),
                    uploaded_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_style_samples", x => new { x.style_id, x.sha256 });
                    table.ForeignKey(
                        name: "fk_style_samples_styles_style_id",
                        column: x => x.style_id,
                        principalSchema: "studio",
                        principalTable: "styles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "pack_versions",
                schema: "studio",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    pack_id = table.Column<string>(type: "character varying(40)", maxLength: 40, nullable: false),
                    version = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    status = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    created_by_agent = table.Column<Guid>(type: "uuid", nullable: true),
                    created_by_account = table.Column<Guid>(type: "uuid", nullable: true),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    submitted_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    reviewed_by = table.Column<Guid>(type: "uuid", nullable: true),
                    reviewed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    deprecated_by = table.Column<Guid>(type: "uuid", nullable: true),
                    deprecated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    withdrawn_by = table.Column<Guid>(type: "uuid", nullable: true),
                    withdrawn_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    withdraw_reason = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    manifest_sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_pack_versions", x => x.id);
                    table.CheckConstraint("ck_pack_versions_creator", "(created_by_agent IS NULL) <> (created_by_account IS NULL)");
                    table.CheckConstraint("ck_pack_versions_status", "status IN ('draft', 'submitted', 'approved', 'rejected', 'deprecated', 'withdrawn')");
                    table.ForeignKey(
                        name: "fk_pack_versions_packs_pack_id",
                        column: x => x.pack_id,
                        principalSchema: "studio",
                        principalTable: "packs",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateTable(
                name: "assets",
                schema: "studio",
                columns: table => new
                {
                    version_id = table.Column<Guid>(type: "uuid", nullable: false),
                    asset_id = table.Column<string>(type: "character varying(100)", maxLength: 100, nullable: false),
                    kind = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    sha256 = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    ext = table.Column<string>(type: "character varying(8)", maxLength: 8, nullable: false),
                    bytes = table.Column<long>(type: "bigint", nullable: false),
                    width = table.Column<int>(type: "integer", nullable: true),
                    height = table.Column<int>(type: "integer", nullable: true),
                    frames = table.Column<string>(type: "jsonb", nullable: true),
                    tags = table.Column<string[]>(type: "text[]", nullable: false),
                    licence = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    attribution = table.Column<string>(type: "character varying(1000)", maxLength: 1000, nullable: true),
                    source = table.Column<string>(type: "jsonb", nullable: false),
                    uploaded_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_assets", x => new { x.version_id, x.asset_id });
                    table.CheckConstraint("ck_assets_kind", "kind IN ('image', 'spritesheet', 'tileset', 'audio', 'font', 'palette')");
                    table.ForeignKey(
                        name: "fk_assets_studio_pack_versions_version_id",
                        column: x => x.version_id,
                        principalSchema: "studio",
                        principalTable: "pack_versions",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.CreateIndex(
                name: "ix_assets_sha256",
                schema: "studio",
                table: "assets",
                column: "sha256");

            migrationBuilder.CreateIndex(
                name: "ix_audit_at",
                schema: "studio",
                table: "audit",
                column: "at");

            migrationBuilder.CreateIndex(
                name: "ix_audit_version_id",
                schema: "studio",
                table: "audit",
                column: "version_id");

            migrationBuilder.CreateIndex(
                name: "ix_pack_versions_created_by_account",
                schema: "studio",
                table: "pack_versions",
                column: "created_by_account");

            migrationBuilder.CreateIndex(
                name: "ix_pack_versions_created_by_agent",
                schema: "studio",
                table: "pack_versions",
                column: "created_by_agent");

            migrationBuilder.CreateIndex(
                name: "ix_pack_versions_pack_id_version",
                schema: "studio",
                table: "pack_versions",
                columns: new[] { "pack_id", "version" },
                unique: true,
                filter: "status IN ('approved', 'deprecated', 'withdrawn')");

            migrationBuilder.CreateIndex(
                name: "ix_pack_versions_status_created_at",
                schema: "studio",
                table: "pack_versions",
                columns: new[] { "status", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_packs_style_id",
                schema: "studio",
                table: "packs",
                column: "style_id");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "assets",
                schema: "studio");

            migrationBuilder.DropTable(
                name: "audit",
                schema: "studio");

            migrationBuilder.DropTable(
                name: "style_samples",
                schema: "studio");

            migrationBuilder.DropTable(
                name: "pack_versions",
                schema: "studio");

            migrationBuilder.DropTable(
                name: "packs",
                schema: "studio");

            migrationBuilder.DropTable(
                name: "styles",
                schema: "studio");
        }
    }
}
