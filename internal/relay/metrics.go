package relay

import (
	"context"
	"encoding/json"
	"fmt"
	"maps"
	"strings"
	"time"

	"github.com/lingyuanzhicheng/deeprelay/internal/model"
	"github.com/lingyuanzhicheng/deeprelay/internal/op"
	"github.com/lingyuanzhicheng/deeprelay/internal/price"
	transformerModel "github.com/lingyuanzhicheng/deeprelay/internal/transformer/model"
	"github.com/lingyuanzhicheng/deeprelay/internal/utils/log"
	"github.com/lingyuanzhicheng/deeprelay/internal/utils/snowflake"
)

// RelayMetrics 负责最终的日志收集与持久化
type RelayMetrics struct {
	APIKeyID     int
	RequestModel string
	StartTime    time.Time

	// 首 Token 时间
	FirstTokenTime time.Time

	// 请求和响应内容
	InternalRequest  *transformerModel.InternalLLMRequest
	InternalResponse *transformerModel.InternalLLMResponse

	// 统计指标
	ActualModel string
	GroupID     int

	// Stats token 计数 + 渠道进价成本（channel_llm_prices）
	Stats model.StatsMetrics
	// APIKeyStats 密钥售价收入（llminfo 价格），token 计数与 Stats 相同
	APIKeyStats model.StatsMetrics

	// 参数覆盖
	ParamOverride string

	// ChannelID 用于按渠道查价（成本计算的渠道维度）
	ChannelID int

	// ProgressID 进行中日志的预生成 ID：pending/streaming 进度事件与最终落库日志共用
	ProgressID int64
}

func NewRelayMetrics(apiKeyID int, requestModel string, req *transformerModel.InternalLLMRequest, groupID int) *RelayMetrics {
	return &RelayMetrics{
		APIKeyID:        apiKeyID,
		RequestModel:    requestModel,
		StartTime:       time.Now(),
		InternalRequest: req,
		GroupID:         groupID,
		ProgressID:      snowflake.GenerateID(),
	}
}

func (m *RelayMetrics) SetFirstTokenTime(t time.Time) {
	m.FirstTokenTime = t
}

// NotifyProgress 将进行中日志的进度事件推送给 SSE 订阅者
// status: pending=请求中, streaming=传输中
func (m *RelayMetrics) NotifyProgress(status string) {
	relayLog := model.RelayLog{
		ID:               m.ProgressID,
		Time:             m.StartTime.Unix(),
		RequestModelName: m.RequestModel,
		Status:           status,
		RequestContent:   m.requestContentForLog(),
	}
	if apiKey, getErr := op.APIKeyGet(m.APIKeyID, context.Background()); getErr == nil {
		relayLog.RequestAPIKeyName = apiKey.Name
	}
	op.RelayLogNotify(relayLog)
}

func (m *RelayMetrics) SetInternalResponse(resp *transformerModel.InternalLLMResponse, actualModel string, channelID int) {
	m.InternalResponse = resp
	m.ActualModel = actualModel
	m.ChannelID = channelID

	if resp == nil || resp.Usage == nil {
		return
	}

	m.Stats = computeUsageMetrics(resp.Usage, price.GetChannelLLMPrice(channelID, actualModel))
	m.APIKeyStats = computeUsageMetrics(resp.Usage, price.GetLLMInfoPrice(m.GroupID))
}

func (m *RelayMetrics) Save(ctx context.Context, success bool, err error, attempts []model.ChannelAttempt) {
	duration := time.Since(m.StartTime)

	channelMetrics := m.Stats
	apiKeyMetrics := m.APIKeyStats
	if success {
		channelMetrics.RequestSuccess = 1
		apiKeyMetrics.RequestSuccess = 1
	} else {
		channelMetrics.RequestFailed = 1
		apiKeyMetrics.RequestFailed = 1
	}

	channelID, channelName := finalChannel(attempts)

	// 密钥收入侧（售价）
	op.StatsTotalUpdate(apiKeyMetrics)
	op.StatsHourlyUpdate(apiKeyMetrics)
	op.StatsDailyUpdate(context.Background(), apiKeyMetrics)
	op.StatsAPIKeyUpdate(m.APIKeyID, apiKeyMetrics)
	if m.GroupID > 0 {
		op.StatsModelUpdate(model.StatsModel{GroupID: m.GroupID, StatsMetrics: apiKeyMetrics})
	}

	// 渠道成本侧（进价）
	op.StatsChannelUpdate(channelID, channelMetrics)

	log.Infof("relay complete: model=%s, channel=%d(%s), success=%t, duration=%dms, input_token=%d, output_token=%d, channel_cost=%f, apikey_revenue=%f, attempts=%d",
		m.RequestModel, channelID, channelName, success, duration.Milliseconds(),
		m.Stats.InputToken, m.Stats.OutputToken,
		channelMetrics.Total(), apiKeyMetrics.Total(), len(attempts))

	if revErr := op.APIKeyIncRevenue(m.APIKeyID, apiKeyMetrics.Total()); revErr != nil {
		log.Warnf("failed to update api key revenue: %v", revErr)
	}

	m.saveLog(ctx, err, duration, attempts, channelID, channelName)
}

func finalChannel(attempts []model.ChannelAttempt) (int, string) {
	var lastID int
	var lastName string
	for i := len(attempts) - 1; i >= 0; i-- {
		a := attempts[i]
		if a.Status == model.AttemptSuccess {
			return a.ChannelID, a.ChannelName
		}
		if a.Status == model.AttemptFailed && lastID == 0 {
			lastID = a.ChannelID
			lastName = a.ChannelName
		}
	}
	return lastID, lastName
}

