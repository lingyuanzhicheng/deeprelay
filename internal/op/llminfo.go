package op

import (
	"context"
	"fmt"

	"github.com/lingyuanzhicheng/deeprelay/internal/db"
	"github.com/lingyuanzhicheng/deeprelay/internal/model"
	"github.com/lingyuanzhicheng/deeprelay/internal/utils/cache"
	"gorm.io/gorm/clause"
)

// llminfoCache 以 group_id 为键的 LLMInfo 内存缓存镜像（1:1 关联 groups.id）。
var llminfoCache = cache.New[int, model.LLMInfo](16)

func llminfoRefreshCache(ctx context.Context) error {
	infos := []model.LLMInfo{}
	if err := db.GetDB().WithContext(ctx).Find(&infos).Error; err != nil {
		return err
	}
	for _, info := range infos {
		llminfoCache.Set(info.GroupID, info)
	}
	return nil
}

// LLMInfoGetByGroup 按.group_id 查缓存；不存在返回 ok=false。
func LLMInfoGetByGroup(groupID int) (model.LLMInfo, bool) {
	return llminfoCache.Get(groupID)
}

// LLMInfoList 全量列表（缓存镜像）。
func LLMInfoList(ctx context.Context) ([]model.LLMInfo, error) {
	infos := make([]model.LLMInfo, 0, llminfoCache.Len())
	for _, info := range llminfoCache.GetAll() {
		infos = append(infos, info)
	}
	return infos, nil
}

// llminfoEnsure 确保指定 group 存在 llminfo 行（缺失时以默认值创建）。
// 幂等，供 group 创建与 group_item 增补路径调用（兜底存量分组）。
func llminfoEnsure(groupID int, ctx context.Context) error {
	if groupID == 0 {
		return fmt.Errorf("invalid group id")
	}
	if _, ok := llminfoCache.Get(groupID); ok {
		return nil
	}
	// 双检：缓存未命中可能因并发创建，落库前再查一次 DB
	var count int64
	if err := db.GetDB().WithContext(ctx).Model(&model.LLMInfo{}).Where("group_id = ?", groupID).Count(&count).Error; err != nil {
		return err
	}
	if count > 0 {
		return llminfoRefreshCache(ctx)
	}
	info := model.LLMInfo{GroupID: groupID}
	if err := db.GetDB().WithContext(ctx).Create(&info).Error; err != nil {
		return err
	}
	llminfoCache.Set(groupID, info)
	return nil
}

// LLMInfoUpsert 以 group_id 为业务键创建或更新全部用户可编辑字段。
func LLMInfoUpsert(info *model.LLMInfo, ctx context.Context) error {
	if info.GroupID == 0 {
		return fmt.Errorf("group_id is required")
	}
	if err := db.GetDB().WithContext(ctx).
		Clauses(clause.OnConflict{
			Columns: []clause.Column{{Name: "group_id"}},
			DoUpdates: clause.AssignmentColumns([]string{
				"lab", "family", "endpoint", "context_limit", "output_limit", "input_type", "output_type",
				"tools", "reasoning", "structured", "temperature",
				"input_price", "output_price", "cache_read_price", "cache_write_price",
				"instruction",
			}),
		}).Create(info).Error; err != nil {
		return fmt.Errorf("failed to upsert llminfo: %w", err)
	}
	llminfoCache.Set(info.GroupID, *info)
	return nil
}

// LLMInfoDeleteByGroupIDs 批量删除指定 group 的 llminfo 行（group 删除时联动）。
func LLMInfoDeleteByGroupIDs(groupIDs []int, ctx context.Context) error {
	if len(groupIDs) == 0 {
		return nil
	}
	if err := db.GetDB().WithContext(ctx).Where("group_id IN ?", groupIDs).Delete(&model.LLMInfo{}).Error; err != nil {
		return fmt.Errorf("failed to delete llminfo: %w", err)
	}
	for _, id := range groupIDs {
		llminfoCache.Del(id)
	}
	return nil
}
