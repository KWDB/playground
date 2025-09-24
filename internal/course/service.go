// Package course 提供课程管理功能
// 包括课程加载、内容解析、命令提取等核心功能
//
// 主要功能:
//   - 从文件系统加载课程配置和内容
//   - 解析Markdown格式的课程文档
//   - 提取课程中的可执行命令
//   - 线程安全的课程数据访问
//
// 使用示例:
//
//	service := course.NewService("./courses")
//	service.LoadCourses()
//	courses := service.GetCourses()
package course

import (
	"fmt"
	"io/fs"
	"os"
	"path"
	"path/filepath"
	"strings"
	"sync"

	"kwdb-playground/internal/logger"

	"gopkg.in/yaml.v3"
)

// Service 课程服务，负责管理所有课程的加载和访问
// 线程安全，支持并发访问
type Service struct {
	coursesDir       string             // 课程文件根目录
	coursesFS        fs.FS              // 课程文件系统
	coursesBasePath  string             // 课程在FS中的根路径
	courses          map[string]*Course // 课程缓存，key为课程ID
	mu               sync.RWMutex       // 读写锁，保护courses map的并发访问
	logger           *logger.Logger     // 日志记录器实例
}

// NewService 创建新的课程服务实例
// 参数:
//
//	coursesDir: 课程文件存储目录路径
//
// 返回: 初始化的课程服务实例
func NewService(coursesDir string) *Service {
	// 创建默认INFO级别的logger实例
	loggerInstance := logger.NewLogger(logger.INFO)
	loggerInstance.Debug("Creating new course service with directory: %s", coursesDir)
	return &Service{
		coursesDir:      coursesDir,
		courses:         make(map[string]*Course),
		mu:              sync.RWMutex{},
		logger:          loggerInstance,
	}
}

// NewServiceFromFS 基于嵌入式文件系统创建课程服务（发布模式）
// 参数:
//
//  coursesFS: 提供课程内容的文件系统，通常为 embed.FS
//  basePath: 课程在FS中的根路径，例如 "courses"
//
// 返回: 初始化的课程服务实例
func NewServiceFromFS(coursesFS fs.FS, basePath string) *Service {
	loggerInstance := logger.NewLogger(logger.INFO)
	loggerInstance.Debug("Creating new course service from FS with base path: %s", basePath)
	return &Service{
		coursesFS:       coursesFS,
		coursesBasePath: basePath,
		courses:         make(map[string]*Course),
		mu:              sync.RWMutex{},
		logger:          loggerInstance,
	}
}

// SetLogger 设置日志记录器实例
// 允许外部配置logger，使其与配置系统兼容
// 参数:
//
//	loggerInstance: 要设置的logger实例
func (s *Service) SetLogger(loggerInstance *logger.Logger) {
	s.logger = loggerInstance
}

// LoadCourses 加载所有课程
// 扫描课程目录，加载所有有效的课程配置和内容
// 该方法是线程安全的，会清空现有课程缓存并重新加载
// 返回: 如果目录不存在或读取失败则返回错误
func (s *Service) LoadCourses() error {
	// 如果设置了嵌入式FS，则走嵌入模式
	if s.coursesFS != nil {
		s.logger.Debug("Loading courses from embedded FS: %s", s.coursesBasePath)

		entries, err := fs.ReadDir(s.coursesFS, s.coursesBasePath)
		if err != nil {
			return fmt.Errorf("failed to read courses base path in FS: %w", err)
		}

		// 使用写锁保护courses map
		s.mu.Lock()
		defer s.mu.Unlock()

		// 重新初始化缓存，避免旧数据残留
		s.courses = make(map[string]*Course)

		loadedCount := 0
		for _, entry := range entries {
			if entry.IsDir() {
				courseID := entry.Name()
				s.logger.Debug("Loading course (FS): %s", courseID)

				coursePath := path.Join(s.coursesBasePath, courseID)
				course, err := s.loadCourseFromFS(courseID, coursePath)
				if err != nil {
					s.logger.Error("Failed to load course %s from FS: %v", courseID, err)
					continue
				}

				s.courses[courseID] = course
				loadedCount++
			}
		}

		s.logger.Info("Successfully loaded %d courses from embedded FS", loadedCount)
		return nil
	}

	s.logger.Debug("Loading courses from directory: %s", s.coursesDir)

	// 检查课程目录是否存在
	if _, err := os.Stat(s.coursesDir); os.IsNotExist(err) {
		return fmt.Errorf("courses directory does not exist: %s", s.coursesDir)
	}

	entries, err := os.ReadDir(s.coursesDir)
	if err != nil {
		return fmt.Errorf("failed to read courses directory: %w", err)
	}

	// 使用写锁保护courses map
	s.mu.Lock()
	defer s.mu.Unlock()

	// 重新初始化缓存，避免旧数据残留
	s.courses = make(map[string]*Course)

	loadedCount := 0
	for _, entry := range entries {
		if entry.IsDir() {
			courseID := entry.Name()
			s.logger.Debug("Loading course: %s", courseID)

			coursePath := filepath.Join(s.coursesDir, courseID)
			course, err := s.loadCourse(courseID, coursePath)
			if err != nil {
				s.logger.Error("Failed to load course %s: %v", courseID, err)
				continue
			}

			s.courses[courseID] = course
			loadedCount++
		}
	}

	s.logger.Info("Successfully loaded %d courses", loadedCount)
	return nil
}

