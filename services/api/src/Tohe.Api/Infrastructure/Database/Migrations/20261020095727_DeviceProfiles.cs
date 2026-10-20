using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <inheritdoc />
    public partial class DeviceProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<bool>(
                name: "device_earned",
                schema: "progress",
                table: "scores",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "profile_id",
                schema: "identity",
                table: "retired_profile_ids",
                type: "uuid",
                nullable: true);

            migrationBuilder.AddColumn<bool>(
                name: "device_earned",
                schema: "integrity",
                table: "results",
                type: "boolean",
                nullable: false,
                defaultValue: false);

            migrationBuilder.AddColumn<Guid>(
                name: "device_profile_id",
                schema: "identity",
                table: "auth_attempts",
                type: "uuid",
                nullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_retired_profile_ids_profile_id",
                schema: "identity",
                table: "retired_profile_ids",
                column: "profile_id",
                unique: true);

            // A run earned by a device profile stays one (ADR 0043): nothing clears the mark, so no later change puts it
            // on a public board.
            migrationBuilder.Sql("""
                CREATE FUNCTION integrity.device_earned_stays() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    IF OLD.device_earned AND NOT NEW.device_earned THEN
                        RAISE EXCEPTION 'device_earned is never cleared (ADR 0043)';
                    END IF;
                    RETURN NEW;
                END
                $$;
                CREATE TRIGGER results_device_earned_stays BEFORE UPDATE OF device_earned ON integrity.results
                    FOR EACH ROW EXECUTE FUNCTION integrity.device_earned_stays();
                CREATE FUNCTION progress.device_earned_stays() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    IF OLD.device_earned AND NOT NEW.device_earned THEN
                        RAISE EXCEPTION 'device_earned is never cleared (ADR 0043)';
                    END IF;
                    RETURN NEW;
                END
                $$;
                CREATE TRIGGER scores_device_earned_stays BEFORE UPDATE OF device_earned ON progress.scores
                    FOR EACH ROW EXECUTE FUNCTION progress.device_earned_stays();
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TRIGGER scores_device_earned_stays ON progress.scores;
                DROP FUNCTION progress.device_earned_stays();
                DROP TRIGGER results_device_earned_stays ON integrity.results;
                DROP FUNCTION integrity.device_earned_stays();
                """);

            migrationBuilder.DropIndex(
                name: "ix_retired_profile_ids_profile_id",
                schema: "identity",
                table: "retired_profile_ids");

            migrationBuilder.DropColumn(
                name: "device_earned",
                schema: "progress",
                table: "scores");

            migrationBuilder.DropColumn(
                name: "profile_id",
                schema: "identity",
                table: "retired_profile_ids");

            migrationBuilder.DropColumn(
                name: "device_earned",
                schema: "integrity",
                table: "results");

            migrationBuilder.DropColumn(
                name: "device_profile_id",
                schema: "identity",
                table: "auth_attempts");
        }
    }
}
