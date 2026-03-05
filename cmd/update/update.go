package update

import (
	"context"
	"errors"
	"fmt"
	"os"
	"time"

	"github.com/spf13/cobra"

	"kwdb-playground/internal/config"
	"kwdb-playground/internal/upgrade"
)

var (
	prepareUpgradePlan = upgrade.Prepare
	performBrewUpgrade = upgrade.PerformBrewUpgrade
	performUpgrade     = upgrade.PerformUpgrade
)

func NewCommand() *cobra.Command {
	cmd := &cobra.Command{
		Use:   "update",
		Short: "升级 KWDB Playground",
		Long:  "检查并升级当前 KWDB Playground 可执行文件",
		RunE: func(cmd *cobra.Command, args []string) error {
			if upgrade.IsDockerDeploy() {
				return fmt.Errorf("Docker 部署请使用在线升级接口")
			}

			checkCtx, cancelCheck := context.WithTimeout(cmd.Context(), 10*time.Second)
			defer cancelCheck()

			plan, err := prepareUpgradePlan(checkCtx, config.Version)
			if err != nil {
				return err
			}

			switch plan.Mode {
			case upgrade.ModeNoUpdate:
				fmt.Printf("当前已是最新版本 v%s\n", plan.CurrentVersion)
				return nil
			case upgrade.ModeUnsupported, upgrade.ModeDocker:
				return errors.New(plan.Message)
			case upgrade.ModeBrew:
				fmt.Printf("发现新版本 v%s，正在通过 Homebrew 升级...\n", plan.LatestVersion)
				upgradeCtx, cancelUpgrade := context.WithTimeout(context.Background(), 10*time.Minute)
				defer cancelUpgrade()
				if err := performBrewUpgrade(upgradeCtx, nil, os.Environ()); err != nil {
					return fmt.Errorf("Homebrew 升级失败: %w", err)
				}
				fmt.Printf("升级完成，当前版本将于下次启动生效: v%s\n", plan.LatestVersion)
				return nil
			case upgrade.ModeBinary:
				fmt.Printf("发现新版本 v%s，开始下载并替换二进制...\n", plan.LatestVersion)
				upgradeCtx, cancelUpgrade := context.WithTimeout(context.Background(), 5*time.Minute)
				defer cancelUpgrade()
				if err := performUpgrade(upgradeCtx, plan.DownloadURL, plan.ExecutablePath, nil, os.Environ()); err != nil {
					return fmt.Errorf("升级失败: %w", err)
				}
				fmt.Printf("升级完成，请重新执行 kwdb-playground\n")
				return nil
			default:
				return fmt.Errorf("未知升级模式: %s", plan.Mode)
			}
		},
	}

	return cmd
}
