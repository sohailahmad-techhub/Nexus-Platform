import React, { useState, useEffect, useRef } from 'react';
import { api } from '../../services/api';
import { useAuth } from '../../context/AuthContext';
import { Card, CardHeader, CardBody } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge } from '../../components/ui/Badge';
import { FileText, Upload, Download, Trash2, Share2, PenTool, X, RefreshCw, FileCheck } from 'lucide-react';
import toast from 'react-hot-toast';

interface PopulatedUser {
  id: string;
  name: string;
  role: 'entrepreneur' | 'investor';
  avatarUrl: string;
}

interface DocumentItem {
  id: string;
  name: string;
  type: string;
  size: string;
  url: string;
  shared: boolean;
  status: 'uploaded' | 'signed';
  signatureImage?: string;
  signedById?: PopulatedUser;
  signedAt?: string;
  ownerId: PopulatedUser;
  createdAt: string;
}

const BACKEND_URL = import.meta.env.VITE_API_URL 
  ? import.meta.env.VITE_API_URL.replace('/api', '') 
  : 'http://localhost:5000';

export const DocumentsPage: React.FC = () => {
  const { user } = useAuth();
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const [previewDoc, setPreviewDoc] = useState<DocumentItem | null>(null);

  // Signature Pad State
  const [signingDoc, setSigningDoc] = useState<DocumentItem | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const fetchDocuments = async () => {
    try {
      const res = await api.get('/documents');
      setDocuments(res.data);
    } catch (err: any) {
      toast.error('Failed to load documents');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchDocuments();
  }, []);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0) return;
    const file = e.target.files[0];
    
    const formData = new FormData();
    formData.append('file', file);

    setIsUploading(true);
    try {
      await api.post('/documents/upload', formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });
      toast.success('Document uploaded successfully!');
      fetchDocuments();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to upload document');
    } finally {
      setIsUploading(false);
      // Reset input element
      e.target.value = '';
    }
  };

  const handleDelete = async (docId: string) => {
    if (!window.confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.delete(`/documents/${docId}`);
      toast.success('Document deleted');
      if (previewDoc?.id === docId) setPreviewDoc(null);
      fetchDocuments();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to delete document');
    }
  };

  const handleToggleShare = async (docId: string, currentShared: boolean) => {
    try {
      await api.post(`/documents/share/${docId}`, { shared: !currentShared });
      toast.success(currentShared ? 'Document unshared' : 'Document shared successfully');
      fetchDocuments();
    } catch (err: any) {
      toast.error('Failed to update share preferences');
    }
  };

  // HTML5 Canvas signature pad drawing handlers
  const getCoordinates = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return { x: 0, y: 0 };
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    // Account for styling dimensions vs canvas coordinates
    const scaleX = canvas.width / rect.width;
    const scaleY = canvas.height / rect.height;

    return {
      x: (clientX - rect.left) * scaleX,
      y: (clientY - rect.top) * scaleY
    };
  };

  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#1e3a8a'; // Deep blue signature ink
    ctx.lineWidth = 4;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    const coords = getCoordinates(e);
    ctx.beginPath();
    ctx.moveTo(coords.x, coords.y);
    setIsDrawing(true);
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    if ('touches' in e) {
      e.preventDefault(); // Stop mobile scroll when drawing
    }

    const coords = getCoordinates(e);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
  };

  const submitSignature = async () => {
    const canvas = canvasRef.current;
    if (!canvas || !signingDoc) return;

    // Check if canvas has drawing (isn't blank)
    const blank = document.createElement('canvas');
    blank.width = canvas.width;
    blank.height = canvas.height;
    if (canvas.toDataURL() === blank.toDataURL()) {
      toast.error('Please sign on the pad before submitting');
      return;
    }

    const signatureImage = canvas.toDataURL('image/png');

    try {
      await api.post(`/documents/sign/${signingDoc.id}`, { signatureImage });
      toast.success('Document signed successfully!');
      setSigningDoc(null);
      fetchDocuments();
    } catch (err: any) {
      toast.error(err.response?.data?.error || 'Failed to apply signature');
    }
  };

  const renderFilePreview = (doc: DocumentItem) => {
    const fileUrl = `${BACKEND_URL}${doc.url}`;
    const fileType = doc.name.split('.').pop()?.toLowerCase();

    if (fileType === 'pdf') {
      return (
        <iframe
          src={`${fileUrl}#toolbar=0`}
          className="w-full h-[500px] border border-gray-200 rounded-lg bg-gray-50"
          title={doc.name}
        />
      );
    } else if (['jpg', 'jpeg', 'png', 'gif', 'svg'].includes(fileType || '')) {
      return (
        <div className="flex justify-center border border-gray-200 rounded-lg p-4 bg-gray-50 max-h-[500px] overflow-auto">
          <img src={fileUrl} alt={doc.name} className="max-w-full h-auto object-contain" />
        </div>
      );
    } else {
      return (
        <div className="flex flex-col items-center justify-center p-12 border border-dashed border-gray-300 rounded-lg bg-gray-50 text-center">
          <FileText size={64} className="text-gray-400 mb-4" />
          <h4 className="font-bold text-gray-800 mb-1">{doc.name}</h4>
          <p className="text-sm text-gray-500 mb-4">Preview not supported for {doc.type} files.</p>
          <a
            href={fileUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-medium text-sm rounded-md transition"
          >
            <Download size={16} className="mr-2" /> Download & View Locally
          </a>
        </div>
      );
    }
  };

  const totalUsedBytes = documents.reduce((acc, curr) => {
    // Basic parser for sizes like "2.4 MB" or "100 KB"
    const sizeStr = curr.size;
    const parts = sizeStr.split(' ');
    if (parts.length === 2) {
      const num = parseFloat(parts[0]);
      const unit = parts[1].toUpperCase();
      let scale = 1;
      if (unit === 'KB') scale = 1024;
      else if (unit === 'MB') scale = 1024 * 1024;
      else if (unit === 'GB') scale = 1024 * 1024 * 1024;
      return acc + (num * scale);
    }
    return acc;
  }, 0);

  const totalUsedFormatted = (totalUsedBytes / (1024 * 1024)).toFixed(1) + ' MB';
  const percentageUsed = Math.min((totalUsedBytes / (500 * 1024 * 1024)) * 100, 100); // Out of 500MB free quota

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 font-display">Document Chamber</h1>
          <p className="text-gray-600">Secure document processing, sharing, and e-signatures</p>
        </div>
        
        <label className="inline-flex items-center px-4 py-2 bg-primary-600 hover:bg-primary-700 text-white font-semibold text-sm rounded-md transition duration-200 cursor-pointer shadow-sm hover:shadow-md">
          <Upload size={18} className="mr-2" />
          Upload Document
          <input
            type="file"
            className="hidden"
            onChange={handleFileUpload}
            disabled={isUploading}
            accept=".pdf,.doc,.docx,.xls,.xlsx,.png,.jpg,.jpeg"
          />
        </label>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        {/* Storage details panel */}
        <div className="lg:col-span-1 space-y-6">
          <Card>
            <CardHeader>
              <h2 className="text-lg font-medium text-gray-900">Sandbox Storage</h2>
            </CardHeader>
            <CardBody className="space-y-4">
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600 font-medium">Used Space</span>
                  <span className="font-bold text-gray-900">{totalUsedFormatted}</span>
                </div>
                <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-primary-600 rounded-full transition-all duration-500" 
                    style={{ width: `${percentageUsed}%` }}
                  ></div>
                </div>
                <div className="flex justify-between text-xs text-gray-500">
                  <span>Quota: 500 MB</span>
                  <span>{percentageUsed.toFixed(0)}% used</span>
                </div>
              </div>
              
              <div className="pt-4 border-t border-gray-250">
                <h3 className="text-sm font-semibold text-gray-900 mb-2">Chamber Filters</h3>
                <div className="space-y-1">
                  <button 
                    onClick={() => setPreviewDoc(null)}
                    className="w-full text-left px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-md transition"
                  >
                    Clear Preview Panel
                  </button>
                  <a
                    href="#all-docs"
                    className="block px-3 py-2 text-sm font-medium text-primary-700 bg-primary-50 hover:bg-primary-100 rounded-md transition"
                  >
                    All Shared & Owned
                  </a>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
        
        {/* Document list */}
        <div className="lg:col-span-3 space-y-6" id="all-docs">
          <Card>
            <CardHeader className="flex justify-between items-center">
              <h2 className="text-lg font-medium text-gray-900">Vault files ({documents.length})</h2>
            </CardHeader>
            <CardBody>
              {isLoading ? (
                <div className="flex justify-center items-center py-12">
                  <RefreshCw className="animate-spin text-primary-600" size={32} />
                </div>
              ) : documents.length > 0 ? (
                <div className="space-y-2">
                  {documents.map(doc => {
                    const isOwner = doc.ownerId.id === user?.id;
                    return (
                      <div
                        key={doc.id}
                        className={`flex flex-col md:flex-row md:items-center justify-between p-4 rounded-lg border transition-all duration-200 gap-4 ${
                          previewDoc?.id === doc.id
                            ? 'bg-primary-50/50 border-primary-300 shadow-sm'
                            : 'border-gray-200 hover:bg-gray-50 bg-white'
                        }`}
                      >
                        <div className="flex items-start gap-3 cursor-pointer flex-1" onClick={() => setPreviewDoc(doc)}>
                          <div className="p-2.5 bg-primary-100 rounded-lg text-primary-700 shrink-0">
                            <FileText size={24} />
                          </div>
                          
                          <div className="min-w-0">
                            <div className="flex flex-wrap items-center gap-2">
                              <h3 className="text-sm font-bold text-gray-900 truncate max-w-xs md:max-w-md">
                                {doc.name}
                              </h3>
                              {doc.shared && (
                                <Badge variant="secondary" size="sm">Shared</Badge>
                              )}
                              {doc.status === 'signed' ? (
                                <Badge variant="success" size="sm" className="flex items-center gap-0.5">
                                  <FileCheck size={12} /> Signed
                                </Badge>
                              ) : (
                                <Badge variant="warning" size="sm">Unsigned</Badge>
                              )}
                            </div>
                            
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-gray-500">
                              <span className="font-semibold text-gray-700">{doc.type}</span>
                              <span>{doc.size}</span>
                              <span>Uploaded by: <b className="text-gray-700">{doc.ownerId.name} ({doc.ownerId.role})</b></span>
                            </div>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-2 justify-end">
                          <a
                            href={`${BACKEND_URL}${doc.url}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-2 hover:bg-gray-150 rounded text-gray-600 transition"
                            title="Download File"
                          >
                            <Download size={18} />
                          </a>

                          {isOwner && (
                            <button
                              onClick={() => handleToggleShare(doc.id, doc.shared)}
                              className={`p-2 rounded transition ${
                                doc.shared 
                                  ? 'text-primary-600 bg-primary-50 hover:bg-primary-100' 
                                  : 'text-gray-400 hover:bg-gray-150'
                              }`}
                              title={doc.shared ? 'Stop Sharing' : 'Share Document'}
                            >
                              <Share2 size={18} />
                            </button>
                          )}

                          {doc.status !== 'signed' && (doc.shared || isOwner) && (
                            <button
                              onClick={() => setSigningDoc(doc)}
                              className="px-3 py-1.5 bg-accent-500 hover:bg-accent-600 text-white font-semibold text-xs rounded flex items-center gap-1 transition shadow-sm"
                              title="Sign this Document"
                            >
                              <PenTool size={14} /> Sign
                            </button>
                          )}

                          {isOwner && (
                            <button
                              onClick={() => handleDelete(doc.id)}
                              className="p-2 text-error-600 hover:bg-error-50 rounded transition"
                              title="Delete Document"
                            >
                              <Trash2 size={18} />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="text-center py-12 text-gray-500 border border-dashed border-gray-200 rounded-lg">
                  <FileText size={48} className="mx-auto text-gray-300 mb-2" />
                  <p className="font-medium text-gray-700">No documents found</p>
                  <p className="text-xs text-gray-500 mt-1">Upload a pitch deck, business plan, or spreadsheet to begin.</p>
                </div>
              )}
            </CardBody>
          </Card>

          {/* Dynamic Preview Section */}
          {previewDoc && (
            <Card className="border border-primary-200 shadow-md">
              <CardHeader className="flex justify-between items-center bg-gray-55/40 border-b border-gray-200">
                <div>
                  <h3 className="font-bold text-gray-900">{previewDoc.name}</h3>
                  <p className="text-xs text-gray-500">
                    Uploaded {new Date(previewDoc.createdAt).toLocaleDateString()} by {previewDoc.ownerId.name}
                  </p>
                </div>
                <button
                  className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100"
                  onClick={() => setPreviewDoc(null)}
                >
                  <X size={18} />
                </button>
              </CardHeader>
              <CardBody className="space-y-4">
                {renderFilePreview(previewDoc)}

                {/* Show Signature E-stamp Details */}
                {previewDoc.status === 'signed' && (
                  <div className="p-4 bg-success-50/50 border border-success-200 rounded-lg flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <h4 className="font-bold text-success-800 flex items-center gap-1.5 text-sm">
                        <FileCheck size={16} /> E-Signed Document Verified
                      </h4>
                      <p className="text-xs text-gray-600">
                        Signed by <span className="font-bold">{previewDoc.signedById?.name} ({previewDoc.signedById?.role})</span> on {previewDoc.signedAt ? new Date(previewDoc.signedAt).toLocaleString() : ''}
                      </p>
                    </div>
                    {previewDoc.signatureImage && (
                      <div className="border border-success-200 bg-white p-1.5 rounded shadow-sm max-w-[150px]">
                        <img 
                          src={previewDoc.signatureImage} 
                          alt="Signature Timestamp Stamp" 
                          className="max-h-12 w-auto object-contain mx-auto" 
                        />
                      </div>
                    )}
                  </div>
                )}
              </CardBody>
            </Card>
          )}
        </div>
      </div>

      {/* HTML5 Canvas E-Signature Drawing Modal */}
      {signingDoc && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full shadow-2xl overflow-hidden animate-scale-up border border-gray-200">
            <div className="p-4 border-b border-gray-250 flex justify-between items-center bg-gray-50">
              <div>
                <h3 className="font-bold text-gray-900 text-base">Affix E-Signature</h3>
                <p className="text-xs text-gray-500">Sign your pitch or funding agreement document</p>
              </div>
              <button 
                className="text-gray-500 hover:text-gray-700 p-1" 
                onClick={() => setSigningDoc(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="p-6 space-y-4">
              <p className="text-xs text-gray-600">
                Draw your signature on the digital pad below using your mouse or trackpad. This drawing will be cryptographically locked to document: <b>{signingDoc.name}</b>.
              </p>

              {/* Drawing Pad Canvas Container */}
              <div className="border border-gray-300 rounded-lg overflow-hidden bg-gray-50 shadow-inner select-none relative">
                <canvas
                  ref={canvasRef}
                  width={500}
                  height={200}
                  className="w-full h-[200px] cursor-crosshair touch-none"
                  onMouseDown={startDrawing}
                  onMouseMove={draw}
                  onMouseUp={stopDrawing}
                  onMouseLeave={stopDrawing}
                  onTouchStart={startDrawing}
                  onTouchMove={draw}
                  onTouchEnd={stopDrawing}
                />
                <div className="absolute bottom-2 left-2 text-[10px] text-gray-400 font-medium select-none pointer-events-none">
                  X ________________________________________ (Draw Here)
                </div>
              </div>

              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={clearCanvas}
                  className="inline-flex items-center text-xs font-semibold text-gray-600 hover:text-gray-900 bg-gray-100 hover:bg-gray-200 px-3 py-1.5 rounded-md transition"
                >
                  Clear Drawing Pad
                </button>

                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={() => setSigningDoc(null)}>
                    Cancel
                  </Button>
                  <Button variant="primary" size="sm" onClick={submitSignature}>
                    Apply Signature
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};