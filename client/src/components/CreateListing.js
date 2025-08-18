import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { 
  Utensils, 
  Hash, 
  FileText, 
  Clock, 
  Plus, 
  ArrowRight,
  Save
} from 'lucide-react';

function CreateListing() {
  const [formData, setFormData] = useState({
    foodName: '',
    quantity: '',
    details: '',
    startTime: '',
    endTime: ''
  });
  const [loading, setLoading] = useState(false);
  
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
    
    if (!formData.foodName || !formData.quantity || !formData.startTime || !formData.endTime) {
      toast.error('Lütfen tüm zorunlu alanları doldurun');
      return;
    }

    if (parseInt(formData.quantity) <= 0) {
      toast.error('Adet 0\'dan büyük olmalıdır');
      return;
    }

    if (formData.startTime >= formData.endTime) {
      toast.error('Bitiş saati başlangıç saatinden sonra olmalıdır');
      return;
    }

    setLoading(true);

    try {
      await axios.post('/api/listings', formData);
      toast.success('İlan başarıyla oluşturuldu!');
      navigate('/');
    } catch (error) {
      toast.error(error.response?.data?.error || 'İlan oluşturulamadı');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4">
      <div className="form-container" style={{ maxWidth: '600px' }}>
        <div className="text-center mb-8">
          <div className="w-16 h-16 bg-gradient-to-br from-orange-500 to-yellow-500 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Plus size={32} className="text-white" />
          </div>
          <h1 className="form-title">Yeni İlan Oluştur</h1>
          <p className="form-subtitle">
            Takas etmek istediğiniz yemeği paylaşın
          </p>
        </div>
        
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="form-group">
            <label htmlFor="foodName" className="form-label">
              <Utensils size={16} className="inline mr-2" />
              Yemek Adı *
            </label>
            <input
              id="foodName"
              name="foodName"
              type="text"
              required
              className="form-input"
              placeholder="Örn: Pizza, Döner, Lahmacun..."
              value={formData.foodName}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="quantity" className="form-label">
              <Hash size={16} className="inline mr-2" />
              Adet *
            </label>
            <input
              id="quantity"
              name="quantity"
              type="number"
              required
              min="1"
              className="form-input"
              placeholder="Kaç adet?"
              value={formData.quantity}
              onChange={handleChange}
            />
          </div>

          <div className="form-group">
            <label htmlFor="details" className="form-label">
              <FileText size={16} className="inline mr-2" />
              Detaylar (Opsiyonel)
            </label>
            <textarea
              id="details"
              name="details"
              className="form-textarea"
              placeholder="Yemek hakkında detaylar, özel notlar, alerjiler vb."
              rows="4"
              value={formData.details}
              onChange={handleChange}
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="form-group">
              <label htmlFor="startTime" className="form-label">
                <Clock size={16} className="inline mr-2" />
                Başlangıç Saati *
              </label>
              <input
                id="startTime"
                name="startTime"
                type="time"
                required
                className="form-input"
                value={formData.startTime}
                onChange={handleChange}
              />
            </div>
            
            <div className="form-group">
              <label htmlFor="endTime" className="form-label">
                <Clock size={16} className="inline mr-2" />
                Bitiş Saati *
              </label>
              <input
                id="endTime"
                name="endTime"
                type="time"
                required
                className="form-input"
                value={formData.endTime}
                onChange={handleChange}
              />
            </div>
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <Clock size={16} />
              İlan Süresi
            </h3>
            <p className="text-blue-700 text-sm">
              İlanınız belirttiğiniz saatler arasında aktif olacak. 
              Bu süre zarfında diğer kullanıcılar size teklif verebilecek.
            </p>
          </div>

          <div className="flex gap-4">
            <button
              type="button"
              onClick={() => navigate('/')}
              className="btn btn-secondary flex-1"
            >
              İptal
            </button>
            
            <button
              type="submit"
              disabled={loading}
              className="btn btn-primary flex-1"
            >
              {loading ? (
                <div className="spinner"></div>
              ) : (
                <>
                  <Save size={16} />
                  İlanı Oluştur
                  <ArrowRight size={16} />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default CreateListing;
