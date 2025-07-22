#!/bin/bash

# Test script to reproduce terraform init failures

echo "Testing Scenario 1: Invalid syntax"
cat > main.tf << 'EOF'
resource "aws_instance" "example" {
  ami = "ami-12345"
  instance_type = 
}
EOF

echo "Running your tool with verbose..."
./your-tool lock --verbose
echo "---"

echo "Testing Scenario 2: Missing provider source"
cat > main.tf << 'EOF'
terraform {
  required_providers {
    nonexistent = {
      version = "~> 1.0"
    }
  }
}

resource "nonexistent_resource" "test" {
  name = "test"
}
EOF

echo "Running your tool with verbose..."
./your-tool lock --verbose
echo "---"

echo "Testing Scenario 3: Invalid provider registry"
cat > main.tf << 'EOF'
terraform {
  required_providers {
    aws = {
      source  = "invalid-registry.com/aws"
      version = "~> 4.0"
    }
  }
}

resource "aws_instance" "test" {
  ami           = "ami-12345"
  instance_type = "t2.micro"
}
EOF

echo "Running your tool with verbose..."
./your-tool lock --verbose
echo "---"

echo "Cleaning up..."
rm -rf .terraform*
echo "> main.tf"  # Empty the file
