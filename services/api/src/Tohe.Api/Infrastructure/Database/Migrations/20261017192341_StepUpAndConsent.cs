using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <summary>
    /// ADR 0025: the account's manage PIN (step-up level 1) with its count of wrong tries, and the terms it accepted at
    /// 16 or older — kept on the sign-up attempt until the account exists. Accounts from before have neither; the hub
    /// asks for both.
    /// </summary>
    public partial class StepUpAndConsent : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<string>(
                name: "terms_version",
                schema: "identity",
                table: "auth_attempts",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);

            migrationBuilder.AddColumn<int>(
                name: "manage_pin_failures",
                schema: "identity",
                table: "accounts",
                type: "integer",
                nullable: false,
                defaultValue: 0);

            migrationBuilder.AddColumn<string>(
                name: "manage_pin_hash",
                schema: "identity",
                table: "accounts",
                type: "text",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "manage_pin_locked_until",
                schema: "identity",
                table: "accounts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "terms_accepted_at",
                schema: "identity",
                table: "accounts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "terms_version",
                schema: "identity",
                table: "accounts",
                type: "character varying(32)",
                maxLength: 32,
                nullable: true);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropColumn(
                name: "terms_version",
                schema: "identity",
                table: "auth_attempts");

            migrationBuilder.DropColumn(
                name: "manage_pin_failures",
                schema: "identity",
                table: "accounts");

            migrationBuilder.DropColumn(
                name: "manage_pin_hash",
                schema: "identity",
                table: "accounts");

            migrationBuilder.DropColumn(
                name: "manage_pin_locked_until",
                schema: "identity",
                table: "accounts");

            migrationBuilder.DropColumn(
                name: "terms_accepted_at",
                schema: "identity",
                table: "accounts");

            migrationBuilder.DropColumn(
                name: "terms_version",
                schema: "identity",
                table: "accounts");
        }
    }
}
