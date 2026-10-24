{{/*
Names. A release called "tohe" gives tohe-api, tohe-hub, tohe-games, tohe-docs, tohe-postgres.
*/}}
{{- define "tohe.fullname" -}}
{{- if .Values.fullnameOverride -}}
{{- .Values.fullnameOverride | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- $name := default .Chart.Name .Values.nameOverride -}}
{{- if contains $name .Release.Name -}}
{{- .Release.Name | trunc 63 | trimSuffix "-" -}}
{{- else -}}
{{- printf "%s-%s" .Release.Name $name | trunc 63 | trimSuffix "-" -}}
{{- end -}}
{{- end -}}
{{- end -}}

{{/* dict "root" $ "component" "api" */}}
{{- define "tohe.componentName" -}}
{{- printf "%s-%s" (include "tohe.fullname" .root) .component | trunc 63 | trimSuffix "-" -}}
{{- end -}}

{{- define "tohe.selectorLabels" -}}
app.kubernetes.io/name: {{ default .root.Chart.Name .root.Values.nameOverride | trunc 63 | trimSuffix "-" }}
app.kubernetes.io/instance: {{ .root.Release.Name }}
app.kubernetes.io/component: {{ .component }}
{{- end -}}

{{- define "tohe.labels" -}}
helm.sh/chart: {{ printf "%s-%s" .root.Chart.Name .root.Chart.Version | replace "+" "_" | trunc 63 | trimSuffix "-" }}
{{ include "tohe.selectorLabels" . }}
app.kubernetes.io/version: {{ include "tohe.tag" (dict "root" .root "image" (dict)) | trunc 63 | quote }}
app.kubernetes.io/managed-by: {{ .root.Release.Service }}
app.kubernetes.io/part-of: tohe
{{- end -}}

{{/*
Images: <registry>/<repository>/<component>:<tag>; a component's repository or tag replaces the global one.
dict "root" $ "component" "api" "image" .Values.api.image
*/}}
{{- define "tohe.tag" -}}
{{- .image.tag | default .root.Values.global.image.tag | default .root.Chart.AppVersion -}}
{{- end -}}

{{- define "tohe.image" -}}
{{- $global := .root.Values.global.image -}}
{{- $repository := .image.repository | default (printf "%s/%s" $global.repository .component) -}}
{{- if $global.registry -}}{{ $global.registry }}/{{- end -}}{{ $repository }}:{{ include "tohe.tag" . }}
{{- end -}}

{{/* URLs: "https://tohe.example.org/" -> origin "https://tohe.example.org", host "tohe.example.org". */}}
{{- define "tohe.origin" -}}
{{- $url := urlParse . -}}
{{- printf "%s://%s" $url.scheme $url.host -}}
{{- end -}}

{{- define "tohe.host" -}}
{{- (urlParse .).hostname -}}
{{- end -}}

{{/* The Secret the workloads read: the operator's, or the one this chart renders. */}}
{{- define "tohe.secretName" -}}
{{- .Values.secrets.existingSecret | default (include "tohe.componentName" (dict "root" . "component" "secrets")) -}}
{{- end -}}

{{/* Settings every workload shares, overridden by the component's own. dict "root" $ "values" .Values.hub */}}
{{- define "tohe.merged" -}}
{{- $defaults := .root.Values.defaults -}}
{{- $out := dict -}}
{{- range $key := list "annotations" "podAnnotations" "podLabels" "nodeSelector" "tolerations" "affinity" "priorityClassName" -}}
{{- $own := index $.values $key -}}
{{- $_ := set $out $key (ternary $own (index $defaults $key) (not (empty $own))) -}}
{{- end -}}
{{- toYaml $out -}}
{{- end -}}

{{/*
Npgsql connection string from the parts; the password comes from $(TOHE_DB_PASSWORD), which the kubelet expands
from the env var defined just before it. GSS encryption off: without Kerberos it only costs a round trip.
*/}}
{{- define "tohe.connectionString" -}}
{{- $pg := .Values.infra.postgres -}}
{{- if eq $pg.mode "builtin" -}}
Host={{ include "tohe.componentName" (dict "root" . "component" "postgres") }};Port=5432;Database={{ $pg.database }};Username={{ $pg.username }};Password=$(TOHE_DB_PASSWORD);Maximum Pool Size={{ $pg.maxPoolSize }};SSL Mode=Disable;GSS Encryption Mode=Disable
{{- else -}}
Host={{ $pg.external.host }};Port={{ $pg.external.port }};Database={{ $pg.database }};Username={{ $pg.username }};Password=$(TOHE_DB_PASSWORD);Maximum Pool Size={{ $pg.maxPoolSize }};SSL Mode={{ $pg.external.sslMode }};GSS Encryption Mode=Disable
{{- end -}}
{{- end -}}

