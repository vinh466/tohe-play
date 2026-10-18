using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <summary>
    /// ADR 0034: accounts wait to be deleted, deleted profiles' public IDs are retired for good, and the append-only
    /// tables get their one way out each — a result's decisions go with it in a profile's purge, audit entries past a
    /// year in the retention job — both only in a transaction that says so (<c>tohe.purge</c>).
    /// </summary>
    public partial class AccountDeletion : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.DropForeignKey(
                name: "fk_decisions_integrity_results_result_id",
                schema: "integrity",
                table: "decisions");

            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "delete_after",
                schema: "identity",
                table: "accounts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.CreateTable(
                name: "retired_profile_ids",
                schema: "identity",
                columns: table => new
                {
                    public_id = table.Column<string>(type: "character(12)", fixedLength: true, maxLength: 12, nullable: false),
                    retired_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_retired_profile_ids", x => x.public_id);
                });

            migrationBuilder.CreateIndex(
                name: "ix_accounts_delete_after",
                schema: "identity",
                table: "accounts",
                column: "delete_after",
                filter: "delete_after IS NOT NULL");

            migrationBuilder.AddForeignKey(
                name: "fk_decisions_integrity_results_result_id",
                schema: "integrity",
                table: "decisions",
                column: "result_id",
                principalSchema: "integrity",
                principalTable: "results",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);

            // A decision goes only with its result (the foreign key cascades), and only in a profile's purge. Nested
            // IFs: a statement-level TRUNCATE has no OLD to read.
            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION integrity.decisions_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    IF TG_OP = 'DELETE' THEN
                        IF current_setting('tohe.purge', true) = 'profiles'
                           AND NOT EXISTS (SELECT 1 FROM integrity.results r WHERE r.id = OLD.result_id) THEN
                            RETURN OLD;
                        END IF;
                    END IF;
                    RAISE EXCEPTION 'integrity.decisions is append-only';
                END
                $$;
                CREATE OR REPLACE FUNCTION admin.audit_log_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    IF TG_OP = 'DELETE' THEN
                        IF current_setting('tohe.purge', true) = 'audit' AND OLD.at < now() - interval '365 days' THEN
                            RETURN OLD;
                        END IF;
                    END IF;
                    RAISE EXCEPTION 'admin.audit_log is append-only';
                END
                $$;
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                CREATE OR REPLACE FUNCTION integrity.decisions_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    RAISE EXCEPTION 'integrity.decisions is append-only';
                END
                $$;
                CREATE OR REPLACE FUNCTION admin.audit_log_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    RAISE EXCEPTION 'admin.audit_log is append-only';
                END
                $$;
                """);

            migrationBuilder.DropForeignKey(
                name: "fk_decisions_integrity_results_result_id",
                schema: "integrity",
                table: "decisions");

            migrationBuilder.DropTable(
                name: "retired_profile_ids",
                schema: "identity");

            migrationBuilder.DropIndex(
                name: "ix_accounts_delete_after",
                schema: "identity",
                table: "accounts");

            migrationBuilder.DropColumn(
                name: "delete_after",
                schema: "identity",
                table: "accounts");

            migrationBuilder.AddForeignKey(
                name: "fk_decisions_integrity_results_result_id",
                schema: "integrity",
                table: "decisions",
                column: "result_id",
                principalSchema: "integrity",
                principalTable: "results",
                principalColumn: "id",
                onDelete: ReferentialAction.Restrict);
        }
    }
}
