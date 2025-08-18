import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import { Phone, Lock, LogIn, ArrowRight } from 'lucide-react';

function Login() {
  const [formData, setFormData] = useState({
    phone: '',
    password: ''
  });
  const [loading, setLoading] = useState(false);
  
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
    
    if (!formData.phone || !formData.password) {
      toast.error('Tüm alanları doldurun');
      return;
    }

    setLoading(true);
    const result = await login(formData.phone, formData.password);
    
    if (result.success) {
      toast.success('Giriş başarılı!');
      navigate('/');
    } else {
      toast.error(result.error);
    }
    
    setLoading(false);
  };

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
            <label htmlFor="phone" className="form-label">
              Telefon Numarası
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <Phone size={20} className="text-gray-400" />
              </div>
              <input
                id="phone"
                name="phone"
                type="tel"
                required
                className="form-input pl-10"
                placeholder="0555 123 45 67"
                value={formData.phone}
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
