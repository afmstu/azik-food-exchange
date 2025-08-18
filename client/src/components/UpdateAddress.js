import React, { useState, useEffect } from 'react';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { MapPin, Save, Loader } from 'lucide-react';

function UpdateAddress() {
  const [formData, setFormData] = useState({
    province: '',
    district: '',
    neighborhood: '',
    fullAddress: ''
  });
  const [provinces, setProvinces] = useState([]);
  const [districts, setDistricts] = useState([]);
  const [neighborhoods, setNeighborhoods] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    fetchProvinces();
    fetchUserProfile();
  }, []);

  const fetchProvinces = async () => {
    try {
      const response = await axios.get('/api/provinces');
      setProvinces(response.data);
    } catch (error) {
      toast.error('İller yüklenemedi');
    }
  };

  const fetchUserProfile = async () => {
    try {
      const response = await axios.get('/api/user/profile');
      const user = response.data;
      setFormData({
        province: user.province || '',
        district: user.district || '',
        neighborhood: user.neighborhood || '',
        fullAddress: user.fullAddress || ''
      });
      
      // Load districts and neighborhoods for current province
      if (user.province) {
        await fetchDistricts(user.province);
        if (user.district) {
          await fetchNeighborhoods(user.province, user.district);
        }
      }
    } catch (error) {
      toast.error('Kullanıcı bilgileri yüklenemedi');
    } finally {
      setLoading(false);
    }
  };

  const fetchDistricts = async (province) => {
    try {
      const response = await axios.get(`/api/districts/${province}`);
      setDistricts(response.data);
    } catch (error) {
      toast.error('İlçeler yüklenemedi');
    }
  };

  const fetchNeighborhoods = async (province, district) => {
    try {
      const response = await axios.get(`/api/neighborhoods/${province}/${district}`);
      setNeighborhoods(response.data);
    } catch (error) {
      toast.error('Mahalleler yüklenemedi');
    }
  };

  const handleProvinceChange = async (e) => {
    const province = e.target.value;
    setFormData(prev => ({
      ...prev,
      province,
      district: '',
      neighborhood: ''
    }));
    setDistricts([]);
    setNeighborhoods([]);

    if (province) {
      await fetchDistricts(province);
    }
  };

  const handleDistrictChange = async (e) => {
    const district = e.target.value;
    setFormData(prev => ({
      ...prev,
      district,
      neighborhood: ''
    }));
    setNeighborhoods([]);

    if (district) {
      await fetchNeighborhoods(formData.province, district);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.province || !formData.district || !formData.neighborhood || !formData.fullAddress) {
      toast.error('Lütfen tüm alanları doldurun');
      return;
    }

    try {
      setSaving(true);
      await axios.put('/api/user/address', formData);
      toast.success('Adres başarıyla güncellendi');
    } catch (error) {
      toast.error(error.response?.data?.error || 'Adres güncellenemedi');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-orange-600 mx-auto"></div>
        <p className="mt-4 text-gray-600">Bilgiler yükleniyor...</p>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-2 flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-r from-orange-400 to-yellow-400 rounded-lg flex items-center justify-center">
            <MapPin size={24} className="text-white" />
          </div>
          Adres Güncelle
        </h1>
        <p className="text-gray-600">
          Adres bilgilerinizi güncelleyin
        </p>
      </div>

      <div className="card">
        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Province Selection */}
          <div>
            <label className="form-label">
              <MapPin size={16} />
              İl *
            </label>
            <select
              name="province"
              value={formData.province}
              onChange={handleProvinceChange}
              className="form-select"
              required
            >
              <option value="">İl seçin</option>
              {provinces.map(province => (
                <option key={province} value={province}>
                  {province}
                </option>
              ))}
            </select>
          </div>

          {/* District Selection */}
          <div>
            <label className="form-label">
              <MapPin size={16} />
              İlçe *
            </label>
            <select
              name="district"
              value={formData.district}
              onChange={handleDistrictChange}
              className="form-select"
              required
              disabled={!formData.province}
            >
              <option value="">İlçe seçin</option>
              {districts.map(district => (
                <option key={district} value={district}>
                  {district}
                </option>
              ))}
            </select>
          </div>

          {/* Neighborhood Selection */}
          <div>
            <label className="form-label">
              <MapPin size={16} />
              Mahalle *
            </label>
            <select
              name="neighborhood"
              value={formData.neighborhood}
              onChange={handleInputChange}
              className="form-select"
              required
              disabled={!formData.district}
            >
              <option value="">Mahalle seçin</option>
              {neighborhoods.map(neighborhood => (
                <option key={neighborhood} value={neighborhood}>
                  {neighborhood}
                </option>
              ))}
            </select>
          </div>

          {/* Full Address */}
          <div>
            <label className="form-label">
              <MapPin size={16} />
              Tam Adres *
            </label>
            <textarea
              name="fullAddress"
              value={formData.fullAddress}
              onChange={handleInputChange}
              className="form-textarea"
              rows={4}
              placeholder="Sokak, cadde, bina no, daire no vb."
              required
            />
          </div>

          {/* Submit Button */}
          <div className="pt-4">
            <button
              type="submit"
              disabled={saving}
              className="btn btn-primary w-full"
            >
              {saving ? (
                <>
                  <Loader size={16} className="animate-spin" />
                  Güncelleniyor...
                </>
              ) : (
                <>
                  <Save size={16} />
                  Adresi Güncelle
                </>
              )}
            </button>
          </div>
        </form>
      </div>

      {/* Current Address Display */}
      <div className="mt-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Mevcut Adres</h2>
        <div className="card bg-gray-50">
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-gray-500" />
              <span className="text-gray-700">
                <strong>İl:</strong> {formData.province || 'Belirtilmemiş'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-gray-500" />
              <span className="text-gray-700">
                <strong>İlçe:</strong> {formData.district || 'Belirtilmemiş'}
              </span>
            </div>
            <div className="flex items-center gap-2">
              <MapPin size={16} className="text-gray-500" />
              <span className="text-gray-700">
                <strong>Mahalle:</strong> {formData.neighborhood || 'Belirtilmemiş'}
              </span>
            </div>
            <div className="flex items-start gap-2">
              <MapPin size={16} className="text-gray-500 mt-0.5" />
              <span className="text-gray-700">
                <strong>Tam Adres:</strong> {formData.fullAddress || 'Belirtilmemiş'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default UpdateAddress;
