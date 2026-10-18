using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <summary>
    /// ADR 0028: communities and their invite codes; an account remembers the community and the code it came with, and a
    /// sign-up attempt carries the code until its account is made. The switches themselves live in admin.settings.
    /// </summary>
    public partial class CommunitiesAndInviteCodes : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "invite_code",
                schema: "identity",
                table: "auth_attempts",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<Guid>(
                name: "community_id",
                schema: "identity",
                table: "accounts",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "invite_code",
                schema: "identity",
                table: "accounts",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "communities",
                schema: "identity",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_communities", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "invite_codes",
                schema: "identity",
                columns: table => new
                {
                    code = table.Column<string>(type: "character varying(32)", maxLength: 32, nullable: false),
                    community_id = table.Column<Guid>(type: "uuid", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true),
                    max_uses = table.Column<int>(type: "integer", nullable: true),
                    uses = table.Column<int>(type: "integer", nullable: false),
                    revoked_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_invite_codes", x => x.code);
                    table.ForeignKey(
                        name: "fk_invite_codes_communities_community_id",
                        column: x => x.community_id,
                        principalSchema: "identity",
                        principalTable: "communities",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Restrict);
                });

            migrationBuilder.CreateIndex(
                name: "ix_accounts_community_id",
                schema: "identity",
                table: "accounts",
                column: "community_id");

            migrationBuilder.CreateIndex(
                name: "ix_communities_name",
                schema: "identity",
                table: "communities",
                column: "name",
                unique: true);

            migrationBuilder.CreateIndex(
                name: "ix_invite_codes_community_id",
                schema: "identity",
                table: "invite_codes",
                column: "community_id");

            migrationBuilder.AddForeignKey(
                name: "fk_accounts_communities_community_id",
                schema: "identity",
                table: "accounts",
                column: "community_id",
                principalSchema: "identity",
                principalTable: "communities",
                principalColumn: "id",
                onDelete: ReferentialAction.SetNull);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_accounts_communities_community_id",
                schema: "identity",
                table: "accounts");

            migrationBuilder.DropTable(
                name: "invite_codes",
                schema: "identity");

            migrationBuilder.DropTable(
                name: "communities",
                schema: "identity");

            migrationBuilder.DropIndex(
                name: "ix_accounts_community_id",
                schema: "identity",
                table: "accounts");

            migrationBuilder.DropColumn(
                name: "invite_code",
                schema: "identity",
                table: "auth_attempts");

            migrationBuilder.DropColumn(
                name: "community_id",
                schema: "identity",
                table: "accounts");

            migrationBuilder.DropColumn(
                name: "invite_code",
                schema: "identity",
                table: "accounts");
        }
    }
}
