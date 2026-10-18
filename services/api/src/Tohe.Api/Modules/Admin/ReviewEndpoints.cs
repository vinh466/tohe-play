using Microsoft.AspNetCore.Http.HttpResults;
using Microsoft.AspNetCore.Identity;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Identity;
using Tohe.Api.Modules.Integrity;

namespace Tohe.Api.Modules.Admin;

/// <summary>A result in a list of the review, with whose it is.</summary>
/// <param name="Player">Null when the profile is gone.</param>
public sealed record ReviewEntry(ReviewSummary Result, ProfileCard? Player);

/// <param name="Held">How many results wait for a person, all pages together.</param>
/// <param name="Next">Pass it back for the next page; null on the last.</param>
public sealed record ReviewPage(int Held, IReadOnlyList<ReviewEntry> Results, long? Next);

/// <summary>A result as a person reviews it, with whose it is.</summary>
public sealed record ReviewDetail(
    ReviewSummary Result,
    ProfileCard? Player,
    ReviewHistory History,
    RankedEvidence? Ranked,
    IReadOnlyList<DecisionView> Decisions);

/// <param name="Note">What the reviewer saw, for the other admins.</param>
public sealed record ReviewDecisionRequest(string? Note);

/// <summary>
/// The console's review (ADR 0029): the results the integrity engine held, oldest first; the ones people decided about or
/// the engine rejected, latest first; and a person's decision — approve, reject, reopen. Every decision needs step-up
/// level 2, is logged in the engine with who made it, and lands in the audit log. Nobody decides about their own results.
/// </summary>
internal static class ReviewEndpoints
{
    private const int MaxNote = 300;

    public static void Map(RouteGroupBuilder admin)
    {
        admin.MapGet("/review", HeldAsync)
            .RequirePermission(AdminPermissions.ResultsReview)
            .WithName("GetAdminReview")
            .WithSummary("Held results, waiting for a person: oldest first, fifty at a time.");

        admin.MapGet("/review/decided", DecidedAsync)
            .RequirePermission(AdminPermissions.ResultsReview)
            .WithName("GetAdminReviewDecided")
            .WithSummary("Results people decided about or the engine rejected: the latest decision first, fifty at a time.");

        admin.MapGet("/review/{id:long}", DetailAsync)
            .RequirePermission(AdminPermissions.ResultsReview)
            .WithName("GetAdminReviewResult")
            .WithSummary("One result: where it stands, what its profile did before on the board, its evidence, every decision.");

        admin.MapPost("/review/{id:long}/approve", ApproveAsync)
            .RequirePermission(AdminPermissions.ResultsReview)
            .RequireStepUp()
            .WithName("ApproveAdminReviewResult")
            .WithSummary("Approve a held result: verified when the server refereed or replayed it, checked otherwise.");

        admin.MapPost("/review/{id:long}/reject", RejectAsync)
            .RequirePermission(AdminPermissions.ResultsReview)
            .RequireStepUp()
            .WithName("RejectAdminReviewResult")
            .WithSummary("Reject a result, at any level: it counts on no board.");

        admin.MapPost("/review/{id:long}/reopen", ReopenAsync)
            .RequirePermission(AdminPermissions.ResultsReview)
            .RequireStepUp()
            .WithName("ReopenAdminReviewResult")
            .WithSummary("Reopen a decided result — rejected, checked or verified: held again, for another look.");
    }

    private static async Task<Ok<ReviewPage>> HeldAsync(
        IntegrityReview review, AccountsAdmin accounts, CancellationToken ct, long? after = null)
    {
        var (results, next) = await review.HeldAsync(after, ct);
        return TypedResults.Ok(await PageAsync(results, next, review, accounts, ct));
    }

    private static async Task<Ok<ReviewPage>> DecidedAsync(
        IntegrityReview review, AccountsAdmin accounts, CancellationToken ct, long? before = null)
    {
        var (results, next) = await review.DecidedAsync(before, ct);
        return TypedResults.Ok(await PageAsync(results, next, review, accounts, ct));
    }

    private static async Task<Results<Ok<ReviewDetail>, NotFound>> DetailAsync(
        long id, IntegrityReview review, AccountsAdmin accounts, CancellationToken ct) =>
        await DetailOfAsync(id, review, accounts, ct) is { } detail ? TypedResults.Ok(detail) : TypedResults.NotFound();