// loadCourse 加载单个课程的配置和内容（磁盘模式）
// courseID: 课程的唯一标识符
// coursePath: 课程目录的完整路径
// 返回完整的课程对象或错误信息
func (s *Service) loadCourse(courseID, coursePath string) (*Course, error) {
	configPath := filepath.Join(coursePath, "index.yaml")

	// 检查配置文件是否存在
	if _, err := os.Stat(configPath); os.IsNotExist(err) {
		return nil, fmt.Errorf("course config file not found: %s", configPath)
	}

	// 读取课程配置文件
	configData, err := os.ReadFile(configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read course config: %w", err)
	}

	// 检查配置文件是否为空
	if len(configData) == 0 {
		return nil, fmt.Errorf("course config file is empty: %s", configPath)
	}

	// 解析YAML配置
	var course Course
	if err := yaml.Unmarshal(configData, &course); err != nil {
		return nil, fmt.Errorf("failed to parse course config: %w", err)
	}

	// 设置课程ID和基础信息
	course.ID = courseID
	if course.Title == "" {
		course.Title = courseID // 如果没有设置标题，使用ID作为默认标题
	}

	// 加载课程详细内容
	if err := s.loadCourseContent(&course, coursePath); err != nil {
		return nil, fmt.Errorf("failed to load course content: %w", err)
	}

	return &course, nil
}

// loadCourseFromFS 加载单个课程的配置和内容（嵌入模式）
// courseID: 课程的唯一标识符
// coursePath: 课程在FS中的目录路径（使用/分隔）
// 返回完整的课程对象或错误信息
func (s *Service) loadCourseFromFS(courseID, coursePath string) (*Course, error) {
	configPath := path.Join(coursePath, "index.yaml")

	// 读取课程配置文件（FS内）
	configData, err := fs.ReadFile(s.coursesFS, configPath)
	if err != nil {
		return nil, fmt.Errorf("failed to read course config from FS: %w", err)
	}

	// 检查配置文件是否为空
	if len(configData) == 0 {
		return nil, fmt.Errorf("course config file is empty: %s", configPath)
	}

	// 解析YAML配置
	var course Course
	if err := yaml.Unmarshal(configData, &course); err != nil {
		return nil, fmt.Errorf("failed to parse course config: %w", err)
	}

	// 设置课程ID和基础信息
	course.ID = courseID
	if course.Title == "" {
		course.Title = courseID // 如果没有设置标题，使用ID作为默认标题
	}

	// 加载课程详细内容（FS内）
	if err := s.loadCourseContentFromFS(&course, coursePath); err != nil {
		return nil, fmt.Errorf("failed to load course content from FS: %w", err)
	}

	return &course, nil
}

