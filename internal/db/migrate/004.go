package migrate

import (
	"fmt"
	"time"

	"gorm.io/gorm"
)

func init() {
	RegisterAfterAutoMigration(Migration{
		Version: 4,
		Up:      initializePeriodKeyPeriods,
	})
}

func initializePeriodKeyPeriods(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	if !db.Migrator().HasTable("channel_keys") || !db.Migrator().HasColumn("channel_keys", "period_start") {
		return nil
	}

	now := time.Now().Unix()
	if err := db.Exec(`UPDATE channel_keys SET period_start = ? WHERE cost_type = 1 AND period_start = 0`, now).Error; err != nil {
		return fmt.Errorf("failed to initialize period key periods: %w", err)
	}
	return nil
}
