package op

import (
	"context"
	"crypto/rand"
	"encoding/hex"
	"sync"
	"time"

	"github.com/lingyuanzhicheng/deeprelay/internal/db"
	"github.com/lingyuanzhicheng/deeprelay/internal/model"
	"github.com/lingyuanzhicheng/deeprelay/internal/utils/log"
	"github.com/lingyuanzhicheng/deeprelay/internal/utils/snowflake"
)

const relayLogMaxSize = 20
const relayLogMaxSizeNoDB = 100 // 当不保存到数据库时，允许更大的缓存用于实时查询

var relayLogCache = make([]model.RelayLog, 0, relayLogMaxSize)
var relayLogCacheLock sync.Mutex

var relayLogFlushLock sync.Mutex

var relayLogSubscribers = make(map[chan model.RelayLog]struct{})
var relayLogSubscribersLock sync.RWMutex

var relayLogStreamTokens = make(map[string]string) // token -> api_key_name 范围（空串表示不过滤）
var relayLogStreamTokensLock sync.RWMutex

func RelayLogStreamTokenCreate(scope string) (string, error) {
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}
	token := hex.EncodeToString(bytes)

	relayLogStreamTokensLock.Lock()
	relayLogStreamTokens[token] = scope
	relayLogStreamTokensLock.Unlock()

	return token, nil
}

// RelayLogStreamTokenVerify 校验流 token 并返回其数据范围（api_key_name，空串表示不过滤）
func RelayLogStreamTokenVerify(token string) (string, bool) {
	relayLogStreamTokensLock.RLock()
	scope, ok := relayLogStreamTokens[token]
	relayLogStreamTokensLock.RUnlock()
	return scope, ok
}

func RelayLogStreamTokenRevoke(token string) {
	relayLogStreamTokensLock.Lock()
	delete(relayLogStreamTokens, token)
	relayLogStreamTokensLock.Unlock()
}

func RelayLogSubscribe() chan model.RelayLog {
	ch := make(chan model.RelayLog, 10)
	relayLogSubscribersLock.Lock()
	relayLogSubscribers[ch] = struct{}{}
	relayLogSubscribersLock.Unlock()
	return ch
}

func RelayLogUnsubscribe(ch chan model.RelayLog) {
	relayLogSubscribersLock.Lock()
	delete(relayLogSubscribers, ch)
	relayLogSubscribersLock.Unlock()
	close(ch)
}

func notifySubscribers(relayLog model.RelayLog) {
	relayLogSubscribersLock.RLock()
	defer relayLogSubscribersLock.RUnlock()

	for ch := range relayLogSubscribers {
		select {
		case ch <- relayLog:
		default:
		}
	}
}

// RelayLogNotify 将进行中的日志进度（pending/streaming）推送给 SSE 订阅者，
// 同时登记到活跃进度表，供 /log/list 轮询兜底（SSE 被代理缓冲时仍能看到进行中日志）
func RelayLogNotify(relayLog model.RelayLog) {
	if relayLog.ID == 0 {
		relayLog.ID = snowflake.GenerateID()
	}
	relayLogProgressLock.Lock()
	relayLogProgress[relayLog.ID] = progressEntry{log: relayLog, updatedAt: time.Now()}
	pruneRelayLogProgressLocked()
	relayLogProgressLock.Unlock()
	notifySubscribers(relayLog)
}

// progressEntry 活跃进度条目
type progressEntry struct {
	log       model.RelayLog
	updatedAt time.Time
}

const relayLogProgressTTL = 15 * time.Minute

var (
	relayLogProgress     = make(map[int64]progressEntry)
	relayLogProgressLock sync.RWMutex
)

func pruneRelayLogProgressLocked() {
	cutoff := time.Now().Add(-relayLogProgressTTL)
	for id, entry := range relayLogProgress {
		if entry.updatedAt.Before(cutoff) {
			delete(relayLogProgress, id)
		}
	}
}

// RelayLogActiveProgress 返回当前所有进行中的日志（pending/streaming）
func RelayLogActiveProgress() []model.RelayLog {
	relayLogProgressLock.RLock()
	defer relayLogProgressLock.RUnlock()
	result := make([]model.RelayLog, 0, len(relayLogProgress))
	for _, entry := range relayLogProgress {
		result = append(result, entry.log)
	}
	return result
}

func relayLogFlushToDB(ctx context.Context) error {
	relayLogFlushLock.Lock()
	defer relayLogFlushLock.Unlock()

	relayLogCacheLock.Lock()
	if len(relayLogCache) == 0 {
		relayLogCacheLock.Unlock()
		return nil
	}
	batch := make([]model.RelayLog, len(relayLogCache))
	copy(batch, relayLogCache)
	flushedUpto := len(batch)
	relayLogCacheLock.Unlock()

	result := db.GetDB().WithContext(ctx).Create(&batch)
	if result.Error != nil {
		return result.Error
	}

	relayLogCacheLock.Lock()
	if len(relayLogCache) >= flushedUpto {
		relayLogCache = relayLogCache[flushedUpto:]
	} else {
		relayLogCache = relayLogCache[:0]
	}
	if len(relayLogCache) == 0 {
		relayLogCache = make([]model.RelayLog, 0, relayLogMaxSize)
	}
	relayLogCacheLock.Unlock()

	return nil
}

