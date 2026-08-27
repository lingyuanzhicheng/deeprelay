package model

// ChannelLLMPrice 表示某个渠道下单个模型的实际结算单价与 modelsdev 绑定关系。
// 价格唯一来源是 DB（+内存缓存镜像）；modelsdev 仅在按绑定同步时作为外部数据源。
type ChannelLLMPrice struct {
	ID        int     `json:"id" gorm:"primaryKey"`
	ChannelID int     `json:"channel_id" gorm:"uniqueIndex:idx_channel_model;not null"`
	ModelName string  `json:"model_name" gorm:"uniqueIndex:idx_channel_model;not null"`

	// 实际结算单价（用户配置或自动同步而来），单位：$/M tokens
	Input      float64 `json:"input" gorm:"default:0"`
	Output     float64 `json:"output" gorm:"default:0"`
	CacheRead  float64 `json:"cache_read" gorm:"default:0"`
	CacheWrite float64 `json:"cache_write" gorm:"default:0"`

	// modelsdev 绑定（为空表示未绑定，自动同步时跳过）
	BindProvider string `json:"bind_provider,omitempty" gorm:"default:''"`
	BindModelID  string `json:"bind_model_id,omitempty" gorm:"default:''"`
}

// ChannelLLMPriceBind 单条绑定请求项（批量绑定时使用）。
type ChannelLLMPriceBind struct {
	ModelName string `json:"model_name" binding:"required"`
	Provider string `json:"provider" binding:"required"`
	ModelID  string `json:"model_id" binding:"required"`
}

// ChannelLLMPriceBatchBindRequest 批量绑定请求体。
type ChannelLLMPriceBatchBindRequest struct {
	ChannelID int                    `json:"channel_id" binding:"required"`
	Items     []ChannelLLMPriceBind  `json:"items" binding:"required"`
}

// ChannelLLMPriceAutoMatchRequest 自动匹配绑定请求体。
type ChannelLLMPriceAutoMatchRequest struct {
	ChannelID  int      `json:"channel_id" binding:"required"`
	ModelNames []string `json:"model_names" binding:"required"`
	Provider   string   `json:"provider" binding:"required"`
	Mode       int      `json:"mode"` // 1=Fuzzy, 2=Exact（复用 AutoGroupType 语义）
}
