package config

import (
	"fmt"
	"os"
	"strconv"

	"kwdb-playground/internal/logger"
)

// BuildDefaultUseEmbed 用于通过 -ldflags 注入发布版本的默认嵌入开关（建议为"true"或"false"，也可为"1"或"0"）
// 在未设置环境变量 COURSES_USE_EMBED 时，此值作为默认值生效
var BuildDefaultUseEmbed = ""

// Config 应用程序配置结构
// 包含服务器和课程相关的所有配置项
type Config struct {
	// Server 服务器相关配置
	Server ServerConfig `json:"server" yaml:"server"`
	Docker DockerConfig `json:"docker" yaml:"docker"`
	// Course 课程相关配置
	Course CourseConfig `json:"course" yaml:"course"`
	Log    LogConfig    `json:"log" yaml:"log"`
}

// ServerConfig 服务器配置
// 定义HTTP服务器的监听地址和端口
type ServerConfig struct {
	// Host 服务器监听地址，默认为0.0.0.0
	Host string `json:"host" yaml:"host"` // 服务器监听地址
	// Port 服务器监听端口，默认为3006
	Port         int `json:"port" yaml:"port"`                 // 服务器监听端口
	SessionLimit int `json:"sessionLimit" yaml:"sessionLimit"` // 并发会话限制
}

// DockerConfig Docker容器相关配置
type DockerConfig struct {
	Host    string `json:"host" yaml:"host"`       // Docker守护进程地址
	Timeout int    `json:"timeout" yaml:"timeout"` // 操作超时时间（秒）
}

// CourseConfig 课程配置
// 定义课程文件的存储路径
type CourseConfig struct {
	// Dir 课程文件目录路径，默认为./courses
	Dir      string `json:"dir" yaml:"dir"`           // 课程文件目录路径
	Reload   bool   `json:"reload" yaml:"reload"`     // 是否启用热重载
	UseEmbed bool   `json:"useEmbed" yaml:"useEmbed"` // 是否使用嵌入式FS作为课程数据来源
}

// LogConfig 日志系统相关配置
type LogConfig struct {
	Level  string `json:"level" yaml:"level"`   // 日志级别 (debug, info, warn, error)
	Format string `json:"format" yaml:"format"` // 日志格式 (json, text)
}

// Load 从环境变量加载配置
// 读取环境变量并构建配置对象，如果环境变量不存在则使用默认值
// 支持的环境变量:
//   - SERVER_HOST: 服务器监听地址 (默认: 0.0.0.0)
//   - SERVER_PORT: 服务器监听端口 (默认: 3006)
//   - COURSE_DIR: 课程文件目录 (默认: ./courses)
//   - COURSES_RELOAD: 是否启用课程热重载 (默认: true)
//   - COURSES_USE_EMBED: 是否使用嵌入式FS作为课程数据来源 (默认: false 或由 BuildDefaultUseEmbed 指定)
//
// 返回完整的配置对象，如果配置验证失败会记录警告但不会中断程序
func Load() *Config {
	// 创建临时logger实例用于配置加载过程
	// 取消临时 DEBUG 输出，避免启动期噪声
	_ = logger.NewLogger(logger.ERROR) // 保留占位，如需未来扩展可使用

	// 计算嵌入模式的默认值：优先环境变量，若未设置则使用编译期注入的 BuildDefaultUseEmbed
	defaultUseEmbed := (BuildDefaultUseEmbed == "true" || BuildDefaultUseEmbed == "1")

	config := &Config{
		Server: ServerConfig{
			Host:         getEnv("SERVER_HOST", "0.0.0.0"),
			Port:         getEnvInt("SERVER_PORT", 3006),
			SessionLimit: getEnvInt("SESSION_LIMIT", 1),
		},
		Docker: DockerConfig{
			Host:    getEnv("DOCKER_HOST", ""),
			Timeout: getEnvInt("DOCKER_TIMEOUT", 30),
		},
		Course: CourseConfig{
			Dir:      getEnv("COURSE_DIR", "./courses"),
			Reload:   getEnvBool("COURSES_RELOAD", true),
			UseEmbed: getEnvBool("COURSES_USE_EMBED", defaultUseEmbed),
		},
		Log: LogConfig{
			Level:  getEnv("LOG_LEVEL", "info"),
			Format: getEnv("LOG_FORMAT", "json"),
		},
	}

	// 应用全局日志级别覆盖，确保后续新建的 Logger 统一遵循配置
	logger.SetGlobalLevel(logger.ParseLogLevel(config.Log.Level))

	// 创建配置好的logger实例
	configLogger := logger.NewLogger(logger.ParseLogLevel(config.Log.Level))

	// 验证配置
	if err := validateConfig(config, configLogger); err != nil {
		configLogger.Warn("Configuration validation warning: %v", err)
	}

	return config
}

