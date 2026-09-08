package migrate

import (
	"fmt"

	"gorm.io/gorm"
)

func init() {
	RegisterAfterAutoMigration(Migration{
		Version: 13,
		Up:      migrateLegacyUnlimitedModels,
	})
}

func migrateLegacyUnlimitedModels(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	if !db.Migrator().HasTable("api_keys") {
		return nil
	}
	if !db.Migrator().HasColumn("api_keys", "unlimited_models") {
		return nil
	}
	result := db.Exec(`
		UPDATE api_keys
		SET unlimited_models = 1
		WHERE (unlimited_models = 0 OR unlimited_models IS NULL OR unlimited_models = '')
		  AND (supported_models IS NULL OR supported_models = '')
	`)
	if result.Error != nil {
		return fmt.Errorf("migrate legacy unlimited_models: %w", result.Error)
	}
	return nil
}
