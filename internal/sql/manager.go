package sql

import (
	"context"
	"fmt"
	"sync"

	"kwdb-playground/internal/course"

	"github.com/jackc/pgx/v5/pgxpool"
)

// DriverManager 管理多个课程的SQL驱动实例
// 为每个课程维护独立的连接池，避免并发冲突
type DriverManager struct {
	drivers map[string]*Driver // key: courseID
	mu      sync.RWMutex
}

// NewDriverManager 创建新的驱动管理器
func NewDriverManager() *DriverManager {
	return &DriverManager{
		drivers: make(map[string]*Driver),
	}
}

// GetDriver 获取指定课程的驱动实例
// 如果不存在，会自动创建新的实例
func (m *DriverManager) GetDriver(courseID string) *Driver {
	m.mu.RLock()
	driver, exists := m.drivers[courseID]
	m.mu.RUnlock()

	if exists {
		return driver
	}

	// 需要创建新的驱动实例
	m.mu.Lock()
	defer m.mu.Unlock()

	// 双重检查，防止并发创建
	if driver, exists = m.drivers[courseID]; exists {
		return driver
	}

	driver = &Driver{}
	m.drivers[courseID] = driver
	return driver
}

// EnsureReady 确保指定课程的数据库连接就绪
func (m *DriverManager) EnsureReady(ctx context.Context, course *course.Course) error {
	if course == nil {
		return fmt.Errorf("course is nil")
	}

	driver := m.GetDriver(course.ID)
	return driver.EnsureReady(ctx, course)
}

// Pool 获取指定课程的连接池
func (m *DriverManager) Pool(courseID string) *pgxpool.Pool {
	driver := m.GetDriver(courseID)
	return driver.Pool()
}

// RemoveDriver 移除指定课程的驱动实例（课程停止时调用）
func (m *DriverManager) RemoveDriver(courseID string) {
	m.mu.Lock()
	defer m.mu.Unlock()

	if driver, exists := m.drivers[courseID]; exists {
		// 关闭连接池
		if driver.pool != nil {
			driver.pool.Close()
		}
		delete(m.drivers, courseID)
	}
}

// Close 关闭所有驱动实例
func (m *DriverManager) Close() {
	m.mu.Lock()
	defer m.mu.Unlock()

	for courseID, driver := range m.drivers {
		if driver.pool != nil {
			driver.pool.Close()
		}
		delete(m.drivers, courseID)
	}
}

// GetCourseCount 获取当前管理的课程数量
func (m *DriverManager) GetCourseCount() int {
	m.mu.RLock()
	defer m.mu.RUnlock()
	return len(m.drivers)
}
