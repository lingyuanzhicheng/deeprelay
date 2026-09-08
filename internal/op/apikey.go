package op

import (
	"context"
	"fmt"

	"github.com/lingyuanzhicheng/deeprelay/internal/db"
	"github.com/lingyuanzhicheng/deeprelay/internal/model"
	"github.com/lingyuanzhicheng/deeprelay/internal/utils/cache"
	"gorm.io/gorm"
)

var apiKeyCache = cache.New[int, model.APIKey](16)
var apiKeyIDMap = cache.New[string, int](16)

func APIKeyCreate(key *model.APIKey, ctx context.Context) error {
	if err := db.GetDB().WithContext(ctx).Create(key).Error; err != nil {
		return fmt.Errorf("failed to create API key: %w", err)
	}
	apiKeyCache.Set(key.ID, *key)
	apiKeyIDMap.Set(key.APIKey, key.ID)
	return nil
}

func APIKeyUpdate(key *model.APIKey, ctx context.Context) error {
	existing, ok := apiKeyCache.Get(key.ID)
	if !ok {
		return fmt.Errorf("API key not found")
	}
	if err := db.GetDB().WithContext(ctx).Omit("api_key").Save(key).Error; err != nil {
		return fmt.Errorf("failed to update API key: %w", err)
	}
	key.APIKey = existing.APIKey
	apiKeyCache.Set(key.ID, *key)
	return nil
}

func APIKeyList(ctx context.Context) ([]model.APIKey, error) {
	keys := make([]model.APIKey, 0, apiKeyCache.Len())
	for _, apiKey := range apiKeyCache.GetAll() {
		keys = append(keys, apiKey)
	}
	return keys, nil
}

func APIKeyGet(id int, ctx context.Context) (model.APIKey, error) {
	apiKey, ok := apiKeyCache.Get(id)
	if !ok {
		return model.APIKey{}, fmt.Errorf("API key not found")
	}
	return apiKey, nil
}

func APIKeyGetByAPIKey(apiKey string, ctx context.Context) (model.APIKey, error) {
	id, ok := apiKeyIDMap.Get(apiKey)
	if !ok {
		return model.APIKey{}, fmt.Errorf("API key not found")
	}
	return APIKeyGet(id, ctx)
}

func APIKeyDelete(id int, ctx context.Context) error {
	k := model.APIKey{
		ID: id,
	}
	if err := StatsAPIKeyDel(id); err != nil {
		return fmt.Errorf("failed to delete stats API key: %v", err)
	}
	result := db.GetDB().WithContext(ctx).Delete(&k)
	if result.RowsAffected == 0 {
		return fmt.Errorf("API key not found")
	}
	if result.Error != nil {
		return fmt.Errorf("failed to delete API key: %w", result.Error)
	}
	apiKeyCache.Del(k.ID)
	apiKeyIDMap.Del(k.APIKey)
	return nil
}

func APIKeyReset(id int, newKey string, ctx context.Context) (model.APIKey, error) {
	existing, ok := apiKeyCache.Get(id)
	if !ok {
		return model.APIKey{}, fmt.Errorf("API key not found")
	}
	if newKey == "" {
		return model.APIKey{}, fmt.Errorf("new key is empty")
	}
	if err := db.GetDB().WithContext(ctx).
		Model(&model.APIKey{}).
		Where("id = ?", id).
		Update("api_key", newKey).Error; err != nil {
		return model.APIKey{}, fmt.Errorf("failed to reset API key: %w", err)
	}
	apiKeyIDMap.Del(existing.APIKey)
	existing.APIKey = newKey
	apiKeyCache.Set(id, existing)
	apiKeyIDMap.Set(newKey, id)
	return existing, nil
}

// APIKeyIncRevenue 累加密钥收入（售价侧），DB 表达式累加保证并发不丢增量。
func APIKeyIncRevenue(id int, revenue float64) error {
	if id == 0 {
		return fmt.Errorf("invalid api key")
	}
	if revenue == 0 {
		return nil
	}
	if err := db.GetDB().WithContext(context.Background()).
		Model(&model.APIKey{}).
		Where("id = ?", id).
		Update("revenue", gorm.Expr("revenue + ?", revenue)).Error; err != nil {
		return fmt.Errorf("failed to inc api key revenue: %w", err)
	}
	if key, ok := apiKeyCache.Get(id); ok {
		key.Revenue += revenue
		apiKeyCache.Set(id, key)
	}
	return nil
}

func apiKeyRefreshCache(ctx context.Context) error {
	apiKeys := []model.APIKey{}
	if err := db.GetDB().WithContext(ctx).Find(&apiKeys).Error; err != nil {
		return err
	}
	for _, apiKey := range apiKeys {
		apiKeyCache.Set(apiKey.ID, apiKey)
		apiKeyIDMap.Set(apiKey.APIKey, apiKey.ID)
	}
	return nil
}
