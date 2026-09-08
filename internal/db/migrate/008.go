package migrate

import (
	"fmt"
	"strings"

	"gorm.io/gorm"
)

func init() {
	// 008/009：把 006 时代 cache_* 追加在表尾的 stats 表重排。
	// 010/011：指标列序二次定版（input/output 相邻、cache 相邻），并把 stats_models 纳入。
	// 两组共用同一套函数：已记录成功的版本自动跳过，未跑过 008 的库由 008 先重排一次，
	// 010 时表已不存在而自动 no-op，最终都收敛到当前规范列序。
	RegisterBeforeAutoMigration(Migration{
		Version: 8,
		Up:      renameStatsTablesForReorder,
	})
	RegisterAfterAutoMigration(Migration{
		Version: 9,
		Up:      restoreReorderedStatsData,
	})
	RegisterBeforeAutoMigration(Migration{
		Version: 10,
		Up:      renameStatsTablesForReorder,
	})
	RegisterAfterAutoMigration(Migration{
		Version: 11,
		Up:      restoreReorderedStatsData,
	})
}

// statsMetricsColumns StatsMetrics 的规范列序（与 model.StatsMetrics 字段序一致）。
var statsMetricsColumns = []string{
	"input_token", "output_token", "cache_read_token", "cache_write_token",
	"input_cost", "output_cost", "cache_read_cost", "cache_write_cost",
	"request_success", "request_failed",
}

// statsReorderTables stats 表及其规范列序（键列 + 指标列）。
var statsReorderTables = []struct {
	name    string
	columns []string
}{
	{"stats_models", append([]string{"group_id"}, statsMetricsColumns...)},
	{"stats_totals", append([]string{"id"}, statsMetricsColumns...)},
	{"stats_dailies", append([]string{"date"}, statsMetricsColumns...)},
	{"stats_hourlies", append([]string{"hour", "date"}, statsMetricsColumns...)},
	{"stats_channels", append([]string{"channel_id"}, statsMetricsColumns...)},
	{"stats_api_keys", append([]string{"api_key_id"}, statsMetricsColumns...)},
}

const statsReorderLegacySuffix = "_legacy"

// renameStatsTablesForReorder（AutoMigrate 前）把列序不符的 stats 表改名让位，
// 随后的 AutoMigrate 按当前结构体字段序重建同名空表。
func renameStatsTablesForReorder(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	for _, table := range statsReorderTables {
		if !db.Migrator().HasTable(table.name) {
			continue
		}
		legacy := table.name + statsReorderLegacySuffix
		if db.Migrator().HasTable(legacy) {
			if err := db.Migrator().DropTable(legacy); err != nil {
				return fmt.Errorf("failed to drop leftover %s: %w", legacy, err)
			}
		}
		if err := db.Exec(fmt.Sprintf("ALTER TABLE %s RENAME TO %s", table.name, legacy)).Error; err != nil {
			return fmt.Errorf("failed to rename %s: %w", table.name, err)
		}
	}
	return nil
}

// restoreReorderedStatsData（AutoMigrate 后）把旧表数据按规范列序回填并清理旧表。
func restoreReorderedStatsData(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	for _, table := range statsReorderTables {
		legacy := table.name + statsReorderLegacySuffix
		if !db.Migrator().HasTable(legacy) {
			continue
		}
		if !db.Migrator().HasTable(table.name) {
			return fmt.Errorf("table %s missing after automigrate", table.name)
		}
		columnList := strings.Join(table.columns, ", ")
		err := db.Transaction(func(tx *gorm.DB) error {
			if err := tx.Exec(fmt.Sprintf("DELETE FROM %s", table.name)).Error; err != nil {
				return err
			}
			if err := tx.Exec(fmt.Sprintf("INSERT INTO %s (%s) SELECT %s FROM %s", table.name, columnList, columnList, legacy)).Error; err != nil {
				return err
			}
			return tx.Exec(fmt.Sprintf("DROP TABLE %s", legacy)).Error
		})
		if err != nil {
			return fmt.Errorf("failed to restore %s: %w", table.name, err)
		}
	}
	return nil
}
