package model

// LLMInfo 模型对外信息，1:1 关联 groups.id（llminfo.group_id = groups.id）。
// 全部业务字段（lab/family/.../instruction）均为用户自己填写的文本，
// 价格字段（$/M tokens）用于密钥收入（售价）侧计费。
type LLMInfo struct {
	ID      int `json:"id" gorm:"primaryKey;autoIncrement"`
	GroupID int `json:"group_id" gorm:"uniqueIndex;not null"`

	// 9 文本字段
	Lab          string `json:"lab"`
	Family       string `json:"family"`
	Endpoint     string `json:"endpoint"`
	ContextLimit string `json:"context_limit"`
	OutputLimit  string `json:"output_limit"`
	InputType    string `json:"input_type"`
	OutputType   string `json:"output_type"`

	// 4 布尔字段
	Tools       bool `json:"tools"`
	Reasoning   bool `json:"reasoning"`
	Structured  bool `json:"structured"`
	Temperature bool `json:"temperature"`

	// 4 价格字段（$/M tokens）
	InputPrice      float64 `json:"input_price"`
	OutputPrice     float64 `json:"output_price"`
	CacheReadPrice  float64 `json:"cache_read_price"`
	CacheWritePrice float64 `json:"cache_write_price"`

	// 介绍
	Instruction string `json:"instruction"`
}

// TableName 固定表名为 llminfo（GORM 默认命名是 llm_infos，需与旧全局价表区分开）。
func (LLMInfo) TableName() string { return "llminfo" }
