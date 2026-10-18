using Tohe.Api.Modules.Email;

namespace Tohe.Api.Modules.Identity;

/// <summary>
/// What the account's email receives (ADR 0024): a code for whatever needs one, and a notice for every change to how
/// the account signs in. Each says what happened and what to do if it was not the reader. A code is in the subject
/// too, to copy from a notification: alone it opens nothing.
/// </summary>
internal static class IdentityEmails
{
    private const string Lifetime = "Mã dùng được trong 15 phút.";

    public static EmailMessage SignUpCode(string to, string code, Uri? link) => new(
        "signup-code",
        to,
        $"Mã đăng ký Tò He: {Spaced(code)}",
        EmailLayout.Render(
            "Mã đăng ký của bạn",
            [$"Nhập mã này trên Tò He để tạo tài khoản. {Lifetime}"],
            code,
            "Nếu bạn không đăng ký, cứ bỏ qua thư này: không có tài khoản nào được tạo.",
            Link("Xác nhận và vào chơi", link)));

    /// <summary>Someone signed up with an address that already has an account: no code, the way back in instead.</summary>
    public static EmailMessage AlreadyRegistered(string to, Uri? signIn) => new(
        "signup-existing",
        to,
        "Bạn đã có tài khoản Tò He",
        EmailLayout.Render(
            "Email này đã có tài khoản",
            [
                "Ai đó (có thể là bạn) vừa đăng ký Tò He bằng email này, nhưng email này đã có tài khoản rồi.",
                "Hãy đăng nhập bằng email này. Nếu quên mật khẩu, chọn \"Quên mật khẩu?\" ở trang đăng nhập.",
            ],
            footnote: "Nếu không phải bạn, cứ bỏ qua thư này: không có gì thay đổi.",
            link: Link("Đăng nhập", signIn)));

    public static EmailMessage ResetCode(string to, string code, Uri? link) => new(
        "reset-code",
        to,
        $"Mã đặt lại mật khẩu Tò He: {Spaced(code)}",
        EmailLayout.Render(
            "Đặt lại mật khẩu",
            [$"Nhập mã này trên Tò He để đặt mật khẩu mới. {Lifetime}"],
            code,
            "Nếu bạn không yêu cầu, cứ bỏ qua thư này: mật khẩu của bạn vẫn như cũ.",
            Link("Đặt mật khẩu mới", link)));

    public static EmailMessage PasswordChanged(string to) => new(
        "password-changed",
        to,
        "Mật khẩu Tò He của bạn đã đổi",
        EmailLayout.Render(
            "Mật khẩu đã đổi",
            [
                "Mật khẩu tài khoản Tò He của bạn vừa được đặt lại, và mọi thiết bị khác đã được đăng xuất.",
                "Tài khoản đăng nhập bằng email này và mật khẩu.",
            ],
            footnote: "Nếu không phải bạn, hãy đặt lại mật khẩu ngay bằng \"Quên mật khẩu?\" rồi báo người quản lý Tò He."));

    public static EmailMessage EmailCode(string to, string code, Uri? link) => new(
        "email-code",
        to,
        $"Mã xác nhận email Tò He: {Spaced(code)}",
        EmailLayout.Render(
            "Xác nhận email mới",
            [$"Nhập mã này trên Tò He để từ nay đăng nhập bằng email này. {Lifetime}"],
            code,
            "Nếu bạn không yêu cầu, cứ bỏ qua thư này: không có gì thay đổi.",
            Link("Xác nhận email", link)));

    /// <summary>An account asked to move to an address another account has: nothing changes, and nothing leaks.</summary>
    public static EmailMessage EmailTaken(string to) => new(
        "email-taken",
        to,
        "Email này đã có tài khoản Tò He",
        EmailLayout.Render(
            "Email này đã có tài khoản",
            [
                "Ai đó vừa muốn đổi email đăng nhập của một tài khoản Tò He sang email này. Email này đã có tài khoản " +
                "riêng, nên không có gì thay đổi.",
            ],
            footnote: "Nếu không phải bạn, cứ bỏ qua thư này."));

    /// <summary>To the address the account used to sign in with.</summary>
    public static EmailMessage EmailChanged(string to, string newEmail) => new(
        "email-changed",
        to,
        "Email đăng nhập Tò He đã đổi",
        EmailLayout.Render(
            "Email đăng nhập đã đổi",
            [$"Tài khoản Tò He của bạn từ nay đăng nhập bằng {Mask(newEmail)}, và mọi thiết bị khác đã được đăng xuất."],
            footnote: "Nếu không phải bạn, hãy báo ngay người quản lý Tò He."));

    /// <summary>Stepping up without the password (ADR 0025): proof it is the owner, before account security changes.</summary>
    public static EmailMessage StepUpCode(string to, string code) => new(
        "stepup-code",
        to,
        $"Mã xác nhận Tò He: {Spaced(code)}",
        EmailLayout.Render(
            "Xác nhận là bạn",
            ["Nhập mã này trên Tò He để đổi cài đặt bảo mật của tài khoản. Mã dùng được trong 10 phút."],
            code,
            "Nếu không phải bạn vừa yêu cầu, hãy đổi mật khẩu: có thể ai đó đang dùng tài khoản của bạn."));

    /// <summary>"nam@example.org" → "n•••@example.org": enough to recognise, not to learn.</summary>
    public static string Mask(string email)
    {
        var at = email.LastIndexOf('@');
        return at <= 0 ? "•••" : $"{email[0]}•••{email[at..]}";
    }

    private static string Spaced(string code) => $"{code[..3]} {code[3..]}";

    private static EmailLink? Link(string label, Uri? url) => url is null ? null : new EmailLink(label, url);
}
