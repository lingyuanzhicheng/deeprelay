package migrate

import (
	"fmt"

	"gorm.io/gorm"
)

func init() {
	RegisterAfterAutoMigration(Migration{
		Version: 12,
		Up:      addAPIKeyUnlimitedModelsColumn,
	})
}

// addAPIKeyUnlimitedModelsColumn 为 api_keys 表追加 unlimited_models 列。
// AutoMigrate 之后运行以确保列存在（兜底；struct 字段已声明 gorm tag，AutoMigrate 通常会加）。
//
// 不做数据迁移：旧记录 unlimited_models=false 时仍由 relay 层按 supported_models 判定；
// 新记录的 unlimited_models 语义由 handler 层在更新时归一化（unlimited=true → supported_models=""）。
func addAPIKeyUnlimitedModelsColumn(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	if !db.Migrator().HasTable("api_keys") {
		return nil
	}
	if db.Migrator().HasColumn("api_keys", "unlimited_models") {
		return nil
	}
	if err := db.Exec(`ALTER TABLE api_keys ADD COLUMN unlimited_models BOOLEAN DEFAULT 0`).Error; err != nil {
		return fmt.Errorf("failed to add api_keys.unlimited_models: %w", err)
	}
	return nil
}
