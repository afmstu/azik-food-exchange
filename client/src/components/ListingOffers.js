import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { Package, User, Phone, Calendar, CheckCircle, XCircle } from 'lucide-react';

function ListingOffers() {
  const [offers, setOffers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchOffers();
  }, []);

  const fetchOffers = async () => {
    try {
      setLoading(true);
      const response = await axios.get('/api/listing-offers');
      setOffers(response.data);
    } catch (error) {
      toast.error('Teklifler yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const handleOfferAction = async (offerId, action) => {
    try {
      await axios.put(`/api/offers/${offerId}`, { status: action });
      toast.success(`Teklif ${action === 'accepted' ? 'kabul edildi' : 'reddedildi'}`);
      fetchOffers(); // Refresh offers
    } catch (error) {
      toast.error('İşlem başarısız');
    }
  };

  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadge = (status) => {
    switch (status) {
      case 'pending':
        return <span className="badge badge-warning">Beklemede</span>;
      case 'accepted':
        return <span className="badge badge-success">Kabul Edildi</span>;
      case 'rejected':
        return <span className="badge badge-danger">Reddedildi</span>;
      default:
        return <span className="badge badge-info">{status}</span>;
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          Gelen Teklifler
        </h1>
        <p className="text-gray-600">
          İlanlarınıza gelen takas teklifleri
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Teklifler yükleniyor...</p>
        </div>
      ) : offers.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-gray-500 text-2xl">📥</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Henüz teklif almadınız
          </h3>
          <p className="text-gray-600 mb-4">
            İlanlarınız için teklif gelmesini bekleyin veya yeni ilan oluşturun!
          </p>
          <a href="/create-listing" className="btn btn-primary">
            <Package size={16} />
            Yeni İlan Oluştur
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {offers.map(offer => (
            <div key={offer.id} className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">{offer.foodName}</h3>
                  <p className="text-sm text-gray-500">
                    {offer.quantity} adet
                  </p>
                </div>
                {getStatusBadge(offer.status)}
              </div>
              
              <div className="space-y-3 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <User size={16} />
                  <span>{offer.firstName} {offer.lastName}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Phone size={16} />
                  <span>{offer.phone}</span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar size={16} />
                  <span>{formatDate(offer.createdAt)}</span>
                </div>
              </div>
              
              {offer.status === 'pending' && (
                <div className="space-y-3">
                  <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                    <p className="text-yellow-800 text-sm">
                      ⏳ Bu teklifi değerlendirmeniz bekleniyor
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleOfferAction(offer.id, 'accepted')}
                      className="btn btn-success flex-1"
                    >
                      <CheckCircle size={16} />
                      Kabul Et
                    </button>
                    <button
                      onClick={() => handleOfferAction(offer.id, 'rejected')}
                      className="btn btn-danger flex-1"
                    >
                      <XCircle size={16} />
                      Reddet
                    </button>
                  </div>
                </div>
              )}
              
              {offer.status === 'accepted' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-green-800 text-sm font-semibold mb-2">
                    ✅ Bu teklifi kabul ettiniz
                  </p>
                  <p className="text-green-700 text-sm">
                    Yukarıdaki telefon numarasından iletişime geçebilirsiniz.
                  </p>
                </div>
              )}
              
              {offer.status === 'rejected' && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-3">
                  <p className="text-red-800 text-sm">
                    ❌ Bu teklifi reddettiniz
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default ListingOffers;
