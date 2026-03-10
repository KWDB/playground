package check

import (
	"embed"

	"github.com/spf13/cobra"

	"kwdb-playground/cmd/doctor"
)

func NewCommand(staticFiles embed.FS) *cobra.Command {
	cmd := doctor.NewCommand(staticFiles)
	cmd.Use = "check"
	cmd.Hidden = true
	cmd.Deprecated = "请使用 doctor 命令替代 check"
	return cmd
}