    private static Task<Results<Ok<ReviewDetail>, NotFound, ValidationProblem, ProblemHttpResult>> ApproveAsync(
        long id, ReviewDecisionRequest request, [AsParameters] DecisionServices services, CancellationToken ct) =>
        DecideAsync(id, ReviewDecision.Approve, AuditActions.ResultApprove, request, services, ct);

    private static Task<Results<Ok<ReviewDetail>, NotFound, ValidationProblem, ProblemHttpResult>> RejectAsync(
        long id, ReviewDecisionRequest request, [AsParameters] DecisionServices services, CancellationToken ct) =>
        DecideAsync(id, ReviewDecision.Reject, AuditActions.ResultReject, request, services, ct);

    private static Task<Results<Ok<ReviewDetail>, NotFound, ValidationProblem, ProblemHttpResult>> ReopenAsync(
        long id, ReviewDecisionRequest request, [AsParameters] DecisionServices services, CancellationToken ct) =>
        DecideAsync(id, ReviewDecision.Reopen, AuditActions.ResultReopen, request, services, ct);

    private static async Task<Results<Ok<ReviewDetail>, NotFound, ValidationProblem, ProblemHttpResult>> DecideAsync(
        long id, ReviewDecision decision, string action, ReviewDecisionRequest request, DecisionServices services, CancellationToken ct)
    {
        var note = request.Note?.Trim();
        if (note?.Length > MaxNote)
        {
            return Problems.Field("note", "note_too_long");
        }

        if (await services.Review.AccountOfAsync(id, ct) is not { } owner)
        {
            return TypedResults.NotFound();
        }

        var caller = AdminCaller.Of(services.Http);
        if (owner == caller.AccountId)
        {
            return Problems.Of(StatusCodes.Status403Forbidden, "admin_self", "Nobody decides about their own results");
        }

        var actor = AdminActor.Of((await services.Users.FindByIdAsync(caller.AccountId.ToString()))!, services.Http);
        await using (var transaction = await services.Db.Database.BeginTransactionAsync(ct))
        {
            if (await services.Review.DecideAsync(id, decision, actor.Label, note, services.Clock.GetUtcNow(), ct) is not { } moved)
            {
                return Problems.Of(StatusCodes.Status409Conflict, "review_not_allowed", "The result is not at a level this decision applies to");
            }

            services.Audit.Add(
                actor,
                action,
                $"result {id}",
                new { from = moved.From.ToString().ToLowerInvariant(), to = moved.To.ToString().ToLowerInvariant(), note });
            await services.Db.SaveChangesAsync(ct);
            await transaction.CommitAsync(ct);
        }

        return TypedResults.Ok((await DetailOfAsync(id, services.Review, services.Accounts, ct))!);
    }

    private static async Task<ReviewPage> PageAsync(
        IReadOnlyList<ReviewSummary> results, long? next, IntegrityReview review, AccountsAdmin accounts, CancellationToken ct)
    {
        var cards = await accounts.CardsAsync([.. results.Select(result => result.ProfileId).Distinct()], ct);
        return new ReviewPage(
            await review.HeldCountAsync(ct),
            [.. results.Select(result => new ReviewEntry(result, cards.GetValueOrDefault(result.ProfileId)))],
            next);
    }

    private static async Task<ReviewDetail?> DetailOfAsync(long id, IntegrityReview review, AccountsAdmin accounts, CancellationToken ct)
    {
        if (await review.FindAsync(id, ct) is not { } item)
        {
            return null;
        }

        var cards = await accounts.CardsAsync([item.Result.ProfileId], ct);
        return new ReviewDetail(item.Result, cards.GetValueOrDefault(item.Result.ProfileId), item.History, item.Ranked, item.Decisions);
    }

    /// <summary>What a decision needs from the request's services.</summary>
    internal readonly record struct DecisionServices(
        HttpContext Http,
        UserManager<Account> Users,
        IntegrityReview Review,
        AccountsAdmin Accounts,
        AdminAudit Audit,
        ToheDbContext Db,
        TimeProvider Clock);
}
