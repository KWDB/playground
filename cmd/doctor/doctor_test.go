package doctor

import (
	"embed"
	"testing"
)

func TestNewCommandFlags(t *testing.T) {
	var fs embed.FS
	cmd := NewCommand(fs)
	if cmd.Use != "doctor" {
		t.Fatalf("unexpected use: %s", cmd.Use)
	}
	for _, flagName := range []string{"fix", "dry-run", "fix-scope", "host", "port"} {
		if cmd.Flags().Lookup(flagName) == nil {
			t.Fatalf("missing flag: %s", flagName)
		}
	}
}
