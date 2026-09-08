package handlers

import (
	"net/http"
	"strconv"
	"strings"

	"github.com/lingyuanzhicheng/deeprelay/internal/model"
	"github.com/lingyuanzhicheng/deeprelay/internal/op"
	"github.com/lingyuanzhicheng/deeprelay/internal/server/auth"
	"github.com/lingyuanzhicheng/deeprelay/internal/server/middleware"
	"github.com/lingyuanzhicheng/deeprelay/internal/server/resp"
	"github.com/lingyuanzhicheng/deeprelay/internal/server/router"
	"github.com/gin-gonic/gin"
	"github.com/samber/lo"
)

func init() {
	router.NewGroupRouter("/api/v1/apikey").
		Use(middleware.Auth()).
		Use(middleware.RequireJSON()).
		AddRoute(
			router.NewRoute("/create", http.MethodPost).
				Handle(createAPIKey),
		).
		AddRoute(
			router.NewRoute("/list", http.MethodGet).
				Handle(listAPIKey),
		).
		AddRoute(
			router.NewRoute("/update", http.MethodPost).
				Handle(updateAPIKey),
		).
		AddRoute(
			router.NewRoute("/delete/:id", http.MethodDelete).
				Handle(deleteAPIKey),
		).
		AddRoute(
			router.NewRoute("/reset/:id", http.MethodPost).
				Handle(resetAPIKey),
		)
	router.NewGroupRouter("/api/v1/apikey").
		Use(middleware.APIKeyAuth()).
		AddRoute(
			router.NewRoute("/stats", http.MethodGet).
				Handle(getStatsAPIKeyById),
		).
		AddRoute(
			router.NewRoute("/login", http.MethodGet).
				Handle(loginAPIKey),
		).
		AddRoute(
			router.NewRoute("/me/reset", http.MethodPost).
				Handle(resetOwnAPIKey),
		)
}

func createAPIKey(c *gin.Context) {
	var req model.APIKey
	if err := c.ShouldBindJSON(&req); err != nil {
		resp.Error(c, http.StatusBadRequest, resp.ErrInvalidJSON)
		return
	}
	req.APIKey = auth.GenerateAPIKey()
	if req.UnlimitedModels {
		req.SupportedModels = ""
	}
	if err := op.APIKeyCreate(&req, c.Request.Context()); err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, req)
}

func listAPIKey(c *gin.Context) {
	apiKeys, err := op.APIKeyList(c.Request.Context())
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, apiKeys)
}

func updateAPIKey(c *gin.Context) {
	var req model.APIKey
	if err := c.ShouldBindJSON(&req); err != nil {
		resp.Error(c, http.StatusBadRequest, resp.ErrInvalidJSON)
		return
	}
	if req.UnlimitedModels {
		req.SupportedModels = ""
	}
	if err := op.APIKeyUpdate(&req, c.Request.Context()); err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, req)
}

func deleteAPIKey(c *gin.Context) {
	id := c.Param("id")
	idNum, err := strconv.Atoi(id)
	if err != nil {
		resp.Error(c, http.StatusBadRequest, resp.ErrInvalidParam)
		return
	}
	if err := op.APIKeyDelete(idNum, c.Request.Context()); err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, nil)
}

func resetAPIKey(c *gin.Context) {
	id := c.Param("id")
	idNum, err := strconv.Atoi(id)
	if err != nil {
		resp.Error(c, http.StatusBadRequest, resp.ErrInvalidParam)
		return
	}
	newKey := auth.GenerateAPIKey()
	updated, err := op.APIKeyReset(idNum, newKey, c.Request.Context())
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, updated)
}

func getStatsAPIKeyById(c *gin.Context) {
	id := c.GetInt("api_key_id")
	stats := op.StatsAPIKeyGet(id)
	info, err := op.APIKeyGet(id, c.Request.Context())
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	models, err := op.GroupListModel(c.Request.Context())
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	if info.UnlimitedModels {
		info.SupportedModels = ""
	} else {
		var modelsString string
		if info.SupportedModels == "" {
			modelsString = strings.Join(models, ", ")
		} else {
			supportedModels := lo.Map(strings.Split(info.SupportedModels, ","), func(s string, _ int) string {
				return strings.TrimSpace(s)
			})
			models = lo.Filter(models, func(m string, _ int) bool {
				return lo.Contains(supportedModels, m)
			})
			modelsString = strings.Join(models, ", ")
		}
		info.SupportedModels = modelsString
	}
	resp.Success(c, map[string]any{
		"stats": stats,
		"info":  info,
	})
}

// resetOwnAPIKey 密钥登录模式下重置当前密钥，返回新生成的密钥值。
// 旧密钥立即失效，调用方需妥善保存返回的新密钥。
func resetOwnAPIKey(c *gin.Context) {
	id := c.GetInt("api_key_id")
	newKey := auth.GenerateAPIKey()
	if _, err := op.APIKeyReset(id, newKey, c.Request.Context()); err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, map[string]any{
		"api_key": newKey,
	})
}

func loginAPIKey(c *gin.Context) {
	resp.Success(c, nil)
}
