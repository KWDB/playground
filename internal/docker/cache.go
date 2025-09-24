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
	entry, exists := c.cache[containerID]
	if !exists {
		c.mu.RUnlock()
		return false, false
	}

	// 检查缓存是否过期 - 在锁保护下进行时间检查
	now := time.Now()
	if now.Sub(entry.lastChecked) > c.ttl {
		c.mu.RUnlock()
		// 缓存过期，需要删除过期条目
		c.mu.Lock()
		// 双重检查，防止其他goroutine已经更新了缓存
		if entry2, exists2 := c.cache[containerID]; exists2 && now.Sub(entry2.lastChecked) > c.ttl {
			delete(c.cache, containerID)
		}
		c.mu.Unlock()
		return false, false
	}

	isRunning := entry.isRunning
	c.mu.RUnlock()
	return isRunning, true
}

// set 设置容器状态缓存
func (c *containerCache) set(containerID string, isRunning bool) {
	c.mu.Lock()
	defer c.mu.Unlock()

	// 创建新的缓存条目，使用当前时间戳
	now := time.Now()
	c.cache[containerID] = &containerStateCache{
		isRunning:   isRunning,
		lastChecked: now,
		cacheTTL:    c.ttl,
	}
}

// delete 删除容器状态缓存
func (c *containerCache) delete(containerID string) {
	c.mu.Lock()
	defer c.mu.Unlock()

	delete(c.cache, containerID)
}
