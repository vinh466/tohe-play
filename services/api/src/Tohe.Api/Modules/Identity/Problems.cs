using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;

namespace Tohe.Api.Modules.Identity;

/// <summary>
/// Problem responses carry a machine-readable <c>code</c> the hub turns into a Vietnamese message; validation errors
/// carry codes instead of sentences for the same reason.
/// </summary>
internal static class Problems
{
    public static ProblemHttpResult Of(int status, string code, string title) =>
        TypedResults.Problem(
            title: title,
            statusCode: status,
            extensions: new Dictionary<string, object?> { ["code"] = code });

    public static ProblemHttpResult InvalidCredentials() =>
        Of(StatusCodes.Status401Unauthorized, "invalid_credentials", "Wrong email or password");

    /// <summary>Email is off on this server (<c>Email:Mode=Disabled</c>), so nothing that needs a code can start.</summary>
    public static ProblemHttpResult EmailUnavailable() =>
        Of(StatusCodes.Status503ServiceUnavailable, "email_unavailable", "This server does not send email");

    /// <summary><c>code_cooldown</c> (a minute between codes) or <c>too_many_codes</c> (five an hour) for one address.</summary>
    public static ProblemHttpResult TooManyCodes(string code) =>
        Of(StatusCodes.Status429TooManyRequests, code, "Too many codes for this address; wait a little");

    public static ProblemHttpResult CodeInvalid(int triesLeft) =>
        TypedResults.Problem(
            title: "Wrong code",
            statusCode: StatusCodes.Status400BadRequest,
            extensions: new Dictionary<string, object?> { ["code"] = "code_invalid", ["triesLeft"] = triesLeft });

    /// <summary>Expired, used, out of tries, replaced by a newer code — or its email was taken meanwhile: start again.</summary>
    public static ProblemHttpResult AttemptClosed() =>
        Of(StatusCodes.Status400BadRequest, "attempt_closed", "This code no longer works; ask for a new one");

    /// <summary>The admin console turned this sign-in method off (ADR 0028).</summary>
    public static ProblemHttpResult MethodDisabled() =>
        Of(StatusCodes.Status403Forbidden, "method_disabled", "This way of signing in is off");

    /// <summary>
    /// Nobody new may sign up now (ADR 0028). The other refusals of <c>Invites</c> — <c>invite_required</c>,
    /// <c>invite_invalid</c> — go on the invite code's field.
    /// </summary>
    public static ProblemHttpResult RegistrationClosed() =>
        Of(StatusCodes.Status403Forbidden, "registration_closed", "Nobody new may sign up now");

    /// <summary>Suspended from the admin console; said only to someone who proved the account is theirs.</summary>
    public static ProblemHttpResult AccountSuspended() =>
        Of(StatusCodes.Status403Forbidden, "account_suspended", "This account is suspended");

    /// <summary>
    /// The session ended since this device last asked — its account asked to be deleted (ADR 0034): sign in again,
    /// which keeps the account.
    /// </summary>
    public static ProblemHttpResult SessionEnded() =>
        Of(StatusCodes.Status401Unauthorized, "session_ended", "This session has ended; sign in again");

    public static ProblemHttpResult LockedOut() =>
        Of(StatusCodes.Status429TooManyRequests, "locked_out", "Too many wrong attempts; try again in a few minutes");

    public static ProblemHttpResult ParentGateRequired() =>
        Of(StatusCodes.Status403Forbidden, "parent_gate_required", "Enter the manage PIN to manage the account's profiles");

    /// <summary>Account security changes need step-up level 2 on this device: the password, or a code by email.</summary>
    public static ProblemHttpResult StepUpRequired() =>
        Of(StatusCodes.Status403Forbidden, "step_up_required", "Prove it is the account's owner first");

    public static ValidationProblem Field(string field, string code) =>
        TypedResults.ValidationProblem(new Dictionary<string, string[]> { [field] = [code] });

    public static ValidationProblem FromIdentity(IEnumerable<IdentityError> errors)
    {
        var fields = new Dictionary<string, string[]>();
        foreach (var error in errors)
        {
            var (field, code) = error.Code switch
            {
                nameof(IdentityErrorDescriber.DuplicateUserName) => ("username", "username_taken"),
                nameof(IdentityErrorDescriber.InvalidUserName) => ("username", "username_invalid"),
                nameof(IdentityErrorDescriber.PasswordTooShort) => ("password", "password_too_short"),
                _ => ("", error.Code),
            };
            fields[field] = [.. fields.GetValueOrDefault(field, []), code];
        }

        return TypedResults.ValidationProblem(fields);
    }
}