// loadCourseContent 加载课程的详细内容，根据index.yaml中的details结构加载对应文件（磁盘模式）
// course: 要加载内容的课程对象指针
// coursePath: 课程目录的完整路径
// 返回加载过程中遇到的错误
func (s *Service) loadCourseContent(course *Course, coursePath string) error {
	s.logger.Debug("Loading content for course: %s", course.ID)

	// 加载课程介绍内容
	if course.Details.Intro.Text != "" {
		introPath := filepath.Join(coursePath, course.Details.Intro.Text)
		if content, err := s.loadMarkdownFile(introPath); err == nil {
			course.Details.Intro.Content = content
			s.logger.Debug("Loaded intro file %s for course: %s", course.Details.Intro.Text, course.ID)
		} else {
			s.logger.Warn("Failed to load intro file %s for course %s: %v", course.Details.Intro.Text, course.ID, err)
			course.Details.Intro.Content = "" // 设置为空字符串
		}
	}

	// 加载课程步骤内容
	for i := range course.Details.Steps {
		step := &course.Details.Steps[i]
		if step.Text != "" {
			stepPath := filepath.Join(coursePath, step.Text)
			if content, err := s.loadMarkdownFile(stepPath); err == nil {
				step.Content = content
				s.logger.Debug("Loaded step file %s for course: %s", step.Text, course.ID)
			} else {
				s.logger.Warn("Failed to load step file %s for course %s: %v", step.Text, course.ID, err)
				step.Content = "" // 设置为空字符串
			}
		}
	}

	// 加载课程结束内容
	if course.Details.Finish.Text != "" {
		finishPath := filepath.Join(coursePath, course.Details.Finish.Text)
		if content, err := s.loadMarkdownFile(finishPath); err == nil {
			course.Details.Finish.Content = content
			s.logger.Debug("Loaded finish file %s for course: %s", course.Details.Finish.Text, course.ID)
		} else {
			s.logger.Warn("Failed to load finish file %s for course %s: %v", course.Details.Finish.Text, course.ID, err)
			course.Details.Finish.Content = "" // 设置为空字符串
		}
	}

	s.logger.Debug("Loaded content for course: %s with %d steps", course.ID, len(course.Details.Steps))
	return nil
}

// loadCourseContentFromFS 加载课程的详细内容（嵌入模式）
// course: 要加载内容的课程对象指针
// coursePath: 课程在FS中的目录路径（使用/分隔）
// 返回加载过程中遇到的错误
func (s *Service) loadCourseContentFromFS(course *Course, coursePath string) error {
	s.logger.Debug("Loading content for course from FS: %s", course.ID)

	// 加载课程介绍内容
	if course.Details.Intro.Text != "" {
		introPath := path.Join(coursePath, course.Details.Intro.Text)
		if content, err := s.loadMarkdownFileFromFS(introPath); err == nil {
			course.Details.Intro.Content = content
			s.logger.Debug("Loaded intro file %s for course(FS): %s", course.Details.Intro.Text, course.ID)
		} else {
			s.logger.Warn("Failed to load intro file %s for course(FS) %s: %v", course.Details.Intro.Text, course.ID, err)
			course.Details.Intro.Content = "" // 设置为空字符串
		}
	}

	// 加载课程步骤内容
	for i := range course.Details.Steps {
		step := &course.Details.Steps[i]
		if step.Text != "" {
			stepPath := path.Join(coursePath, step.Text)
			if content, err := s.loadMarkdownFileFromFS(stepPath); err == nil {
				step.Content = content
				s.logger.Debug("Loaded step file %s for course(FS): %s", step.Text, course.ID)
			} else {
				s.logger.Warn("Failed to load step file %s for course(FS) %s: %v", step.Text, course.ID, err)
				step.Content = "" // 设置为空字符串
			}
		}
	}

	// 加载课程结束内容
	if course.Details.Finish.Text != "" {
		finishPath := path.Join(coursePath, course.Details.Finish.Text)
		if content, err := s.loadMarkdownFileFromFS(finishPath); err == nil {
			course.Details.Finish.Content = content
			s.logger.Debug("Loaded finish file %s for course(FS): %s", course.Details.Finish.Text, course.ID)
		} else {
			s.logger.Warn("Failed to load finish file %s for course(FS) %s: %v", course.Details.Finish.Text, course.ID, err)
			course.Details.Finish.Content = "" // 设置为空字符串
		}
	}

	s.logger.Debug("Loaded content for course(FS): %s with %d steps", course.ID, len(course.Details.Steps))
	return nil
}

// loadMarkdownFile 读取并返回Markdown文件的内容（磁盘模式）
// filePath: Markdown文件的完整路径
// 返回文件内容字符串或错误信息
func (s *Service) loadMarkdownFile(filePath string) (string, error) {
	// 检查文件是否存在
	if _, err := os.Stat(filePath); os.IsNotExist(err) {
		return "", fmt.Errorf("markdown file not found: %s", filePath)
	}

	// 读取文件内容
	content, err := os.ReadFile(filePath)
	if err != nil {
		return "", fmt.Errorf("failed to read markdown file %s: %w", filePath, err)
	}

	// 检查文件是否为空
	if len(content) == 0 {
		return "", fmt.Errorf("markdown file is empty: %s", filePath)
	}

	return string(content), nil
}

