package lock

import (
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"github.com/spf13/cobra"
	"your-module/cmd/terraform"
	"your-module/core"
)

type Flags struct {
	reset bool
}

func Cmd() *cobra.Command {
	flags := &Flags{}
	cmd := &cobra.Command{
		Use:   "lock",
		Short: "Generates the .terraform.lock.hcl file for Terraform",
		Long:  "Generates the providers lock file for Terraform 0.14+ or OpenTofu",
		Run: func(cmd *cobra.Command, _ []string) {
			execute(cmd, flags)
		},
	}

	cmd.Flags().BoolVarP(&flags.reset, "reset", "r", false, "removes generated terraform files")

	return cmd
}

func execute(cmd *cobra.Command, flags *Flags) {
	if !terraform.IsLockFileSupported() {
		core.ErrorMsg("Terraform lock file generation requires Terraform 0.14+ or OpenTofu")
		return
	}

	// Get the tool that user intended to use, splitting terraform/tofu
	tool := getTerraformTool()
	core.StdMsg("Using " + tool + " (detected from command " + getBinaryName() + ")")

	if flags.reset {
		core.WarnMsg("Cleaning existing generated terraform files...")
		terraform.CleanTerraform()
	}

	core.WarnMsg("Removing existing lock file...")
	// Remove existing lock file first to prevent checksum conflicts
	err := removeLockFile()
	if err != nil {
		core.StdMsg("Could not remove existing lock file: " + err.Error())
	}

	// Step 1. Initial init with -backend=false to avoid backend initialization
	err = terraform.RunInitWithTool(tool)
	core.ExitIfError(err)

	// Step2 Generate multi-platform lock file
	core.WarnMsg("Generating new lock file for multiple platforms...")
	
	err = terraform.GenerateIacLockWithTool(tool)
	core.ExitIfError(err)

	// Step 3 run init again to ensure everything is properly initialized with new lock file
	core.WarnMsg("Finalizing initialization with new lock file...")
	err = terraform.RunInitWithTool(tool)
	core.ExitIfError(err)

	core.OkayMsg("Successfully created terraform lock file.")
}

// Helper function to check if command exists
func isCommandAvailable(name string) bool {
	cmd := exec.Command(name, "version")
	err := cmd.Run()
	return err == nil
}

// getBinaryName gets the name of the binary that was executed
func getBinaryName() string {
	if len(os.Args) > 0 {
		binaryPath := os.Args[0]
		return filepath.Base(binaryPath)
	}
	return "unknown"
}

// getTerraformTool detects which tool to use based on binary name
func getTerraformTool() string {
	binaryName := getBinaryName()

	// Check if binary name starts with "tofu" or "terraform"
	if strings.HasPrefix(binaryName, "tofu") {
		return "tofu"
	} else if strings.HasPrefix(binaryName, "terraform") {
		return "terraform"
	}

	// Default fallback - check which is available but don't mix
	if isCommandAvailable("tofu") {
		return "tofu"
	} else if isCommandAvailable("terraform") {
		return "terraform"
	}

	// Final fallback if nothing available
	core.ErrorMsg("Neither 'tofu' nor 'terraform' command is available. Please install one of them.")
	os.Exit(1)
	return ""
}

func removeLockFile() error {
	lockFile := ".terraform.lock.hcl"

	// Check if the lock file exists
	_, err := os.Stat(lockFile)
	if os.IsNotExist(err) {
		// If the file does not exist (this is not the error), return nil
		return nil
	}

	// If the file exists, remove it
	err = os.Remove(lockFile)
	if err != nil {
		return fmt.Errorf("failed to remove %s: %w", lockFile, err)
	}

	core.StdMsg("Removed existing lock file: " + lockFile)
	return nil
}

>>>>>>>>>>
terraform

package terraform

import (
	"errors"
	"fmt"
	"log/slog"
	"os"
	"os/exec"
	"path/filepath"
	"strings"

	"your-module/core"
)

// IsLockFileSupported checks if terraform/tofu supports lock files
func IsLockFileSupported() bool {
	// check if tofu exists, if no error, return true (tofu supports lock files)
	cmd := exec.Command("tofu", "--version")
	_, err := cmd.Output()
	if err == nil {
		return true
	}

	// check if terraform exists, if it does, ensure it's version 0.14+
	cmd = exec.Command("terraform", "--version")
	output, err := cmd.Output()
	if err != nil {
		return false
	}

	versionString := strings.Fields(string(output))[1]
	ver := strings.TrimPrefix(versionString, "v")

	return !isVersionLessThan(ver, "0.14.0")
}

// CleanTerraform removes existing terraform files using Go's cross-platform functions
func CleanTerraform() {
	core.WarnMsg("Removing existing .terraform*")

	// Use Go's built-in functions for cross-platform compatibility
	patterns := []string{".terraform", ".terraform.lock.hcl.bak"}

	for _, pattern := range patterns {
		matches, err := filepath.Glob(pattern + "*")
		if err != nil {
			continue
		}

		for _, match := range matches {
			if err := os.RemoveAll(match); err != nil {
				slog.Debug("could not remove terraform file", "file", match, "error", err)
			}
		}
	}
}

// runs init for the specified tool (terraform or tofu)
func RunInitWithTool(tool string) error {
	if !InTerraformDir() {
		return errors.New("current directory contains no terraform files")
	}

	core.WarnMsg("Running " + tool + " init...")

	// Disable backend for init, focused on providers
	cmd := exec.Command(tool, "init", "-backend=false")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("%s init failed: %w", tool, err)
	}

	core.OkayMsg(fmt.Sprintf("%s init complete.", strings.Title(tool)))
	return nil
}

func InTerraformDir() bool {
	matched, err := filepath.Glob("*.tf")
	if (matched == nil) || (err != nil) {
		return false
	}

	return true
}

// generateIacLockWithTool runs the 'providers lock' command to generate the .terraform.lock.hcl file
// using the specified tool (either terraform or tofu).
func GenerateIacLockWithTool(tool string) error {
	cmd := exec.Command(tool, "providers", "lock", "-platform=linux_amd64", "-platform=darwin_amd64", "-platform=windows_amd64")
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	err := cmd.Run()
	if err != nil {
		return fmt.Errorf("unable to generate lock file with %s: %w", tool, err)
	}

	return nil
}

// isVersionLessThan compares version strings (simple implementation)
func isVersionLessThan(version1, version2 string) bool {
	v1 := strings.Split(version1, ".")
	v2 := strings.Split(version2, ".")

	for i := 0; i < len(v1) && i < len(v2); i++ {
		if v1[i] < v2[i] {
			return true
		} else if v1[i] > v2[i] {
			return false
		}
	}

	return len(v1) < len(v2)
}