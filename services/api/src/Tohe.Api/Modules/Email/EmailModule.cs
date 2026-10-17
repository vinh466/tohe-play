using Microsoft.Extensions.DependencyInjection.Extensions;
using Microsoft.Extensions.Options;
using Tohe.Api.Infrastructure;

namespace Tohe.Api.Modules.Email;

/// <summary>
/// Transactional email (ADR 0022): other modules add messages to the outbox in their own transaction; a background
/// worker hands them to an SMTP relay. Nothing here has endpoints of its own.
/// </summary>
internal static class EmailModule
{
    public static WebApplicationBuilder AddEmailModule(this WebApplicationBuilder builder)
    {
        var services = builder.Services;
        var options = services.AddOptions<EmailOptions>().BindConfiguration(EmailOptions.Section);
        services.AddSingleton<IValidateOptions<EmailOptions>, EmailOptionsValidator>();
        if (!BuildTime.IsGeneratingOpenApi)
        {
            options.ValidateOnStart();
        }

        services.TryAddSingleton(TimeProvider.System);
        services.TryAddSingleton<ISmtpTransport, MailKitSmtpTransport>();
        services.AddScoped<IEmailOutbox, EmailOutbox>();
        services.AddScoped<EmailDelivery>();
        services.AddScoped<EmailFacts>();

        var configured = builder.Configuration.GetSection(EmailOptions.Section).Get<EmailOptions>() ?? new EmailOptions();
        if (configured.Mode == EmailMode.Smtp && configured.DeliveryEnabled && !BuildTime.IsGeneratingOpenApi)
        {
            services.AddHostedService<EmailDeliveryWorker>();
        }

        return builder;
    }
}

/// <summary>Stops the API at start-up with every problem named, rather than failing at the first code someone asks for.</summary>
internal sealed class EmailOptionsValidator : IValidateOptions<EmailOptions>
{
    public ValidateOptionsResult Validate(string? name, EmailOptions options)
    {
        var problems = options.Problems().ToList();
        return problems.Count == 0 ? ValidateOptionsResult.Success : ValidateOptionsResult.Fail(problems);
    }
}