// loadMarkdownFileFromFS 读取并返回Markdown文件的内容（嵌入模式）
// filePath: Markdown文件在FS中的路径（使用/分隔）
// 返回文件内容字符串或错误信息
func (s *Service) loadMarkdownFileFromFS(filePath string) (string, error) {
	content, err := fs.ReadFile(s.coursesFS, filePath)
	if err != nil {
		return "", fmt.Errorf("failed to read markdown file from FS %s: %w", filePath, err)
	}

	if len(content) == 0 {
		return "", fmt.Errorf("markdown file is empty: %s", filePath)
	}

	return string(content), nil
}

// GetCourses 获取所有课程
// 返回所有已加载课程的副本，避免外部修改影响内部缓存
// 该方法是线程安全的，使用读锁保护数据访问
// 返回: 课程ID到课程对象的映射
func (s *Service) GetCourses() map[string]*Course {
	s.mu.RLock()
	defer s.mu.RUnlock()

	// 创建副本以避免外部修改
	result := make(map[string]*Course)
	for k, v := range s.courses {
		result[k] = v
	}
	return result
}

// GetCourse 根据ID获取特定课程
// 参数:
//
//	id: 课程唯一标识符
//
// 返回:
//
//	course: 课程对象指针，如果课程不存在则为nil
//	exists: 布尔值，表示课程是否存在
//
// 该方法是线程安全的，使用读锁保护数据访问
func (s *Service) GetCourse(id string) (*Course, bool) {
	s.mu.RLock()
	defer s.mu.RUnlock()

	course, exists := s.courses[id]
	return course, exists
}

// ExtractExecutableCommands 从课程内容中提取可执行命令
// 扫描课程内容和所有步骤，提取Markdown代码块中的可执行命令
// 参数:
//
//	course: 要提取命令的课程对象
//
// 返回: 命令标识符到命令内容的映射
//   - content_N: 来自课程主要内容的第N个命令
//   - step_<stepID>_N: 来自特定步骤的第N个命令
func (s *Service) ExtractExecutableCommands(course *Course) map[string]string {
	commands := make(map[string]string)

	// 从课程内容中提取命令
	contentCommands := extractCommandsFromText(course.Details.Intro.Content)
	for i, cmd := range contentCommands {
		key := fmt.Sprintf("content_%d", i+1)
		commands[key] = cmd
	}

	// 从步骤中提取命令
	for _, step := range course.Details.Steps {
		stepCommands := extractCommandsFromText(step.Content)
		for i, cmd := range stepCommands {
			key := fmt.Sprintf("step_%s_%d", step.Title, i+1)
			commands[key] = cmd
		}
	}

	return commands
}

// extractCommandsFromText 从文本中提取命令
// 解析Markdown格式的文本，提取代码块中以$开头的命令行
// 支持多行命令的解析和合并
// 参数:
//
//	text: 要解析的Markdown文本
//
// 返回: 提取到的命令列表
func extractCommandsFromText(text string) []string {
	var commands []string
	lines := strings.Split(text, "\n")
	inCodeBlock := false
	currentCommand := ""

	for _, line := range lines {
		// 检查是否是代码块开始或结束
		if strings.HasPrefix(line, "```") {
			if inCodeBlock {
				// 代码块结束
				if currentCommand != "" {
					commands = append(commands, strings.TrimSpace(currentCommand))
					currentCommand = ""
				}
			}
			inCodeBlock = !inCodeBlock
			continue
		}

		// 如果在代码块中，检查是否是命令行
		if inCodeBlock {
			trimmedLine := strings.TrimSpace(line)
			if strings.HasPrefix(trimmedLine, "$") {
				// 如果已有命令，先保存
				if currentCommand != "" {
					commands = append(commands, strings.TrimSpace(currentCommand))
				}
				// 开始新命令（去掉$符号）
				currentCommand = strings.TrimSpace(trimmedLine[1:])
			} else if currentCommand != "" && trimmedLine != "" {
				// 多行命令的续行
				currentCommand += " " + trimmedLine
			}
		}
	}

	// 处理最后一个命令
	if currentCommand != "" {
		commands = append(commands, strings.TrimSpace(currentCommand))
	}

	return commands
}
