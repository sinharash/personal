# Scenario 1: Invalid syntax (save as main.tf)
# This will cause a parsing error
resource "aws_instance" "example" {
  ami = "ami-12345"
  instance_type = 
  # Missing value - syntax error
}

# Scenario 2: Provider without source (save as main.tf)
terraform {
  required_providers {
    nonexistent = {
      version = "~> 1.0"
      # Missing source - will fail
    }
  }
}

resource "nonexistent_resource" "test" {
  name = "test"
}

# Scenario 3: Invalid provider source (save as main.tf)
terraform {
  required_providers {
    aws = {
      source  = "invalid-registry.com/aws"  # Non-existent registry
      version = "~> 4.0"
    }
  }
}

resource "aws_instance" "test" {
  ami           = "ami-12345"
  instance_type = "t2.micro"
}

# Scenario 4: Backend configuration pointing to non-existent location (save as main.tf)
terraform {
  backend "s3" {
    bucket = "this-bucket-definitely-does-not-exist-12345"
    key    = "terraform.tfstate"
    region = "us-west-2"
  }
}

resource "aws_instance" "test" {
  ami           = "ami-12345"
  instance_type = "t2.micro"
}

# Scenario 5: Version constraint that can't be satisfied (save as main.tf)
terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "= 999.999.999"  # Version that doesn't exist
    }
  }
}

resource "aws_instance" "test" {
  ami           = "ami-12345"
  instance_type = "t2.micro"
}