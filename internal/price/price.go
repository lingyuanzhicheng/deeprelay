package price

// 价格包的公共入口。
// 全局价表（presets.go）与全局同步函数（UpdateLLMPrice）已废弃。
// 价格唯一来源是 ChannelLLMPrice 表的内存缓存镜像，通过 GetChannelLLMPrice 查询。
// modelsdev 仅在按渠道绑定同步时作为外部数据源，由 op 层负责拉取与同步。

