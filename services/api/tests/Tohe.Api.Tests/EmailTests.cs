using Microsoft.AspNetCore.Hosting;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Tohe.Api.Infrastructure.Database;
using Tohe.Api.Modules.Email;

namespace Tohe.Api.Tests;

/// <summary>Transactional email (ADR 0022): the outbox, delivery, retries and what stays behind.</summary>
public sealed class EmailTests(ApiFactory factory) : IClassFixture<ApiFactory>
{
    private static readonly CancellationToken Ct = TestContext.Current.CancellationToken;

    [Fact]
    public async Task A_saved_message_is_sent_and_its_body_erased()
    {
        var to = Recipient();
        await EnqueueAsync(to, code: "482913");

        await DeliverAsync();

        var message = Assert.Single(factory.Smtp.Sent, m => m.To.Mailboxes.Single().Address == to);
        Assert.Equal("no-reply@tohe.test", message.From.Mailboxes.Single().Address);
        Assert.Equal("Tò He", message.From.Mailboxes.Single().Name);
        Assert.Equal("Mã của bạn", message.Subject);
        Assert.Contains("482 913", message.TextBody, StringComparison.Ordinal);
        Assert.Contains("482 913", message.HtmlBody, StringComparison.Ordinal);

        var row = await RowAsync(to);
        Assert.NotNull(row.SentAt);
        Assert.Equal(1, row.Attempts);
        Assert.Null(row.Subject);
        Assert.Null(row.Text);
        Assert.Null(row.Html);
    }

    [Fact]
    public async Task Nothing_is_sent_for_a_message_whose_transaction_never_committed()
    {
        var to = Recipient();
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            scope.ServiceProvider.GetRequiredService<IEmailOutbox>().Add(Message(to));
            // The caller fails before SaveChangesAsync: no attempt, no code.
        }

        await DeliverAsync();

