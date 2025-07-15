variable "name" {
  type = string
  description = "Variable name"
}

variable "environment" {
  type = string
  description = "Variable environment"
}

variable "instance_type" {
  type = string
  description = "Variable instance_type"
}

resource "aws_instance" "main" {
  ami = "ami-0c02fb55956c7d316"
  instance_type = var.instance_type
  tags = {
    Name = var.name
  }
}