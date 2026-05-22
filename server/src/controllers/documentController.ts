import { Response } from 'express';
import fs from 'fs';
import path from 'path';
import Document from '../models/Document';
import { AuthRequest } from '../middleware/authMiddleware';

// Utility helper to format bytes to human readable size
const formatBytes = (bytes: number, decimals = 1) => {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
};

export const uploadDocument = async (req: AuthRequest, res: Response) => {
  try {
    const ownerId = req.user?.id;
    if (!ownerId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const { originalname, mimetype, size, filename } = req.file;

    // Map mimetype to custom document types
    let docType = 'Document';
    if (mimetype === 'application/pdf') {
      docType = 'PDF';
    } else if (
      mimetype === 'application/vnd.ms-excel' ||
      mimetype === 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    ) {
      docType = 'Spreadsheet';
    } else if (
      mimetype === 'application/msword' ||
      mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ) {
      docType = 'Document';
    } else if (mimetype.startsWith('image/')) {
      docType = 'Image';
    }

    const docUrl = `/uploads/${filename}`;

    const document = new Document({
      name: originalname,
      type: docType,
      size: formatBytes(size),
      url: docUrl,
      ownerId,
      shared: false,
      status: 'uploaded'
    });

    await document.save();
    return res.status(201).json(document);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

export const getDocuments = async (req: AuthRequest, res: Response) => {
  try {
    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    // Retrieve documents owned by this user or shared (all public documents or shared with user)
    const documents = await Document.find({
      $or: [
        { ownerId: userId },
        { shared: true }
      ]
    })
      .populate('ownerId', 'name email avatarUrl role')
      .populate('signedById', 'name email avatarUrl role')
      .sort({ updatedAt: -1 });

    return res.status(200).json(documents);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

export const shareDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { shared } = req.body;

    if (shared === undefined) {
      return res.status(400).json({ error: 'shared boolean is required' });
    }

    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.ownerId.toString() !== userId) {
      return res.status(403).json({ error: 'Only the owner can share the document' });
    }

    document.shared = shared;
    await document.save();

    return res.status(200).json(document);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

export const signDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;
    const { signatureImage } = req.body; // Expect base64 canvas drawing data URL

    if (!signatureImage) {
      return res.status(400).json({ error: 'Signature drawing data is required' });
    }

    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    // Must be owner or the document must be shared to be signed
    if (document.ownerId.toString() !== userId && !document.shared) {
      return res.status(403).json({ error: 'Access denied: cannot sign this document' });
    }

    document.status = 'signed';
    document.signatureImage = signatureImage;
    document.signedById = userId;
    document.signedAt = new Date();
    await document.save();

    return res.status(200).json(document);
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};

export const deleteDocument = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    const document = await Document.findById(id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }

    if (document.ownerId.toString() !== userId) {
      return res.status(403).json({ error: 'Only the owner can delete the document' });
    }

    // Try deleting file from local disk storage
    const filename = path.basename(document.url);
    const filePath = path.join(__dirname, '../../uploads', filename);
    
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    await Document.findByIdAndDelete(id);
    return res.status(200).json({ message: 'Document deleted successfully' });
  } catch (error) {
    return res.status(500).json({ error: (error as Error).message });
  }
};
