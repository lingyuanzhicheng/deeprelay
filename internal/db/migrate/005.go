package migrate

import (
	"fmt"

	"gorm.io/gorm"
)

func init() {
	RegisterAfterAutoMigration(Migration{
		Version: 5,
		Up:      addChannelLLMPriceTable,
	})
}

// addChannelLLMPriceTable 建立渠道×模型价格表，并为 channels 增补 LLMPriceSyncTime 列。
func addChannelLLMPriceTable(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}

	// 新增 channel_llm_prices 表（由 AutoMigrate 托管结构体，这里仅兜底处理列与索引）。
	if !db.Migrator().HasTable("channel_llm_prices") {
		if err := db.Exec(`CREATE TABLE IF NOT EXISTS channel_llm_prices (
			id INTEGER PRIMARY KEY AUTOINCREMENT,
			channel_id INTEGER NOT NULL,
			model_name TEXT NOT NULL,
			input REAL DEFAULT 0,
			output REAL DEFAULT 0,
			cache_read REAL DEFAULT 0,
			cache_write REAL DEFAULT 0,
			bind_provider TEXT DEFAULT '',
			bind_model_id TEXT DEFAULT ''
		)`).Error; err != nil {
			return fmt.Errorf("failed to create channel_llm_prices: %w", err)
		}
		if err := db.Exec(`CREATE UNIQUE INDEX IF NOT EXISTS idx_channel_llm_prices_channel_model ON channel_llm_prices(channel_id, model_name)`).Error; err != nil {
			return fmt.Errorf("failed to create unique index: %w", err)
		}
	}

	// channels 表新增 llm_price_sync_time 列（按需补列，避免 AutoMigrate 漏补）。
	if db.Migrator().HasTable("channels") && !db.Migrator().HasColumn("channels", "llm_price_sync_time") {
		if err := db.Exec(`ALTER TABLE channels ADD COLUMN llm_price_sync_time INTEGER DEFAULT 0`).Error; err != nil {
			return fmt.Errorf("failed to add channels.llm_price_sync_time: %w", err)
		}
	}
	return nil
}
