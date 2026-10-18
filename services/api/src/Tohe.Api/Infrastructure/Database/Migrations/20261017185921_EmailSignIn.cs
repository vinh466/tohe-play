using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <summary>
    /// ADR 0024: flows that wait for a code sent by email keep it in <c>identity.auth_attempts</c>, and one account signs
    /// in with any one email — accounts from before email sign-in have none yet, so the index skips them.
    /// </summary>
    public partial class EmailSignIn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropIndex(
                name: "EmailIndex",
                schema: "identity",
                table: "accounts");

            migrationBuilder.CreateTable(
                name: "auth_attempts",
                schema: "identity",
                columns: table => new
                {
                    id = table.Column<Guid>(type: "uuid", nullable: false),
                    purpose = table.Column<string>(type: "character varying(16)", maxLength: 16, nullable: false),
                    email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    normalized_email = table.Column<string>(type: "character varying(254)", maxLength: 254, nullable: false),
                    account_id = table.Column<Guid>(type: "uuid", nullable: true),
                    code_hash = table.Column<string>(type: "character(64)", fixedLength: true, maxLength: 64, nullable: true),
                    password_hash = table.Column<string>(type: "text", nullable: true),
                    display_name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: true),
                    tries_left = table.Column<int>(type: "integer", nullable: false),
                    created_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    expires_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    closed_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_auth_attempts", x => x.id);
                });

            migrationBuilder.CreateIndex(
                name: "email_index",
                schema: "identity",
                table: "accounts",
                column: "normalized_email",
                unique: true,
                filter: "normalized_email IS NOT NULL");

            migrationBuilder.CreateIndex(
                name: "ix_auth_attempts_expires_at",
                schema: "identity",
                table: "auth_attempts",
                column: "expires_at");

            migrationBuilder.CreateIndex(
                name: "ix_auth_attempts_normalized_email_created_at",
                schema: "identity",
                table: "auth_attempts",
                columns: new[] { "normalized_email", "created_at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropTable(
                name: "auth_attempts",
                schema: "identity");

            migrationBuilder.DropIndex(
                name: "email_index",
                schema: "identity",
                table: "accounts");

            migrationBuilder.CreateIndex(
                name: "EmailIndex",
                schema: "identity",
                table: "accounts",
                column: "normalized_email");
        }
    }
}
