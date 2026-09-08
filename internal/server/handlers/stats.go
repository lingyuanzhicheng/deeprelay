package handlers

import (
	"net/http"
	"time"

	"github.com/lingyuanzhicheng/deeprelay/internal/relay/balancer"
	"github.com/lingyuanzhicheng/deeprelay/internal/op"
	"github.com/lingyuanzhicheng/deeprelay/internal/server/middleware"
	"github.com/lingyuanzhicheng/deeprelay/internal/server/resp"
	"github.com/lingyuanzhicheng/deeprelay/internal/server/router"
	"github.com/gin-gonic/gin"
)

func init() {
	router.NewGroupRouter("/api/v1/stats").
		Use(middleware.Auth()).
		AddRoute(
			router.NewRoute("/today", http.MethodGet).
				Handle(getStatsToday),
		).
		AddRoute(
			router.NewRoute("/daily", http.MethodGet).
				Handle(getStatsDaily),
		).
		AddRoute(
			router.NewRoute("/hourly", http.MethodGet).
				Handle(getStatsHourly),
		).
		AddRoute(
			router.NewRoute("/total", http.MethodGet).
				Handle(getStatsTotal),
		).
		AddRoute(
			router.NewRoute("/apikey", http.MethodGet).
				Handle(getStatsAPIKey),
		).
		AddRoute(
			router.NewRoute("/realtime", http.MethodGet).
				Handle(getStatsRealtime),
		).
		AddRoute(
			router.NewRoute("/breaker", http.MethodGet).
				Handle(getStatsBreaker),
		)
}

func getStatsToday(c *gin.Context) {
	resp.Success(c, op.StatsTodayGet())
}

func getStatsDaily(c *gin.Context) {
	statsDaily, err := op.StatsGetDaily(c.Request.Context())
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, statsDaily)
}

func getStatsHourly(c *gin.Context) {
	resp.Success(c, op.StatsHourlyGet())
}

func getStatsTotal(c *gin.Context) {
	resp.Success(c, op.StatsTotalGet())
}

func getStatsAPIKey(c *gin.Context) {
	resp.Success(c, op.StatsAPIKeyList())
}

func getStatsRealtime(c *gin.Context) {
	r, err := op.StatsRealtimeGet(c.Request.Context(), time.Minute)
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, r)
}

func getStatsBreaker(c *gin.Context) {
	total, healthy := balancer.GetStats()
	resp.Success(c, gin.H{
		"total":   total,
		"healthy": healthy,
	})
}
