package model

import (
	"math/rand"
	"sort"
	"sync/atomic"
	"time"

	"github.com/lingyuanzhicheng/deeprelay/internal/transformer/outbound"
)

type AutoGroupType int

const (
	AutoGroupTypeNone  AutoGroupType = 0 //不自动分组
	AutoGroupTypeFuzzy AutoGroupType = 1 //模糊匹配
	AutoGroupTypeExact AutoGroupType = 2 //准确匹配
	AutoGroupTypeRegex AutoGroupType = 3 //正则匹配
)

// KeyCostType 密钥成本类型
type KeyCostType int

const (
	KeyCostTypeUnlimited  KeyCostType = 0 // 免费套餐/不限
	KeyCostTypePeriod    KeyCostType = 1 // 周期额度（按周期重置）
	KeyCostTypePayAsYouGo KeyCostType = 2 // 按量计费（用尽即止）
)

// KeySelectMode 密钥选择策略
type KeySelectMode int

const (
	KeySelectModeCostAware  KeySelectMode = 0 // 成本均衡：选 UsedCost 最低的
	KeySelectModeRoundRobin KeySelectMode = 1 // 轮询
	KeySelectModeRandom     KeySelectMode = 2 // 随机
	KeySelectModeFailover   KeySelectMode = 3 // 故障转移：按 Priority 排序取第一个
	KeySelectModeWeighted   KeySelectMode = 4 // 加权：按 Weight 加权随机
)

var roundRobinKeyCounter uint64

type Channel struct {
	ID            int                   `json:"id" gorm:"primaryKey"`
	Name          string                `json:"name" gorm:"unique;not null"`
	Type          outbound.OutboundType `json:"type"`
	Enabled       bool                  `json:"enabled" gorm:"default:true"`
	BaseUrls      []BaseUrl             `json:"base_urls" gorm:"serializer:json"`
	Keys          []ChannelKey          `json:"keys" gorm:"foreignKey:ChannelID"`
	Model         string                `json:"model"`
	CustomModel   string                `json:"custom_model"`
	Proxy         bool                  `json:"proxy" gorm:"default:false"`
	AutoSync      bool                  `json:"auto_sync" gorm:"default:false"`
	AutoGroup     AutoGroupType         `json:"auto_group" gorm:"default:0"`
	CustomHeader  []CustomHeader        `json:"custom_header" gorm:"serializer:json"`
	ParamOverride *string               `json:"param_override"`
	ChannelProxy  *string               `json:"channel_proxy"`
	Stats         *StatsChannel         `json:"stats,omitempty" gorm:"foreignKey:ChannelID"`
	MatchRegex    *string               `json:"match_regex"`
	KeySelectMode KeySelectMode         `json:"key_select_mode" gorm:"default:0"`
}

type BaseUrl struct {
	URL   string `json:"url"`
	Delay int    `json:"delay"`
}

type CustomHeader struct {
	HeaderKey   string `json:"header_key"`
	HeaderValue string `json:"header_value"`
}

type ChannelKey struct {
	ID               int     `json:"id" gorm:"primaryKey"`
	ChannelID        int     `json:"channel_id"`
	Enabled          bool    `json:"enabled" gorm:"default:true"`
	ChannelKey       string  `json:"channel_key"`
	StatusCode       int     `json:"status_code"`
	LastUseTimeStamp int64   `json:"last_use_time_stamp"`
	UsedCost         float64 `json:"used_cost" gorm:"default:0"`
	Remark           string  `json:"remark"`

	// 成本控制
	CostType     KeyCostType `json:"cost_type" gorm:"default:0"`
	PeriodQuota  float64 `json:"period_quota" gorm:"default:0"`
	ResetPeriod  int         `json:"reset_period" gorm:"default:0"`
	PeriodStart  int64       `json:"period_start" gorm:"default:0"`
	MaxCost      float64     `json:"max_cost" gorm:"default:0"`

	// 流量控制
	MaxRPM        int `json:"max_rpm" gorm:"default:0"`
	MaxConcurrent int `json:"max_concurrent" gorm:"default:0"`

	// 负载均衡参数
	Priority int `json:"priority" gorm:"default:0"`
	Weight   int `json:"weight" gorm:"default:1"`
}

