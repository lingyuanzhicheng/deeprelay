package migrate

import (
	"fmt"

	"gorm.io/gorm"
)

func init() {
	RegisterBeforeAutoMigration(Migration{
		Version: 6,
		Up:      dropLLMInfoAndAddGroupIDStats,
	})
}

// dropLLMInfoAndAddGroupIDStats llminfo 重构 + Stats 8 维指标 + relay_logs 8 维成本。
//
// 旧表与新结构差异过大且历史数据无业务价值，直接 DROP，由随后的 AutoMigrate
// 按新结构体重建：
//   - llm_infos（旧全局价表，c7dacd4 后无业务用途）→ 新 llminfo（1:1 关联 groups）
//   - stats_models（旧按模型名聚合）→ 新按 group_id 聚合
//   - relay_logs（cost 拆 8 维 + 新增 tps / cache token / api_key_name）
//
// 其余 5 张 stats 表由 AutoMigrate 增量补列，遗留的 wait_time 列由 007 迁移删除。
//
// 注意必须在 BeforeAutoMigrate 阶段执行：若放到 After，AutoMigrate 会先尝试向旧表
// 补 NOT NULL UNIQUE 的 group_id 列，多行旧数据默认值 0 会触发唯一冲突导致启动失败。
func dropLLMInfoAndAddGroupIDStats(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	for _, table := range []string{"llm_infos", "stats_models", "relay_logs"} {
		if !db.Migrator().HasTable(table) {
			continue
		}
		if err := db.Exec(fmt.Sprintf("DROP TABLE IF EXISTS %s", table)).Error; err != nil {
			return fmt.Errorf("failed to drop %s: %w", table, err)
		}
	}
	return nil
}
