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
  LogIn
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
      console.error('İlanlar yüklenemedi:', error);
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
    </div>
  );
}

export default Home;
