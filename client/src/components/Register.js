import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { 
  User, 
  Phone, 
  Lock, 
  MapPin, 
  Building, 
  UserPlus, 
  ArrowRight,
  CheckCircle,
  Mail
} from 'lucide-react';

function Register() {
  const [formData, setFormData] = useState({
    role: '',
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    province: '',
    district: '',
    neighborhood: '',
    fullAddress: '',
    password: '',
    confirmPassword: ''
  });
  
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [loading, setLoading] = useState(false);
  
  const { register } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    fetchProvinces();
  }, []);

  const fetchProvinces = async () => {
    try {
      const response = await axios.get('/api/provinces');
      setProvinces(response.data);
    } catch (error) {
      toast.error('İller yüklenemedi');
    }
  };

  const fetchDistricts = async (province) => {
    if (!province) {
      setDistricts([]);
      setNeighborhoods([]);
      return;
    }
    
    try {
      const response = await axios.get(`/api/districts/${province}`);
      setDistricts(response.data);
      setNeighborhoods([]);
    } catch (error) {
      toast.error('İlçeler yüklenemedi');
    }
  };

  const fetchNeighborhoods = async (province, district) => {
    if (!province || !district) {
      setNeighborhoods([]);
      return;
    }
    
    try {
      const response = await axios.get(`/api/neighborhoods/${province}/${district}`);
      setNeighborhoods(response.data);
    } catch (error) {
      toast.error('Mahalleler yüklenemedi');
    }
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value
    });

    // Handle cascading dropdowns
    if (name === 'province') {
      fetchDistricts(value);
      setFormData(prev => ({ ...prev, district: '', neighborhood: '' }));
    } else if (name === 'district') {
      fetchNeighborhoods(formData.province, value);
      setFormData(prev => ({ ...prev, neighborhood: '' }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (formData.password !== formData.confirmPassword) {
      toast.error('Şifreler eşleşmiyor');
      return;
    }

    if (formData.password.length < 8) {
      toast.error('Şifre en az 8 karakter olmalıdır');
      return;
    }

    setLoading(true);

    const userData = {
      role: formData.role,
      firstName: formData.firstName,
      lastName: formData.lastName,
      email: formData.email,
      phone: formData.phone,
      province: formData.province,
      district: formData.district,
      neighborhood: formData.neighborhood,
      fullAddress: formData.fullAddress,
      password: formData.password
    };

    const result = await register(userData);
    
    if (result.success) {
      toast.success('Kayıt başarılı!');
      navigate('/');
    } else {
      toast.error(result.error);
    }
    
    setLoading(false);
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="form-container" style={{ maxWidth: '600px' }}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <UserPlus size={32} className="text-white" />
          </div>
          <h1 className="form-title">Yeni Hesap Oluşturun</h1>
          <p className="form-subtitle">
            Gıda çalışanları için yemek takası platformuna katılın
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="form-group">
            <label htmlFor="role" className="form-label">
              <Building size={16} className="inline mr-2" />
              Çalıştığınız Yerdeki Rolünüz *
            </label>
            <select
              id="role"
              name="role"
              required
              className="form-select"
              value={formData.role}
              onChange={handleChange}
            >
              <option value="">Rolünüzü seçin</option>
              <option value="Aşçı">Aşçı</option>
              <option value="Mutfak Görevlisi">Mutfak Görevlisi</option>
              <option value="Garson">Garson</option>
              <option value="Restoran Müdürü">Restoran Müdürü</option>
              <option value="Diğer">Diğer</option>
            </select>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="firstName" className="form-label">
                <User size={16} className="inline mr-2" />
                Ad *
              </label>
              <input
                id="firstName"
                name="firstName"
                type="text"
                required
                className="form-input"
                placeholder="Adınız"
                value={formData.firstName}
                onChange={handleChange}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="lastName" className="form-label">
                <User size={16} className="inline mr-2" />
                Soyad *
              </label>
              <input
                id="lastName"
                name="lastName"
                type="text"
                required
                className="form-input"
                placeholder="Soyadınız"
                value={formData.lastName}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="email" className="form-label">
              <Mail size={16} className="inline mr-2" />
              E-posta Adresi *
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
            <label htmlFor="phone" className="form-label">
              <Phone size={16} className="inline mr-2" />
              Telefon Numarası *
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

          <div className="grid grid-cols-3 gap-4">
            <div className="form-group">
              <label htmlFor="province" className="form-label">
                <MapPin size={16} className="inline mr-2" />
                İl *
              </label>
              <select
                id="province"
                name="province"
                required
                className="form-select"
                value={formData.province}
                onChange={handleChange}
              >
                <option value="">İl seçin</option>
                {provinces.map(province => (
                  <option key={province} value={province}>{province}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="district" className="form-label">
                <MapPin size={16} className="inline mr-2" />
                İlçe *
              </label>
              <select
                id="district"
                name="district"
                required
                className="form-select"
                value={formData.district}
                onChange={handleChange}
                disabled={!formData.province}
              >
                <option value="">İlçe seçin</option>
                {districts.map(district => (
                  <option key={district} value={district}>{district}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="neighborhood" className="form-label">
                <MapPin size={16} className="inline mr-2" />
                Mahalle *
              </label>
              <select
                id="neighborhood"
                name="neighborhood"
                required
                className="form-select"
                value={formData.neighborhood}
                onChange={handleChange}
                disabled={!formData.district}
              >
                <option value="">Mahalle seçin</option>
                {neighborhoods.map(neighborhood => (
                  <option key={neighborhood} value={neighborhood}>{neighborhood}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="fullAddress" className="form-label">
              <MapPin size={16} className="inline mr-2" />
              Tam Adres *
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <MapPin size={20} className="text-gray-400" />
              </div>
              <textarea
                id="fullAddress"
                name="fullAddress"
                required
                className="form-textarea pl-10"
                placeholder="Sokak, bina no, kat, daire no vb."
                value={formData.fullAddress}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="password" className="form-label">
                <Lock size={16} className="inline mr-2" />
                Şifre *
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
                  placeholder="En az 8 karakter"
                  value={formData.password}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="confirmPassword" className="form-label">
                <CheckCircle size={16} className="inline mr-2" />
                Şifre Tekrar *
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <CheckCircle size={20} className="text-gray-400" />
                </div>
                <input
                  id="confirmPassword"
                  name="confirmPassword"
                  type="password"
                  required
                  className="form-input pl-10"
                  placeholder="Şifrenizi tekrar girin"
                  value={formData.confirmPassword}
                  onChange={handleChange}
                />
              </div>
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
                <UserPlus size={16} />
                Kayıt Ol
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        <div className="text-center mt-6">
          <p className="text-gray-600">
            Zaten hesabınız var mı?{' '}
            <Link 
              to="/login" 
              className="text-orange-600 hover:text-orange-500 font-semibold transition-colors"
            >
              Giriş yapın
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}

export default Register;