// ChannelUpdateRequest 渠道更新请求 - 仅包含变更的数据
type ChannelUpdateRequest struct {
	ID            int                    `json:"id" binding:"required"`
	Name          *string                `json:"name,omitempty"`
	Type          *outbound.OutboundType `json:"type,omitempty"`
	Enabled       *bool                  `json:"enabled,omitempty"`
	BaseUrls      *[]BaseUrl             `json:"base_urls,omitempty"`
	Model         *string                `json:"model,omitempty"`
	CustomModel   *string                `json:"custom_model,omitempty"`
	Proxy         *bool                  `json:"proxy,omitempty"`
	AutoSync      *bool                  `json:"auto_sync,omitempty"`
	AutoGroup     *AutoGroupType         `json:"auto_group,omitempty"`
	CustomHeader  *[]CustomHeader        `json:"custom_header,omitempty"`
	ChannelProxy  *string                `json:"channel_proxy,omitempty"`
	ParamOverride *string                `json:"param_override,omitempty"`
	MatchRegex    *string                `json:"match_regex,omitempty"`
	KeySelectMode *KeySelectMode         `json:"key_select_mode,omitempty"`

	KeysToAdd    []ChannelKeyAddRequest    `json:"keys_to_add,omitempty"`
	KeysToUpdate []ChannelKeyUpdateRequest `json:"keys_to_update,omitempty"`
	KeysToDelete []int                     `json:"keys_to_delete,omitempty"`
}

type ChannelKeyAddRequest struct {
	Enabled       bool         `json:"enabled"`
	ChannelKey    string       `json:"channel_key" binding:"required"`
	Remark        string       `json:"remark"`
	CostType      *KeyCostType `json:"cost_type,omitempty"`
	PeriodQuota  *float64     `json:"period_quota,omitempty"`
	ResetPeriod   *int         `json:"reset_period,omitempty"`
	PeriodStart   *int64       `json:"period_start,omitempty"`
	MaxCost       *float64     `json:"max_cost,omitempty"`
	MaxRPM        *int         `json:"max_rpm,omitempty"`
	MaxConcurrent *int         `json:"max_concurrent,omitempty"`
	Priority      *int         `json:"priority,omitempty"`
	Weight        *int         `json:"weight,omitempty"`
}

type ChannelKeyUpdateRequest struct {
	ID            int          `json:"id" binding:"required"`
	Enabled       *bool        `json:"enabled,omitempty"`
	ChannelKey    *string      `json:"channel_key,omitempty"`
	Remark        *string      `json:"remark,omitempty"`
	CostType      *KeyCostType `json:"cost_type,omitempty"`
	PeriodQuota  *float64     `json:"period_quota,omitempty"`
	ResetPeriod   *int         `json:"reset_period,omitempty"`
	PeriodStart   *int64       `json:"period_start,omitempty"`
	MaxCost       *float64     `json:"max_cost,omitempty"`
	MaxRPM        *int         `json:"max_rpm,omitempty"`
	MaxConcurrent *int         `json:"max_concurrent,omitempty"`
	Priority      *int         `json:"priority,omitempty"`
	Weight        *int         `json:"weight,omitempty"`
}

// ChannelFetchModelRequest is used by /channel/fetch-model (not persisted).
type ChannelFetchModelRequest struct {
	Type    outbound.OutboundType `json:"type" binding:"required"`
	BaseURL string                `json:"base_url" binding:"required"`
	Key     string                `json:"key" binding:"required"`
	Proxy   bool                  `json:"proxy"`
}

func (c *Channel) GetBaseUrl() string {
	if c == nil || len(c.BaseUrls) == 0 {
		return ""
	}

	bestURL := ""
	bestDelay := 0
	bestSet := false

	for _, bu := range c.BaseUrls {
		if bu.URL == "" {
			continue
		}
		if !bestSet || bu.Delay < bestDelay {
			bestURL = bu.URL
			bestDelay = bu.Delay
			bestSet = true
		}
	}

	return bestURL
}

func (c *Channel) GetChannelKey() ChannelKey {
	keys := c.GetChannelKeys()
	if len(keys) == 0 {
		return ChannelKey{}
	}
	return keys[0]
}

