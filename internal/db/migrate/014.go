package migrate

import (
	"fmt"

	"gorm.io/gorm"
)

func init() {
	RegisterAfterAutoMigration(Migration{
		Version: 14,
		Up:      addAPIKeyModelAliasColumns,
	})
}

func addAPIKeyModelAliasColumns(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	if !db.Migrator().HasTable("api_keys") {
		return nil
	}
	for _, col := range []struct {
		name    string
		colType string
	}{
		{"model_pro", "VARCHAR(255) DEFAULT ''"},
		{"model_flash", "VARCHAR(255) DEFAULT ''"},
		{"model_vision", "VARCHAR(255) DEFAULT ''"},
	} {
		if !db.Migrator().HasColumn("api_keys", col.name) {
			if err := db.Exec(fmt.Sprintf("ALTER TABLE api_keys ADD COLUMN %s %s", col.name, col.colType)).Error; err != nil {
				return fmt.Errorf("failed to add api_keys.%s: %w", col.name, err)
			}
		}
	}
	return nil
}
