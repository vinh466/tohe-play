# The images of a release (ADR 0021): what CI builds once per run, tests (the chart on kind, the e2e suites on the compose
# stack) and, on main, publishes as they are. Build context: repository root.
#   docker buildx bake -f deploy/docker/docker-bake.hcl            # the four images, tagged :dev
#   TAG=sha-<commit> REVISION=<commit> docker buildx bake -f deploy/docker/docker-bake.hcl --pull
# A new image is a new target here, then a service in compose.yaml and compose.image.yaml, and a component in the chart.

variable "IMAGES" {
  default = "ghcr.io/vinh466/tohe-play"
}

variable "TAG" {
  default = "dev"
}

variable "REVISION" {
  default = ""
}

group "default" {
  targets = ["api", "web"]
}

target "_release" {
  context = "."
  labels = {
    "org.opencontainers.image.source"   = "https://github.com/vinh466/tohe-play"
    "org.opencontainers.image.revision" = REVISION
  }
}

target "api" {
  inherits   = ["_release"]
  dockerfile = "deploy/docker/api.Dockerfile"
  tags       = ["${IMAGES}/api:${TAG}"]
}

# The static images, served by Caddy: one Dockerfile, a target each.
target "web" {
  name       = component
  matrix     = { component = ["hub", "games", "docs"] }
  inherits   = ["_release"]
  dockerfile = "deploy/docker/web.Dockerfile"
  target     = component
  tags       = ["${IMAGES}/${component}:${TAG}"]
}
