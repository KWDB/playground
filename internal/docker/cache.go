package docker

import (
	"sync"
	"time"
)

// containerCache 容器状态缓存管理器
type containerCache struct {
	mu    sync.RWMutex
	cache map[string]*containerStateCache
	ttl   time.Duration
}

// newContainerCache 创建新的容器缓存管理器
func newContainerCache(ttl time.Duration) *containerCache {
	return &containerCache{
		cache: make(map[string]*containerStateCache),
		ttl:   ttl,
	}
}

// get 获取缓存的容器状态
func (c *containerCache) get(containerID string) (bool, bool) {
	c.mu.RLock()
	defer c.mu.RUnlock()

	entry, exists := c.cache[containerID]
	if !exists {
		return false, false
	}

	// 检查缓存是否过期
	if time.Since(entry.lastChecked) > c.ttl {
		return false, false
	}

	return entry.isRunning, true
}

// set 设置容器状态缓存
func (c *containerCache) set(containerID string, isRunning bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	c.cache[containerID] = &containerStateCache{
		isRunning:   isRunning,
		lastChecked: time.Now(),
		cacheTTL:    c.ttl,
	}
}

// delete 删除容器状态缓存
func (c *containerCache) delete(containerID string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	delete(c.cache, containerID)
}
