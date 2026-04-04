import React, { useState, useEffect } from 'react';
import { X, Send, Loader } from 'lucide-react';
import { LeadData } from '../types';
import { shareLead, getSystemUsers, SystemUser } from '../services/leadSharingService';

interface ShareLeadModalProps {
  isOpen: boolean;
  lead: LeadData | null;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ShareLeadModal: React.FC<ShareLeadModalProps> = ({
  isOpen,
  lead,
  onClose,
  onSuccess,
}) => {
  const [users, setUsers] = useState<SystemUser[]>([]);
  const [selectedUser, setSelectedUser] = useState<string>('');
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  // Load system users on mount
  useEffect(() => {
    if (isOpen) {
      loadUsers();
      // Reset form
      setSelectedUser('');
      setMessage('');
      setError(null);
      setSuccess(false);
    }
  }, [isOpen]);

  const loadUsers = async () => {
    const systemUsers = await getSystemUsers();
    setUsers(systemUsers);
  };

  const handleShare = async () => {
    if (!selectedUser || !lead) {
      setError('Please select a recipient');
      return;
    }

    setLoading(true);
    setError(null);

    const result = await shareLead(
      lead.id || '',
      lead,
      selectedUser,
      message || undefined
    );

    setLoading(false);

    if (result.success) {
      setSuccess(true);
      setTimeout(() => {
        onClose();
        onSuccess?.();
      }, 1500);
    } else {
      setError(result.error || 'Failed to share lead');
    }
  };

  if (!isOpen || !lead) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-modal">
      <div className="bg-white rounded-sm shadow-xl max-w-md w-full mx-4">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b">
          <h2 className="text-lg font-semibold text-dhl-black">Share Lead</h2>
          <button
            onClick={onClose}
            className="text-dhl-gray-medium hover:text-dhl-gray-dark transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-4">
          {/* Lead Info */}
          <div className="bg-dhl-gray-light p-4 rounded-sm">
            <p className="text-sm font-medium text-dhl-black">{lead.companyName}</p>
            <p className="text-xs text-dhl-gray-dark mt-1">
              Potential: {lead.potentialSek ?? '—'}
            </p>
          </div>

          {/* Recipient Selection */}
          <div>
            <label className="block text-sm font-medium text-dhl-gray-dark mb-2">
              Send to
            </label>
            <select
              value={selectedUser}
              onChange={(e) => setSelectedUser(e.target.value)}
              className="w-full px-3 py-2 border border-dhl-gray-medium rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            >
              <option value="">Select a team member...</option>
              {users.map((user) => (
                <option key={user.id} value={user.email}>
                  {user.full_name || user.username || user.email}
                </option>
              ))}
            </select>
          </div>

          {/* Message */}
          <div>
            <label className="block text-sm font-medium text-dhl-gray-dark mb-2">
              Message (optional)
            </label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a note..."
              rows={3}
              className="w-full px-3 py-2 border border-dhl-gray-medium rounded-sm focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm resize-none"
            />
          </div>

          {/* Error/Success Messages */}
          {error && (
            <div className="bg-dhl-gray-light border border-dhl-gray-medium text-red-700 px-4 py-3 rounded-sm text-sm">
              {error}
            </div>
          )}

          {success && (
            <div className="bg-dhl-gray-light border border-green-200 text-dhl-yellow px-4 py-3 rounded-sm text-sm flex items-center">
              <svg className="w-4 h-4 mr-2" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                  clipRule="evenodd"
                />
              </svg>
              Lead shared successfully!
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t px-6 py-4 flex gap-3">
          <button
            onClick={onClose}
            className="flex-1 px-4 py-2 text-dhl-gray-dark bg-dhl-gray-light hover:bg-gray-200 rounded-sm font-medium transition"
          >
            Cancel
          </button>
          <button
            onClick={handleShare}
            disabled={loading || !selectedUser || success}
            className="flex-1 px-4 py-2 bg-dhl-red hover:bg-dhl-red disabled:bg-gray-300 text-white rounded-sm font-medium transition flex items-center justify-center gap-2"
          >
            {loading ? (
              <>
                <Loader className="w-4 h-4 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Send className="w-4 h-4" />
                Share
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

export default ShareLeadModal;



