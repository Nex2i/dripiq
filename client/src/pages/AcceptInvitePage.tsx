import React, { useState, useEffect } from 'react';
import { useSearchParams, Navigate } from '@tanstack/react-router';
import { CheckCircle, XCircle, Clock, Mail, Building2 } from 'lucide-react';

interface InviteInfo {
  id: string;
  email: string;
  firstName: string;
  lastName?: string;
  role: string;
  tenantId: string;
  expiresAt: string;
}

export default function AcceptInvitePage() {
  const searchParams = useSearchParams();
  const token = searchParams.token;
  
  const [inviteInfo, setInviteInfo] = useState<InviteInfo | null>(null);
  const [status, setStatus] = useState<'loading' | 'valid' | 'invalid' | 'expired' | 'accepted' | 'error'>('loading');
  const [isAccepting, setIsAccepting] = useState(false);

  useEffect(() => {
    if (!token) {
      setStatus('invalid');
      return;
    }

    verifyInviteToken(token);
  }, [token]);

  const verifyInviteToken = async (token: string) => {
    try {
      // TODO: Replace with actual API call
      console.log('Verifying invite token:', token);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Mock successful verification
      const mockInviteInfo: InviteInfo = {
        id: 'invite_123',
        email: 'user@example.com',
        firstName: 'John',
        lastName: 'Doe',
        role: 'Sales Rep',
        tenantId: 'tenant_123',
        expiresAt: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(), // 3 days from now
      };

      setInviteInfo(mockInviteInfo);
      setStatus('valid');
    } catch (error) {
      console.error('Error verifying invite:', error);
      setStatus('error');
    }
  };

  const handleAcceptInvite = async () => {
    if (!token) return;

    setIsAccepting(true);
    
    try {
      // TODO: Replace with actual API call
      console.log('Accepting invite with token:', token);
      
      // Simulate API call
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      setStatus('accepted');
      
      // Redirect to dashboard after a delay
      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 2000);
    } catch (error) {
      console.error('Error accepting invite:', error);
      setStatus('error');
    } finally {
      setIsAccepting(false);
    }
  };

  const formatExpiryDate = (dateString: string) => {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(dateString));
  };

  // Redirect to login if no token
  if (!token) {
    return <Navigate to="/auth/login" />;
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        <div className="text-center">
          <Building2 className="mx-auto h-12 w-12 text-blue-600" />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
            Join DripIQ
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            You've been invited to join a workspace
          </p>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow sm:rounded-lg sm:px-10">
          {status === 'loading' && (
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-4 text-sm text-gray-600">Verifying invitation...</p>
            </div>
          )}

          {status === 'valid' && inviteInfo && (
            <div className="space-y-6">
              <div className="text-center">
                <Mail className="mx-auto h-8 w-8 text-green-600" />
                <h3 className="mt-2 text-lg font-medium text-gray-900">
                  Valid Invitation
                </h3>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-md p-4">
                <div className="space-y-2 text-sm">
                  <div>
                    <span className="font-medium text-gray-700">Invited as:</span>
                    <span className="ml-2 text-gray-900">
                      {inviteInfo.firstName} {inviteInfo.lastName}
                    </span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Email:</span>
                    <span className="ml-2 text-gray-900">{inviteInfo.email}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Role:</span>
                    <span className="ml-2 text-gray-900">{inviteInfo.role}</span>
                  </div>
                  <div>
                    <span className="font-medium text-gray-700">Expires:</span>
                    <span className="ml-2 text-gray-900">
                      {formatExpiryDate(inviteInfo.expiresAt)}
                    </span>
                  </div>
                </div>
              </div>

              <button
                onClick={handleAcceptInvite}
                disabled={isAccepting}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isAccepting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Accepting invitation...
                  </>
                ) : (
                  'Accept invitation'
                )}
              </button>

              <p className="text-xs text-gray-500 text-center">
                By accepting this invitation, you agree to join the workspace and will be able to access the platform.
              </p>
            </div>
          )}

          {status === 'accepted' && (
            <div className="text-center space-y-4">
              <CheckCircle className="mx-auto h-12 w-12 text-green-600" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Invitation Accepted!
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  Welcome to the team! You'll be redirected to the dashboard shortly.
                </p>
              </div>
              <div className="animate-pulse">
                <div className="bg-gray-200 rounded h-2 w-full"></div>
              </div>
            </div>
          )}

          {status === 'invalid' && (
            <div className="text-center space-y-4">
              <XCircle className="mx-auto h-12 w-12 text-red-600" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Invalid Invitation
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  This invitation link is invalid or malformed. Please check the link and try again.
                </p>
              </div>
              <button
                onClick={() => window.location.href = '/auth/login'}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Go to Sign In
              </button>
            </div>
          )}

          {status === 'expired' && (
            <div className="text-center space-y-4">
              <Clock className="mx-auto h-12 w-12 text-yellow-600" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Invitation Expired
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  This invitation has expired. Please contact your team administrator for a new invitation.
                </p>
              </div>
              <button
                onClick={() => window.location.href = '/auth/login'}
                className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
              >
                Go to Sign In
              </button>
            </div>
          )}

          {status === 'error' && (
            <div className="text-center space-y-4">
              <XCircle className="mx-auto h-12 w-12 text-red-600" />
              <div>
                <h3 className="text-lg font-medium text-gray-900">
                  Error Verifying Invitation
                </h3>
                <p className="mt-2 text-sm text-gray-600">
                  There was an error processing your invitation. Please try again or contact support.
                </p>
              </div>
              <div className="space-y-2">
                <button
                  onClick={() => verifyInviteToken(token)}
                  className="w-full flex justify-center py-2 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Try Again
                </button>
                <button
                  onClick={() => window.location.href = '/auth/login'}
                  className="w-full flex justify-center py-2 px-4 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                  Go to Sign In
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}