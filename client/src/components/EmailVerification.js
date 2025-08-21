import React, { useState, useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { Mail, CheckCircle, XCircle, Loader, Home, ArrowRight } from 'lucide-react';

function EmailVerification() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();
  const [verificationStatus, setVerificationStatus] = useState('verifying');
  const [errorMessage, setErrorMessage] = useState('');
  const [countdown, setCountdown] = useState(3);

  useEffect(() => {
    const token = searchParams.get('token');
    const success = searchParams.get('success');
    const error = searchParams.get('error');
    
    if (success === 'true') {
      // Server'dan redirect geldi, doğrulama başarılı
      setVerificationStatus('success');
      toast.success('E-posta doğrulandı! Giriş yapıldı.');
      
      // Countdown başlat
      const timer = setInterval(() => {
        setCountdown((prev) => {
          if (prev <= 1) {
            clearInterval(timer);
            navigate('/');
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
      
      return () => clearInterval(timer);
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
        
        // Countdown başlat
        const timer = setInterval(() => {
          setCountdown((prev) => {
            if (prev <= 1) {
              clearInterval(timer);
              navigate('/');
              return 0;
            }
            return prev - 1;
          });
        }, 1000);
        
        return () => clearInterval(timer);
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
            <div className="relative mb-6">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center">
                <Loader className="w-10 h-10 text-white animate-spin" />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-orange-500 rounded-full animate-pulse"></div>
            </div>
            <h2 className="text-2xl font-bold mb-3 text-gray-800">E-posta Doğrulanıyor</h2>
            <p className="text-gray-600 mb-6">Hesabınız güvenli bir şekilde doğrulanıyor...</p>
            <div className="flex justify-center space-x-2">
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce"></div>
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{animationDelay: '0.1s'}}></div>
              <div className="w-2 h-2 bg-orange-500 rounded-full animate-bounce" style={{animationDelay: '0.2s'}}></div>
            </div>
          </div>
        );
      
      case 'success':
        return (
          <div className="text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-green-400 to-green-600 rounded-full flex items-center justify-center">
                <CheckCircle className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-green-500 rounded-full animate-ping"></div>
            </div>
            <h2 className="text-2xl font-bold mb-3 text-green-600">🎉 E-posta Doğrulandı!</h2>
            <p className="text-gray-600 mb-4">Hesabınız başarıyla doğrulandı ve giriş yapıldı.</p>
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center space-x-2">
                <CheckCircle className="w-5 h-5 text-green-600" />
                <span className="text-green-700 font-medium">Hesabınız aktif!</span>
              </div>
            </div>
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500 mb-6">
              <span>Ana sayfaya yönlendiriliyorsunuz</span>
              <div className="flex space-x-1">
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-pulse"></span>
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></span>
                <span className="w-1 h-1 bg-gray-400 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></span>
              </div>
              <span className="font-mono bg-gray-100 px-2 py-1 rounded">{countdown}s</span>
            </div>
            <button
              onClick={() => navigate('/')}
              className="bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-3 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all duration-200 transform hover:scale-105 flex items-center space-x-2 mx-auto"
            >
              <Home className="w-4 h-4" />
              <span>Ana Sayfaya Git</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        );
      
      case 'error':
        return (
          <div className="text-center">
            <div className="relative mb-6">
              <div className="w-20 h-20 mx-auto bg-gradient-to-br from-red-400 to-red-600 rounded-full flex items-center justify-center">
                <XCircle className="w-10 h-10 text-white" />
              </div>
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-red-500 rounded-full"></div>
            </div>
            <h2 className="text-2xl font-bold mb-3 text-red-600">❌ Doğrulama Başarısız</h2>
            <p className="text-gray-600 mb-6">{errorMessage}</p>
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-center space-x-2">
                <XCircle className="w-5 h-5 text-red-600" />
                <span className="text-red-700 font-medium">Doğrulama işlemi tamamlanamadı</span>
              </div>
            </div>
            <div className="space-y-3">
              <button
                onClick={() => navigate('/login')}
                className="w-full bg-gradient-to-r from-orange-500 to-orange-600 text-white px-6 py-3 rounded-lg hover:from-orange-600 hover:to-orange-700 transition-all duration-200 transform hover:scale-105 flex items-center justify-center space-x-2"
              >
                <span>Giriş Sayfasına Dön</span>
                <ArrowRight className="w-4 h-4" />
              </button>
              <button
                onClick={() => navigate('/register')}
                className="w-full bg-gray-100 text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-200 transition-all duration-200 flex items-center justify-center space-x-2"
              >
                <Mail className="w-4 h-4" />
                <span>Yeni Hesap Oluştur</span>
              </button>
            </div>
          </div>
        );
      
      default:
        return null;
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 via-white to-orange-50 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <div className="w-16 h-16 mx-auto bg-gradient-to-br from-orange-400 to-orange-600 rounded-full flex items-center justify-center mb-4">
              <Mail className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">E-posta Doğrulama</h1>
            <p className="text-gray-600">Hesabınızı güvenli hale getiriyoruz</p>
          </div>
          
          {renderContent()}
        </div>
        
        <div className="text-center mt-6">
          <p className="text-sm text-gray-500">
            Azık - Yemek Takası Platformu
          </p>
        </div>
      </div>
    </div>
  );
}

export default EmailVerification;
