using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <summary>
    /// ADR 0027, the console's users: an account can be suspended, and every profile keeps the names it had (D-17) — a
    /// trigger writes one on each new profile and each rename, whoever makes it; today's names start the history.
    /// </summary>
    public partial class AccountModeration : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.AddColumn<DateTimeOffset>(
                name: "suspended_at",
                schema: "identity",
                table: "accounts",
                type: "timestamp with time zone",
                nullable: true);

            migrationBuilder.AddColumn<string>(
                name: "suspended_reason",
                schema: "identity",
                table: "accounts",
                type: "character varying(300)",
                maxLength: 300,
                nullable: true);

            migrationBuilder.CreateTable(
                name: "profile_names",
                schema: "identity",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    profile_id = table.Column<Guid>(type: "uuid", nullable: false),
                    name = table.Column<string>(type: "character varying(200)", maxLength: 200, nullable: false),
                    at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_profile_names", x => x.id);
                    table.ForeignKey(
                        name: "fk_profile_names_profiles_profile_id",
                        column: x => x.profile_id,
                        principalSchema: "identity",
                        principalTable: "profiles",
                        principalColumn: "id",
                        onDelete: ReferentialAction.Cascade);
                });

            migrationBuilder.Sql("""
                CREATE FUNCTION identity.profile_name_history() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    IF TG_OP = 'INSERT' THEN
                        INSERT INTO identity.profile_names (profile_id, name, at) VALUES (NEW.id, NEW.name, now());
                    ELSIF NEW.name IS DISTINCT FROM OLD.name THEN
                        INSERT INTO identity.profile_names (profile_id, name, at) VALUES (NEW.id, NEW.name, now());
                    END IF;
                    RETURN NEW;
                END
                $$;
                CREATE TRIGGER profiles_name_history AFTER INSERT OR UPDATE OF name ON identity.profiles
                    FOR EACH ROW EXECUTE FUNCTION identity.profile_name_history();
                INSERT INTO identity.profile_names (profile_id, name, at) SELECT id, name, created_at FROM identity.profiles;
                """);

            migrationBuilder.CreateIndex(
                name: "ix_profile_names_profile_id_at",
                schema: "identity",
                table: "profile_names",
                columns: new[] { "profile_id", "at" });
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TRIGGER profiles_name_history ON identity.profiles;
                DROP FUNCTION identity.profile_name_history();
                """);

            migrationBuilder.DropTable(
                name: "profile_names",
                schema: "identity");

            migrationBuilder.DropColumn(
                name: "suspended_at",
                schema: "identity",
                table: "accounts");

            migrationBuilder.DropColumn(
                name: "suspended_reason",
                schema: "identity",
                table: "accounts");
        }
    }
}
