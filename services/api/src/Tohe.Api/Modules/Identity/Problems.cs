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
        Of(StatusCodes.Status401Unauthorized, "invalid_credentials", "Wrong username or password");

    public static ProblemHttpResult LockedOut() =>
        Of(StatusCodes.Status429TooManyRequests, "locked_out", "Too many wrong attempts; try again in a few minutes");

    public static ProblemHttpResult ParentGateRequired() =>
        Of(StatusCodes.Status403Forbidden, "parent_gate_required", "Re-enter the password to manage the account's profiles");

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
