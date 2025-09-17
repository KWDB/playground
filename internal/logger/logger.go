package logger

import (
	"fmt"
	"log"
	"strings"
)

// LogLevel 定义日志级别类型
type LogLevel int

// 日志级别常量定义
const (
	DEBUG LogLevel = iota
	INFO
	WARN
	ERROR
)

// LogLevelNames 日志级别名称映射
var LogLevelNames = map[LogLevel]string{
	DEBUG: "DEBUG",
	INFO:  "INFO",
	WARN:  "WARN",
	ERROR: "ERROR",
}

// Logger 日志记录器结构体
type Logger struct {
	level LogLevel // 当前日志级别
}

// NewLogger 创建新的日志记录器实例
func NewLogger(level LogLevel) *Logger {
	return &Logger{
		level: level,
	}
}

// ParseLogLevel 从字符串解析日志级别
func ParseLogLevel(levelStr string) LogLevel {
	switch strings.ToUpper(levelStr) {
	case "DEBUG":
		return DEBUG
	case "INFO":
		return INFO
	case "WARN", "WARNING":
		return WARN
	case "ERROR":
		return ERROR
	default:
		return INFO // 默认级别
	}
}

// shouldLog 检查是否应该记录指定级别的日志
func (l *Logger) shouldLog(level LogLevel) bool {
	return level >= l.level
}

// formatMessage 格式化日志消息，添加级别标识
func (l *Logger) formatMessage(level LogLevel, format string, args ...interface{}) string {
	levelName := LogLevelNames[level]
	message := fmt.Sprintf(format, args...)
	return fmt.Sprintf("[%s] %s", levelName, message)
}

// Debug 记录DEBUG级别日志
func (l *Logger) Debug(format string, args ...interface{}) {
	if l.shouldLog(DEBUG) {
		message := l.formatMessage(DEBUG, format, args...)
		log.Print(message)
	}
}

// Info 记录INFO级别日志
func (l *Logger) Info(format string, args ...interface{}) {
	if l.shouldLog(INFO) {
		message := l.formatMessage(INFO, format, args...)
		log.Print(message)
	}
}

// Warn 记录WARN级别日志
func (l *Logger) Warn(format string, args ...interface{}) {
	if l.shouldLog(WARN) {
		message := l.formatMessage(WARN, format, args...)
		log.Print(message)
	}
}

// Error 记录ERROR级别日志
func (l *Logger) Error(format string, args ...interface{}) {
	if l.shouldLog(ERROR) {
		message := l.formatMessage(ERROR, format, args...)
		log.Print(message)
	}
}

// SetLevel 设置日志级别
func (l *Logger) SetLevel(level LogLevel) {
	l.level = level
}

// GetLevel 获取当前日志级别
func (l *Logger) GetLevel() LogLevel {
	return l.level
}