import crypto from 'node:crypto';

const ALLOWED_SEVERITIES = new Set(['low', 'medium', 'high', 'critical']);
const ALLOWED_STATUSES = new Set(['pending', 'verified']);

const DEFAULT_CHECKS = [
  {
    id: 'chk-docker-nonroot',
    title: 'Docker image runs under non-root node user',
    service: 'container-runtime',
    severity: 'high',
    status: 'verified',
    createdAt: '2026-11-15T09:00:00.000Z',
  },
  {
    id: 'chk-health-probe',
    title: 'HTTP /health and /ready probes return 200 OK',
    service: 'api-gateway',
    severity: 'critical',
    status: 'verified',
    createdAt: '2026-11-15T09:05:00.000Z',
  },
  {
    id: 'chk-tf-remote-state',
    title: 'Terraform remote state synced in Google Cloud Storage',
    service: 'gcp-infra',
    severity: 'medium',
    status: 'pending',
    createdAt: '2026-11-15T09:10:00.000Z',
  },
];

/**
 * In-memory store for deployment verification checks.
 */
export class ChecksStore {
  constructor(initialItems = DEFAULT_CHECKS) {
    this.items = initialItems.map((item) => ({ ...item }));
  }

  /**
   * List checks optionally filtered by status ('pending' or 'verified').
   */
  list(statusFilter) {
    if (statusFilter) {
      const normalized = String(statusFilter).trim().toLowerCase();
      if (!ALLOWED_STATUSES.has(normalized)) {
        const error = new Error(`Invalid status filter "${statusFilter}". Allowed: pending, verified.`);
        error.statusCode = 400;
        throw error;
      }
      return this.items.filter((item) => item.status === normalized);
    }
    return [...this.items];
  }

  /**
   * Create a new deployment check item with validation.
   */
  create({ title, service = 'general', severity = 'medium' }) {
    const cleanTitle = typeof title === 'string' ? title.trim() : '';
    if (cleanTitle.length < 3 || cleanTitle.length > 140) {
      const error = new Error('Field "title" must be a string between 3 and 140 characters.');
      error.statusCode = 400;
      throw error;
    }

    const cleanService = typeof service === 'string' && service.trim() ? service.trim().slice(0, 60) : 'general';
    const cleanSeverity = String(severity).trim().toLowerCase();
    if (!ALLOWED_SEVERITIES.has(cleanSeverity)) {
      const error = new Error('Field "severity" must be one of: low, medium, high, critical.');
      error.statusCode = 400;
      throw error;
    }

    const item = {
      id: `chk-${crypto.randomBytes(4).toString('hex')}`,
      title: cleanTitle,
      service: cleanService,
      severity: cleanSeverity,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };

    this.items.unshift(item);
    return item;
  }

  /**
   * Toggle a check status between 'pending' and 'verified'.
   */
  toggle(id) {
    const item = this.items.find((entry) => entry.id === id);
    if (!item) {
      return null;
    }
    item.status = item.status === 'verified' ? 'pending' : 'verified';
    item.updatedAt = new Date().toISOString();
    return { ...item };
  }

  /**
   * Remove a check by ID.
   */
  remove(id) {
    const index = this.items.findIndex((entry) => entry.id === id);
    if (index === -1) {
      return false;
    }
    this.items.splice(index, 1);
    return true;
  }
}
