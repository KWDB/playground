package check

import (
	"sync/atomic"
	"testing"
	"time"
)

func resetImageSourcesCacheForTest() {
	imageSourcesCacheMu.Lock()
	imageSourcesCacheAt = time.Time{}
	imageSourcesCacheOK = false
	imageSourcesCacheMessage = ""
	imageSourcesCacheDetails = ""
	imageSourcesCacheMu.Unlock()
}

func TestImageSourcesAvailabilityUsesCache(t *testing.T) {
	originalProbe := probeRegistryV2Func
	defer func() {
		probeRegistryV2Func = originalProbe
		resetImageSourcesCacheForTest()
	}()

	resetImageSourcesCacheForTest()

	var calls int32
	probeRegistryV2Func = func(url string) (int, bool, error) {
		atomic.AddInt32(&calls, 1)
		return 200, true, nil
	}

	ImageSourcesAvailability()
	ImageSourcesAvailability()

	if got := atomic.LoadInt32(&calls); got != 3 {
		t.Fatalf("expected 3 probe calls with cache hit, got %d", got)
	}
}

func TestImageSourcesAvailabilityReProbeAfterCacheExpired(t *testing.T) {
	originalProbe := probeRegistryV2Func
	defer func() {
		probeRegistryV2Func = originalProbe
		resetImageSourcesCacheForTest()
	}()

	resetImageSourcesCacheForTest()

	var calls int32
	probeRegistryV2Func = func(url string) (int, bool, error) {
		atomic.AddInt32(&calls, 1)
		return 200, true, nil
	}

	ImageSourcesAvailability()

	imageSourcesCacheMu.Lock()
	imageSourcesCacheAt = time.Now().Add(-imageSourcesCacheTTL - time.Second)
	imageSourcesCacheMu.Unlock()

	ImageSourcesAvailability()

	if got := atomic.LoadInt32(&calls); got != 6 {
		t.Fatalf("expected 6 probe calls after cache expiry, got %d", got)
	}
}
