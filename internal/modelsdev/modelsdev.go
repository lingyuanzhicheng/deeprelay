package modelsdev

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"path/filepath"
	"sort"
	"strings"
	"sync"
	"time"

	"github.com/lingyuanzhicheng/deeprelay/internal/model"
	"github.com/lingyuanzhicheng/deeprelay/internal/utils/log"
)

const modelsDevURL = "https://models.dev/api.json"

// modelsdev.json 持久化路径（相对工作目录的 data/）。
const modelsDevCacheFile = "data/modelsdev.json"

// rawEntry 对应 api.json 顶层 provider → models 映射。
type rawEntry struct {
	Models map[string]struct {
		ID   string         `json:"id"`
		Cost model.LLMPrice `json:"cost"`
	} `json:"models"`
}

// Data 缓存一次 modelsdev api.json 的结构化结果。
type Data struct {
	raw map[string]rawEntry
}

// --- 内存缓存 + 文件持久化 ---
// cached 是进程级缓存；Fetch 成功后写入，GetCached 读取。
// 冷启动时 cached 为 nil，GetCached 从 data/modelsdev.json 加载。
var (
	cached     *Data
	cachedMu   sync.RWMutex
	cachedOnce sync.Once
)

// GetCached 返回当前内存缓存；若内存为空则尝试从 data/modelsdev.json 加载。
// 不会触发网络请求，适用于 API 热路径。
func GetCached() *Data {
	cachedMu.RLock()
	if cached != nil {
		d := cached
		cachedMu.RUnlock()
		return d
	}
	cachedMu.RUnlock()

	// 冷启动：尝试从文件加载（只尝试一次，避免重复 IO）
	cachedOnce.Do(func() {
		d, err := loadFromFile()
		if err != nil {
			log.Warnf("modelsdev: cache file not loaded: %v", err)
			return
		}
		cachedMu.Lock()
		cached = d
		cachedMu.Unlock()
		log.Infof("modelsdev: loaded cache from %s", modelsDevCacheFile)
	})

	cachedMu.RLock()
	defer cachedMu.RUnlock()
	return cached
}

// loadFromFile 从 data/modelsdev.json 读取并解析。
func loadFromFile() (*Data, error) {
	body, err := os.ReadFile(modelsDevCacheFile)
	if err != nil {
		return nil, err
	}
	var raw map[string]rawEntry
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("failed to parse %s: %w", modelsDevCacheFile, err)
	}
	return &Data{raw: raw}, nil
}

// saveToFile 将缓存写回 data/modelsdev.json（原子写：先写临时文件再 rename）。
func saveToFile(d *Data) error {
	if d == nil || d.raw == nil {
		return nil
	}
	dir := filepath.Dir(modelsDevCacheFile)
	if err := os.MkdirAll(dir, 0755); err != nil {
		return fmt.Errorf("create cache dir: %w", err)
	}
	body, err := json.Marshal(d.raw)
	if err != nil {
		return fmt.Errorf("marshal cache: %w", err)
	}
	tmp := modelsDevCacheFile + ".tmp"
	if err := os.WriteFile(tmp, body, 0644); err != nil {
		return fmt.Errorf("write cache tmp: %w", err)
	}
	if err := os.Rename(tmp, modelsDevCacheFile); err != nil {
		return fmt.Errorf("rename cache: %w", err)
	}
	return nil
}

func (d *Data) Lookup(provider, modelID string) (model.LLMPrice, bool) {
	if d == nil || d.raw == nil {
		return model.LLMPrice{}, false
	}
	provider = strings.ToLower(provider)
	modelID = strings.ToLower(modelID)
	p, ok := d.raw[provider]
	if !ok {
		return model.LLMPrice{}, false
	}
	m, ok := p.Models[modelID]
	if !ok {
		return model.LLMPrice{}, false
	}
	return m.Cost, true
}

func (d *Data) Providers() []string {
	if d == nil {
		return nil
	}
	out := make([]string, 0, len(d.raw))
	for k := range d.raw {
		out = append(out, k)
	}
	sort.Strings(out)
	return out
}

// ModelsDevModelInfo carries the fields the frontend suggestion UI needs.
type ModelsDevModelInfo struct {
	ID      string         `json:"id"`
	Object  string         `json:"object"`
	OwnedBy string         `json:"owned_by"`
	Cost    model.LLMPrice `json:"cost"`
}

func (d *Data) Models(provider string) []ModelsDevModelInfo {
	if d == nil {
		return nil
	}
	provider = strings.ToLower(provider)
	p, ok := d.raw[provider]
	if !ok {
		return nil
	}
	out := make([]ModelsDevModelInfo, 0, len(p.Models))
	for _, m := range p.Models {
		out = append(out, ModelsDevModelInfo{
			ID:      m.ID,
			Object:  "model",
			OwnedBy: provider,
			Cost:    m.Cost,
		})
	}
	// 按 ID 排序，前端展示稳定
	sort.Slice(out, func(i, j int) bool { return out[i].ID < out[j].ID })
	return out
}

// Fetch 拉取并解析 modelsdev api.json，更新内存缓存并持久化到 data/modelsdev.json。
// 使用 http.DefaultTransport（不走系统代理，避免依赖 client 包导致循环）。
func Fetch(ctx context.Context) (*Data, error) {
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, modelsDevURL, nil)
	if err != nil {
		return nil, err
	}
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		return nil, err
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		return nil, fmt.Errorf("failed to fetch modelsdev: %s", resp.Status)
	}
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read modelsdev body: %w", err)
	}
	var raw map[string]rawEntry
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("failed to parse modelsdev: %w", err)
	}
	d := &Data{raw: raw}

	// 更新内存缓存
	cachedMu.Lock()
	cached = d
	cachedMu.Unlock()

	// 持久化到文件（失败仅告警，不影响主流程）
	if err := saveToFile(d); err != nil {
		log.Warnf("modelsdev: failed to persist cache: %v", err)
	} else {
		log.Infof("modelsdev: cache persisted to %s at %s", modelsDevCacheFile, time.Now().Format(time.RFC3339))
	}
	return d, nil
}