{{/*
Everything the chart cannot express in values.schema.json. Each failure names the value to fix.
*/}}
{{- define "tohe.validate" -}}
{{- $urlPattern := "^https?://[^/?#]+/?$" -}}
{{- $urls := .Values.publicUrls -}}
{{- if not $urls.hub -}}
{{- fail "publicUrls.hub is required: the hub's public URL, e.g. https://tohe.example.org" -}}
{{- end -}}
{{- if not (regexMatch $urlPattern $urls.hub) -}}
{{- fail (printf "publicUrls.hub must be an http(s) origin with no path, got %q" $urls.hub) -}}
{{- end -}}
{{- if not $urls.games -}}
{{- fail "publicUrls.games is required: the games origin, e.g. https://games.tohe.example beside the hub https://tohe.example (ADR 0002, 0040)" -}}
{{- end -}}
{{- if not (regexMatch $urlPattern $urls.games) -}}
{{- fail (printf "publicUrls.games must be an http(s) origin with no path, got %q" $urls.games) -}}
{{- end -}}
{{- $hosts := list (include "tohe.host" $urls.hub) (include "tohe.host" $urls.games) -}}
{{- if .Values.docs.enabled -}}
{{- if not $urls.docs -}}
{{- fail "publicUrls.docs is required while docs.enabled: the developer docs, e.g. https://docs.tohe.example.org (ADR 0042)" -}}
{{- end -}}
{{- if not (regexMatch $urlPattern $urls.docs) -}}
{{- fail (printf "publicUrls.docs must be an http(s) origin with no path, got %q" $urls.docs) -}}
{{- end -}}
{{- $hosts = append $hosts (include "tohe.host" $urls.docs) -}}
{{- end -}}
{{- if $urls.console -}}
{{- if not (regexMatch $urlPattern $urls.console) -}}
{{- fail (printf "publicUrls.console must be an http(s) origin with no path, got %q" $urls.console) -}}
{{- end -}}
{{- $hosts = append $hosts (include "tohe.host" $urls.console) -}}
{{- end -}}
{{- if .Values.studio.enabled -}}
{{- if not $urls.studio -}}
{{- fail "publicUrls.studio is required while studio.enabled: the Asset Studio, e.g. https://studio.tohe.example.org (ADR 0051)" -}}
{{- end -}}
{{- if not (regexMatch $urlPattern $urls.studio) -}}
{{- fail (printf "publicUrls.studio must be an http(s) origin with no path, got %q" $urls.studio) -}}
{{- end -}}
{{- $hosts = append $hosts (include "tohe.host" $urls.studio) -}}
{{- end -}}
{{- if ne (len $hosts) (len (uniq $hosts)) -}}
{{- fail (printf "publicUrls must use a different host each — the games origin must never share the hub's (ADR 0002), nor the console or the Studio (ADR 0042, 0051); got %s" (join ", " $hosts)) -}}
{{- end -}}
{{- if ne (int .Values.api.replicaCount) 1 -}}
{{- fail "api.replicaCount must be 1: rooms live in the API's memory and its jobs and migrations assume one instance (ADR 0016)" -}}
{{- end -}}
{{- $pg := .Values.infra.postgres -}}
{{- if not (has $pg.mode (list "builtin" "external")) -}}
{{- fail (printf "infra.postgres.mode must be builtin or external, got %q" $pg.mode) -}}
{{- end -}}
{{- if and $pg.external.connectionStringKey (not .Values.secrets.existingSecret) -}}
{{- fail "infra.postgres.external.connectionStringKey names a key of secrets.existingSecret, which is empty" -}}
{{- end -}}
{{- if and (eq $pg.mode "builtin") $pg.external.connectionStringKey -}}
{{- fail "infra.postgres.external.connectionStringKey only applies to infra.postgres.mode=external" -}}
{{- end -}}
{{- if and (eq $pg.mode "external") (not $pg.external.host) (not $pg.external.connectionStringKey) -}}
{{- fail "infra.postgres.external.host is required with infra.postgres.mode=external (or set external.connectionStringKey)" -}}
{{- end -}}
{{- if and (not .Values.secrets.existingSecret) (not .Values.secrets.values.postgresPassword) -}}
{{- fail "secrets.values.postgresPassword is required unless secrets.existingSecret is set — e.g. --set secrets.values.postgresPassword=$(openssl rand -hex 24)" -}}
{{- end -}}
{{- if contains ";" .Values.secrets.values.postgresPassword -}}
{{- fail "secrets.values.postgresPassword must not contain \";\": it ends up in an Npgsql connection string" -}}
{{- end -}}
{{- end -}}