func (m *RelayMetrics) saveLog(ctx context.Context, err error, duration time.Duration, attempts []model.ChannelAttempt, channelID int, channelName string) {
	actualModel := m.ActualModel
	if actualModel == "" {
		actualModel = m.RequestModel
	}

	relayLog := model.RelayLog{
		ID:               m.ProgressID,
		Time:             m.StartTime.Unix(),
		RequestModelName: m.RequestModel,
		ChannelName:      channelName,
		ChannelId:        channelID,
		ActualModelName:  actualModel,
		UseTime:          int(duration.Milliseconds()),
		Attempts:         attempts,
		TotalAttempts:    len(attempts),
	}

	if apiKey, getErr := op.APIKeyGet(m.APIKeyID, ctx); getErr == nil {
		relayLog.RequestAPIKeyName = apiKey.Name
	}

	// 首字时间
	if !m.FirstTokenTime.IsZero() {
		relayLog.Ftut = int(m.FirstTokenTime.Sub(m.StartTime).Milliseconds())
	}

	// Usage 与 8 维成本（渠道进价 + 密钥售价）
	relayLog.InputTokens = int(m.Stats.InputToken)
	relayLog.CacheReadTokens = int(m.Stats.CacheReadToken)
	relayLog.CacheWriteTokens = int(m.Stats.CacheWriteToken)
	relayLog.OutputTokens = int(m.Stats.OutputToken)
	relayLog.ChannelInputCost = m.Stats.InputCost
	relayLog.ChannelCacheReadCost = m.Stats.CacheReadCost
	relayLog.ChannelCacheWriteCost = m.Stats.CacheWriteCost
	relayLog.ChannelOutputCost = m.Stats.OutputCost
	relayLog.APIKeyInputCost = m.APIKeyStats.InputCost
	relayLog.APIKeyCacheReadCost = m.APIKeyStats.CacheReadCost
	relayLog.APIKeyCacheWriteCost = m.APIKeyStats.CacheWriteCost
	relayLog.APIKeyOutputCost = m.APIKeyStats.OutputCost

	// 生成速率
	relayLog.Tps = computeTPS(m.Stats.OutputToken, relayLog.UseTime, relayLog.Ftut)

	relayLog.RequestContent = m.requestContentForLog()

	// 响应内容
	if m.InternalResponse != nil {
		respForLog := m.filterResponseForLog(m.InternalResponse)
		if respJSON, jsonErr := json.Marshal(respForLog); jsonErr == nil {
			if m.InternalResponse.Usage != nil && m.InternalResponse.Usage.AnthropicUsage {
				respStr := string(respJSON)
				old := `"usage":{`
				insert := fmt.Sprintf(`"usage":{"cache_creation_input_tokens":%d,`, m.InternalResponse.Usage.CacheCreationInputTokens)
				respJSON = []byte(strings.Replace(respStr, old, insert, 1))
			}
			relayLog.ResponseContent = string(respJSON)
		}
	}

	// 错误信息
	if err != nil {
		relayLog.Error = err.Error()
	}

	if logErr := op.RelayLogAdd(ctx, relayLog); logErr != nil {
		log.Warnf("failed to save relay log: %v", logErr)
	}
}

// filterResponseForLog 创建响应的浅拷贝，过滤掉 images、MultipleContent 中的图片数据和 Audio.Data 以减少存储压力
func (m *RelayMetrics) filterResponseForLog(resp *transformerModel.InternalLLMResponse) *transformerModel.InternalLLMResponse {
	if resp == nil {
		return nil
	}

	filterMsg := func(msg *transformerModel.Message) *transformerModel.Message {
		if msg == nil {
			return nil
		}
		c := *msg
		c.Images = nil
		if len(c.Content.MultipleContent) > 0 {
			parts := make([]transformerModel.MessageContentPart, 0, len(c.Content.MultipleContent))
			for _, p := range c.Content.MultipleContent {
				if p.Type == "image_url" && p.ImageURL != nil {
					parts = append(parts, transformerModel.MessageContentPart{
						Type:     "image_url",
						ImageURL: &transformerModel.ImageURL{URL: "[image data omitted for storage]"},
					})
				} else {
					parts = append(parts, p)
				}
			}
			c.Content = transformerModel.MessageContent{Content: c.Content.Content, MultipleContent: parts}
		}
		if c.Audio != nil && c.Audio.Data != "" {
			a := *c.Audio
			a.Data = "[audio data omitted for storage]"
			c.Audio = &a
		}
		return &c
	}

	filtered := *resp
	filtered.Choices = make([]transformerModel.Choice, len(resp.Choices))
	for i, choice := range resp.Choices {
		filtered.Choices[i] = choice
		filtered.Choices[i].Message = filterMsg(choice.Message)
		filtered.Choices[i].Delta = filterMsg(choice.Delta)
	}
	return &filtered
}

// requestContentForLog 构建请求内容 JSON（应用 ParamOverride 后的最终请求体）
func (m *RelayMetrics) requestContentForLog() string {
	if m.InternalRequest == nil {
		return ""
	}
	reqJSON, jsonErr := json.Marshal(m.InternalRequest)
	if jsonErr != nil {
		return fmt.Sprintf(`{"error":"marshal request failed: %s"}`, jsonErr)
	}
	if m.ParamOverride == "" {
		return string(reqJSON)
	}
	var reqMap map[string]any
	if err := json.Unmarshal(reqJSON, &reqMap); err != nil {
		return string(reqJSON)
	}
	var override map[string]any
	if err := json.Unmarshal([]byte(m.ParamOverride), &override); err != nil {
		return string(reqJSON)
	}
	maps.Copy(reqMap, override)
	finalJSON, err := json.Marshal(reqMap)
	if err != nil {
		return string(reqJSON)
	}
	return string(finalJSON)
}
