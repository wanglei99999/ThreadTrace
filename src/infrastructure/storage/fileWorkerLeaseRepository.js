'use strict';

const fs = require('fs/promises');
const path = require('path');
const { assertWorkerLeaseRepository } = require('../../application/ports/workerLeaseRepository');
const {
  createWorkerLease,
  renewWorkerLease: buildRenewedWorkerLease,
  isWorkerLeaseExpired
} = require('../../domain/models/workerLease');

function createFileWorkerLeaseRepository(options) {
  const baseDir = path.resolve((options && options.baseDir) || path.join(process.cwd(), 'data', 'store', 'worker-leases'));

  const repository = {
    async acquireWorkerLease(request) {
      const safeRequest = request || {};
      const lease = createWorkerLease({
        leaseKey: safeRequest.leaseKey,
        workerType: safeRequest.workerType,
        ownerId: safeRequest.ownerId,
        ttlMs: safeRequest.ttlMs,
        now: safeRequest.now
      });
      const filePath = workerLeasePath(baseDir, safeRequest.leaseKey);
      await fs.mkdir(path.dirname(filePath), { recursive: true });

      try {
        await fs.writeFile(filePath, JSON.stringify(lease, null, 2) + '\n', { encoding: 'utf8', flag: 'wx' });
        return { acquired: true, lease };
      } catch (error) {
        if (!error || error.code !== 'EEXIST') throw error;
      }

      const existing = await readLeaseFile(filePath);
      if (!existing || existing.ownerId === safeRequest.ownerId || isWorkerLeaseExpired(existing, safeRequest.now || lease.updatedAt)) {
        const updated = Object.assign({}, lease, {
          acquiredAt: existing && existing.ownerId === safeRequest.ownerId ? existing.acquiredAt : lease.acquiredAt
        });
        await fs.writeFile(filePath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
        return { acquired: true, lease: updated };
      }

      return { acquired: false, lease: existing };
    },

    async renewWorkerLease(request) {
      const safeRequest = request || {};
      const filePath = workerLeasePath(baseDir, safeRequest.leaseKey);
      const existing = await readLeaseFile(filePath);
      if (!existing || existing.ownerId !== safeRequest.ownerId) {
        return { renewed: false, lease: existing };
      }
      const updated = buildRenewedWorkerLease(existing, {
        ttlMs: safeRequest.ttlMs,
        now: safeRequest.now
      });
      await fs.writeFile(filePath, JSON.stringify(updated, null, 2) + '\n', 'utf8');
      return { renewed: true, lease: updated };
    },

    async releaseWorkerLease(request) {
      const safeRequest = request || {};
      const filePath = workerLeasePath(baseDir, safeRequest.leaseKey);
      const existing = await readLeaseFile(filePath);
      if (!existing || existing.ownerId !== safeRequest.ownerId) {
        return { released: false };
      }
      await fs.unlink(filePath).catch(function (error) {
        if (!error || error.code !== 'ENOENT') throw error;
      });
      return { released: true };
    },

    async listWorkerLeases(query) {
      const safeQuery = query || {};
      const files = await listWorkerLeaseFiles(baseDir);
      const leases = [];

      for (const filePath of files) {
        const lease = await readLeaseFile(filePath);
        if (!lease) continue;
        if (safeQuery.workerType && lease.workerType !== safeQuery.workerType) continue;
        if (safeQuery.ownerId && lease.ownerId !== safeQuery.ownerId) continue;
        leases.push(lease);
      }

      return leases
        .sort(function (a, b) {
          return String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''));
        })
        .slice(0, safeQuery.limit || leases.length);
    }
  };

  return assertWorkerLeaseRepository(repository);
}

function workerLeasePath(baseDir, leaseKey) {
  return path.join(baseDir, safeSegment(leaseKey) + '.json');
}

function safeSegment(value) {
  return String(value || 'unknown').replace(/[^a-zA-Z0-9_.-]/g, '_');
}

async function readLeaseFile(filePath) {
  try {
    const text = await fs.readFile(filePath, 'utf8');
    return JSON.parse(text);
  } catch (error) {
    if (error && error.code === 'ENOENT') return undefined;
    throw error;
  }
}

async function listWorkerLeaseFiles(baseDir) {
  try {
    const entries = await fs.readdir(baseDir, { withFileTypes: true });
    return entries
      .filter(function (entry) {
        return entry.isFile() && /\.json$/i.test(entry.name);
      })
      .map(function (entry) {
        return path.join(baseDir, entry.name);
      });
  } catch (error) {
    if (error && error.code === 'ENOENT') return [];
    throw error;
  }
}

module.exports = {
  createFileWorkerLeaseRepository
};
