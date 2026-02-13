package course

import (
	"encoding/json"
	"fmt"
	"os"
	"sync"
	"time"

	"kwdb-playground/internal/logger"
)

// ProgressManager 用户进度管理器，负责进度的持久化存储和访问
// 使用文件存储和 sync.Mutex 确保并发安全
type ProgressManager struct {
	filePath string
	mu       sync.Mutex
	logger   *logger.Logger
}

// ProgressStore 进度存储结构，包含所有用户的进度数据
type ProgressStore struct {
	Version   string                  `json:"version"`
	UpdatedAt time.Time               `json:"updated_at"`
	Progress  map[string]UserProgress `json:"progress"` // key: "userID:courseID"
}

// NewProgressManager 创建新的进度管理器
// 参数:
//
//	filePath: 进度数据存储文件路径 (例如 "data/progress.json")
//	loggerInstance: 日志记录器实例
//
// 返回: 初始化的进度管理器
func NewProgressManager(filePath string, loggerInstance *logger.Logger) *ProgressManager {
	return &ProgressManager{
		filePath: filePath,
		logger:   loggerInstance,
	}
}

// GetProgress 获取用户的课程进度
// 参数:
//
//	userID: 用户ID
//	courseID: 课程ID
//
// 返回:
//
//	progress: 用户进度对象（如果不存在则为零值）
//	exists: 是否存在该进度记录
//	err: 错误信息
func (pm *ProgressManager) GetProgress(userID, courseID string) (*UserProgress, bool, error) {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	// 读取进度文件
	store, err := pm.readProgressFile()
	if err != nil {
		return nil, false, err
	}

	// 查找指定用户的课程进度
	key := pm.getProgressKey(userID, courseID)
	progress, exists := store.Progress[key]

	if exists {
		pm.logger.Debug("获取用户进度成功: userID=%s, courseID=%s, currentStep=%d", userID, courseID, progress.CurrentStep)
	}

	return &progress, exists, nil
}

// SaveProgress 保存或更新用户的课程进度
// 参数:
//
//	userID: 用户ID
//	courseID: 课程ID
//	step: 当前步骤索引
//	completed: 是否已完成课程
//
// 返回: 错误信息
func (pm *ProgressManager) SaveProgress(userID, courseID string, step int, completed bool) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	// 读取现有进度数据
	store, err := pm.readProgressFile()
	if err != nil {
		return err
	}

	// 构建或更新进度对象
	key := pm.getProgressKey(userID, courseID)
	progress := UserProgress{
		UserID:      userID,
		CourseID:    courseID,
		CurrentStep: step,
		Completed:   completed,
		UpdatedAt:   time.Now(),
	}

	// 如果是新建记录，设置起始时间
	var existingCompleted bool
	if existing, exists := store.Progress[key]; exists {
		progress.StartedAt = existing.StartedAt
		progress.CompletedAt = existing.CompletedAt
		existingCompleted = existing.Completed
	} else {
		progress.StartedAt = time.Now()
	}

	// 如果标记为已完成且之前未完成，设置完成时间
	if completed && !existingCompleted {
		now := time.Now()
		progress.CompletedAt = &now
	}

	// 如果标记为未完成，清空完成时间
	if !completed {
		progress.CompletedAt = nil
	}

	store.Progress[key] = progress
	store.UpdatedAt = time.Now()

	// 写入进度文件
	if err := pm.writeProgressFile(store); err != nil {
		return err
	}

	pm.logger.Debug("保存用户进度成功: userID=%s, courseID=%s, currentStep=%d, completed=%v",
		userID, courseID, step, completed)

	return nil
}

// ResetProgress 重置用户的课程进度
// 参数:
//
//	userID: 用户ID
//	courseID: 课程ID
//
// 返回: 错误信息
func (pm *ProgressManager) ResetProgress(userID, courseID string) error {
	pm.mu.Lock()
	defer pm.mu.Unlock()

	// 读取现有进度数据
	store, err := pm.readProgressFile()
	if err != nil {
		return err
	}

	// 删除指定用户的课程进度
	key := pm.getProgressKey(userID, courseID)
	if _, exists := store.Progress[key]; exists {
		delete(store.Progress, key)
		store.UpdatedAt = time.Now()

		// 写入进度文件
		if err := pm.writeProgressFile(store); err != nil {
			return err
		}

		pm.logger.Debug("重置用户进度成功: userID=%s, courseID=%s", userID, courseID)
	} else {
		pm.logger.Debug("重置用户进度: 进度记录不存在，userID=%s, courseID=%s", userID, courseID)
	}

	return nil
}

// readProgressFile 读取进度文件内容
// 如果文件不存在，返回空的进度存储结构
// 返回: 进度存储对象或错误信息
func (pm *ProgressManager) readProgressFile() (*ProgressStore, error) {
	// 如果文件不存在，返回初始化的存储结构
	if _, err := os.Stat(pm.filePath); os.IsNotExist(err) {
		return &ProgressStore{
			Version:   "1.0",
			UpdatedAt: time.Now(),
			Progress:  make(map[string]UserProgress),
		}, nil
	}

	// 读取文件内容
	data, err := os.ReadFile(pm.filePath)
	if err != nil {
		return nil, fmt.Errorf("读取进度文件失败: %w", err)
	}

	// 解析JSON
	var store ProgressStore
	if err := json.Unmarshal(data, &store); err != nil {
		pm.logger.Warn("进度文件格式错误，将重新初始化: %v", err)
		return &ProgressStore{
			Version:   "1.0",
			UpdatedAt: time.Now(),
			Progress:  make(map[string]UserProgress),
		}, nil
	}

	return &store, nil
}

// writeProgressFile 写入进度文件内容
// 参数:
//
//	store: 要写入的进度存储对象
//
// 返回: 错误信息
func (pm *ProgressManager) writeProgressFile(store *ProgressStore) error {
	// 序列化为JSON
	data, err := json.MarshalIndent(store, "", "  ")
	if err != nil {
		return fmt.Errorf("序列化进度数据失败: %w", err)
	}

	// 写入文件
	if err := os.WriteFile(pm.filePath, data, 0644); err != nil {
		return fmt.Errorf("写入进度文件失败: %w", err)
	}

	return nil
}

// getProgressKey 生成进度记录的唯一键
// 参数:
//
//	userID: 用户ID
//	courseID: 课程ID
//
// 返回: 组合的键字符串
func (pm *ProgressManager) getProgressKey(userID, courseID string) string {
	return fmt.Sprintf("%s:%s", userID, courseID)
}
