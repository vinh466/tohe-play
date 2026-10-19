using System.Globalization;
using Tohe.Api.Infrastructure;
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

    /// <summary>Proving the account is theirs before a provider is linked to it (ADR 0026).</summary>
    public static EmailMessage LinkCode(string to, string code, string provider) => new(
        "link-code",
        to,
        $"Mã liên kết Tò He: {Spaced(code)}",
        EmailLayout.Render(
            $"Liên kết {provider}",
            [$"Nhập mã này trên Tò He để từ nay đăng nhập tài khoản của bạn bằng {provider}. {Lifetime}"],
            code,
            "Nếu không phải bạn, đừng đưa mã này cho ai: không có gì thay đổi."));

    public static EmailMessage MethodLinked(string to, string provider) => new(
        "method-linked",
        to,
        $"Tài khoản Tò He đã liên kết với {provider}",
        EmailLayout.Render(
            $"Đã liên kết {provider}",
            [$"Từ nay tài khoản Tò He của bạn đăng nhập được bằng {provider}."],
            footnote: "Nếu không phải bạn, hãy vào Quản lý tài khoản → Bảo mật tài khoản để gỡ liên kết, và đổi mật khẩu."));

    public static EmailMessage MethodUnlinked(string to, string provider) => new(
        "method-unlinked",
        to,
        $"Tài khoản Tò He đã gỡ liên kết {provider}",
        EmailLayout.Render(
            $"Đã gỡ liên kết {provider}",
            [$"Tài khoản Tò He của bạn không còn đăng nhập bằng {provider}, và mọi thiết bị khác đã được đăng xuất."],
            footnote: "Nếu không phải bạn, hãy đặt lại mật khẩu ngay bằng \"Quên mật khẩu?\" rồi báo người quản lý Tò He."));

    /// <summary>An authenticator added in the hub: the account signs in to the console with it (ADR 0027, 0042).</summary>
    public static EmailMessage TwoFactorEnabled(string to) => new(
        "two-factor-enabled",
        to,
        "Tài khoản Tò He đã bật xác thực hai lớp",
        EmailLayout.Render(
            "Đã bật xác thực hai lớp",
            ["Một ứng dụng xác thực vừa được thêm vào tài khoản Tò He của bạn: từ nay tài khoản đăng nhập được bảng quản trị bằng mật khẩu và mã của ứng dụng đó."],
            footnote: "Nếu không phải bạn, hãy đặt lại mật khẩu ngay bằng \"Quên mật khẩu?\" rồi báo người quản lý Tò He."));

    /// <summary>Two-factor authentication turned off in the console: every session ended (ADR 0027, 0042).</summary>
    public static EmailMessage TwoFactorDisabled(string to) => new(
        "two-factor-disabled",
        to,
        "Tài khoản Tò He đã tắt xác thực hai lớp",
        EmailLayout.Render(
            "Đã tắt xác thực hai lớp",
            [
                "Xác thực hai lớp của tài khoản Tò He của bạn vừa được tắt ở bảng quản trị, và mọi thiết bị đã được đăng xuất.",
                "Tài khoản không vào được bảng quản trị nữa cho đến khi thêm lại ứng dụng xác thực ở trang Tài khoản của Tò He.",
            ],
            footnote: "Nếu không phải bạn, hãy đặt lại mật khẩu ngay bằng \"Quên mật khẩu?\" rồi báo người quản lý Tò He."));

    /// <summary>
    /// The owner asked to delete the account (ADR 0034): the day after which the operator deletes it (ADR 0038), and
    /// the way to keep it.
    /// </summary>
    public static EmailMessage DeletionScheduled(string to, DateTimeOffset deleteAfter, Uri? signIn) => new(
        "account-deleting",
        to,
        "Tài khoản Tò He sắp bị xoá",
        EmailLayout.Render(
            "Tài khoản sẽ bị xoá",
            [
                $"Tài khoản Tò He của bạn sẽ bị xoá hẳn sau ngày {Day(deleteAfter)}, cùng mọi hồ sơ trong đó: ván đã " +
                "lưu, điểm và kết quả trên bảng xếp hạng. Mọi thiết bị đã được đăng xuất.",
                "Đổi ý? Chỉ cần đăng nhập lại trước ngày đó: tài khoản được giữ nguyên như cũ.",
            ],
            footnote: "Nếu không phải bạn yêu cầu, hãy đăng nhập ngay để giữ tài khoản, rồi đổi mật khẩu.",
            link: Link("Đăng nhập để giữ tài khoản", signIn)));

    /// <summary>Someone signed in while the account waited to be deleted, which keeps it (design §3.14).</summary>
    public static EmailMessage DeletionCancelled(string to) => new(
        "account-kept",
        to,
        "Tài khoản Tò He sẽ không bị xoá",
        EmailLayout.Render(
            "Đã huỷ xoá tài khoản",
            ["Tài khoản Tò He của bạn vừa được đăng nhập, nên nó được giữ lại như cũ và không bị xoá nữa."],
            footnote: "Nếu không phải bạn đăng nhập, hãy đặt lại mật khẩu ngay bằng \"Quên mật khẩu?\"."));

    /// <summary>"nam@example.org" → "n•••@example.org": enough to recognise, not to learn.</summary>
    public static string Mask(string email)
    {
        var at = email.LastIndexOf('@');
        return at <= 0 ? "•••" : $"{email[0]}•••{email[at..]}";
    }

    private static string Spaced(string code) => $"{code[..3]} {code[3..]}";

    /// <summary>The day in Việt Nam, as people there read it: 25/10/2026.</summary>
    private static string Day(DateTimeOffset at) =>
        at.ToOffset(Weeks.VietnamOffset).ToString("dd/MM/yyyy", CultureInfo.InvariantCulture);

    private static EmailLink? Link(string label, Uri? url) => url is null ? null : new EmailLink(label, url);
}