func RelayLogAdd(ctx context.Context, relayLog model.RelayLog) error {
	enabled, err := SettingGetBool(model.SettingKeyRelayLogKeepEnabled)
	if err != nil {
		return err
	}
	maxSize := relayLogMaxSize
	if !enabled {
		maxSize = relayLogMaxSizeNoDB
	}
	if relayLog.ID == 0 {
		relayLog.ID = snowflake.GenerateID()
	}
	relayLogProgressLock.Lock()
	delete(relayLogProgress, relayLog.ID)
	relayLogProgressLock.Unlock()
	go notifySubscribers(relayLog)

	relayLogCacheLock.Lock()
	relayLogCache = append(relayLogCache, relayLog)
	if len(relayLogCache) >= maxSize {
		if enabled {
			relayLogCacheLock.Unlock()
			return relayLogFlushToDB(ctx)
		}
		// 如果未启用日志保存，移除最旧的日志，保留最新的日志用于实时查询
		keepSize := maxSize / 2
		if len(relayLogCache) > keepSize {
			relayLogCache = relayLogCache[len(relayLogCache)-keepSize:]
		}
	}
	relayLogCacheLock.Unlock()
	return nil
}

func RelayLogSaveDBTask(ctx context.Context) error {
	log.Debugf("relay log save db task started")
	startTime := time.Now()
	defer func() {
		log.Debugf("relay log save db task finished, save time: %s", time.Since(startTime))
	}()
	enabled, err := SettingGetBool(model.SettingKeyRelayLogKeepEnabled)
	if err != nil {
		return err
	}

	if enabled {
		if err := relayLogFlushToDB(ctx); err != nil {
			return err
		}
		return relayLogCleanup(ctx)
	}

	// 如果未启用日志保存，检查缓存大小，如果超过限制则清理旧日志
	relayLogCacheLock.Lock()
	if len(relayLogCache) > relayLogMaxSizeNoDB {
		keepSize := relayLogMaxSizeNoDB / 2
		relayLogCache = relayLogCache[len(relayLogCache)-keepSize:]
	}
	relayLogCacheLock.Unlock()

	return nil
}

func relayLogCleanup(ctx context.Context) error {
	keepPeriod, err := SettingGetInt(model.SettingKeyRelayLogKeepPeriod)
	if err != nil {
		return err
	}

	if keepPeriod <= 0 {
		return nil
	}

	cutoffTime := time.Now().Add(-time.Duration(keepPeriod) * 24 * time.Hour).Unix()
	return db.GetDB().WithContext(ctx).Where("time < ?", cutoffTime).Delete(&model.RelayLog{}).Error
}

// RelayLogList 查询日志列表，支持可选的时间范围过滤
// startTime 和 endTime 为 nil 时表示不限制时间范围
// apiKeyName 非空时仅返回该 API Key 的日志（密钥登录场景）
func RelayLogList(ctx context.Context, startTime, endTime *int, page, pageSize int, apiKeyName string) ([]model.RelayLog, error) {
	enabled, err := SettingGetBool(model.SettingKeyRelayLogKeepEnabled)
	if err != nil {
		return nil, err
	}
	relayLogCacheLock.Lock()
	var cachedLogs []model.RelayLog
	for _, log := range relayLogCache {
		if apiKeyName != "" && log.RequestAPIKeyName != apiKeyName {
			continue
		}
		if startTime != nil && log.Time < int64(*startTime) {
			continue
		}
		if endTime != nil && log.Time > int64(*endTime) {
			continue
		}
		cachedLogs = append(cachedLogs, log)
	}
	relayLogCacheLock.Unlock()

	// 反转缓存日志顺序（原本新的在末尾，反转后新的在前面，方便分页）
	for i, j := 0, len(cachedLogs)-1; i < j; i, j = i+1, j-1 {
		cachedLogs[i], cachedLogs[j] = cachedLogs[j], cachedLogs[i]
	}

	cacheCount := len(cachedLogs)
	offset := (page - 1) * pageSize

	var result []model.RelayLog

	// 先从缓存中取（缓存是最新的日志）
	if offset < cacheCount {
		cacheEnd := offset + pageSize
		if cacheEnd > cacheCount {
			cacheEnd = cacheCount
		}
		result = append(result, cachedLogs[offset:cacheEnd]...)
	}

	// 如果启用了日志保存，缓存不够时从数据库补充
	if enabled {
		remaining := pageSize - len(result)
		if remaining > 0 {
			dbOffset := 0
			if offset > cacheCount {
				dbOffset = offset - cacheCount
			}

			query := db.GetDB().WithContext(ctx)
			if apiKeyName != "" {
				query = query.Where("request_api_key_name = ?", apiKeyName)
			}
			if startTime != nil {
				query = query.Where("time >= ?", *startTime)
			}
			if endTime != nil {
				query = query.Where("time <= ?", *endTime)
			}

			var dbLogs []model.RelayLog
			if err := query.Order("id DESC").Offset(dbOffset).Limit(remaining).Find(&dbLogs).Error; err != nil {
				return nil, err
			}
			result = append(result, dbLogs...)
		}
	}

	return result, nil
}

func RelayLogClear(ctx context.Context) error {
	relayLogCacheLock.Lock()
	relayLogCache = make([]model.RelayLog, 0, relayLogMaxSize)
	relayLogCacheLock.Unlock()
	return db.GetDB().WithContext(ctx).Where("1 = 1").Delete(&model.RelayLog{}).Error
}
