package model

// AttemptStatus 尝试状态
type AttemptStatus string

const (
	AttemptSuccess      AttemptStatus = "success"       // 转发成功
	AttemptFailed       AttemptStatus = "failed"        // 转发失败
	AttemptCircuitBreak AttemptStatus = "circuit_break" // 熔断跳过
	AttemptSkipped      AttemptStatus = "skipped"        // 其他原因跳过（禁用、无Key、类型不兼容等）
)

// ChannelAttempt 记录单次渠道尝试的决策和结果
type ChannelAttempt struct {
	ChannelID    int           `json:"channel_id"`
	ChannelKeyID int           `json:"channel_key_id,omitempty"`
	ChannelName  string        `json:"channel_name"`
	ModelName    string        `json:"model_name"`
	AttemptNum   int           `json:"attempt_num"`
	Status       AttemptStatus `json:"status"`
	Duration     int           `json:"duration"`
	Sticky       bool          `json:"sticky,omitempty"`
	Msg          string        `json:"msg,omitempty"`
}

type RelayLog struct {
	ID                int64            `json:"id" gorm:"primaryKey;autoIncrement:false"` // Snowflake ID
	Time              int64            `json:"time"`                                     // 时间戳（秒）
	RequestModelName  string           `json:"request_model_name"`                       // 请求模型名称
	RequestAPIKeyName string           `json:"request_api_key_name"`                     // 请求使用的 API Key 名称
	ChannelId         int              `json:"channel"`                                  // 实际使用的渠道ID
	ChannelName       string           `json:"channel_name"`                             // 渠道名称
	ActualModelName   string           `json:"actual_model_name"`                        // 实际使用模型名称

	// Token counts
	InputTokens      int `json:"input_tokens"`      // 输入Token
	CacheReadTokens  int `json:"cache_read_tokens"` // 缓存读取Token
	CacheWriteTokens int `json:"cache_write_tokens"`// 缓存写入Token
	OutputTokens     int `json:"output_tokens"`     // 输出 Token

	// 时序
	Ftut    int     `json:"ftut"`    // 首字时间(毫秒)
	UseTime int     `json:"use_time"`// 总用时(毫秒)
	Tps     float64 `json:"tps"`     // tokens/sec（生成阶段输出速率）

	// 渠道侧成本（进价 = channel_llm_prices × token）
	ChannelInputCost       float64 `json:"channel_input_cost"`
	ChannelOutputCost      float64 `json:"channel_output_cost"`
	ChannelCacheReadCost   float64 `json:"channel_cache_read_cost"`
	ChannelCacheWriteCost  float64 `json:"channel_cache_write_cost"`

	// 密钥侧收入（售价 = llminfo × token），关联 group_id（c7dacd4 后由 GroupGetEnabledMap 推导）
	APIKeyInputCost        float64 `json:"apikey_input_cost"`
	APIKeyOutputCost       float64 `json:"apikey_output_cost"`
	APIKeyCacheReadCost    float64 `json:"apikey_cache_read_cost"`
	APIKeyCacheWriteCost   float64 `json:"apikey_cache_write_cost"`

	// 元数据
	RequestContent   string           `json:"request_content"`
	ResponseContent  string           `json:"response_content"`
	Error            string           `json:"error"`
	Attempts         []ChannelAttempt `json:"attempts" gorm:"serializer:json"`
	TotalAttempts    int              `json:"total_attempts"`

	// Status 进行中标记：pending=请求中（已路由未收到响应）、streaming=传输中（已收到响应正流式回传）。
	// 仅通过 SSE 实时推送，落库的终态日志该字段为空
	Status string `json:"status,omitempty" gorm:"-:migration;-:all"`
}
