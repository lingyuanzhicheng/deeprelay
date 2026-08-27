package handlers

import (
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
	"github.com/lingyuanzhicheng/deeprelay/internal/model"
	"github.com/lingyuanzhicheng/deeprelay/internal/op"
	"github.com/lingyuanzhicheng/deeprelay/internal/server/middleware"
	"github.com/lingyuanzhicheng/deeprelay/internal/server/resp"
	"github.com/lingyuanzhicheng/deeprelay/internal/server/router"
)

func init() {
	router.NewGroupRouter("/api/v1/channel-llm-price").
		Use(middleware.Auth()).
		Use(middleware.RequireJSON()).
		AddRoute(
			router.NewRoute("/list", http.MethodGet).Handle(listChannelLLMPrices),
		).
		AddRoute(
			router.NewRoute("/upsert", http.MethodPost).Handle(upsertChannelLLMPrice),
		).
		AddRoute(
			router.NewRoute("/batch-upsert", http.MethodPost).Handle(batchUpsertChannelLLMPrice),
		).
		AddRoute(
			router.NewRoute("/delete", http.MethodPost).Handle(deleteChannelLLMPrice),
		).
		AddRoute(
			router.NewRoute("/bind", http.MethodPost).Handle(bindChannelLLMPrice),
		).
		AddRoute(
			router.NewRoute("/batch-bind", http.MethodPost).Handle(batchBindChannelLLMPrice),
		).
		AddRoute(
			router.NewRoute("/auto-match", http.MethodPost).Handle(autoMatchChannelLLMPrice),
		).
		AddRoute(
			router.NewRoute("/sync-modelsdev", http.MethodPost).Handle(syncModelsDev),
		).
		AddRoute(
			router.NewRoute("/sync-all-modelsdev", http.MethodPost).Handle(syncAllModelsDev),
		).
		AddRoute(
			router.NewRoute("/last-sync-time", http.MethodGet).Handle(getLLMPriceLastSyncTime),
		).
		AddRoute(
			router.NewRoute("/modelsdev/providers", http.MethodGet).Handle(listModelsDevProviders),
		).
		AddRoute(
			router.NewRoute("/modelsdev/models", http.MethodGet).Handle(listModelsDevModels),
		)
}

func listChannelLLMPrices(c *gin.Context) {
	channelIDStr := c.Query("channel_id")
	if channelIDStr == "" {
		resp.Error(c, http.StatusBadRequest, "channel_id is required")
		return
	}
	channelID, err := strconv.Atoi(channelIDStr)
	if err != nil {
		resp.Error(c, http.StatusBadRequest, "invalid channel_id")
		return
	}
	prices, err := op.ChannelLLMPriceListByChannel(channelID)
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, prices)
}

func upsertChannelLLMPrice(c *gin.Context) {
	var p model.ChannelLLMPrice
	if err := c.ShouldBindJSON(&p); err != nil {
		resp.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := op.ChannelLLMPriceUpsert(p, c.Request.Context()); err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, p)
}

func batchUpsertChannelLLMPrice(c *gin.Context) {
	var req struct {
		Items []model.ChannelLLMPrice `json:"items" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		resp.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := op.ChannelLLMPriceBatchUpsert(req.Items, c.Request.Context()); err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, nil)
}

func deleteChannelLLMPrice(c *gin.Context) {
	var req struct {
		ChannelID int    `json:"channel_id" binding:"required"`
		ModelName string `json:"model_name" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		resp.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := op.ChannelLLMPriceDelete(req.ChannelID, req.ModelName, c.Request.Context()); err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, nil)
}

func bindChannelLLMPrice(c *gin.Context) {
	var req struct {
		ChannelID int    `json:"channel_id" binding:"required"`
		ModelName string `json:"model_name" binding:"required"`
		Provider  string `json:"provider" binding:"required"`
		ModelID   string `json:"model_id" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		resp.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := op.ChannelLLMPriceBindSet(req.ChannelID, req.ModelName, req.Provider, req.ModelID, c.Request.Context()); err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, nil)
}

func batchBindChannelLLMPrice(c *gin.Context) {
	var req model.ChannelLLMPriceBatchBindRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		resp.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if err := op.ChannelLLMPriceBatchBind(req, c.Request.Context()); err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, nil)
}

func autoMatchChannelLLMPrice(c *gin.Context) {
	var req model.ChannelLLMPriceAutoMatchRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		resp.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	matched, err := op.ChannelLLMPriceAutoMatch(req, c.Request.Context())
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, gin.H{"matched": matched})
}

func syncModelsDev(c *gin.Context) {
	channelIDStr := c.Query("channel_id")
	if channelIDStr == "" {
		resp.Error(c, http.StatusBadRequest, "channel_id is required")
		return
	}
	channelID, err := strconv.Atoi(channelIDStr)
	if err != nil {
		resp.Error(c, http.StatusBadRequest, "invalid channel_id")
		return
	}
	if err := op.ChannelLLMPriceSyncFromModelsDev(channelID, c.Request.Context()); err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, nil)
}

func listModelsDevProviders(c *gin.Context) {
	providers, err := op.ModelsDevProviders(c.Request.Context())
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, providers)
}

func listModelsDevModels(c *gin.Context) {
	provider := c.Query("provider")
	if provider == "" {
		resp.Error(c, http.StatusBadRequest, "provider is required")
		return
	}
	models, err := op.ModelsDevModels(provider, c.Request.Context())
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, models)
}

func syncAllModelsDev(c *gin.Context) {
	if err := op.ChannelLLMPriceSyncAllFromModelsDev(c.Request.Context()); err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, nil)
}

func getLLMPriceLastSyncTime(c *gin.Context) {
	resp.Success(c, op.ModelsDevLastSyncTime())
}
