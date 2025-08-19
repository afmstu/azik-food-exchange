import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { 
  Search, 
  Filter, 
  MapPin, 
  Clock, 
  User, 
  Phone, 
  MessageSquare,
  Plus,
  Utensils,
  Users,
  TrendingUp,
  Heart,
  UserPlus,
  LogIn,
  Settings
} from 'lucide-react';

function Home() {
  const [listings, setListings] = useState([]);
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [filters, setFilters] = useState({
    province: '',
    district: ''
  });
  const [loading, setLoading] = useState(true);
  const [offering, setOffering] = useState({});
  const [showDeveloperLogin, setShowDeveloperLogin] = useState(false);
  const [developerEmail, setDeveloperEmail] = useState('');
  const [developerPassword, setDeveloperPassword] = useState('');

  const { user } = useAuth();

  useEffect(() => {
    fetchListings();
    fetchProvinces();
  }, [filters]);

  const fetchListings = async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.province) params.append('province', filters.province);
      if (filters.district) params.append('district', filters.district);
      
      const response = await axios.get(`/api/listings?${params.toString()}`);
      setListings(response.data);
    } catch (error) {
      toast.error('İlanlar yüklenemedi');
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

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
      return;
    }
    
    try {
      const response = await axios.get(`/api/districts/${province}`);
      setDistricts(response.data);
    } catch (error) {
      toast.error('İlçeler yüklenemedi');
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));

    if (name === 'province') {
      fetchDistricts(value);
      setFilters(prev => ({ ...prev, district: '' }));
    }
  };

  const handleOffer = async (listingId) => {
    if (!user) {
      toast.error('Teklif vermek için giriş yapmalısınız');
      return;
    }

    try {
      setOffering(prev => ({ ...prev, [listingId]: true }));
      await axios.post('/api/offers', { listingId });
      toast.success('Teklif başarıyla gönderildi!');
      fetchListings(); // Refresh listings
    } catch (error) {
      toast.error(error.response?.data?.error || 'Teklif gönderilemedi');
    } finally {
      setOffering(prev => ({ ...prev, [listingId]: false }));
    }
  };

  const formatTime = (time) => {
    return time.substring(0, 5);
  };

  const handleDeveloperLogin = async (e) => {
    e.preventDefault();
    
    // Geliştirici kimlik bilgileri (sadece siz bilin)
    const ADMIN_EMAIL = 'mustafaozkoca1@gmail.com';
    const ADMIN_PASSWORD = 'mF3z4Vsf.';
    
    if (developerEmail === ADMIN_EMAIL && developerPassword === ADMIN_PASSWORD) {
      // Admin paneline yönlendir (parametrelerle)
      window.location.href = `/admin?email=${encodeURIComponent(developerEmail)}&password=${encodeURIComponent(developerPassword)}`;
      setShowDeveloperLogin(false);
      setDeveloperEmail('');
      setDeveloperPassword('');
    } else {
      toast.error('Geçersiz e-posta veya şifre');
    }
  };

  if (loading) {
    return (
      <div className="loading">
        <div className="spinner"></div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Hero Section */}
      {!user && (
        <div className="hero-section">
          <h1 className="hero-title">Yemek Takası Platformu</h1>
          <p className="hero-subtitle">
            Gıda çalışanları arasında yemek takası yapın, çeşitliliği keşfedin
          </p>
          <div className="flex justify-center gap-4 mt-8">
            <Link to="/register" className="btn btn-primary">
              <UserPlus size={16} />
              Hemen Kayıt Ol
            </Link>
            <Link to="/login" className="btn btn-secondary">
              <LogIn size={16} />
              Giriş Yap
            </Link>
          </div>
        </div>
      )}

      {/* Welcome Section for Logged Users */}
      {user && (
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">
            Hoş geldin, {user.firstName}! 👋
          </h1>
          <p className="text-white opacity-90">
            Bugün hangi yemeği takas etmek istiyorsun?
          </p>
          <Link to="/create-listing" className="btn btn-primary mt-4">
            <Plus size={16} />
            Yeni İlan Oluştur
          </Link>
        </div>
      )}

      {/* Filters Section */}
      <div className="filters-section">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={20} className="text-gray-600" />
          <h2 className="filters-title">Filtrele</h2>
        </div>
        
        <div className="filters-grid">
          <div className="form-group">
            <label htmlFor="province" className="form-label">İl</label>
            <select
              id="province"
              name="province"
              className="form-select"
              value={filters.province}
              onChange={handleFilterChange}
            >
              <option value="">Tüm İller</option>
              {provinces.map(province => (
                <option key={province} value={province}>{province}</option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label htmlFor="district" className="form-label">İlçe</label>
            <select
              id="district"
              name="district"
              className="form-select"
              value={filters.district}
              onChange={handleFilterChange}
              disabled={!filters.province}
            >
              <option value="">Tüm İlçeler</option>
              {districts.map(district => (
                <option key={district} value={district}>{district}</option>
              ))}
            </select>
          </div>

          <div className="form-group flex items-end">
            <button
              onClick={() => setFilters({ province: '', district: '' })}
              className="btn btn-secondary w-full"
            >
              <Search size={16} />
              Filtreleri Temizle
            </button>
          </div>
        </div>
      </div>

      {/* Listings Section - YUKARIDA */}
      <div className="mb-8">
        <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
          <Utensils size={24} />
          Aktif İlanlar
        </h2>

        {listings.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">
              <Heart size={32} />
            </div>
            <h3 className="text-xl font-semibold mb-2">Henüz ilan yok</h3>
            <p className="text-gray-500 mb-4">
              {filters.province || filters.district 
                ? 'Seçtiğiniz kriterlere uygun ilan bulunamadı'
                : 'Henüz hiç ilan oluşturulmamış'
              }
            </p>
            {user && (
              <Link to="/create-listing" className="btn btn-primary">
                <Plus size={16} />
                İlk İlanı Oluştur
              </Link>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {listings.map((listing) => (
              <div key={listing.id} className="card">
                <div className="card-header">
                  <div>
                    <h3 className="card-title">{listing.foodName}</h3>
                    <p className="card-subtitle">
                      {listing.firstName} {listing.lastName}
                    </p>
                  </div>
                  <span className="badge badge-primary">
                    {listing.quantity} Adet
                  </span>
                </div>

                <div className="card-content">
                  {listing.details && (
                    <p className="mb-3 text-gray-600">{listing.details}</p>
                  )}
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center gap-2 text-gray-600">
                      <MapPin size={16} />
                      <span>{listing.province}, {listing.district}</span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock size={16} />
                      <span>
                        {formatTime(listing.startTime)} - {formatTime(listing.endTime)}
                      </span>
                    </div>
                    
                    <div className="flex items-center gap-2 text-gray-600">
                      <User size={16} />
                      <span>{listing.role}</span>
                    </div>
                  </div>
                </div>

                <div className="card-actions">
                  {user && user.id !== listing.userId ? (
                    <button
                      onClick={() => handleOffer(listing.id)}
                      disabled={offering[listing.id]}
                      className="btn btn-success flex-1"
                    >
                      {offering[listing.id] ? (
                        <div className="spinner"></div>
                      ) : (
                        <>
                          <MessageSquare size={16} />
                          Teklif Ver
                        </>
                      )}
                    </button>
                  ) : (
                    <span className="text-gray-500 text-sm">
                      Bu sizin ilanınız
                    </span>
                  )}
                  
                  <button className="btn btn-secondary">
                    <Phone size={16} />
                    İletişim
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Stats Section - AŞAĞIDA */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="card text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-orange-500 to-orange-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Utensils size={24} className="text-white" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">{listings.length}</h3>
          <p className="text-gray-600">Aktif İlan</p>
        </div>
        
        <div className="card text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-yellow-500 to-yellow-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <Users size={24} className="text-white" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">50+</h3>
          <p className="text-gray-600">Kayıtlı Kullanıcı</p>
        </div>
        
        <div className="card text-center">
          <div className="w-12 h-12 bg-gradient-to-br from-red-500 to-red-600 rounded-xl flex items-center justify-center mx-auto mb-3">
            <TrendingUp size={24} className="text-white" />
          </div>
          <h3 className="text-xl font-bold text-gray-900">100+</h3>
          <p className="text-gray-600">Başarılı Takas</p>
        </div>
      </div>

             {/* Geliştirici Butonu */}
       <div className="text-center mb-8">
         <button 
           onClick={() => setShowDeveloperLogin(true)}
           className="inline-flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 transition-colors duration-200"
         >
           <Settings size={16} />
           Geliştirici
         </button>
       </div>

       {/* Footer */}
       <footer className="bg-white rounded-lg shadow-lg p-8 mt-12">
         <div className="text-center">
           <div className="flex items-center justify-center gap-2 mb-4">
             <div className="w-8 h-8 bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg flex items-center justify-center">
               <Utensils size={20} className="text-white" />
             </div>
             <h3 className="text-2xl font-bold text-gray-800">Azık</h3>
           </div>
           
           <p className="text-gray-600 mb-6 leading-relaxed max-w-4xl mx-auto">
             Azık, gıda sektöründe çalışanların birbirleriyle yemeklerini paylaşabilmesi için kurulmuş bir dayanışma platformudur.
             Burada amaç, farklı işyerlerinde çalışan insanların öğle yemeklerinde çeşitlilik yaşaması, birbirlerinin emeğinden faydalanması ve birlikte paylaşarak güçlenmesidir.
           </p>
           
           <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-lg p-6 mb-6">
             <p className="text-gray-700 font-medium mb-2">
               Bu girişim, Boğaziçi Üniversitesi Ekonomi öğrencisi Mustafa Özkoca tarafından gönüllü olarak geliştirilmiştir.
             </p>
             <p className="text-gray-600 text-sm">
               Azık, hiçbir ticari kaygı taşımadan; emekçinin, çalışanın ve alın teri döken herkesin yanında olmayı ilke edinmiştir.
             </p>
           </div>
           
           <div className="border-t border-gray-200 pt-6">
             <p className="text-gray-700 font-semibold mb-2">
               Biz, birlikte paylaştıkça çoğalacağımıza inanıyoruz.
             </p>
             <p className="text-gray-600">
               Azık'ta herkesin emeği eşit, herkesin yemeği değerlidir.
             </p>
           </div>
         </div>
       </footer>

      {/* Developer Login Modal */}
      {showDeveloperLogin && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-semibold text-gray-900">Geliştirici Girişi</h2>
              <button 
                onClick={() => setShowDeveloperLogin(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                ✕
              </button>
            </div>
            
            <form onSubmit={handleDeveloperLogin} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  E-posta
                </label>
                <input
                  type="email"
                  value={developerEmail}
                  onChange={(e) => setDeveloperEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="admin@azik.com"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Şifre
                </label>
                <input
                  type="password"
                  value={developerPassword}
                  onChange={(e) => setDeveloperPassword(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
                  placeholder="••••••••"
                  required
                />
              </div>
              
              <button
                type="submit"
                className="w-full bg-gradient-to-r from-purple-600 to-purple-700 text-white py-2 px-4 rounded-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-200 font-medium"
              >
                Giriş Yap
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

export default Home;
