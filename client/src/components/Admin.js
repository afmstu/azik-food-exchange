import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { Users, Trash2, Eye, Shield } from 'lucide-react';

function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Geliştirici kimlik bilgileri kontrolü
  const ADMIN_EMAIL = 'mustafaozkoca1@gmail.com';
  const ADMIN_PASSWORD = 'mF3z4Vsf.';

  useEffect(() => {
    // URL'den parametreleri al
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email');
    const password = urlParams.get('password');
    
    // Eğer doğru kimlik bilgileri varsa kullanıcıları yükle
    if (email === ADMIN_EMAIL && password === ADMIN_PASSWORD) {
      fetchUsers(email, password);
    } else {
      setLoading(false);
    }
  }, []);

  const fetchUsers = async (email, password) => {
    try {
      const response = await axios.get(`/api/admin/users?email=${email}&password=${password}`);
      setUsers(response.data);
    } catch (error) {
      toast.error('Kullanıcılar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const deleteUser = async (userId) => {
    if (!window.confirm('Bu kullanıcıyı silmek istediğinizden emin misiniz?')) {
      return;
    }

    // URL'den parametreleri al
    const urlParams = new URLSearchParams(window.location.search);
    const email = urlParams.get('email');
    const password = urlParams.get('password');

    try {
      await axios.delete(`/api/admin/users/${userId}?email=${email}&password=${password}`);
      toast.success('Kullanıcı başarıyla silindi');
      fetchUsers(email, password);
    } catch (error) {
      toast.error('Kullanıcı silinirken hata oluştu');
    }
  };
  
  // URL'den parametreleri al
  const urlParams = new URLSearchParams(window.location.search);
  const email = urlParams.get('email');
  const password = urlParams.get('password');
  
  if (email !== ADMIN_EMAIL || password !== ADMIN_PASSWORD) {
    return (
      <div className="container">
        <div className="auth-card">
          <div className="text-center">
            <Shield className="w-12 h-12 mx-auto mb-4 text-red-500" />
            <h2 className="text-xl font-semibold mb-2">Erişim Reddedildi</h2>
            <p className="text-gray-600">Bu sayfaya erişim yetkiniz bulunmamaktadır.</p>
            <button 
              onClick={() => window.location.href = '/'}
              className="mt-4 bg-orange-500 text-white px-4 py-2 rounded-lg hover:bg-orange-600 transition-colors"
            >
              Ana Sayfaya Dön
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="container">
        <div className="auth-card">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-orange-500 mx-auto"></div>
            <p className="mt-2 text-gray-600">Yükleniyor...</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="container">
      <div className="auth-card">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-800">Admin Paneli</h1>
          <Users className="w-6 h-6 text-orange-500" />
        </div>

        <div className="mb-4">
          <h2 className="text-lg font-semibold mb-2">Kayıtlı Kullanıcılar ({users.length})</h2>
        </div>

        <div className="space-y-4">
          {users.map((user) => (
            <div key={user.id} className="bg-white p-4 rounded-lg shadow-sm border">
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-orange-100 rounded-full flex items-center justify-center">
                      <span className="text-orange-600 font-semibold">
                        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <h3 className="font-semibold text-gray-800">
                        {user.firstName} {user.lastName}
                      </h3>
                      <p className="text-sm text-gray-600">{user.email}</p>
                      <p className="text-xs text-gray-500">
                        {user.province} / {user.district} / {user.neighborhood}
                      </p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center space-x-2">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    user.role === 'admin' 
                      ? 'bg-purple-100 text-purple-800' 
                      : 'bg-blue-100 text-blue-800'
                  }`}>
                    {user.role}
                  </span>
                  
                  <button
                    onClick={() => deleteUser(user.id)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    title="Kullanıcıyı Sil"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {users.length === 0 && (
          <div className="text-center py-8">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">Henüz kayıtlı kullanıcı bulunmamaktadır.</p>
          </div>
        )}
      </div>
    </div>
  );
}

export default Admin;
