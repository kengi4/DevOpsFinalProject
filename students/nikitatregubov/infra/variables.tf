variable "project_id" {
  type        = string
  description = "Google Cloud Project ID where resources will be provisioned."

  validation {
    condition     = length(trimspace(var.project_id)) > 0
    error_message = "project_id must not be empty."
  }
}

variable "region" {
  type        = string
  default     = "us-central1"
  description = "Google Cloud region (us-central1 qualifies for Always Free e2-micro compute)."
}

variable "zone" {
  type        = string
  default     = "us-central1-a"
  description = "Google Cloud compute zone for the VM instance."
}

variable "app_name" {
  type        = string
  default     = "cloudpulse"
  description = "Name prefix applied to created GCP resources."
}

variable "machine_type" {
  type        = string
  default     = "e2-micro"
  description = "Compute Engine machine type."
}

variable "disk_size_gb" {
  type        = number
  default     = 20
  description = "Boot disk size in GB (up to 30 GB pd-standard is Always Free eligible)."
}

variable "http_port" {
  type        = number
  default     = 80
  description = "Public HTTP port exposed by the Compute Engine firewall."
}

variable "ssh_user" {
  type        = string
  default     = "devops"
  description = "Linux username provisioned for SSH deployment."

  validation {
    condition     = can(regex("^[a-z_][a-z0-9_-]{0,31}$", var.ssh_user))
    error_message = "ssh_user must be a valid POSIX username."
  }
}

variable "ssh_public_key" {
  type        = string
  sensitive   = true
  description = "OpenSSH public key installed on the Compute Engine VM for CI/CD deployments."

  validation {
    condition     = length(trimspace(var.ssh_public_key)) > 0
    error_message = "ssh_public_key must not be empty."
  }
}

variable "ssh_source_ranges" {
  type        = list(string)
  default     = ["0.0.0.0/0"]
  description = "CIDR ranges permitted to connect via SSH (0.0.0.0/0 required for GitHub-hosted runners)."
}
