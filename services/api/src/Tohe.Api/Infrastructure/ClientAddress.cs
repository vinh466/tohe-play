using System.Net;
using System.Net.Sockets;

namespace Tohe.Api.Infrastructure;

/// <summary>
/// The key a per-address limit counts a client under: an IPv4 address as it is, an IPv6 address by its /64 — one
/// household or phone is given a whole /64 and picks addresses in it at will, so the full address would be no limit.
/// The address is the one the trusted proxy chain gives (<c>UseForwardedHeaders</c>). Used by the Links module's limits
/// (ADR 0044); the API's older limits keep the full address for now.
/// </summary>
internal static class ClientAddress
{
    public static string PartitionKey(IPAddress? address)
    {
        if (address is null)
        {
            return "unknown";
        }

        if (address.IsIPv4MappedToIPv6)
        {
            address = address.MapToIPv4();
        }

        if (address.AddressFamily != AddressFamily.InterNetworkV6)
        {
            return address.ToString();
        }

        var bytes = address.GetAddressBytes();
        Array.Clear(bytes, 8, 8);
        return $"{new IPAddress(bytes)}/64";
    }
}