        Assert.DoesNotContain(factory.Smtp.Sent, m => m.To.Mailboxes.Single().Address == to);
    }

    [Fact]
    public async Task A_refused_message_waits_then_is_retried()
    {
        var to = Recipient();
        await EnqueueAsync(to);
        factory.Smtp.RefuseNext(1);

        await DeliverAsync();

        var row = await RowAsync(to);
        Assert.Equal(1, row.Attempts);
        Assert.Null(row.SentAt);
        Assert.Equal("451 relay unavailable", row.LastError);
        Assert.NotNull(row.Text);
        Assert.True(row.NextAttemptAt > DateTimeOffset.UtcNow.AddSeconds(30), "the next try waits about a minute");

        await DeliverAsync();
        Assert.DoesNotContain(factory.Smtp.Sent, m => m.To.Mailboxes.Single().Address == to);

        await MakeDueAsync(to);
        await DeliverAsync();
        Assert.Single(factory.Smtp.Sent, m => m.To.Mailboxes.Single().Address == to);
        Assert.Null((await RowAsync(to)).LastError);
    }

    [Fact]
    public async Task A_message_is_given_up_after_the_last_attempt_and_its_body_erased()
    {
        var to = Recipient();
        await EnqueueAsync(to);
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
            await db.EmailOutbox.Where(e => e.To == to).ExecuteUpdateAsync(e => e.SetProperty(x => x.Attempts, 5), Ct);
        }

        factory.Smtp.RefuseNext(1);
        await DeliverAsync();

        var row = await RowAsync(to);
        Assert.Equal(6, row.Attempts);
        Assert.NotNull(row.FailedAt);
        Assert.Null(row.SentAt);
        Assert.Null(row.Text);
        Assert.Null(row.Html);

        await MakeDueAsync(to);
        await DeliverAsync();
        Assert.DoesNotContain(factory.Smtp.Sent, m => m.To.Mailboxes.Single().Address == to);
    }

    [Fact]
    public async Task Envelopes_older_than_the_retention_are_deleted()
    {
        var to = Recipient();
        await EnqueueAsync(to);
        await DeliverAsync();
        await using (var scope = factory.Services.CreateAsyncScope())
        {
            var db = scope.ServiceProvider.GetRequiredService<ToheDbContext>();
            await db.EmailOutbox.Where(e => e.To == to)
                .ExecuteUpdateAsync(e => e.SetProperty(x => x.SentAt, DateTimeOffset.UtcNow.AddDays(-31)), Ct);
        }

        await DeliverAsync();

        await using var check = factory.Services.CreateAsyncScope();
        Assert.False(await check.ServiceProvider.GetRequiredService<ToheDbContext>().EmailOutbox.AnyAsync(e => e.To == to, Ct));
    }

    [Fact]
    public async Task With_email_disabled_the_outbox_refuses_messages()
    {
        await using var disabled = factory.WithWebHostBuilder(builder => builder.UseSetting("Email:Mode", "Disabled"));
        await using var scope = disabled.Services.CreateAsyncScope();
        var outbox = scope.ServiceProvider.GetRequiredService<IEmailOutbox>();

        Assert.False(outbox.Enabled);
        Assert.Throws<InvalidOperationException>(() => outbox.Add(Message(Recipient())));
    }

    [Theory]
    [InlineData("Email:Smtp:Host", "", "Email:Smtp:Host is required")]
    [InlineData("Email:From", "not a mailbox", "Email:From must be a mailbox")]
    public void A_misconfigured_relay_stops_the_api_from_starting(string key, string value, string message)
    {
        using var misconfigured = factory.WithWebHostBuilder(builder => builder.UseSetting(key, value));

        var error = Assert.ThrowsAny<Exception>(() => misconfigured.CreateClient());

        Assert.Contains(message, error.ToString(), StringComparison.Ordinal);
    }

    [Fact]
    public void The_layout_encodes_what_it_is_given()
    {
        var body = EmailLayout.Render("<b>Chào</b>", ["Bé & bố"], code: "123456", footnote: "Không phải bạn?");

        Assert.Contains("&lt;b&gt;Chào&lt;/b&gt;", body.Html, StringComparison.Ordinal);
        Assert.Contains("Bé &amp; bố", body.Html, StringComparison.Ordinal);
        Assert.Contains("123 456", body.Text, StringComparison.Ordinal);
        Assert.Contains("vui lòng không trả lời", body.Text, StringComparison.Ordinal);
    }

    // ------------------------------------------------------------------ helpers

    private static string Recipient() => $"{Guid.NewGuid():N}@example.test";

    private static EmailMessage Message(string to, string code = "000000") =>
        new("test-code", to, "Mã của bạn", EmailLayout.Render("Mã của bạn", ["Nhập mã này trong ứng dụng."], code));

    private async Task EnqueueAsync(string to, string code = "000000")
    {
        await using var scope = factory.Services.CreateAsyncScope();
        scope.ServiceProvider.GetRequiredService<IEmailOutbox>().Add(Message(to, code));
        await scope.ServiceProvider.GetRequiredService<ToheDbContext>().SaveChangesAsync(Ct);
    }

    private async Task DeliverAsync()
    {
        await using var scope = factory.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<EmailDelivery>().RunAsync(Ct);
    }

    private async Task MakeDueAsync(string to)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        await scope.ServiceProvider.GetRequiredService<ToheDbContext>().EmailOutbox.Where(e => e.To == to)
            .ExecuteUpdateAsync(e => e.SetProperty(x => x.NextAttemptAt, DateTimeOffset.UtcNow.AddSeconds(-1)), Ct);
    }

    private async Task<OutboxEmail> RowAsync(string to)
    {
        await using var scope = factory.Services.CreateAsyncScope();
        return await scope.ServiceProvider.GetRequiredService<ToheDbContext>().EmailOutbox.AsNoTracking().SingleAsync(e => e.To == to, Ct);
    }
}
