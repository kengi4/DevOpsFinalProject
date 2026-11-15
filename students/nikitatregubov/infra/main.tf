locals {
  web_tag = "${var.app_name}-web"
}

resource "google_compute_network" "vpc" {
  name                    = "${var.app_name}-vpc"
  auto_create_subnetworks = false
  description             = "Dedicated VPC network for ${var.app_name}"
}

resource "google_compute_subnetwork" "subnet" {
  name          = "${var.app_name}-subnet"
  ip_cidr_range = "10.10.0.0/24"
  region        = var.region
  network       = google_compute_network.vpc.id
}

resource "google_compute_firewall" "allow_http" {
  name        = "${var.app_name}-allow-http"
  network     = google_compute_network.vpc.id
  direction   = "INGRESS"
  description = "Allow public HTTP traffic to CloudPulse"

  allow {
    protocol = "tcp"
    ports    = [tostring(var.http_port)]
  }

  source_ranges = ["0.0.0.0/0"]
  target_tags   = [local.web_tag]
}

resource "google_compute_firewall" "allow_ssh" {
  name        = "${var.app_name}-allow-ssh"
  network     = google_compute_network.vpc.id
  direction   = "INGRESS"
  description = "Allow SSH access for CI/CD deployment and administration"

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = var.ssh_source_ranges
  target_tags   = [local.web_tag]
}

resource "google_compute_address" "vm_ip" {
  name         = "${var.app_name}-ip"
  region       = var.region
  address_type = "EXTERNAL"
  description  = "Static external IPv4 address for ${var.app_name} VM"
}

resource "google_compute_instance" "app_vm" {
  name                      = "${var.app_name}-vm"
  machine_type              = var.machine_type
  zone                      = var.zone
  tags                      = [local.web_tag]
  allow_stopping_for_update = true

  boot_disk {
    initialize_params {
      image = "debian-cloud/debian-12"
      size  = var.disk_size_gb
      type  = "pd-standard"
    }
  }

  network_interface {
    subnetwork = google_compute_subnetwork.subnet.id

    access_config {
      nat_ip = google_compute_address.vm_ip.address
    }
  }

  metadata = {
    enable-oslogin = "FALSE"
    ssh-keys       = "${var.ssh_user}:${trimspace(var.ssh_public_key)}"
  }

  metadata_startup_script = templatefile("${path.module}/startup.sh.tftpl", {
    ssh_user = var.ssh_user
  })

  labels = {
    app        = var.app_name
    managed_by = "terraform"
  }
}
