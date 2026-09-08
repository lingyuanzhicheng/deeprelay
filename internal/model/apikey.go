package model

type APIKey struct {
	ID              int     `json:"id" gorm:"primaryKey"`
	Name            string  `json:"name" gorm:"not null"`
	APIKey          string  `json:"api_key" gorm:"not null"`
	Enabled         bool    `json:"enabled" gorm:"default:true"`
	ExpireAt        int64   `json:"expire_at,omitempty"`
	MaxCost         float64 `json:"max_cost,omitempty"`
	SupportedModels string  `json:"supported_models,omitempty"`
	UnlimitedModels bool    `json:"unlimited_models" gorm:"default:false"`
	ModelPro    string `json:"model_pro,omitempty"`
	ModelFlash  string `json:"model_flash,omitempty"`
	ModelVision string `json:"model_vision,omitempty"`
	// Revenue 累计收入（售价 = llminfo 价格 × 实际 token），与渠道进价双轨并行
	Revenue float64 `json:"revenue" gorm:"default:0"`
}
