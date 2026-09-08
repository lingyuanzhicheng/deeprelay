package middleware

import (
	"net/http"
	"strings"
	"time"

	"github.com/lingyuanzhicheng/deeprelay/internal/conf"
	"github.com/lingyuanzhicheng/deeprelay/internal/op"
	"github.com/lingyuanzhicheng/deeprelay/internal/server/auth"
	"github.com/lingyuanzhicheng/deeprelay/internal/server/resp"
	"github.com/gin-gonic/gin"
)

func Auth() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := c.GetHeader("Authorization")
		if token == "" {
			resp.Error(c, http.StatusBadRequest, resp.ErrBadRequest)
			c.Abort()
			return
		}
		if !auth.VerifyJWTToken(strings.TrimPrefix(token, "Bearer ")) {
			resp.Error(c, http.StatusUnauthorized, resp.ErrUnauthorized)
			c.Abort()
			return
		}
		c.Next()
	}
}

// AuthOrAPIKey 双模认证：允许账户 JWT 或 API Key（sk- 前缀）。
// API Key 认证通过时在上下文写入 api_key_id 与 api_key_name，供 handler 做数据范围过滤
func AuthOrAPIKey() gin.HandlerFunc {
	return func(c *gin.Context) {
		token := strings.TrimPrefix(c.GetHeader("Authorization"), "Bearer ")
		if token != "" && auth.VerifyJWTToken(token) {
			c.Next()
			return
		}
		if strings.HasPrefix(token, "sk-"+conf.APP_NAME+"-") {
			apiKeyObj, err := op.APIKeyGetByAPIKey(token, c.Request.Context())
			if err == nil && apiKeyObj.Enabled {
				c.Set("api_key_id", apiKeyObj.ID)
				c.Set("api_key_name", apiKeyObj.Name)
				c.Next()
				return
			}
		}
		resp.Error(c, http.StatusUnauthorized, resp.ErrUnauthorized)
		c.Abort()
	}
}

func APIKeyAuth() gin.HandlerFunc {
	return func(c *gin.Context) {
		var apiKey string
		var requestType string

		if key := c.Request.Header.Get("x-api-key"); key != "" {
			apiKey = key
			requestType = "anthropic"
		} else if auth := c.Request.Header.Get("Authorization"); auth != "" {
			apiKey = strings.TrimPrefix(auth, "Bearer ")
			requestType = "openai"
		}

		if apiKey == "" {
			resp.Error(c, http.StatusUnauthorized, resp.ErrUnauthorized)
			c.Abort()
			return
		}

		if !strings.HasPrefix(apiKey, "sk-"+conf.APP_NAME+"-") {
			resp.Error(c, http.StatusUnauthorized, resp.ErrUnauthorized)
			c.Abort()
			return
		}
		apiKeyObj, err := op.APIKeyGetByAPIKey(apiKey, c.Request.Context())
		if err != nil {
			resp.Error(c, http.StatusUnauthorized, resp.ErrUnauthorized)
			c.Abort()
			return
		}
		if !apiKeyObj.Enabled {
			resp.Error(c, http.StatusUnauthorized, "API key is disabled")
			c.Abort()
			return
		}
		if apiKeyObj.ExpireAt > 0 && apiKeyObj.ExpireAt < time.Now().Unix() {
			resp.Error(c, http.StatusUnauthorized, "API key has expired")
			c.Abort()
			return
		}
		statsAPIKey := op.StatsAPIKeyGet(apiKeyObj.ID)
		if apiKeyObj.MaxCost > 0 && apiKeyObj.MaxCost < statsAPIKey.StatsMetrics.OutputCost+statsAPIKey.StatsMetrics.InputCost {
			resp.Error(c, http.StatusUnauthorized, "API key has reached the max cost")
			c.Abort()
			return
		}
		c.Set("request_type", requestType)
		c.Set("supported_models", apiKeyObj.SupportedModels)
		c.Set("api_key_unlimited_models", apiKeyObj.UnlimitedModels)
		c.Set("api_key_model_pro", apiKeyObj.ModelPro)
		c.Set("api_key_model_flash", apiKeyObj.ModelFlash)
		c.Set("api_key_model_vision", apiKeyObj.ModelVision)
		c.Set("api_key_id", apiKeyObj.ID)
		c.Next()
	}
}
