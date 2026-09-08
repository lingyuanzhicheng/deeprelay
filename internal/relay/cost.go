package relay

import (
	"github.com/lingyuanzhicheng/deeprelay/internal/model"
	transformerModel "github.com/lingyuanzhicheng/deeprelay/internal/transformer/model"
)

// computeUsageMetrics 按价格表把 usage 折算成 8 维指标。
// token 计数不依赖价格表（无价也记录），缺价时仅成本维度为 0。
func computeUsageMetrics(usage *transformerModel.Usage, p *model.LLMPrice) model.StatsMetrics {
	if usage == nil {
		return model.StatsMetrics{}
	}

	cached := int64(0)
	if usage.PromptTokensDetails != nil {
		cached = usage.PromptTokensDetails.CachedTokens
	}

	metrics := model.StatsMetrics{
		CacheReadToken:  cached,
		CacheWriteToken: usage.CacheCreationInputTokens,
		OutputToken:     usage.CompletionTokens,
	}
	// OpenAI 语义下 PromptTokens 含缓存读取；Anthropic 语义下已是纯非缓存输入
	if usage.AnthropicUsage {
		metrics.InputToken = usage.PromptTokens
	} else {
		nonCached := usage.PromptTokens - cached
		if nonCached < 0 {
			nonCached = 0
		}
		metrics.InputToken = nonCached
	}

	if p == nil {
		return metrics
	}
	metrics.InputCost = float64(metrics.InputToken) * p.Input * 1e-6
	metrics.CacheReadCost = float64(cached) * p.CacheRead * 1e-6
	metrics.CacheWriteCost = float64(metrics.CacheWriteToken) * p.CacheWrite * 1e-6
	metrics.OutputCost = float64(metrics.OutputToken) * p.Output * 1e-6
	return metrics
}

// computeTPS 生成阶段输出速率：非流式（ftut=0）按全程均速，流式扣除首字时间。
func computeTPS(outputTokens int64, useTime, ftut int) float64 {
	if useTime <= ftut || outputTokens <= 0 {
		return 0
	}
	return float64(outputTokens) * 1000 / float64(useTime-ftut)
}
