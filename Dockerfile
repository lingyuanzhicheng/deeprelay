# syntax=docker/dockerfile:1

# ==============================================================================
# Stage 1: 前端构建 (Next.js 静态导出)
# ==============================================================================
FROM node:22-alpine AS frontend

WORKDIR /build/web

RUN npm install -g pnpm@9

COPY web/package.json web/pnpm-lock.yaml web/pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

COPY web/ ./

ARG APP_VERSION=dev
ENV NEXT_PUBLIC_APP_VERSION=${APP_VERSION}
RUN pnpm run build

# ==============================================================================
# Stage 2: 后端构建 (Go, 前端产物嵌入二进制)
# ==============================================================================
FROM golang:1.24-alpine AS backend

WORKDIR /build

COPY go.mod go.sum ./
RUN go mod download

COPY cmd/ cmd/
COPY internal/ internal/
COPY main.go .
COPY static/ static/
COPY --from=frontend /build/web/out/ static/out/

ARG APP_VERSION=dev
ARG COMMIT_ID=unknown
# TARGETARCH 由 buildx 自动注入，为空时编译宿主架构
ARG TARGETARCH
RUN BUILD_TIME="$(date -u +'%F %T %z')" && \
    if [ -n "${TARGETARCH}" ]; then export GOARCH="${TARGETARCH}"; fi && \
    CGO_ENABLED=0 go build -o /build/deeprelay \
    -ldflags="-X 'github.com/lingyuanzhicheng/deeprelay/internal/conf.Version=${APP_VERSION}' \
    -X 'github.com/lingyuanzhicheng/deeprelay/internal/conf.BuildTime=${BUILD_TIME}' \
    -X 'github.com/lingyuanzhicheng/deeprelay/internal/conf.Author=lingyuanzhicheng' \
    -X 'github.com/lingyuanzhicheng/deeprelay/internal/conf.Commit=${COMMIT_ID}' \
    -s -w" \
    -tags=jsoniter .

# ==============================================================================
# Stage 3: 运行镜像
# ==============================================================================
FROM alpine:3.21

ENV TZ=Asia/Shanghai

RUN apk add --no-cache ca-certificates tzdata su-exec && \
    mkdir -p /app/data

WORKDIR /app

COPY --from=backend /build/deeprelay /app/deeprelay
COPY scripts/dockerfiles/entrypoint.sh /entrypoint.sh

RUN chmod +x /entrypoint.sh /app/deeprelay

EXPOSE 8080
VOLUME ["/app/data"]

ENTRYPOINT ["/entrypoint.sh"]
