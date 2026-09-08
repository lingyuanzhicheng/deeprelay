package op

import (
	"fmt"
	"sync"
	"time"

	"github.com/lingyuanzhicheng/deeprelay/internal/model"
	"github.com/lingyuanzhicheng/deeprelay/internal/utils/log"
)

// keyRuntimeState 保存单个密钥的运行时流量状态。
type keyRuntimeState struct {
	mu                sync.Mutex
	currentRPM        int
	rpmWindowStart    int64
	currentConcurrent int
}

var (
	keyRuntimeStates   = make(map[int]*keyRuntimeState)
	keyRuntimeStatesMu sync.RWMutex
)

func getOrCreateKeyRuntime(keyID int) *keyRuntimeState {
	keyRuntimeStatesMu.RLock()
	state, ok := keyRuntimeStates[keyID]
	keyRuntimeStatesMu.RUnlock()
	if ok {
		return state
	}
	keyRuntimeStatesMu.Lock()
	defer keyRuntimeStatesMu.Unlock()
	if state, ok := keyRuntimeStates[keyID]; ok {
		return state
	}
	state = &keyRuntimeState{}
	keyRuntimeStates[keyID] = state
	return state
}

// ChannelKeyAcquire 尝试获取一个密钥的使用权。
// 如果 RPM 或并发达到上限，返回 false。
// 调用方必须在请求结束后调用 ChannelKeyRelease。
func ChannelKeyAcquire(key model.ChannelKey) bool {
	if key.ID == 0 {
		return false
	}
	state := getOrCreateKeyRuntime(key.ID)
	state.mu.Lock()
	defer state.mu.Unlock()

	now := time.Now().Unix()

	// RPM 窗口检查（60 秒固定窗口）
	if key.MaxRPM > 0 {
		if state.rpmWindowStart == 0 || now-state.rpmWindowStart >= 60 {
			state.rpmWindowStart = now
			state.currentRPM = 0
		}
		if state.currentRPM >= key.MaxRPM {
			return false
		}
	}

	// 并发检查
	if key.MaxConcurrent > 0 && state.currentConcurrent >= key.MaxConcurrent {
		return false
	}

	// 占用资源
	if key.MaxRPM > 0 {
		state.currentRPM++
	}
	state.currentConcurrent++
	return true
}

// ChannelKeyRelease 释放一个密钥的并发占用。
func ChannelKeyRelease(keyID int) {
	if keyID == 0 {
		return
	}
	keyRuntimeStatesMu.RLock()
	state, ok := keyRuntimeStates[keyID]
	keyRuntimeStatesMu.RUnlock()
	if !ok {
		return
	}
	state.mu.Lock()
	defer state.mu.Unlock()
	if state.currentConcurrent > 0 {
		state.currentConcurrent--
	}
}

// ChannelKeyIncCost 在密钥运行时锁内累加已用成本，避免并发请求丢失计费增量。
func ChannelKeyIncCost(key model.ChannelKey, cost float64) error {
	if key.ID == 0 {
		return fmt.Errorf("invalid channel key")
	}
	state := getOrCreateKeyRuntime(key.ID)
	state.mu.Lock()
	defer state.mu.Unlock()

	if latest, ok := channelKeyCache.Get(key.ID); ok {
		key.UsedCost = latest.UsedCost
		key.PeriodStart = latest.PeriodStart
		if latest.CostType == model.KeyCostTypePeriod && latest.PeriodStart > 0 && latest.ResetPeriod > 0 {
			now := time.Now().Unix()
			if now >= latest.PeriodStart+int64(latest.ResetPeriod)*86400 {
				key.UsedCost = 0
				key.PeriodStart = now
			}
		}
	}
	key.UsedCost += cost
	return ChannelKeyUpdate(key)
}

// ChannelKeyResetExpiredPeriods 重置所有到期的周期密钥的 UsedCost。
// 作为 isCostAvailable 惰性检查的兜底，由定时任务每小时调用。
func ChannelKeyResetExpiredPeriods() {
	now := time.Now().Unix()
	for _, ch := range channelCache.GetAll() {
		for i := range ch.Keys {
			k := &ch.Keys[i]
			if k.CostType != model.KeyCostTypePeriod {
				continue
			}
			if k.PeriodStart == 0 {
				k.PeriodStart = now
				if err := ChannelKeyUpdate(*k); err != nil {
					log.Warnf("failed to initialize period_start for key %d: %v", k.ID, err)
				}
			} else if k.ResetPeriod > 0 && now >= k.PeriodStart+int64(k.ResetPeriod)*86400 {
				k.UsedCost = 0
				k.PeriodStart = now
				if err := ChannelKeyUpdate(*k); err != nil {
					log.Warnf("failed to save reset key %d: %v", k.ID, err)
				} else {
					log.Infof("channel key %d period reset: new period starts %d", k.ID, now)
				}
			}
		}
	}
}
