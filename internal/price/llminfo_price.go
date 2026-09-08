package price

import (
	"github.com/lingyuanzhicheng/deeprelay/internal/model"
	"github.com/lingyuanzhicheng/deeprelay/internal/op"
)

// GetLLMInfoPrice 按 group_id 查 llminfo 售价（密钥收入侧计费）；无配置返回 nil。
// 与 GetChannelLLMPrice（渠道进价）双轨并行，互不覆盖。
func GetLLMInfoPrice(groupID int) *model.LLMPrice {
	info, ok := op.LLMInfoGetByGroup(groupID)
	if !ok {
		return nil
	}
	return &model.LLMPrice{
		Input:      info.InputPrice,
		Output:     info.OutputPrice,
		CacheRead:  info.CacheReadPrice,
		CacheWrite: info.CacheWritePrice,
	}
}