// GetChannelKeys 返回按当前密钥策略排列的静态可用密钥候选。
func (c *Channel) GetChannelKeys() []ChannelKey {
	available := c.filterAvailableKeys()
	if len(available) == 0 {
		return nil
	}

	switch c.KeySelectMode {
	case KeySelectModeRoundRobin:
		return c.orderRoundRobin(available)
	case KeySelectModeRandom:
		return c.orderRandom(available)
	case KeySelectModeFailover:
		return c.orderFailover(available)
	case KeySelectModeWeighted:
		return c.orderWeighted(available)
	default:
		return c.orderCostAware(available)
	}
}

func (c *Channel) filterAvailableKeys() []ChannelKey {
	if c == nil || len(c.Keys) == 0 {
		return nil
	}

	now := time.Now().Unix()
	var available []ChannelKey

	for _, k := range c.Keys {
		if !k.Enabled || k.ChannelKey == "" {
			continue
		}

		// 429 冷却 5 分钟
		if k.StatusCode == 429 && k.LastUseTimeStamp > 0 {
			if now-k.LastUseTimeStamp < int64(5*time.Minute/time.Second) {
				continue
			}
		}

		// 成本限额检查
		if !k.isCostAvailable(now) {
			continue
		}

		available = append(available, k)
	}

	return available
}

func (k *ChannelKey) isCostAvailable(now int64) bool {
	switch k.CostType {
	case KeyCostTypeUnlimited:
		return true

	case KeyCostTypePeriod:
		// 检查周期是否到期
		if k.PeriodStart > 0 {
			if k.ResetPeriod > 0 {
				elapsed := now - k.PeriodStart
				if elapsed >= int64(k.ResetPeriod)*86400 {
					k.UsedCost = 0
					k.PeriodStart = now
				}
			}
		} else {
			k.PeriodStart = now
		}
		if k.PeriodQuota > 0 && k.UsedCost >= k.PeriodQuota {
			return false
		}
		return true

	case KeyCostTypePayAsYouGo:
		if k.MaxCost > 0 && k.UsedCost >= k.MaxCost {
			return false
		}
		return true
	}
	return true
}

func (c *Channel) orderCostAware(keys []ChannelKey) []ChannelKey {
	result := make([]ChannelKey, len(keys))
	copy(result, keys)
	sort.Slice(result, func(i, j int) bool {
		return result[i].UsedCost < result[j].UsedCost
	})
	return result
}

func (c *Channel) orderRoundRobin(keys []ChannelKey) []ChannelKey {
	n := len(keys)
	result := make([]ChannelKey, len(keys))
	copy(result, keys)
	offset := int(atomic.AddUint64(&roundRobinKeyCounter, 1) % uint64(n))
	for i := 0; i < n; i++ {
		result[i] = keys[(i+offset)%n]
	}
	return result
}

func (c *Channel) orderRandom(keys []ChannelKey) []ChannelKey {
	result := make([]ChannelKey, len(keys))
	copy(result, keys)
	rand.Shuffle(len(result), func(i, j int) {
		result[i], result[j] = result[j], result[i]
	})
	return result
}

func (c *Channel) orderFailover(keys []ChannelKey) []ChannelKey {
	result := make([]ChannelKey, len(keys))
	copy(result, keys)
	sort.Slice(result, func(i, j int) bool {
		return result[i].Priority < result[j].Priority
	})
	return result
}

func (c *Channel) orderWeighted(keys []ChannelKey) []ChannelKey {
	totalWeight := 0
	for _, k := range keys {
		w := k.Weight
		if w <= 0 {
			w = 1
		}
		totalWeight += w
	}

	type weightedKey struct {
		key   ChannelKey
		score float64
	}

	scored := make([]weightedKey, len(keys))
	for i, k := range keys {
		w := k.Weight
		if w <= 0 {
			w = 1
		}
		scored[i] = weightedKey{
			key:   k,
			score: rand.Float64() * float64(w) / float64(totalWeight),
		}
	}

	sort.Slice(scored, func(i, j int) bool {
		return scored[i].score > scored[j].score
	})

	result := make([]ChannelKey, len(keys))
	for i, s := range scored {
		result[i] = s.key
	}
	return result
}
