package op

import (
	"context"
	"fmt"
	"sort"
	"strings"

	"github.com/lingyuanzhicheng/deeprelay/internal/db"
	"github.com/lingyuanzhicheng/deeprelay/internal/model"
	"github.com/lingyuanzhicheng/deeprelay/internal/utils/cache"
)

var channelLLMPriceCache = cache.New[string, model.ChannelLLMPrice](64)

func channelLLMPriceCacheKey(channelID int, modelName string) string {
	return fmt.Sprintf("%d:%s", channelID, strings.ToLower(modelName))
}

// channelLLMPriceCacheSet DB 写成功后同步刷新内存缓存（强制不变量）。
func channelLLMPriceCacheSet(p model.ChannelLLMPrice) {
	channelLLMPriceCache.Set(channelLLMPriceCacheKey(p.ChannelID, p.ModelName), p)
}

func channelLLMPriceCacheDel(channelID int, modelName string) {
	channelLLMPriceCache.Del(channelLLMPriceCacheKey(channelID, modelName))
}

func ChannelLLMPriceGet(channelID int, modelName string) (model.ChannelLLMPrice, bool) {
	p, ok := channelLLMPriceCache.Get(channelLLMPriceCacheKey(channelID, modelName))
	return p, ok
}

func ChannelLLMPriceListByChannel(channelID int) ([]model.ChannelLLMPrice, error) {
	result := make([]model.ChannelLLMPrice, 0)
	for _, p := range channelLLMPriceCache.GetAll() {
		if p.ChannelID == channelID {
			result = append(result, p)
		}
	}
	// 固定排序：按 model_name 升序，避免 map 迭代顺序不稳定导致前端列表抖动
	sort.Slice(result, func(i, j int) bool {
		return result[i].ModelName < result[j].ModelName
	})
	return result, nil
}

func ChannelLLMPriceUpsert(p model.ChannelLLMPrice, ctx context.Context) error {
	p.ModelName = strings.ToLower(p.ModelName)
	if err := db.GetDB().WithContext(ctx).Save(&p).Error; err != nil {
		return err
	}
	channelLLMPriceCacheSet(p)
	return nil
}

func ChannelLLMPriceBatchUpsert(items []model.ChannelLLMPrice, ctx context.Context) error {
	if len(items) == 0 {
		return nil
	}
	for i := range items {
		items[i].ModelName = strings.ToLower(items[i].ModelName)
	}
	tx := db.GetDB().WithContext(ctx).Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()
	for i := range items {
		if err := tx.Save(&items[i]).Error; err != nil {
			tx.Rollback()
			return err
		}
	}
	if err := tx.Commit().Error; err != nil {
		return err
	}
	for i := range items {
		channelLLMPriceCacheSet(items[i])
	}
	return nil
}

func ChannelLLMPriceDelete(channelID int, modelName string, ctx context.Context) error {
	modelName = strings.ToLower(modelName)
	if err := db.GetDB().WithContext(ctx).
		Where("channel_id = ? AND model_name = ?", channelID, modelName).
		Delete(&model.ChannelLLMPrice{}).Error; err != nil {
		return err
	}
	channelLLMPriceCacheDel(channelID, modelName)
	return nil
}

func ChannelLLMPriceBatchDeleteByChannelAndModels(channelID int, modelNames []string, ctx context.Context) error {
	if len(modelNames) == 0 {
		return nil
	}
	for i := range modelNames {
		modelNames[i] = strings.ToLower(modelNames[i])
	}
	if err := db.GetDB().WithContext(ctx).
		Where("channel_id = ? AND model_name IN ?", channelID, modelNames).
		Delete(&model.ChannelLLMPrice{}).Error; err != nil {
		return err
	}
	for _, m := range modelNames {
		channelLLMPriceCacheDel(channelID, m)
	}
	return nil
}

func ChannelLLMPriceBindSet(channelID int, modelName, provider, modelID string, ctx context.Context) error {
	modelName = strings.ToLower(modelName)
	if err := db.GetDB().WithContext(ctx).Model(&model.ChannelLLMPrice{}).
		Where("channel_id = ? AND model_name = ?", channelID, modelName).
		Updates(map[string]interface{}{
			"bind_provider": provider,
			"bind_model_id": modelID,
		}).Error; err != nil {
		return err
	}
	if existing, ok := channelLLMPriceCache.Get(channelLLMPriceCacheKey(channelID, modelName)); ok {
		existing.BindProvider = provider
		existing.BindModelID = modelID
		channelLLMPriceCacheSet(existing)
	}
	return nil
}

