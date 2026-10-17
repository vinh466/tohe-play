using System;
using Microsoft.EntityFrameworkCore.Migrations;
using Npgsql.EntityFrameworkCore.PostgreSQL.Metadata;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <summary>
    /// ADR 0027: the admin module's settings (setup's end first) and its audit log, which a trigger keeps append-only —
    /// no update, delete or truncate. A deployment that already has an owner (granted by the command) has finished
    /// setup, so losing every owner later never opens it again.
    /// </summary>
    public partial class AdminSecurity : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.EnsureSchema(
                name: "admin");

            migrationBuilder.CreateTable(
                name: "audit_log",
                schema: "admin",
                columns: table => new
                {
                    id = table.Column<long>(type: "bigint", nullable: false)
                        .Annotation("Npgsql:ValueGenerationStrategy", NpgsqlValueGenerationStrategy.IdentityByDefaultColumn),
                    at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false),
                    actor_id = table.Column<Guid>(type: "uuid", nullable: true),
                    actor = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: false),
                    action = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    target = table.Column<string>(type: "character varying(320)", maxLength: 320, nullable: true),
                    details = table.Column<string>(type: "jsonb", nullable: true),
                    address = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: true)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_audit_log", x => x.id);
                });

            migrationBuilder.CreateTable(
                name: "settings",
                schema: "admin",
                columns: table => new
                {
                    key = table.Column<string>(type: "character varying(64)", maxLength: 64, nullable: false),
                    value = table.Column<string>(type: "character varying(4000)", maxLength: 4000, nullable: false),
                    updated_at = table.Column<DateTimeOffset>(type: "timestamp with time zone", nullable: false)
                },
                constraints: table =>
                {
                    table.PrimaryKey("pk_settings", x => x.key);
                });

            migrationBuilder.CreateIndex(
                name: "ix_audit_log_at",
                schema: "admin",
                table: "audit_log",
                column: "at");

            migrationBuilder.Sql("""
                CREATE FUNCTION admin.audit_log_append_only() RETURNS trigger LANGUAGE plpgsql AS $$
                BEGIN
                    RAISE EXCEPTION 'admin.audit_log is append-only';
                END
                $$;
                CREATE TRIGGER audit_log_no_change BEFORE UPDATE OR DELETE ON admin.audit_log
                    FOR EACH ROW EXECUTE FUNCTION admin.audit_log_append_only();
                CREATE TRIGGER audit_log_no_truncate BEFORE TRUNCATE ON admin.audit_log
                    FOR EACH STATEMENT EXECUTE FUNCTION admin.audit_log_append_only();
                INSERT INTO admin.settings (key, value, updated_at)
                    SELECT 'setup.completed_at', to_char(now() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS"Z"'), now()
                    WHERE EXISTS (
                        SELECT 1 FROM identity.account_claims WHERE claim_type = 'tohe:role' AND claim_value = 'owner');
                """);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.Sql("""
                DROP TRIGGER audit_log_no_truncate ON admin.audit_log;
                DROP TRIGGER audit_log_no_change ON admin.audit_log;
                DROP FUNCTION admin.audit_log_append_only();
                """);

            migrationBuilder.DropTable(
                name: "audit_log",
                schema: "admin");

            migrationBuilder.DropTable(
                name: "settings",
                schema: "admin");
        }
    }
}
