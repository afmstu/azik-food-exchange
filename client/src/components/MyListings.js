import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { Clock, Package, Calendar, Trash2, AlertTriangle } from 'lucide-react';

function MyListings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [deleting, setDeleting] = useState({});
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(null);

  useEffect(() => {
    fetchListings();
  }, []);

  const fetchListings = async () => {
    try {
      setLoading(true);
      console.log('Fetching my listings...');
      const response = await axios.get('/api/my-listings');
      console.log('My listings response:', response.data);
      setListings(response.data);
    } catch (error) {
      console.error('Error fetching my listings:', error);
      toast.error('İlanlar yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const formatTime = (time) => {
    return time.substring(0, 5);
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
      case 'active':
        return <span className="badge badge-success">Aktif</span>;
      case 'completed':
        return <span className="badge badge-info">Tamamlandı</span>;
      default:
        return <span className="badge badge-warning">{status}</span>;
    }
  };

  const handleDeleteClick = (listingId) => {
    setShowDeleteConfirm(listingId);
  };

  const handleDeleteConfirm = async (listingId) => {
    try {
      setDeleting(prev => ({ ...prev, [listingId]: true }));
      await axios.delete(`/api/listings/${listingId}`);
      toast.success('İlan başarıyla silindi');
      setShowDeleteConfirm(null);
      fetchListings(); // Refresh the list
    } catch (error) {
      toast.error(error.response?.data?.error || 'İlan silinemedi');
    } finally {
      setDeleting(prev => ({ ...prev, [listingId]: false }));
    }
  };

  const handleDeleteCancel = () => {
    setShowDeleteConfirm(null);
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">
          İlanlarım
        </h1>
        <p className="text-gray-600">
          Oluşturduğunuz yemek takası ilanları
        </p>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-green-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">İlanlar yükleniyor...</p>
        </div>
      ) : listings.length === 0 ? (
        <div className="text-center py-12">
          <div className="w-16 h-16 bg-gray-200 rounded-lg flex items-center justify-center mx-auto mb-4">
            <span className="text-gray-500 text-2xl">📝</span>
          </div>
          <h3 className="text-lg font-semibold text-gray-900 mb-2">
            Henüz ilan oluşturmadınız
          </h3>
          <p className="text-gray-600 mb-4">
            İlk ilanınızı oluşturarak yemek takasına başlayın!
          </p>
          <a href="/create-listing" className="btn btn-primary">
            <Package size={16} />
            İlan Oluştur
          </a>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {listings.map(listing => (
            <div key={listing.id} className="card">
              <div className="card-header">
                <div>
                  <h3 className="card-title">{listing.foodName}</h3>
                  <p className="text-sm text-gray-500">
                    {listing.quantity} adet
                  </p>
                </div>
                {getStatusBadge(listing.status)}
              </div>
              
              {listing.details && (
                <p className="text-gray-700 mb-4">{listing.details}</p>
              )}
              
              <div className="space-y-2 mb-4">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Clock size={16} />
                  <span>
                    {formatTime(listing.startTime)} - {formatTime(listing.endTime)}
                  </span>
                </div>
                
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Calendar size={16} />
                  <span>{formatDate(listing.createdAt)}</span>
                </div>
              </div>
              
              {listing.status === 'active' && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-3">
                  <p className="text-green-800 text-sm">
                    ✅ Bu ilan aktif ve teklif almaya açık
                  </p>
                </div>
              )}
              
              {listing.status === 'completed' && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                  <p className="text-blue-800 text-sm">
                    🎉 Bu ilan için teklif kabul edildi
                  </p>
                </div>
              )}

              {/* Delete Button */}
              <div className="mt-4 pt-4 border-t border-gray-200">
                <button
                  onClick={() => handleDeleteClick(listing.id)}
                  disabled={deleting[listing.id]}
                  className="btn btn-danger w-full"
                >
                  {deleting[listing.id] ? (
                    <div className="spinner"></div>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      İlanı Sil
                    </>
                  )}
                </button>
              </div>

              {/* Delete Confirmation Modal */}
              {showDeleteConfirm === listing.id && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
                  <div className="bg-white rounded-lg p-6 max-w-md mx-4">
                    <div className="flex items-center gap-3 mb-4">
                      <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center">
                        <AlertTriangle size={24} className="text-red-600" />
                      </div>
                      <div>
                        <h3 className="text-lg font-semibold text-gray-900">
                          İlanı Sil
                        </h3>
                        <p className="text-gray-600">
                          Bu işlem geri alınamaz
                        </p>
                      </div>
                    </div>
                    
                    <p className="text-gray-700 mb-6">
                      <strong>"{listing.foodName}"</strong> ilanını silmek istediğinizden emin misiniz? 
                      Bu ilana verilen tüm teklifler de silinecektir.
                    </p>
                    
                    <div className="flex gap-3">
                      <button
                        onClick={handleDeleteCancel}
                        className="btn btn-secondary flex-1"
                      >
                        İptal
                      </button>
                      <button
                        onClick={() => handleDeleteConfirm(listing.id)}
                        disabled={deleting[listing.id]}
                        className="btn btn-danger flex-1"
                      >
                        {deleting[listing.id] ? (
                          <div className="spinner"></div>
                        ) : (
                          'Evet, Sil'
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default MyListings;
