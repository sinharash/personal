func RunTerraformInit(verbose bool) error {
	if !InTerraformDir() {
		return errors.New("current directory contains no terraform files")
	}

	core.WarnMsg("Running terraform init...")

	// Always capture stderr for better error messages, even when not verbose
	var stderrBuf bytes.Buffer

	// prefer 'tofu init'
	tofuCmd := exec.Command("tofu", "init")
	tofuCmd.Stderr = &stderrBuf
	
	if verbose {
		// In verbose mode, also show output in real-time
		tofuCmd.Stdout = os.Stdout
		tofuCmd.Stderr = io.MultiWriter(os.Stderr, &stderrBuf)
		core.StdMsg("Running command: " + tofuCmd.String())
		
		// Add some context
		if cwd, err := os.Getwd(); err == nil {
			core.StdMsg("Working directory: " + cwd)
		}
	}
	
	err := tofuCmd.Run()
	if err == nil {
		core.OkayMsg("Tofu init complete.")
		return nil
	}

	// if tofu init fails, try terraform init
	core.WarnMsg("Tofu failed, trying terraform...")
	
	stderrBuf.Reset() // Clear buffer for terraform attempt
	terraformCmd := exec.Command("terraform", "init")
	terraformCmd.Stderr = &stderrBuf
	
	if verbose {
		terraformCmd.Stdout = os.Stdout
		terraformCmd.Stderr = io.MultiWriter(os.Stderr, &stderrBuf)
		core.StdMsg("Running command: " + terraformCmd.String())
	}
	
	err = terraformCmd.Run()
	if err != nil {
		// Include stderr in error message for better debugging
		stderrOutput := strings.TrimSpace(stderrBuf.String())
		if stderrOutput != "" {
			return fmt.Errorf("terraform init failed: %w\nDetails: %s", err, stderrOutput)
		}
		
		return fmt.Errorf("terraform init failed: %w\nTip: Run with --verbose flag for more details", err)
	}

	core.OkayMsg("Terraform init complete.")
	return nil
}

// creating scenarios where it can fail 

# Common scenarios that cause "terraform init failed: exit status 1"

# 1. Invalid terraform syntax
echo 'invalid terraform syntax' > main.tf
terraform init  # Will fail

# 2. Missing provider source
cat > main.tf << EOF
terraform {
  required_providers {
    nonexistent = {
      version = "~> 1.0"
      # Missing source
    }
  }
}
EOF

# 3. Network/connectivity issues (simulate with invalid registry)
cat > main.tf << EOF
terraform {
  required_providers {
    aws = {
      source = "invalid-registry.com/aws"
      version = "~> 4.0"
    }
  }
}
EOF

# 4. Permission issues
sudo chown root:root .terraform/ 2>/dev/null || true
terraform init  # May fail due to permissions

# 5. Corrupted .terraform directory
mkdir -p .terraform
echo "corrupted" > .terraform/terraform.tfstate
terraform init  # May fail

# 6. Backend configuration issues
cat > main.tf << EOF
terraform {
  backend "s3" {
    bucket = "nonexistent-bucket-12345"
    key    = "terraform.tfstate"
    region = "us-west-2"
  }
}
EOF