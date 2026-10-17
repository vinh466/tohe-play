using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <summary>
    /// ADR 0026: a sign-in back from a provider waits in an attempt with the provider's subject until its owner proves an
    /// address, links an account, or finishes signing up. The links themselves are Identity's `account_logins`.
    /// </summary>
    public partial class ExternalSignIn : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "email_proven",
                schema: "identity",
                table: "auth_attempts",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<string>(
                name: "provider",
                schema: "identity",
                table: "auth_attempts",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "provider_key",
                schema: "identity",
                table: "auth_attempts",
                type: "character varying(256)",
                maxLength: 256,
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "provider_name",
                schema: "identity",
                table: "auth_attempts",
                type: "character varying(64)",
                maxLength: 64,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "email_proven",
                schema: "identity",
                table: "auth_attempts");

            migrationBuilder.DropColumn(
                name: "provider",
                schema: "identity",
                table: "auth_attempts");

            migrationBuilder.DropColumn(
                name: "provider_key",
                schema: "identity",
                table: "auth_attempts");

            migrationBuilder.DropColumn(
                name: "provider_name",
                schema: "identity",
                table: "auth_attempts");
        }
    }
}
