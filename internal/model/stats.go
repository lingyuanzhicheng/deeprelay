package model

type StatsMetrics struct {
	InputToken      int64 `json:"input_token" gorm:"bigint"`
	OutputToken     int64 `json:"output_token" gorm:"bigint"`
	CacheReadToken  int64 `json:"cache_read_token" gorm:"bigint"`
	CacheWriteToken int64 `json:"cache_write_token" gorm:"bigint"`

	InputCost      float64 `json:"input_cost" gorm:"type:real"`
	OutputCost     float64 `json:"output_cost" gorm:"type:real"`
	CacheReadCost  float64 `json:"cache_read_cost" gorm:"type:real"`
	CacheWriteCost float64 `json:"cache_write_cost" gorm:"type:real"`

	RequestSuccess int64 `json:"request_success" gorm:"bigint"`
	RequestFailed  int64 `json:"request_failed" gorm:"bigint"`
}

type StatsTotal struct {
	ID int `gorm:"primaryKey"`
	StatsMetrics
}

type StatsHourly struct {
	Hour int    `json:"hour" gorm:"primaryKey"`
	Date string `json:"date" gorm:"not null"` // 记录最后更新日期，格式：20060102
	StatsMetrics
}

type StatsDaily struct {
	Date string `json:"date" gorm:"primaryKey"`
	StatsMetrics
}

type StatsModel struct {
	GroupID int `gorm:"primaryKey"`
	StatsMetrics
}

type StatsChannel struct {
	ChannelID int `json:"channel_id" gorm:"primaryKey"`
	StatsMetrics
}

type StatsAPIKey struct {
	APIKeyID int `json:"api_key_id" gorm:"primaryKey"`
	StatsMetrics
}

// Add aggregates another StatsMetrics into the current one.
func (s *StatsMetrics) Add(delta StatsMetrics) {
	s.InputToken += delta.InputToken
	s.OutputToken += delta.OutputToken
	s.CacheReadToken += delta.CacheReadToken
	s.CacheWriteToken += delta.CacheWriteToken
	s.InputCost += delta.InputCost
	s.OutputCost += delta.OutputCost
	s.CacheReadCost += delta.CacheReadCost
	s.CacheWriteCost += delta.CacheWriteCost
	s.RequestSuccess += delta.RequestSuccess
	s.RequestFailed += delta.RequestFailed
}

func (s StatsMetrics) Total() float64 {
	return s.InputCost + s.CacheReadCost + s.CacheWriteCost + s.OutputCost
}
