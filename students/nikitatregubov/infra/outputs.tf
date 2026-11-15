output "vm_name" {
  description = "Name of the provisioned Compute Engine instance."
  value       = google_compute_instance.app_vm.name
}

output "vm_zone" {
  description = "Zone where the Compute Engine instance runs."
  value       = google_compute_instance.app_vm.zone
}

output "vm_external_ip" {
  description = "Public external IPv4 address of the Compute Engine instance."
  value       = google_compute_address.vm_ip.address
}

output "app_url" {
  description = "Public HTTP URL of the deployed CloudPulse application."
  value       = var.http_port == 80 ? "http://${google_compute_address.vm_ip.address}" : "http://${google_compute_address.vm_ip.address}:${var.http_port}"
}

output "ssh_command" {
  description = "SSH command to connect to the instance."
  value       = "ssh ${var.ssh_user}@${google_compute_address.vm_ip.address}"
}
