package price

import (
	"github.com/lingyuanzhicheng/deeprelay/internal/model"
	"github.com/lingyuanzhicheng/deeprelay/internal/op"
)

// GetChannelLLMPrice 按渠道+模型查价；查不到返回 nil（relay 侧据此判 cost=0 或跳过）。
// 价格唯一来源是 ChannelLLMPrice 表的内存缓存镜像，无全局兜底。
func GetChannelLLMPrice(channelID int, modelName string) *model.LLMPrice {
	p, ok := op.ChannelLLMPriceGet(channelID, modelName)
	if !ok {
		return nil
	}
	return &model.LLMPrice{
		Input:      p.Input,
		Output:     p.Output,
		CacheRead:  p.CacheRead,
		CacheWrite: p.CacheWrite,
	}
}
