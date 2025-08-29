import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { logAnalyticsEvent } from '../firebase';
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
  const [provincesRetryCount, setProvincesRetryCount] = useState(0);
  const [listingsRetryCount, setListingsRetryCount] = useState(0);
  const [isMobile, setIsMobile] = useState(false);
  const [networkStatus, setNetworkStatus] = useState('online');
  const [loadingMessageIndex, setLoadingMessageIndex] = useState(0);

  const { user } = useAuth();

  // Loading mesajları
  const loadingMessages = [
    "🍳 Yemekler getiriliyor...",
    "🔍 İlanlar taranıyor...",
    "🥘 Lezzetli tarifler aranıyor...",
    "🍽️ Sofralar hazırlanıyor...",
    "👨‍🍳 Şefler çalışıyor...",
    "🥄 Karıştırılıyor...",
    "🔥 Ocaklar yakılıyor...",
    "🌶️ Baharatlar ekleniyor..."
  ];

  // Loading mesajlarını döndür
  useEffect(() => {
    if (loading) {
      const interval = setInterval(() => {
        setLoadingMessageIndex(prev => (prev + 1) % loadingMessages.length);
      }, 2000);
      return () => clearInterval(interval);
    }
  }, [loading, loadingMessages.length]);

  // Mobil cihaz kontrolü
  useEffect(() => {
    const checkMobile = () => {
      const userAgent = navigator.userAgent || navigator.vendor || window.opera;
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent.toLowerCase());
      setIsMobile(isMobileDevice);
    };
    
    checkMobile();
  }, []);

  // Network status kontrolü
  useEffect(() => {
    const updateNetworkStatus = () => {
      setNetworkStatus(navigator.onLine ? 'online' : 'offline');
    };

    window.addEventListener('online', updateNetworkStatus);
    window.addEventListener('offline', updateNetworkStatus);
    updateNetworkStatus();

    return () => {
      window.removeEventListener('online', updateNetworkStatus);
      window.removeEventListener('offline', updateNetworkStatus);
    };
  }, []);

  useEffect(() => {
    fetchListings();
    fetchProvinces();
  }, [filters]);

  const fetchListings = async () => {
    // Network offline ise API çağrısı yapma
    if (networkStatus === 'offline') {
      console.log('Network offline, skipping listings fetch');
      toast.error('İnternet bağlantısı yok. İlanlar yüklenemedi.');
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.province) params.append('province', filters.province);
      if (filters.district) params.append('district', filters.district);
      
      console.log('Fetching listings from:', axios.defaults.baseURL + '/api/listings?' + params.toString());
      console.log('Is mobile device:', isMobile);
      
      const response = await axios.get(`/api/listings?${params.toString()}`);
      console.log('Listings response count:', response.data.length);
      setListings(response.data);
      setListingsRetryCount(0); // Başarılı olursa retry sayısını sıfırla
    } catch (error) {
      console.error('Listings fetch error:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        isMobile: isMobile
      });
      
      // Mobil cihazlarda retry logic
      if (isMobile && listingsRetryCount < 2) {
        console.log(`Retrying listings fetch (attempt ${listingsRetryCount + 1})...`);
        setListingsRetryCount(prev => prev + 1);
        setTimeout(() => fetchListings(), 2000); // 2 saniye sonra tekrar dene
        return;
      }
      
      // Daha detaylı hata mesajı
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        toast.error('İlanlar yüklenemedi: Bağlantı zaman aşımı');
      } else if (error.response?.status === 404) {
        toast.error('İlanlar yüklenemedi: API endpoint bulunamadı');
      } else if (error.response?.status >= 500) {
        toast.error('İlanlar yüklenemedi: Sunucu hatası');
      } else {
        toast.error('İlanlar yüklenemedi: ' + (error.response?.data?.error || error.message));
      }
      setListings([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchProvinces = async () => {
    // Network offline ise API çağrısı yapma
    if (networkStatus === 'offline') {
      console.log('Network offline, skipping provinces fetch');
      toast.error('İnternet bağlantısı yok. İller yüklenemedi.');
      return;
    }

    try {
      console.log('Fetching provinces from:', axios.defaults.baseURL + '/api/provinces');
      console.log('Is mobile device:', isMobile);
      
      const response = await axios.get('/api/provinces');
      console.log('Provinces response:', response.data);
      setProvinces(response.data);
      setProvincesRetryCount(0); // Başarılı olursa retry sayısını sıfırla
    } catch (error) {
      console.error('Provinces fetch error:', error);
      console.error('Error details:', {
        message: error.message,
        code: error.code,
        response: error.response?.data,
        status: error.response?.status,
        isMobile: isMobile
      });
      
      // Mobil cihazlarda retry logic
      if (isMobile && provincesRetryCount < 2) {
        console.log(`Retrying provinces fetch (attempt ${provincesRetryCount + 1})...`);
        setProvincesRetryCount(prev => prev + 1);
        setTimeout(() => fetchProvinces(), 2000); // 2 saniye sonra tekrar dene
        return;
      }
      
      // Daha detaylı hata mesajı
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        toast.error('İller yüklenemedi: Bağlantı zaman aşımı');
      } else if (error.response?.status === 404) {
        toast.error('İller yüklenemedi: API endpoint bulunamadı');
      } else if (error.response?.status >= 500) {
        toast.error('İller yüklenemedi: Sunucu hatası');
      } else {
        toast.error('İller yüklenemedi: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  const fetchDistricts = async (province) => {
    if (!province) {
      setDistricts([]);
      return;
    }
    
    try {
      console.log('Fetching districts for:', province);
      const response = await axios.get(`/api/districts/${province}`);
      console.log('Districts response:', response.data);
      setDistricts(response.data);
    } catch (error) {
      console.error('Districts fetch error:', error);
      
      // Daha detaylı hata mesajı
      if (error.code === 'ECONNABORTED' || error.message.includes('timeout')) {
        toast.error('İlçeler yüklenemedi: Bağlantı zaman aşımı');
      } else if (error.response?.status === 404) {
        toast.error('İlçeler yüklenemedi: API endpoint bulunamadı');
      } else if (error.response?.status >= 500) {
        toast.error('İlçeler yüklenemedi: Sunucu hatası');
      } else {
        toast.error('İlçeler yüklenemedi: ' + (error.response?.data?.error || error.message));
      }
    }
  };

  // Memoize expensive calculations
  const filteredListings = useMemo(() => {
    return listings.filter(listing => {
      if (filters.province && listing.province !== filters.province) return false;
      if (filters.district && listing.district !== filters.district) return false;
      return true;
    });
  }, [listings, filters]);

  // Memoize callback functions
  const handleFilterChange = useCallback((e) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));

    if (name === 'province') {
      fetchDistricts(value);
      setFilters(prev => ({ ...prev, district: '' }));
    }
  }, []);

  const handleOffer = useCallback(async (listingId) => {
    if (!user) {
      toast.error('Teklif vermek için giriş yapmalısınız');
      return;
    }

    if (offering[listingId]) return;

    try {
      setOffering(prev => ({ ...prev, [listingId]: true }));
      await axios.post('/api/offers', { listingId });
      
      // Log offer event
      logAnalyticsEvent('offer_sent', {
        listing_id: listingId
      });
      
      toast.success('Teklif başarıyla gönderildi');
      fetchListings(); // Refresh listings
    } catch (error) {
      toast.error(error.response?.data?.error || 'Teklif gönderilemedi');
    } finally {
      setOffering(prev => ({ ...prev, [listingId]: false }));
    }
  }, [user, offering]);

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
      <div className="loading min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-orange-50 to-yellow-50">
        {/* Tencere Animasyonu */}
        <div className="relative mb-8">
          {/* Tencere */}
          <div className="w-24 h-20 bg-gradient-to-b from-gray-700 to-gray-800 rounded-full relative overflow-hidden pot-slide">
            {/* Tencere içi */}
            <div className="absolute inset-2 bg-gradient-to-b from-orange-200 to-orange-300 rounded-full"></div>
            
            {/* Pişen yemek kabarcıkları */}
            <div className="absolute bottom-2 left-3 w-2 h-2 bg-orange-400 rounded-full cooking-bubble"></div>
            <div className="absolute bottom-3 right-4 w-1.5 h-1.5 bg-orange-400 rounded-full cooking-bubble" style={{animationDelay: '0.5s'}}></div>
            <div className="absolute bottom-1 left-1/2 w-1 h-1 bg-orange-400 rounded-full cooking-bubble" style={{animationDelay: '1s'}}></div>
            
            {/* Buhar */}
            <div className="absolute -top-2 left-1/2 transform -translate-x-1/2">
              <div className="w-2 h-4 bg-gray-300 rounded-full steam-rise"></div>
            </div>
            <div className="absolute -top-1 left-1/3 transform -translate-x-1/2">
              <div className="w-1.5 h-3 bg-gray-300 rounded-full steam-rise" style={{animationDelay: '0.5s'}}></div>
            </div>
            <div className="absolute -top-1 right-1/3 transform translate-x-1/2">
              <div className="w-1.5 h-3 bg-gray-300 rounded-full steam-rise" style={{animationDelay: '1s'}}></div>
            </div>
          </div>
          
          {/* Tencere Kolu */}
          <div className="absolute -top-2 left-1/2 transform -translate-x-1/2 w-16 h-2 bg-gray-600 rounded-full"></div>
          
          {/* Kayma Efekti */}
          <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white to-transparent opacity-30 animate-pulse"></div>
        </div>

        {/* Dönen Mesajlar */}
        <div className="text-center">
          <div className="text-2xl font-bold text-orange-600 mb-4 message-fade">
            {loadingMessages[loadingMessageIndex]}
          </div>
          
          {/* Progress Bar */}
          <div className="w-64 h-2 bg-gray-200 rounded-full overflow-hidden">
            <div className="h-full bg-gradient-to-r from-orange-400 to-orange-600 rounded-full animate-pulse"></div>
          </div>
          
          {isMobile && (
            <p className="text-center mt-4 text-gray-600 text-sm">
              Mobil cihazda yükleniyor... Bu biraz zaman alabilir
            </p>
          )}
        </div>

        {/* Yemek İkonları Animasyonu */}
        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-10 left-10 text-2xl animate-bounce" style={{animationDelay: '0.5s', animationDuration: '2s'}}>🍕</div>
          <div className="absolute top-20 right-20 text-2xl animate-bounce" style={{animationDelay: '1s', animationDuration: '2.5s'}}>🍔</div>
          <div className="absolute bottom-20 left-20 text-2xl animate-bounce" style={{animationDelay: '1.5s', animationDuration: '2.2s'}}>🍜</div>
          <div className="absolute bottom-10 right-10 text-2xl animate-bounce" style={{animationDelay: '2s', animationDuration: '2.8s'}}>🍣</div>
          <div className="absolute top-1/2 left-5 text-2xl animate-bounce" style={{animationDelay: '0.8s', animationDuration: '2.3s'}}>🥘</div>
          <div className="absolute top-1/2 right-5 text-2xl animate-bounce" style={{animationDelay: '1.2s', animationDuration: '2.6s'}}>🍖</div>
          <div className="absolute top-1/3 left-1/4 text-xl animate-bounce" style={{animationDelay: '0.3s', animationDuration: '2.1s'}}>🥗</div>
          <div className="absolute bottom-1/3 right-1/4 text-xl animate-bounce" style={{animationDelay: '1.8s', animationDuration: '2.4s'}}>🍝</div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      {/* Debug Section - sadece development'ta göster */}
      {process.env.NODE_ENV === 'development' && (
        <div className="bg-gray-800 p-4 rounded-lg mb-4 text-sm">
          <h3 className="text-white font-bold mb-2">🔧 Debug Bilgileri</h3>
          <p className="text-gray-300">API URL: {axios.defaults.baseURL}</p>
          <p className="text-gray-300">Mobil Cihaz: {isMobile ? 'Evet' : 'Hayır'}</p>
          <p className="text-gray-300">Network: {networkStatus}</p>
          <p className="text-gray-300">Provinces Count: {provinces.length}</p>
          <p className="text-gray-300">Listings Count: {listings.length}</p>
          <p className="text-gray-300">Loading: {loading ? 'Evet' : 'Hayır'}</p>
          <p className="text-gray-300">Provinces Retry: {provincesRetryCount}</p>
          <p className="text-gray-300">Listings Retry: {listingsRetryCount}</p>
          <div className="flex gap-2 mt-2">
            <button 
              onClick={() => {
                console.log('Manual provinces fetch...');
                fetchProvinces();
              }}
              className="bg-blue-500 text-white px-3 py-1 rounded text-xs"
            >
              İlleri Yeniden Yükle
            </button>
            <button 
              onClick={() => {
                console.log('Manual listings fetch...');
                fetchListings();
              }}
              className="bg-green-500 text-white px-3 py-1 rounded text-xs"
            >
              İlanları Yeniden Yükle
            </button>
          </div>
        </div>
      )}

      {/* Network Status Warning - Mobil için */}
      {isMobile && networkStatus === 'offline' && (
        <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-4">
          <div className="flex items-center">
            <div className="w-4 h-4 bg-red-500 rounded-full mr-2"></div>
            <strong>İnternet Bağlantısı Yok!</strong>
          </div>
          <p className="text-sm mt-1">
            İlanlar ve iller yüklenemiyor. Lütfen internet bağlantınızı kontrol edin.
          </p>
        </div>
      )}

      {/* Mobil için Retry Button - Veri yüklenemezse */}
      {isMobile && !loading && provinces.length === 0 && listings.length === 0 && networkStatus === 'online' && (
        <div className="bg-yellow-100 border border-yellow-400 text-yellow-700 px-4 py-3 rounded mb-4">
          <div className="flex items-center justify-between">
            <div>
              <strong>Veri Yüklenemedi</strong>
              <p className="text-sm mt-1">
                İlanlar ve iller yüklenemedi. Tekrar denemek için butona tıklayın.
              </p>
            </div>
            <button 
              onClick={() => {
                setProvincesRetryCount(0);
                setListingsRetryCount(0);
                fetchProvinces();
                fetchListings();
              }}
              className="bg-yellow-500 text-white px-4 py-2 rounded text-sm hover:bg-yellow-600"
            >
              Tekrar Dene
            </button>
          </div>
        </div>
      )}

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

        {filteredListings.length === 0 ? (
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
            {filteredListings.map((listing) => (
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
                      <span>
                        {listing.province}, {listing.district}
                        {listing.neighborhood && `, ${listing.neighborhood}`}
                      </span>
                    </div>
                    
                    {listing.fullAddress && (
                      <div className="flex items-start gap-2 text-gray-600">
                        <MapPin size={16} className="mt-0.5 flex-shrink-0" />
                        <span className="text-xs leading-relaxed">
                          {listing.fullAddress}
                        </span>
                      </div>
                    )}
                    
                    <div className="flex items-center gap-2 text-gray-600">
                      <Clock size={16} />
                      <span>
                        {formatTime(listing.startTime)} - {formatTime(listing.endTime)}
                      </span>
                    </div>
                    

                  </div>
                </div>

                <div className="card-actions">
                  {!user ? (
                    <Link to="/login" className="btn btn-success flex-1">
                      <MessageSquare size={16} />
                      Teklif Ver
                    </Link>
                  ) : user.id === listing.userId ? (
                    <span className="text-gray-500 text-sm">
                      Bu sizin ilanınız
                    </span>
                  ) : (
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

        {/* Geliştirici Butonu - Şık Tasarım */}
        <div className="text-center mt-8 mb-8">
          <div className="inline-flex items-center gap-3 px-6 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-full shadow-lg hover:from-purple-700 hover:to-purple-800 transition-all duration-300 transform hover:scale-105 cursor-pointer" onClick={() => setShowDeveloperLogin(true)}>
            <Settings size={18} className="animate-pulse" />
            <span className="font-medium">Geliştirici Girişi</span>
            <div className="w-2 h-2 bg-white rounded-full animate-bounce"></div>
          </div>
          <p className="text-xs text-gray-500 mt-2 opacity-75">Sadece geliştiriciler için</p>
        </div>

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

export default React.memo(Home);
