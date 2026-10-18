using System;
using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace Tohe.Api.Infrastructure.Database.Migrations
{
    /// <summary>
    /// ADR 0023: households give way to accounts that own their profiles, and every profile gets a public ID. Written
    /// by hand around EF's scaffold so the data moves before anything is dropped — UAT holds a family's history.
    /// A household's children go to its first adult; its telemetry switch to each of its accounts; rooms, seats and
    /// results name accounts instead of households. There is no way back but the backup deploy/uat/deploy.sh takes
    /// before every deploy.
    /// </summary>
    public partial class AccountsOwnProfiles : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            // 1. The new columns, beside the old ones.
            migrationBuilder.AddColumn<bool>(
                name: "telemetry_enabled",
                schema: "identity",
                table: "accounts",
                type: "boolean",
                nullable: false,
                defaultValue: true);

            migrationBuilder.AddColumn<string>(
                name: "public_id",
                schema: "households",
                table: "profiles",
                type: "character(12)",
                fixedLength: true,
                maxLength: 12,
                nullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "name",
                schema: "households",
                table: "profiles",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(20)",
                oldMaxLength: 20);

            // An account's name names its first profile, so it follows the same rules (ProfileNames).
            migrationBuilder.AlterColumn<string>(
                name: "display_name",
                schema: "identity",
                table: "accounts",
                type: "character varying(200)",
                maxLength: 200,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character varying(40)",
                oldMaxLength: 40);

            // Unique while an account had exactly one (adult) profile; an account now owns several.
            migrationBuilder.DropIndex(
                name: "ix_profiles_account_id",
                schema: "households",
                table: "profiles");

            // 2. The data moves, in one transaction with everything else here.
            migrationBuilder.Sql(MoveData);

            // 3. The household goes.
            migrationBuilder.DropForeignKey(
                name: "fk_accounts_households_household_id",
                schema: "identity",
                table: "accounts");

            migrationBuilder.DropForeignKey(
                name: "fk_profiles_households_household_id",
                schema: "households",
                table: "profiles");

            migrationBuilder.DropIndex(
                name: "ix_accounts_household_id",
                schema: "identity",
                table: "accounts");

            migrationBuilder.DropIndex(
                name: "ix_profiles_household_id",
                schema: "households",
                table: "profiles");

            migrationBuilder.DropColumn(
                name: "household_id",
                schema: "identity",
                table: "accounts");

            migrationBuilder.DropColumn(
                name: "household_id",
                schema: "households",
                table: "profiles");

            migrationBuilder.DropTable(
                name: "households",
                schema: "households");

            migrationBuilder.RenameTable(
                name: "profiles",
                schema: "households",
                newName: "profiles",
                newSchema: "identity");

            migrationBuilder.Sql("DROP SCHEMA IF EXISTS households;");

            // The values were rewritten to accounts in step 2; only the names change here.
            migrationBuilder.RenameColumn(
                name: "household_only",
                schema: "rooms",
                table: "rooms",
                newName: "account_only");

            migrationBuilder.RenameColumn(
                name: "host_household_id",
                schema: "rooms",
                table: "rooms",
                newName: "host_account_id");

            migrationBuilder.RenameColumn(
                name: "household_id",
                schema: "rooms",
                table: "results",
                newName: "account_id");

            migrationBuilder.RenameIndex(
                name: "ix_results_household_id_game_id_at",
                schema: "rooms",
                table: "results",
                newName: "ix_results_account_id_game_id_at");

            // 4. What is true from now on.
            migrationBuilder.AlterColumn<Guid>(
                name: "account_id",
                schema: "identity",
                table: "profiles",
                type: "uuid",
                nullable: false,
                oldClrType: typeof(Guid),
                oldType: "uuid",
                oldNullable: true);

            migrationBuilder.AlterColumn<string>(
                name: "public_id",
                schema: "identity",
                table: "profiles",
                type: "character(12)",
                fixedLength: true,
                maxLength: 12,
                nullable: false,
                oldClrType: typeof(string),
                oldType: "character(12)",
                oldFixedLength: true,
                oldMaxLength: 12,
                oldNullable: true);

            migrationBuilder.CreateIndex(
                name: "ix_profiles_account_id_created_at",
                schema: "identity",
                table: "profiles",
                columns: new[] { "account_id", "created_at" });

            migrationBuilder.CreateIndex(
                name: "ix_profiles_public_id",
                schema: "identity",
                table: "profiles",
                column: "public_id",
                unique: true);

            migrationBuilder.AddForeignKey(
                name: "fk_profiles_accounts_account_id",
                schema: "identity",
                table: "profiles",
                column: "account_id",
                principalSchema: "identity",
                principalTable: "accounts",
                principalColumn: "id",
                onDelete: ReferentialAction.Cascade);
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder) =>
            throw new NotSupportedException(
                "AccountsOwnProfiles cannot be undone: households are gone. Restore the database backup taken before " +
                "the deploy (deploy/uat/deploy.sh makes one every time; see docs/guides/uat.md).");

        private const string MoveData = """
            -- Each household's first adult owns its children's profiles from now on (ADR 0023, E-01).
            CREATE TEMP TABLE tohe_household_owner ON COMMIT DROP AS
            SELECT DISTINCT ON (a.household_id) a.household_id, a.id AS account_id
            FROM identity.accounts a
            ORDER BY a.household_id, a.created_at, a.id;

            -- Telemetry was a switch of the household; each of its accounts keeps its value.
            UPDATE identity.accounts a
            SET telemetry_enabled = h.telemetry_enabled
            FROM households.households h
            WHERE h.id = a.household_id;

            -- Adults' profiles already name their account; children's go to the household's first adult.
            UPDATE households.profiles p
            SET account_id = o.account_id
            FROM tohe_household_owner o
            WHERE p.account_id IS NULL AND o.household_id = p.household_id;

            DO $$
            BEGIN
                IF EXISTS (SELECT 1 FROM households.profiles WHERE account_id IS NULL) THEN
                    RAISE EXCEPTION 'A profile has no account to belong to (a household without an adult); nothing was changed';
                END IF;
            END $$;

            -- Public IDs: 11 random digits, the first never 0, and a Damm check digit — as ProfileIds does.
            DO $$
            DECLARE
                quasigroup int[] := ARRAY[
                    0,3,1,7,5,9,8,6,4,2, 7,0,9,2,1,5,4,8,6,3, 4,2,0,6,8,7,1,3,5,9, 1,7,5,0,9,8,3,4,2,6,
                    6,1,2,3,0,4,5,9,7,8, 3,6,7,4,2,0,9,5,8,1, 5,8,6,9,7,2,0,1,3,4, 8,9,4,5,3,6,2,0,1,7,
                    9,4,3,8,6,1,7,2,0,5, 2,5,8,1,4,3,6,7,9,0];
                profile record;
                body text;
                interim int;
                i int;
                candidate text;
            BEGIN
                FOR profile IN SELECT id FROM households.profiles WHERE public_id IS NULL ORDER BY created_at, id LOOP
                    LOOP
                        body := (1 + floor(random() * 9))::int::text || lpad(floor(random() * 10000000000)::bigint::text, 10, '0');
                        interim := 0;
                        FOR i IN 1..11 LOOP
                            interim := quasigroup[interim * 10 + substr(body, i, 1)::int + 1];
                        END LOOP;
                        candidate := body || interim::text;
                        EXIT WHEN NOT EXISTS (SELECT 1 FROM households.profiles WHERE public_id = candidate);
                    END LOOP;
                    UPDATE households.profiles SET public_id = candidate WHERE id = profile.id;
                END LOOP;
            END $$;

            -- Rooms name the host's account (the column is renamed afterwards).
            UPDATE rooms.rooms r
            SET host_household_id = COALESCE(
                (SELECT p.account_id FROM households.profiles p WHERE p.id = r.host_profile_id),
                (SELECT o.account_id FROM tohe_household_owner o WHERE o.household_id = r.host_household_id),
                r.host_household_id);

            -- Results add up per account: the profile's, or the household's first adult for a profile since removed.
            UPDATE rooms.results r
            SET household_id = COALESCE(
                (SELECT p.account_id FROM households.profiles p WHERE p.id = r.profile_id),
                (SELECT o.account_id FROM tohe_household_owner o WHERE o.household_id = r.household_id))
            WHERE r.household_id IS NOT NULL;

            -- Seats are stored as JSON SeatRecords: "HouseholdId" becomes "AccountId", the seated profile's account.
            CREATE FUNCTION pg_temp.tohe_seats(seats jsonb) RETURNS jsonb LANGUAGE sql AS $f$
                SELECT COALESCE(jsonb_agg(
                    CASE WHEN seat ? 'HouseholdId'
                        THEN (seat - 'HouseholdId') || jsonb_build_object('AccountId',
                            (SELECT to_jsonb(p.account_id) FROM households.profiles p WHERE p.id::text = seat->>'ProfileId'))
                        ELSE seat
                    END ORDER BY position), '[]'::jsonb)
                FROM jsonb_array_elements(seats) WITH ORDINALITY AS t(seat, position)
            $f$;

            UPDATE rooms.rooms SET seat_list = pg_temp.tohe_seats(seat_list);
            UPDATE rooms.hands SET seats = pg_temp.tohe_seats(seats);
            """;
    }
}
