# Platform API. Build context: repository root.
FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY global.json ./
COPY services/api/Directory.Build.props services/api/Directory.Packages.props services/api/
COPY services/api/src/Tohe.Api/Tohe.Api.csproj services/api/src/Tohe.Api/
RUN dotnet restore services/api/src/Tohe.Api/Tohe.Api.csproj
COPY services/api/src services/api/src
# The OpenAPI document is generated and committed by `pnpm build`; no need to regenerate it in the image.
RUN dotnet publish services/api/src/Tohe.Api -c Release -o /app --no-restore -p:OpenApiGenerateDocuments=false
# SkiaSharp (the Studio's checks) ships its native library for every platform, ~460 MB with Windows' symbols: the image
# keeps glibc Linux's alone, for x64 and arm64. The chiseled runtime has everything libSkiaSharp.so needs (libc, libm,
# libdl, libpthread, librt, libstdc++), as SkiaSharp.NativeAssets.Linux.NoDependencies asks no fontconfig.
RUN find /app/runtimes -mindepth 1 -maxdepth 1 -type d ! -name linux-x64 ! -name linux-arm64 -exec rm -rf {} +

FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_HTTP_PORTS=8080
# 9464: /metrics for Prometheus, never proxied by the hub (ADR 0036).
EXPOSE 8080 9464
USER app
ENTRYPOINT ["dotnet", "Tohe.Api.dll"]
