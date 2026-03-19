import crypto from 'crypto';
import { Block } from '../types';
import { env } from '../config/env';

class Blockchain {
  private chain: Block[] = [];
  private difficulty: number;

  constructor(difficulty: number = 4) {
    this.difficulty = difficulty;
    this.createGenesisBlock();
  }

  private createGenesisBlock(): void {
    const genesisBlock: Block = {
      index: 0,
      timestamp: Date.now(),
      data: 'Genesis Block',
      previousHash: '0',
      hash: this.calculateHash(0, Date.now(), 'Genesis Block', '0', 0),
      nonce: 0,
    };
    this.chain.push(genesisBlock);
  }

  private calculateHash(
    index: number,
    timestamp: number,
    data: any,
    previousHash: string,
    nonce: number
  ): string {
    return crypto
      .createHash('sha256')
      .update(index + timestamp + JSON.stringify(data) + previousHash + nonce)
      .digest('hex');
  }

  private mineBlock(block: Omit<Block, 'hash'>): Block {
    let nonce = 0;
    let hash = this.calculateHash(block.index, block.timestamp, block.data, block.previousHash, nonce);

    while (hash.substring(0, this.difficulty) !== Array(this.difficulty + 1).join('0')) {
      nonce++;
      hash = this.calculateHash(block.index, block.timestamp, block.data, block.previousHash, nonce);
    }

    return { ...block, hash, nonce };
  }

  addBlock(data: any): Block {
    const previousBlock = this.getLatestBlock();
    const newBlock: Omit<Block, 'hash'> = {
      index: previousBlock.index + 1,
      timestamp: Date.now(),
      data,
      previousHash: previousBlock.hash,
      nonce: 0,
    };

    const minedBlock = this.mineBlock(newBlock);
    this.chain.push(minedBlock);
    return minedBlock;
  }

  getLatestBlock(): Block {
    return this.chain[this.chain.length - 1];
  }

  getChain(): Block[] {
    return this.chain;
  }

  isChainValid(): boolean {
    for (let i = 1; i < this.chain.length; i++) {
      const currentBlock = this.chain[i];
      const previousBlock = this.chain[i - 1];

      // Verify current block hash
      const calculatedHash = this.calculateHash(
        currentBlock.index,
        currentBlock.timestamp,
        currentBlock.data,
        currentBlock.previousHash,
        currentBlock.nonce
      );

      if (currentBlock.hash !== calculatedHash) {
        return false;
      }

      // Verify link to previous block
      if (currentBlock.previousHash !== previousBlock.hash) {
        return false;
      }

      // Verify proof of work
      if (currentBlock.hash.substring(0, this.difficulty) !== Array(this.difficulty + 1).join('0')) {
        return false;
      }
    }
    return true;
  }

  verifyBlock(index: number): boolean {
    if (index < 0 || index >= this.chain.length) {
      return false;
    }

    const block = this.chain[index];
    const calculatedHash = this.calculateHash(
      block.index,
      block.timestamp,
      block.data,
      block.previousHash,
      block.nonce
    );

    return block.hash === calculatedHash;
  }

  getBlockByIndex(index: number): Block | null {
    return this.chain[index] || null;
  }

  getBlockCount(): number {
    return this.chain.length;
  }

  // Generate hash for attendance record without adding to chain
  generateAttendanceHash(attendanceData: any): string {
    const previousBlock = this.getLatestBlock();
    const data = {
      ...attendanceData,
      timestamp: Date.now(),
    };
    
    return crypto
      .createHash('sha256')
      .update(JSON.stringify(data) + previousBlock.hash)
      .digest('hex');
  }
}

// Singleton instance
let blockchainInstance: Blockchain | null = null;

export const getBlockchain = (): Blockchain => {
  if (!blockchainInstance) {
    blockchainInstance = new Blockchain(env.blockchainDifficulty);
  }
  return blockchainInstance;
};

export const resetBlockchain = (): void => {
  blockchainInstance = null;
};

// ── Persistence helpers (blockchain_hashes table) ──────────
import prisma from './prisma';

/**
 * Persist a new block to the blockchain_hashes table.
 * Call this after addBlock() to ensure durability across restarts.
 */
export async function persistBlock(block: Block): Promise<void> {
  try {
    await prisma.blockchainHash.create({
      data: {
        block_index: block.index,
        hash: block.hash,
        previous_hash: block.previousHash,
        data: JSON.stringify(block.data),
        nonce: block.nonce,
        timestamp: new Date(block.timestamp),
      },
    });
  } catch (err) {
    console.error('[Blockchain] Failed to persist block:', err);
  }
}

/**
 * Load persisted chain from DB on startup.
 */
export async function loadChainFromDB(): Promise<void> {
  try {
    const rows = await prisma.blockchainHash.findMany({ orderBy: { block_index: 'asc' } });
    if (rows.length === 0) return;
    const chain = getBlockchain();
    for (const row of rows) {
      if (row.block_index === 0) continue;
      const restored: Block = {
        index: row.block_index,
        hash: row.hash,
        previousHash: row.previous_hash,
        data: JSON.parse(row.data as string),
        nonce: row.nonce,
        timestamp: row.timestamp.getTime(),
      };
      chain.getChain().push(restored);
    }
    console.log(`[Blockchain] Loaded ${rows.length} blocks from DB`);
  } catch (err) {
    console.error('[Blockchain] DB load failed, starting fresh:', err);
  }
}

export default Blockchain;