package sql

import (
    "context"
    "fmt"
    "time"

    "kwdb-playground/internal/course"
    "kwdb-playground/internal/docker"

    "github.com/jackc/pgx/v5/pgxpool"
)

// Driver 管理KWDB的连接与就绪
type Driver struct {
    pool *pgxpool.Pool
}

// EnsureReady 确保容器与数据库就绪，并初始化连接池
// 参数：
// - course: 课程配置（包含 backend.port 等）
// - dc: Docker 控制器，用于启动/复用容器
func (d *Driver) EnsureReady(ctx context.Context, course *course.Course, dc docker.Controller) error {
    if course == nil {
        return fmt.Errorf("course is nil")
    }
    port := course.Backend.Port
    if port <= 0 {
        return fmt.Errorf("invalid backend.port: %d", port)
    }

    // 说明：为了避免阻塞接口（导致前端长时间显示“正在加载连接信息...”），
    // 这里改为短时快速探测策略：在 1 秒内尝试最多 3 次连接，失败立即返回，让前端显示未连接状态。

    attempts := 3               // 最多尝试次数
    interval := 300 * time.Millisecond // 每次尝试间隔
    deadline := time.Now().Add(1 * time.Second)

    dsn := fmt.Sprintf("postgresql://root@localhost:%d/defaultdb?sslmode=disable", port)
    cfg, err := pgxpool.ParseConfig(dsn)
    if err != nil {
        return fmt.Errorf("parse dsn failed: %w", err)
    }
    cfg.MaxConns = 4

    for i := 0; i < attempts && time.Now().Before(deadline); i++ {
        // 为每次尝试设置一个短超时，避免阻塞
        attemptCtx, cancel := context.WithTimeout(ctx, 500*time.Millisecond)
        pool, err := pgxpool.NewWithConfig(attemptCtx, cfg)
        if err == nil {
            var one int
            // SELECT 1 进行连通性验证（短超时）
            err = pool.QueryRow(attemptCtx, "SELECT 1").Scan(&one)
            if err == nil && one == 1 {
                d.pool = pool
                cancel()
                return nil
            }
            pool.Close()
        }
        cancel()
        time.Sleep(interval)
    }

    return fmt.Errorf("KWDB not ready on port %d (quick probe failed)", port)
}

// Pool 返回连接池
func (d *Driver) Pool() *pgxpool.Pool { return d.pool }