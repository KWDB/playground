package main

import (
	"embed"
	"fmt"
	"os"

	"github.com/spf13/cobra"

	checkcmd "kwdb-playground/cmd/check"
	servercmd "kwdb-playground/cmd/server"
)

//go:embed dist courses
var staticFiles embed.FS

// 版本信息通过 -ldflags 注入
var (
	Version   = "dev"
	BuildTime = ""
	GitCommit = ""
)

func newRootCmd() *cobra.Command {
	root := &cobra.Command{
		Use:           "kwdb-playground",
		Short:         "KWDB Playground",
		Long:          "KWDB Playground",
		SilenceUsage:  true,
		SilenceErrors: false,
		Version:       fmt.Sprintf("%s (build: %s, commit: %s)", Version, BuildTime, GitCommit),
	}

	// version 子命令
	versionCmd := &cobra.Command{
		Use:   "version",
		Short: "显示版本信息",
		Run: func(cmd *cobra.Command, args []string) {
			fmt.Printf("版本: %s  构建时间: %s  提交: %s\n", Version, BuildTime, GitCommit)
		},
	}
	root.AddCommand(versionCmd)

	root.AddCommand(servercmd.NewCommand(staticFiles))

	root.AddCommand(checkcmd.NewCommand(staticFiles))

	return root
}

func main() {
	if err := newRootCmd().Execute(); err != nil {
		fmt.Fprintln(os.Stderr, err)
		os.Exit(1)
	}
}
