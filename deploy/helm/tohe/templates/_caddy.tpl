{{/*
A Caddy workload — the hub, the games origin or the site: a Deployment and its Service.
dict "root" $ "component" "hub" "values" .Values.hub "env" (list (dict "name" … "value" …)) "probePath" "/"
*/}}
{{- define "tohe.caddyWorkload" -}}
{{- $root := .root -}}
{{- $name := include "tohe.componentName" (dict "root" $root "component" .component) -}}
{{- $common := include "tohe.merged" (dict "root" $root "values" .values) | fromYaml -}}
apiVersion: apps/v1
kind: Deployment
metadata:
  name: {{ $name }}
  labels:
    {{- include "tohe.labels" (dict "root" $root "component" .component) | nindent 4 }}
  {{- with $common.annotations }}
  annotations:
    {{- toYaml . | nindent 4 }}
  {{- end }}
spec:
  replicas: {{ .values.replicaCount }}
  selector:
    matchLabels:
      {{- include "tohe.selectorLabels" (dict "root" $root "component" .component) | nindent 6 }}
  template:
    metadata:
      labels:
        {{- include "tohe.selectorLabels" (dict "root" $root "component" .component) | nindent 8 }}
        {{- with $common.podLabels }}
        {{- toYaml . | nindent 8 }}
        {{- end }}
      {{- with $common.podAnnotations }}
      annotations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
    spec:
      automountServiceAccountToken: false
      enableServiceLinks: false
      {{- with $root.Values.global.imagePullSecrets }}
      imagePullSecrets:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with $common.priorityClassName }}
      priorityClassName: {{ . }}
      {{- end }}
      securityContext:
        {{- toYaml .values.podSecurityContext | nindent 8 }}
      containers:
        - name: {{ .component }}
          image: {{ include "tohe.image" (dict "root" $root "component" .component "image" .values.image) }}
          imagePullPolicy: {{ $root.Values.global.image.pullPolicy }}
          securityContext:
            {{- toYaml .values.securityContext | nindent 12 }}
          ports:
            - name: http
              containerPort: 8080
          env:
            {{- toYaml .env | nindent 12 }}
            {{- with .values.extraEnv }}
            {{- toYaml . | nindent 12 }}
            {{- end }}
          readinessProbe:
            httpGet:
              path: {{ .probePath }}
              port: http
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: {{ .probePath }}
              port: http
            periodSeconds: 20
          resources:
            {{- toYaml .values.resources | nindent 12 }}
          volumeMounts:
            # Caddy keeps its state under $XDG_DATA_HOME and $XDG_CONFIG_HOME; the root filesystem is read-only.
            - name: data
              mountPath: /data
            - name: config
              mountPath: /config
      volumes:
        - name: data
          emptyDir: {}
        - name: config
          emptyDir: {}
      {{- with $common.nodeSelector }}
      nodeSelector:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with $common.tolerations }}
      tolerations:
        {{- toYaml . | nindent 8 }}
      {{- end }}
      {{- with $common.affinity }}
      affinity:
        {{- toYaml . | nindent 8 }}
      {{- end }}
---
apiVersion: v1
kind: Service
metadata:
  name: {{ $name }}
  labels:
    {{- include "tohe.labels" (dict "root" $root "component" .component) | nindent 4 }}
spec:
  type: ClusterIP
  selector:
    {{- include "tohe.selectorLabels" (dict "root" $root "component" .component) | nindent 4 }}
  ports:
    - name: http
      port: 8080
      targetPort: http
{{- end -}}
