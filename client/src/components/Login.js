import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { Mail, Lock, LogIn, ArrowRight } from 'lucide-react';

function Login() {
  const [formData, setFormData] = useState({
    email: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  const [showVerificationMessage, setShowVerificationMessage] = useState(false);
  const [pendingEmail, setPendingEmail] = useState('');
  
  const { login } = useAuth();
  const navigate = useNavigate();

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.email || !formData.password) {
      toast.error('Tüm alanları doldurun');
      return;
    }

    setLoading(true);
    const result = await login(formData.email, formData.password);
    
    if (result.requiresVerification) {
      setShowVerificationMessage(true);
      setPendingEmail(formData.email);
      toast.error(result.error);
    } else if (result.success) {
      toast.success('Giriş başarılı!');
      navigate('/');
    } else {
      toast.error(result.error);
    }
    
    setLoading(false);
  };

  const handleResendVerification = async () => {
    try {
      setLoading(true);
      await axios.post('/api/resend-verification', { email: pendingEmail });
      toast.success('Doğrulama e-postası tekrar gönderildi');
    } catch (error) {
      toast.error(error.response?.data?.error || 'E-posta gönderilemedi');
    } finally {
      setLoading(false);
    }
  };

  if (showVerificationMessage) {
    return (
      <div className="min-h-screen flex items-center justify-center py-12 px-4">
        <div className="form-container" style={{ maxWidth: '500px' }}>
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-orange-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Mail size={32} className="text-white" />
            </div>
            <h1 className="form-title">E-posta Doğrulama Gerekli</h1>
            <p className="form-subtitle">
              Giriş yapabilmek için e-posta adresinizi doğrulayın
            </p>
          </div>
          
          <div className="bg-white rounded-lg shadow-lg p-6 mb-6">
            <div className="text-center">
              <p className="text-gray-700 mb-4">
                <strong>{pendingEmail}</strong> adresine doğrulama e-postası gönderdik.
              </p>
              <p className="text-gray-600 text-sm mb-6">
                E-postanızı kontrol edin ve "E-posta Adresimi Doğrula" butonuna tıklayın.
              </p>
              
              <div className="space-y-3">
                <button
                  onClick={handleResendVerification}
                  disabled={loading}
                  className="btn btn-secondary w-full"
                >
                  {loading ? (
                    <div className="spinner"></div>
                  ) : (
                    <>
                      <Mail size={16} />
                      E-postayı Tekrar Gönder
                    </>
                  )}
                </button>
                
                <button
                  onClick={() => {
                    setShowVerificationMessage(false);
                    setPendingEmail('');
                  }}
                  className="btn btn-outline w-full"
                >
                  Farklı E-posta Kullan
                </button>
              </div>
            </div>
          </div>
          
          <div className="text-center">
            <p className="text-gray-600">
              Hesabınız yok mu?{' '}
              <Link 
                to="/register" 
                className="text-orange-600 hover:text-orange-500 font-semibold transition-colors"
              >
                Kayıt olun
              </Link>
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="form-container">
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <LogIn size={32} className="text-white" />
          </div>
          <h1 className="form-title">Hoş Geldiniz</h1>
          <p className="form-subtitle">
            Hesabınıza giriş yapın ve yemek takasına başlayın
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="form-group">
            <label htmlFor="email" className="form-label">
              E-posta Adresi
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Mail size={20} className="text-gray-400" />
              </div>
              <input
                id="email"
                name="email"
                type="email"
                required
                className="form-input pl-10"
                placeholder="ornek@email.com"
                value={formData.email}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="password" className="form-label">
              Şifre
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Lock size={20} className="text-gray-400" />
              </div>
              <input
                id="password"
                name="password"
                type="password"
                required
                className="form-input pl-10"
                placeholder="Şifrenizi girin"
                value={formData.password}
                onChange={handleChange}
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="btn btn-primary w-full"
          >
            {loading ? (
              <div className="spinner"></div>
            ) : (
              <>
                <LogIn size={16} />
                Giriş Yap
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <p className="text-gray-600">
            Hesabınız yok mu?{' '}
            <Link 
              to="/register" 
              className="text-orange-600 hover:text-orange-500 font-semibold transition-colors"
            >
              Hemen kayıt olun
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Login;
