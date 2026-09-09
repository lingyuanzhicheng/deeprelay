package handlers

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/lingyuanzhicheng/deeprelay/internal/model"
	"github.com/lingyuanzhicheng/deeprelay/internal/op"
	"github.com/lingyuanzhicheng/deeprelay/internal/server/middleware"
	"github.com/lingyuanzhicheng/deeprelay/internal/server/resp"
	"github.com/lingyuanzhicheng/deeprelay/internal/server/router"
	"github.com/samber/lo"
)

type llminfoItem struct {
	model.LLMInfo
	GroupName string             `json:"group_name"`
	Stats     model.StatsMetrics `json:"stats"`
}

func init() {
	router.NewGroupRouter("/api/v1/llminfo").
		Use(middleware.AuthOrAPIKey()).
		AddRoute(
			router.NewRoute("/list", http.MethodGet).Handle(listLLMInfos),
		)
	router.NewGroupRouter("/api/v1/llminfo").
		Use(middleware.Auth()).
		Use(middleware.RequireJSON()).
		AddRoute(
			router.NewRoute("/update", http.MethodPost).Handle(updateLLMInfo),
		)
}

// listLLMInfos 以 groups 为主表联查 llminfo 与 stats_models，缺失的 llminfo 以默认值补齐。
func listLLMInfos(c *gin.Context) {
	infos, err := op.LLMInfoList(c.Request.Context())
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	infoByGroup := make(map[int]model.LLMInfo, len(infos))
	for _, info := range infos {
		infoByGroup[info.GroupID] = info
	}

	groups, err := op.GroupList(c.Request.Context())
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	items := make([]llminfoItem, 0, len(groups))
	for _, group := range groups {
		info, ok := infoByGroup[group.ID]
		if !ok {
			info = model.LLMInfo{GroupID: group.ID}
		}
		items = append(items, llminfoItem{
			LLMInfo:   info,
			GroupName: group.Name,
			Stats:     op.StatsModelGet(group.ID).StatsMetrics,
		})
	}

	// 密钥登录：按密钥支持的模型过滤（unlimited 全部可见；未指定任何模型则列表为空）
	if keyID := c.GetInt("api_key_id"); keyID > 0 {
		if apiKey, keyErr := op.APIKeyGet(keyID, c.Request.Context()); keyErr == nil {
			if apiKey.UnlimitedModels {
				// 全部可见，不过滤
			} else if strings.TrimSpace(apiKey.SupportedModels) == "" {
				items = nil
			} else {
				allowed := make(map[string]struct{})
				for _, name := range strings.Split(apiKey.SupportedModels, ",") {
					if name = strings.TrimSpace(name); name != "" {
						allowed[name] = struct{}{}
					}
				}
				items = lo.Filter(items, func(item llminfoItem, _ int) bool {
					_, ok := allowed[item.GroupName]
					return ok
				})
			}
		}
	}

	resp.Success(c, items)
}

func updateLLMInfo(c *gin.Context) {
	var info model.LLMInfo
	if err := c.ShouldBindJSON(&info); err != nil {
		resp.Error(c, http.StatusBadRequest, err.Error())
		return
	}
	if info.GroupID == 0 {
		resp.Error(c, http.StatusBadRequest, "group_id is required")
		return
	}
	if _, err := op.GroupGet(info.GroupID, c.Request.Context()); err != nil {
		resp.Error(c, http.StatusNotFound, "group not found")
		return
	}
	if err := op.LLMInfoUpsert(&info, c.Request.Context()); err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, info)
}
