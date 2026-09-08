package migrate

import (
	"fmt"
	"reflect"

	"github.com/lingyuanzhicheng/deeprelay/internal/model"
	"gorm.io/gorm"
)

func init() {
	RegisterBeforeAutoMigration(Migration{
		Version: 7,
		Up:      dropStatsWaitTimeColumns,
	})
}

// dropStatsWaitTimeColumns 删除 5 张 stats 表遗留的 wait_time 列。
// 006 重建了 stats_models / relay_logs / llminfo，其余 stats 表由 AutoMigrate 增量补列，
// 而 GORM 只加列不删列，已从 StatsMetrics 移除的 wait_time 需在此显式删除。
//
// 用原生 ALTER TABLE 而非 Migrator().DropColumn：glebarez 驱动的 DropColumn 依赖正则
// 解析 sqlite_master 里的建表 DDL，未加引号的列定义会匹配失败并静默跳过。
// ALTER TABLE ... DROP COLUMN 在 sqlite(>=3.35)/mysql/postgres 三种方言下语法一致。
func dropStatsWaitTimeColumns(db *gorm.DB) error {
	if db == nil {
		return fmt.Errorf("db is nil")
	}
	targets := []interface{}{
		&model.StatsTotal{},
		&model.StatsDaily{},
		&model.StatsHourly{},
		&model.StatsChannel{},
		&model.StatsAPIKey{},
	}
	for _, target := range targets {
		if !db.Migrator().HasTable(target) {
			continue
		}
		if !db.Migrator().HasColumn(target, "wait_time") {
			continue
		}
		structName := reflect.TypeOf(target).Elem().Name()
		tableName := db.NamingStrategy.TableName(structName)
		if err := db.Exec(fmt.Sprintf("ALTER TABLE %s DROP COLUMN wait_time", tableName)).Error; err != nil {
			return fmt.Errorf("failed to drop wait_time on %s: %w", tableName, err)
		}
	}
	return nil
}