func ChannelLLMPriceBatchBind(req model.ChannelLLMPriceBatchBindRequest, ctx context.Context) error {
	if len(req.Items) == 0 {
		return nil
	}
	tx := db.GetDB().WithContext(ctx).Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()
	for _, item := range req.Items {
		mn := strings.ToLower(item.ModelName)
		if err := tx.Model(&model.ChannelLLMPrice{}).
			Where("channel_id = ? AND model_name = ?", req.ChannelID, mn).
			Updates(map[string]interface{}{
				"bind_provider": item.Provider,
				"bind_model_id": item.ModelID,
			}).Error; err != nil {
			tx.Rollback()
			return err
		}
	}
	if err := tx.Commit().Error; err != nil {
		return err
	}
	for _, item := range req.Items {
		if existing, ok := channelLLMPriceCache.Get(channelLLMPriceCacheKey(req.ChannelID, item.ModelName)); ok {
			existing.BindProvider = item.Provider
			existing.BindModelID = item.ModelID
			channelLLMPriceCacheSet(existing)
		}
	}
	return nil
}

// ChannelLLMPriceSyncTimeSet 更新渠道的 modelsdev 价格同步时间（DB + 缓存）。
func ChannelLLMPriceSyncTimeSet(channelID int, ts int64, ctx context.Context) error {
	if err := db.GetDB().WithContext(ctx).Model(&model.Channel{}).
		Where("id = ?", channelID).
		Update("llm_price_sync_time", ts).Error; err != nil {
		return err
	}
	if ch, ok := channelCache.Get(channelID); ok {
		ch.LLMPriceSyncTime = ts
		channelCache.Set(channelID, ch)
	}
	return nil
}

// ChannelLLMPriceSyncFromUpstream 上游模型列表同步后联动价格表：
// - 新增模型以 0 价格入库（Q4）
// - 上游已移除的模型，按 Q1=同步删除。
func ChannelLLMPriceSyncFromUpstream(channelID int, upstreamModelNames []string, ctx context.Context) error {
	existing, err := ChannelLLMPriceListByChannel(channelID)
	if err != nil {
		return err
	}
	existingSet := make(map[string]struct{}, len(existing))
	for _, p := range existing {
		existingSet[p.ModelName] = struct{}{}
	}
	upstreamSet := make(map[string]struct{}, len(upstreamModelNames))
	for _, m := range upstreamModelNames {
		upstreamSet[strings.ToLower(m)] = struct{}{}
	}

	var toAdd []model.ChannelLLMPrice
	for _, m := range upstreamModelNames {
		mn := strings.ToLower(m)
		if _, ok := existingSet[mn]; ok {
			continue
		}
		toAdd = append(toAdd, model.ChannelLLMPrice{
			ChannelID: channelID,
			ModelName: mn,
		})
	}

	var toDelete []string
	for name := range existingSet {
		if _, ok := upstreamSet[name]; !ok {
			toDelete = append(toDelete, name)
		}
	}

	if len(toAdd) > 0 {
		if err := ChannelLLMPriceBatchUpsert(toAdd, ctx); err != nil {
			return fmt.Errorf("failed to add new channel llm prices: %w", err)
		}
	}
	if len(toDelete) > 0 {
		if err := ChannelLLMPriceBatchDeleteByChannelAndModels(channelID, toDelete, ctx); err != nil {
			return fmt.Errorf("failed to delete removed channel llm prices: %w", err)
		}
	}
	return nil
}

func channelLLMPriceRefreshCache(ctx context.Context) error {
	var prices []model.ChannelLLMPrice
	if err := db.GetDB().WithContext(ctx).Find(&prices).Error; err != nil {
		return fmt.Errorf("failed to load channel_llm_prices: %w", err)
	}
 	for _, p := range prices {
 		channelLLMPriceCacheSet(p)
 	}
 	return nil
 }

