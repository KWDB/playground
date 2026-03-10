package doctor

import (
	"embed"
	"fmt"
	"io"
	"log"
	"os"
	"strings"

	"github.com/spf13/cobra"

	envcheck "kwdb-playground/internal/check"
	"kwdb-playground/internal/config"
)

func NewCommand(staticFiles embed.FS) *cobra.Command {
	var (
		host       string
		port       int
		coursesDir string
		useEmbed   bool
		fix        bool
		dryRun     bool
		fixScope   string
	)

	cmd := &cobra.Command{
		Use:   "doctor",
		Short: "诊断并修复本地开发环境",
		Long: `全面诊断本地开发环境：
1) Docker 环境与镜像源可用性
2) 指定端口占用状态
3) 课程资源加载与完整性
4) 进度文件（data/progress.json）健康状态
5) 进程文件（tmp/kwdb-playground.pid）健康状态
6) 程序可执行文件位置
7) Playground 服务运行与健康状态

使用 --fix 可自动修复可修复项。`,
		RunE: func(cmd *cobra.Command, args []string) error {
			log.SetOutput(io.Discard)
			defer log.SetOutput(os.Stderr)

			cfg, err := config.Load()
			if err != nil {
				return fmt.Errorf("加载配置失败: %w", err)
			}

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

			eff := cfg
			eff.Server.Host = effectiveHost
			eff.Server.Port = effectivePort
			eff.Course.Dir = effectiveCoursesDir
			eff.Course.UseEmbed = effectiveUseEmbed

			summary := envcheck.RunFromConfig(staticFiles, eff)
			showPreFixReport := !(fix && !dryRun)
			if showPreFixReport {
				fmt.Println(envcheck.RenderSummaryCLI(summary))
			}

			if fix {
				results, fixErr := envcheck.ApplyFixes(staticFiles, eff, summary, envcheck.FixOptions{
					DryRun:   dryRun,
					FixScope: fixScope,
				})
				if fixErr != nil {
					return fixErr
				}
				if len(results) > 0 {
					fmt.Println()
					fmt.Println(envcheck.RenderFixResults(results))
				}
				if !dryRun {
					summary = envcheck.RunFromConfig(staticFiles, eff)
					fmt.Println("修复后诊断：")
					fmt.Println(envcheck.RenderSummaryCLI(summary))
				}
			}

			if !summary.OK {
				for _, item := range summary.Items {
					if item.Name == envcheck.ItemNameDockerEnv && strings.Contains(item.Message, "Docker API 版本过低") {
						return fmt.Errorf("环境检查存在失败项：%s；请升级 Docker 后重试", item.Message)
					}
				}
				return fmt.Errorf("环境检查存在失败项，请根据提示修复后重试")
			}
			return nil
		},
	}

	cmd.Flags().StringVar(&host, "host", "", "指定服务主机（默认从环境变量/配置读取）")
	cmd.Flags().IntVar(&port, "port", 0, "指定服务端口（默认从环境变量/配置读取）")
	cmd.Flags().StringVar(&coursesDir, "courses-dir", "", "课程目录（未设置时从配置读取）")
	cmd.Flags().BoolVar(&useEmbed, "courses-use-embed", false, "是否使用嵌入课程资源进行检查（未设置时从配置读取）")
	cmd.Flags().BoolVar(&fix, "fix", false, "自动修复可修复项")
	cmd.Flags().BoolVar(&dryRun, "dry-run", false, "仅显示将执行的修复动作，不实际执行")
	cmd.Flags().StringVar(&fixScope, "fix-scope", "all", "修复范围：docker|image-sources|port|courses|progress|process-file|executable|service|all")

	return cmd
}
