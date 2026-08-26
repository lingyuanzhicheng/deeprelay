package migrate

import (
	"fmt"

	"gorm.io/gorm"
)

func init() {
	RegisterBeforeAutoMigration(Migration{
		Version: 3,
		Up:      renameKeyCostColumn,
	})
}

func renameKeyCostColumn(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	if !db.Migrator().HasTable("channel_keys") || !db.Migrator().HasColumn("channel_keys", "total_cost") {
		return nil
	}

	switch db.Dialector.Name() {
	case "sqlite":
		if err := db.Exec(`ALTER TABLE channel_keys RENAME COLUMN total_cost TO used_cost`).Error; err != nil {
			return fmt.Errorf("failed to rename channel_keys.total_cost to used_cost: %w", err)
		}
	case "mysql":
		if err := db.Exec(`ALTER TABLE channel_keys CHANGE COLUMN total_cost used_cost DOUBLE DEFAULT 0`).Error; err != nil {
			return fmt.Errorf("failed to rename channel_keys.total_cost to used_cost: %w", err)
		}
	case "postgres":
		if err := db.Exec(`ALTER TABLE channel_keys RENAME COLUMN total_cost TO used_cost`).Error; err != nil {
			return fmt.Errorf("failed to rename channel_keys.total_cost to used_cost: %w", err)
		}
	default:
		if err := db.Migrator().RenameColumn("channel_keys", "total_cost", "used_cost"); err != nil {
			return fmt.Errorf("failed to rename channel_keys.total_cost to used_cost: %w", err)
		}
	}
	return nil
}
