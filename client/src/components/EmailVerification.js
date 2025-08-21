import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { Mail, CheckCircle, XCircle, Loader } from 'lucide-react';

function EmailVerification() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [verificationStatus, setVerificationStatus] = useState('verifying');
  const [errorMessage, setErrorMessage] = useState('');

  useEffect(() => {
    const token = searchParams.get('token');
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    
    if (success === 'true' && token) {
      // Server'dan redirect geldi, kullanıcıyı giriş yaptır
      setVerificationStatus('success');
      login(token);
      toast.success('E-posta doğrulandı! Giriş yapıldı.');
      
      setTimeout(() => {
        navigate('/');
      }, 3000);
      return;
    }
    
    if (error) {
      setVerificationStatus('error');
      setErrorMessage('E-posta doğrulama işlemi başarısız oldu');
      return;
    }
    
    if (!token) {
      setVerificationStatus('error');
      setErrorMessage('Doğrulama token\'ı bulunamadı');
      return;
    }
    
    // Eğer success parametresi yoksa, POST request yap
    verifyEmail(token);
  }, [searchParams]);

  const verifyEmail = async (token) => {
    try {
      const response = await axios.post('/api/verify-email', { token });
      
      if (response.data.success) {
        setVerificationStatus('success');
        // Kullanıcıyı otomatik olarak giriş yaptır
        login(response.data.token);
        toast.success('E-posta doğrulandı! Giriş yapıldı.');
        
        // 3 saniye sonra ana sayfaya yönlendir
        setTimeout(() => {
          navigate('/');
        }, 3000);
      }
    } catch (error) {
      setVerificationStatus('error');
      if (error.response?.data?.message) {
        setErrorMessage(error.response.data.message);
      } else {
        setErrorMessage('E-posta doğrulama işlemi başarısız oldu');
      }
    }
  };

  const renderContent = () => {
    switch (verificationStatus) {
      case 'verifying':
        return (
          <div className="text-center">
            <Loader className="w-12 h-12 mx-auto mb-4 animate-spin text-orange-500" />
            <h2 className="text-xl font-semibold mb-2">E-posta Doğrulanıyor</h2>
            <p className="text-gray-600">Lütfen bekleyin...</p>
          </div>
        );
      
      case 'success':
        return (
          <div className="text-center">
            <CheckCircle className="w-12 h-12 mx-auto mb-4 text-green-500" />
            <h2 className="text-xl font-semibold mb-2 text-green-600">E-posta Doğrulandı!</h2>
            <p className="text-gray-600 mb-4">Hesabınız başarıyla doğrulandı ve giriş yapıldı.</p>
            <p className="text-sm text-gray-500">Ana sayfaya yönlendiriliyorsunuz...</p>
          </div>
        );
      
      case 'error':
        return (
          <div className="text-center">
            <XCircle className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-semibold mb-2 text-red-600">Doğrulama Başarısız</h2>
            <p className="text-gray-600 mb-4">{errorMessage}</p>
            <button
              onClick={() => navigate('/login')}
              className="bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors"
            >
              Giriş Sayfasına Dön
            </button>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="container">
      <div className="auth-card">
        {renderContent()}
      </div>
    </div>
  );
}

export default EmailVerification;
