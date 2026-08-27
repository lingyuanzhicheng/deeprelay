package op

import (
	"context"
	"fmt"
	"strings"
	"time"

	"github.com/lingyuanzhicheng/deeprelay/internal/model"
	"github.com/lingyuanzhicheng/deeprelay/internal/modelsdev"
)

func fetchModelsDevData(ctx context.Context) (*modelsdev.Data, error) {
	return modelsdev.Fetch(ctx)
}

func ModelsDevProviders(ctx context.Context) ([]string, error) {
	data, err := fetchModelsDevData(ctx)
	if err != nil {
		return nil, err
	}
	return data.Providers(), nil
}

func ModelsDevModels(provider string, ctx context.Context) ([]model.OpenAIModel, error) {
	data, err := fetchModelsDevData(ctx)
	if err != nil {
		return nil, err
	}
	return data.Models(provider), nil
}

func channelLLMPriceSyncFromModelsDev(channelID int, ctx context.Context, preloaded *modelsdev.Data) error {
	data := preloaded
	if data == nil {
		d, err := fetchModelsDevData(ctx)
		if err != nil {
			return err
		}
		data = d
	}
	existing, err := ChannelLLMPriceListByChannel(channelID)
	if err != nil {
		return err
	}
	var updated []model.ChannelLLMPrice
	for _, p := range existing {
		if p.BindProvider == "" || p.BindModelID == "" {
			continue
		}
		cost, ok := data.Lookup(p.BindProvider, p.BindModelID)
		if !ok {
			continue
		}
		p.Input = cost.Input
		p.Output = cost.Output
		p.CacheRead = cost.CacheRead
		p.CacheWrite = cost.CacheWrite
		updated = append(updated, p)
	}
	if len(updated) > 0 {
		if err := ChannelLLMPriceBatchUpsert(updated, ctx); err != nil {
			return err
		}
	}
	return ChannelLLMPriceSyncTimeSet(channelID, time.Now().Unix(), ctx)
}

func ChannelLLMPriceSyncFromModelsDev(channelID int, ctx context.Context) error {
	return channelLLMPriceSyncFromModelsDev(channelID, ctx, nil)
}

func ChannelLLMPriceSyncAllFromModelsDev(ctx context.Context) error {
	data, err := fetchModelsDevData(ctx)
	if err != nil {
		return err
	}
	channels, err := ChannelList(ctx)
	if err != nil {
		return err
	}
	for _, ch := range channels {
		if err := channelLLMPriceSyncFromModelsDev(ch.ID, ctx, data); err != nil {
			return err
		}
	}
	return nil
}

func ChannelLLMPriceAutoMatch(req model.ChannelLLMPriceAutoMatchRequest, ctx context.Context) (int, error) {
	data, err := fetchModelsDevData(ctx)
	if err != nil {
		return 0, err
	}
	if len(data.Models(req.Provider)) == 0 {
		return 0, fmt.Errorf("provider not found: %s", req.Provider)
	}
	var matched []model.ChannelLLMPriceBind
	for _, mn := range req.ModelNames {
		mn = strings.ToLower(mn)
		if mn == "" {
			continue
		}
		var hit string
		for _, m := range data.Models(req.Provider) {
			mid := strings.ToLower(m.ID)
			if req.Mode == int(model.AutoGroupTypeExact) {
				if mid == mn {
					hit = m.ID
					break
				}
			} else {
				if strings.Contains(mid, mn) || strings.Contains(mn, mid) {
					hit = m.ID
					break
				}
			}
		}
		if hit != "" {
			matched = append(matched, model.ChannelLLMPriceBind{
				ModelName: mn,
				Provider:  req.Provider,
				ModelID:   hit,
			})
		}
	}
	if len(matched) == 0 {
		return 0, nil
	}
	if err := ChannelLLMPriceBatchBind(model.ChannelLLMPriceBatchBindRequest{
		ChannelID: req.ChannelID,
		Items:     matched,
	}, ctx); err != nil {
		return 0, err
	}
	if err := channelLLMPriceSyncFromModelsDev(req.ChannelID, ctx, data); err != nil {
		return len(matched), err
	}
	return len(matched), nil
}

func ModelsDevLastSyncTime() time.Time {
	var earliest int64
	for _, ch := range channelCache.GetAll() {
		if ch.LLMPriceSyncTime == 0 {
			continue
		}
		if earliest == 0 || ch.LLMPriceSyncTime < earliest {
			earliest = ch.LLMPriceSyncTime
		}
	}
	if earliest == 0 {
		return time.Time{}
	}
	return time.Unix(earliest, 0)
}
