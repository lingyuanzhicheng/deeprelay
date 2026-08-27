package modelsdev

import (
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"

	"github.com/lingyuanzhicheng/deeprelay/internal/model"
)

const modelsDevURL = "https://models.dev/api.json"

// Data 缓存一次 modelsdev api.json 的结构化结果。
type Data struct {
	raw map[string]struct {
		Models map[string]struct {
			ID   string         `json:"id"`
			Cost model.LLMPrice `json:"cost"`
		} `json:"models"`
	}
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
	return out
}

func (d *Data) Models(provider string) []model.OpenAIModel {
	if d == nil {
		return nil
	}
	provider = strings.ToLower(provider)
	p, ok := d.raw[provider]
	if !ok {
		return nil
	}
	out := make([]model.OpenAIModel, 0, len(p.Models))
	for _, m := range p.Models {
		out = append(out, model.OpenAIModel{ID: m.ID, Object: "model", OwnedBy: provider})
	}
	return out
}

// Fetch 拉取并解析 modelsdev api.json。使用 http.DefaultTransport（不走系统代理，避免依赖 client 包导致循环）。
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
	var raw map[string]struct {
		Models map[string]struct {
			ID   string         `json:"id"`
			Cost model.LLMPrice `json:"cost"`
		} `json:"models"`
	}
	if err := json.Unmarshal(body, &raw); err != nil {
		return nil, fmt.Errorf("failed to parse modelsdev: %w", err)
	}
	return &Data{raw: raw}, nil
}
