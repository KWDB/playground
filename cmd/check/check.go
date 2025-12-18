package check

import (
	"embed"
	"fmt"
	"io"
	"log"
	"os"

	"github.com/spf13/cobra"

	envcheck "kwdb-playground/internal/check"
	"kwdb-playground/internal/config"
)

// NewCommand 创建 check 子命令：
// - Docker 环境检查
// - 端口占用检查
// - 课程加载与完整性检查
// - 服务健康检查（端口未监听不判失败）
func NewCommand(staticFiles embed.FS) *cobra.Command {
	// 不在命令构造阶段加载配置，避免在执行 help/-h 时触发配置加载
	// 通过 Flags 接收用户输入，实际运行时再加载配置并合并覆盖
	var (
		host       string
		port       int
		coursesDir string
		useEmbed   bool
	)

	cmd := &cobra.Command{
		Use:   "check",
		Short: "检查本地开发环境",
		Long: `全面检查本地开发环境：
1) Docker 环境是否可用
2) 镜像源可用性(Docker Hub/ghcr.io/Aliyun ACR)
3) 指定端口是否被占用
4) 课程资源加载与数据完整性
5) Playground 服务运行与健康状态`,
		RunE: func(cmd *cobra.Command, args []string) error {
			// 静默模式：禁用标准库日志输出，避免内部模块在检查期间输出日志
			// 注意：仅影响该命令的执行周期，结束后通过 defer 恢复，避免影响其他命令
			log.SetOutput(io.Discard)
			defer log.SetOutput(os.Stderr)

			// 仅在实际运行时加载配置，避免 help/-h 加载配置
			cfg := config.Load()

			// 计算有效参数：优先使用用户通过 Flags 设置的值；否则回退到配置
			effectiveHost := cfg.Server.Host
			if cmd.Flags().Changed("host") && host != "" {
				effectiveHost = host
			}
			effectivePort := cfg.Server.Port
			if cmd.Flags().Changed("port") && port != 0 {
				effectivePort = port
			}
			effectiveCoursesDir := cfg.Course.Dir
			if cmd.Flags().Changed("courses-dir") && coursesDir != "" {
				effectiveCoursesDir = coursesDir
			}
			effectiveUseEmbed := cfg.Course.UseEmbed
			if cmd.Flags().Changed("courses-use-embed") {
				effectiveUseEmbed = useEmbed
			}

			// 组装生效配置并调用共享检查逻辑
			eff := cfg
			eff.Server.Host = effectiveHost
			eff.Server.Port = effectivePort
			eff.Course.Dir = effectiveCoursesDir
			eff.Course.UseEmbed = effectiveUseEmbed

			summary := envcheck.RunFromConfig(staticFiles, eff)
			fmt.Println(envcheck.RenderSummaryCLI(summary))

			if !summary.OK {
				return fmt.Errorf("环境检查存在失败项，请根据提示修复后重试")
			}
			return nil
		},
	}

	// Flags（仅在用户显式设置时覆盖配置）
	cmd.Flags().StringVar(&host, "host", "", "指定服务主机（默认从环境变量/配置读取）")
	cmd.Flags().IntVar(&port, "port", 0, "指定服务端口（默认从环境变量/配置读取）")
	cmd.Flags().StringVar(&coursesDir, "courses-dir", "", "课程目录（未设置时从配置读取）")
	cmd.Flags().BoolVar(&useEmbed, "courses-use-embed", false, "是否使用嵌入课程资源进行检查（未设置时从配置读取）")

	return cmd
}

// 检查逻辑与渲染统一由 internal/check 提供，CLI 仅负责参数与调用
