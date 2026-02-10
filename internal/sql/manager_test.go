package sql

import (
	"fmt"
	"sync"
	"testing"
)

// TestDriverManagerConcurrentAccess 测试驱动管理器的并发安全性
func TestDriverManagerConcurrentAccess(t *testing.T) {
	manager := NewDriverManager()
	defer manager.Close()

	// 测试并发获取不同课程的驱动
	var wg sync.WaitGroup
	numCourses := 10
	numGoroutines := 100

	for i := 0; i < numGoroutines; i++ {
		wg.Add(1)
		go func(id int) {
			defer wg.Done()

			// 模拟多个goroutine同时访问不同课程
			for j := 0; j < numCourses; j++ {
				courseID := fmt.Sprintf("course-%d", j)
				driver := manager.GetDriver(courseID)
				if driver == nil {
					t.Errorf("GetDriver returned nil for course %s", courseID)
				}
			}
		}(i)
	}

	wg.Wait()

	// 验证每个课程只有一个驱动实例
	if count := manager.GetCourseCount(); count != numCourses {
		t.Errorf("Expected %d drivers, got %d", numCourses, count)
	}

	// 验证相同课程返回相同实例
	for i := 0; i < numCourses; i++ {
		courseID := fmt.Sprintf("course-%d", i)
		driver1 := manager.GetDriver(courseID)
		driver2 := manager.GetDriver(courseID)
		if driver1 != driver2 {
			t.Errorf("Same course should return same driver instance")
		}
	}
}

// TestDriverManagerRemoveDriver 测试移除驱动功能
func TestDriverManagerRemoveDriver(t *testing.T) {
	manager := NewDriverManager()
	defer manager.Close()

	// 添加几个驱动
	for i := 0; i < 5; i++ {
		courseID := fmt.Sprintf("course-%d", i)
		manager.GetDriver(courseID)
	}

	if count := manager.GetCourseCount(); count != 5 {
		t.Errorf("Expected 5 drivers, got %d", count)
	}

	// 移除一个驱动
	manager.RemoveDriver("course-2")

	if count := manager.GetCourseCount(); count != 4 {
		t.Errorf("Expected 4 drivers after removal, got %d", count)
	}

	// 验证被移除的课程会创建新实例
	driver := manager.GetDriver("course-2")
	if driver == nil {
		t.Error("GetDriver should return new instance after removal")
	}
}

// TestDriverManagerClose 测试关闭所有驱动
func TestDriverManagerClose(t *testing.T) {
	manager := NewDriverManager()

	// 添加几个驱动
	for i := 0; i < 5; i++ {
		courseID := fmt.Sprintf("course-%d", i)
		manager.GetDriver(courseID)
	}

	// 关闭所有驱动
	manager.Close()

	if count := manager.GetCourseCount(); count != 0 {
		t.Errorf("Expected 0 drivers after close, got %d", count)
	}
}

// BenchmarkDriverManagerGetDriver 测试驱动获取性能
func BenchmarkDriverManagerGetDriver(b *testing.B) {
	manager := NewDriverManager()
	defer manager.Close()

	b.RunParallel(func(pb *testing.PB) {
		i := 0
		for pb.Next() {
			courseID := fmt.Sprintf("course-%d", i%10)
			manager.GetDriver(courseID)
			i++
		}
	})
}
