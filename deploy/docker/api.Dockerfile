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

FROM mcr.microsoft.com/dotnet/aspnet:10.0-noble-chiseled
WORKDIR /app
COPY --from=build /app .
ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
USER app
ENTRYPOINT ["dotnet", "Tohe.Api.dll"]