// validateConfig 验证配置的有效性
// 检查配置项是否符合要求，包括端口范围和目录存在性
// 如果验证失败返回错误，但不会中断程序运行
func validateConfig(cfg *Config, logger *logger.Logger) error {
	// 检查端口范围
	if cfg.Server.Port < 1 || cfg.Server.Port > 65535 {
		return fmt.Errorf("invalid port number: %d, must be between 1 and 65535", cfg.Server.Port)
	}

	if cfg.Docker.Timeout < 1 {
		return fmt.Errorf("invalid docker timeout: %d, must be positive", cfg.Docker.Timeout)
	}

	// 检查课程目录是否存在（仅在非嵌入模式下）
	if !cfg.Course.UseEmbed {
		if _, err := os.Stat(cfg.Course.Dir); os.IsNotExist(err) {
			return fmt.Errorf("course directory does not exist: %s", cfg.Course.Dir)
		}
	}

	validLogLevels := map[string]bool{"debug": true, "info": true, "warn": true, "error": true}
	if !validLogLevels[cfg.Log.Level] {
		return fmt.Errorf("invalid log level: %s, must be one of: debug, info, warn, error", cfg.Log.Level)
	}

	return nil
}

// getEnv 获取环境变量，如果不存在则返回默认值
// 参数:
//
// key: 环境变量名称
// defaultValue: 默认值
//
// 返回: 环境变量值或默认值
func getEnv(key, defaultValue string) string {
	if value := os.Getenv(key); value != "" {
		return value
	}
	return defaultValue
}

// getEnvInt 获取整数类型的环境变量，如果不存在或转换失败则返回默认值
// 参数:
//
// key: 环境变量名称
// defaultValue: 默认值
//
// 返回: 环境变量转换后的整数值或默认值
func getEnvInt(key string, defaultValue int) int {
	if value := os.Getenv(key); value != "" {
		if intValue, err := strconv.Atoi(value); err == nil {
			return intValue
		}
		// 记录解析错误但不中断程序
		// 使用临时logger记录警告
		tempLogger := logger.NewLogger(logger.WARN)
		tempLogger.Warn("failed to parse %s as integer: %s, using default: %d", key, value, defaultValue)
	}
	return defaultValue
}

// getEnvBool 获取布尔类型的环境变量，如果不存在或转换失败则返回默认值
// 参数:
//
// key: 环境变量名称
// defaultValue: 默认值
//
// 返回: 环境变量转换后的布尔值或默认值
// 支持的布尔值格式: true, false, 1, 0, t, f, T, F, TRUE, FALSE
func getEnvBool(key string, defaultValue bool) bool {
	if value := os.Getenv(key); value != "" {
		if boolValue, err := strconv.ParseBool(value); err == nil {
			return boolValue
		}
		// 记录解析错误但不中断程序
		// 使用临时logger记录警告
		tempLogger := logger.NewLogger(logger.WARN)
		tempLogger.Warn("failed to parse %s as boolean: %s, using default: %t", key, value, defaultValue)
	}
	return defaultValue
}
