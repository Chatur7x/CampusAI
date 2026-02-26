import { Response } from 'express';
import { AuthenticatedRequest } from '../types';
import { prisma } from '../utils/prisma';
import { getBlockchain } from '../utils/blockchain';

// ==================== BLOCKCHAIN EXPLORER ====================
export const getBlockchainStatus = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const blockchain = getBlockchain();
    const chain = blockchain.getChain();

    // Get attendance records with blockchain hashes
    const attendanceRecords = await prisma.attendance.findMany({
      where: { blockchainHash: { not: null } },
      orderBy: { createdAt: 'desc' },
      take: 100,
      include: {
        student: {
          include: {
            user: { include: { profile: true } },
          },
        },
      },
    });

    // Verify chain integrity
    const isValid = blockchain.isChainValid();

    // Calculate statistics
    const totalBlocks = chain.length;
    const verifiedRecords = attendanceRecords.length;
    const tamperedBlocks = chain.filter((block, index) => {
      if (index === 0) return false; // Genesis block
      return !blockchain.verifyBlock(index);
    }).length;

    res.status(200).json({
      success: true,
      data: {
        status: isValid ? 'VALID' : 'TAMPERED',
        totalBlocks,
        verifiedRecords,
        tamperedBlocks,
        chain: chain.slice(-10), // Last 10 blocks
        recentRecords: attendanceRecords.slice(0, 20),
      },
    });
  } catch (error) {
    console.error('Get blockchain status error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const verifyAttendanceRecord = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { attendanceId } = req.params;

    const attendance = await prisma.attendance.findUnique({
      where: { id: attendanceId },
    });

    if (!attendance) {
      res.status(404).json({ success: false, message: 'Attendance record not found' });
      return;
    }

    if (!attendance.blockchainHash) {
      res.status(400).json({ success: false, message: 'Record not blockchain verified' });
      return;
    }

    // Verify the hash
    const blockchain = getBlockchain();
    const chain = blockchain.getChain();

    const matchingBlock = chain.find(block => block.hash === attendance.blockchainHash);

    if (!matchingBlock) {
      res.status(400).json({
        success: false,
        message: 'Record hash not found in blockchain',
        data: {
          verified: false,
          tampered: true,
        },
      });
      return;
    }

    // Verify block integrity
    const blockIndex = chain.indexOf(matchingBlock);
    const isBlockValid = blockchain.verifyBlock(blockIndex);

    res.status(200).json({
      success: true,
      data: {
        verified: true,
        tampered: !isBlockValid,
        block: matchingBlock,
        attendance,
      },
    });
  } catch (error) {
    console.error('Verify attendance record error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getBlockByHash = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { hash } = req.params;

    const blockchain = getBlockchain();
    const chain = blockchain.getChain();

    const block = chain.find(b => b.hash === hash);

    if (!block) {
      res.status(404).json({ success: false, message: 'Block not found' });
      return;
    }

    // Get associated attendance records
    const attendanceRecords = await prisma.attendance.findMany({
      where: { blockchainHash: hash },
      include: {
        student: {
          include: {
            user: { include: { profile: true } },
          },
        },
      },
    });

    res.status(200).json({
      success: true,
      data: {
        block,
        attendanceRecords,
      },
    });
  } catch (error) {
    console.error('Get block by hash error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getBlockchainAudit = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    if (!req.user || (req.user.role !== 'ADMIN' && req.user.role !== 'SUPER_ADMIN')) {
      res.status(403).json({ success: false, message: 'Insufficient permissions' });
      return;
    }

    const blockchain = getBlockchain();
    const chain = blockchain.getChain();

    // Perform full audit
    const auditResults = [];
    let tamperedCount = 0;

    for (let i = 1; i < chain.length; i++) {
      const block = chain[i];
      const isValid = blockchain.verifyBlock(i);

      if (!isValid) {
        tamperedCount++;
        auditResults.push({
          index: i,
          hash: block.hash,
          status: 'TAMPERED',
          timestamp: block.timestamp,
        });
      }
    }

    // Check for missing records in database
    const hashesInChain = chain.map(b => b.hash);
    const recordsInDb = await prisma.attendance.findMany({
      where: { blockchainHash: { in: hashesInChain } },
      select: { blockchainHash: true },
    });
    const hashesInDb = recordsInDb.map(r => r.blockchainHash);

    const orphanedBlocks = hashesInChain.filter(h => !hashesInDb.includes(h) && h !== chain[0].hash);

    res.status(200).json({
      success: true,
      data: {
        totalBlocks: chain.length,
        tamperedCount,
        orphanedBlocks: orphanedBlocks.length,
        auditResults,
        orphanedBlockHashes: orphanedBlocks,
        integrity: tamperedCount === 0 && orphanedBlocks.length === 0 ? 'PASS' : 'FAIL',
      },
    });
  } catch (error) {
    console.error('Blockchain audit error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};

export const getAttendanceChain = async (req: AuthenticatedRequest, res: Response): Promise<void> => {
  try {
    const { studentId } = req.params;

    const attendance = await prisma.attendance.findMany({
      where: {
        studentId,
        blockchainHash: { not: null },
      },
      orderBy: { date: 'asc' },
    });

    // Build the chain of records
    const chain = attendance.map((record, index) => ({
      index,
      date: record.date,
      status: record.status,
      hash: record.blockchainHash,
      previousHash: record.previousHash,
      method: record.method,
    }));

    // Verify chain links
    let isChainValid = true;
    for (let i = 1; i < chain.length; i++) {
      if (chain[i].previousHash !== chain[i - 1].hash) {
        isChainValid = false;
        break;
      }
    }

    res.status(200).json({
      success: true,
      data: {
        studentId,
        totalRecords: attendance.length,
        isChainValid,
        chain,
      },
    });
  } catch (error) {
    console.error('Get attendance chain error:', error);
    res.status(500).json({ success: false, message: 'Internal server error' });
  }
};