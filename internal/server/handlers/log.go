package handlers

import (
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"strings"

	"github.com/lingyuanzhicheng/deeprelay/internal/op"
	"github.com/lingyuanzhicheng/deeprelay/internal/server/middleware"
	"github.com/lingyuanzhicheng/deeprelay/internal/server/resp"
	"github.com/lingyuanzhicheng/deeprelay/internal/server/router"
	"github.com/gin-gonic/gin"
)

func init() {
	router.NewGroupRouter("/api/v1/log").
		Use(middleware.AuthOrAPIKey()).
		AddRoute(
			router.NewRoute("/list", http.MethodGet).
				Handle(listLog),
		).
		AddRoute(
			router.NewRoute("/clear", http.MethodDelete).
				Handle(clearLog),
		).
		AddRoute(
			router.NewRoute("/stream-token", http.MethodGet).
				Handle(getStreamToken),
		)

	router.NewGroupRouter("/api/v1/log").
		AddRoute(
			router.NewRoute("/stream", http.MethodGet).
				Handle(streamLog),
		)
}

func listLog(c *gin.Context) {
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	pageSize, _ := strconv.Atoi(c.DefaultQuery("page_size", "20"))
	startTimeStr := c.Query("start_time")
	endTimeStr := c.Query("end_time")

	if page < 1 {
		page = 1
	}
	if pageSize < 1 || pageSize > 100 {
		pageSize = 20
	}

	var startTime, endTime *int
	if startTimeStr != "" {
		st, err := strconv.Atoi(startTimeStr)
		if err != nil {
			resp.Error(c, http.StatusBadRequest, err.Error())
			return
		}
		startTime = &st
	}
	if endTimeStr != "" {
		et, err := strconv.Atoi(endTimeStr)
		if err != nil {
			resp.Error(c, http.StatusBadRequest, err.Error())
			return
		}
		endTime = &et
	}

	logs, err := op.RelayLogList(c.Request.Context(), startTime, endTime, page, pageSize, c.GetString("api_key_name"))
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}

	// 第 1 页附带进行中的日志（pending/streaming），使轮询兜底也能实时看到进度卡片
	if page == 1 {
		scope := c.GetString("api_key_name")
		for _, progressLog := range op.RelayLogActiveProgress() {
			if scope != "" && progressLog.RequestAPIKeyName != scope {
				continue
			}
			if startTime != nil && progressLog.Time < int64(*startTime) {
				continue
			}
			if endTime != nil && progressLog.Time > int64(*endTime) {
				continue
			}
			logs = append(logs, progressLog)
		}
	}

	// 密钥登录视角：剥离错误中的渠道名前缀，隐藏渠道与实际模型信息
	if scope := c.GetString("api_key_name"); scope != "" {
		for i := range logs {
			logs[i].Error = sanitizeRelayError(logs[i].Error)
			logs[i].ChannelName = ""
			logs[i].ActualModelName = ""
			logs[i].Attempts = nil
		}
	}

	resp.Success(c, logs)
}

func clearLog(c *gin.Context) {
	if err := op.RelayLogClear(c.Request.Context()); err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, nil)
}

// sanitizeRelayError 密钥登录视角下剥离错误信息中的渠道名前缀：channel <渠道名> failed: <rest>
func sanitizeRelayError(errText string) string {
	if after, found := strings.CutPrefix(errText, "channel "); found {
		if idx := strings.Index(after, " failed: "); idx >= 0 {
			return after[idx+len(" failed: "):]
		}
	}
	return errText
}

func getStreamToken(c *gin.Context) {
	token, err := op.RelayLogStreamTokenCreate(c.GetString("api_key_name"))
	if err != nil {
		resp.Error(c, http.StatusInternalServerError, err.Error())
		return
	}
	resp.Success(c, gin.H{"token": token})
}

func streamLog(c *gin.Context) {
	token := c.Query("token")
	if token == "" {
		resp.Error(c, http.StatusUnauthorized, "invalid stream token")
		return
	}
	scope, ok := op.RelayLogStreamTokenVerify(token)
	if !ok {
		resp.Error(c, http.StatusUnauthorized, "invalid stream token")
		return
	}

	op.RelayLogStreamTokenRevoke(token)

	c.Header("Content-Type", "text/event-stream")
	c.Header("Cache-Control", "no-cache")
	c.Header("Connection", "keep-alive")
	c.Header("X-Accel-Buffering", "no")

	logChan := op.RelayLogSubscribe()
	defer op.RelayLogUnsubscribe(logChan)

	ctx := c.Request.Context()

	for {
		select {
		case <-ctx.Done():
			return
		case log, ok := <-logChan:
			if !ok {
				return
			}
			if scope != "" && log.RequestAPIKeyName != scope {
				continue
			}
			if scope != "" {
				log.Error = sanitizeRelayError(log.Error)
				log.ChannelName = ""
				log.ActualModelName = ""
				log.Attempts = nil
			}
			data, err := json.Marshal(log)
			if err != nil {
				continue
			}
			c.Writer.Write([]byte(fmt.Sprintf("data: %s\n\n", data)))
			c.Writer.Flush()
		}
	}
}
