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

        {/* Tablo Başlığı */}
        <div className="bg-gray-50 rounded-lg p-4 mb-4">
          <div className="grid grid-cols-12 gap-4 text-sm font-semibold text-gray-700">
            <div className="col-span-1">#</div>
            <div className="col-span-2">Ad Soyad</div>
            <div className="col-span-3">E-posta</div>
            <div className="col-span-2">Telefon</div>
            <div className="col-span-2">Konum</div>
            <div className="col-span-1">Rol</div>
            <div className="col-span-1">İşlem</div>
          </div>
        </div>

        {/* Tablo İçeriği */}
        <div className="space-y-2">
          {users.map((user, index) => (
            <div key={user.id} className="bg-white p-4 rounded-lg shadow-sm border hover:shadow-md transition-shadow">
              <div className="grid grid-cols-12 gap-4 items-center text-sm">
                {/* Sıra No */}
                <div className="col-span-1">
                  <span className="bg-orange-100 text-orange-800 px-2 py-1 rounded-full text-xs font-medium">
                    {index + 1}
                  </span>
                </div>

                {/* Ad Soyad */}
                <div className="col-span-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
                      <span className="text-orange-600 font-semibold text-xs">
                        {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                      </span>
                    </div>
                    <div>
                      <div className="font-medium text-gray-800">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {user.createdAt ? new Date(user.createdAt).toLocaleDateString('tr-TR') : 'Tarih yok'}
                      </div>
                    </div>
                  </div>
                </div>

                {/* E-posta */}
                <div className="col-span-3">
                  <div className="text-gray-800 font-medium">{user.email}</div>
                  <div className="text-xs text-gray-500">
                    {user.emailVerified ? '✅ Doğrulanmış' : '❌ Doğrulanmamış'}
                  </div>
                </div>

                {/* Telefon */}
                <div className="col-span-2">
                  <div className="text-gray-800">{user.phone || 'Belirtilmemiş'}</div>
                </div>

                {/* Konum */}
                <div className="col-span-2">
                  <div className="text-gray-800">
                    {user.province && user.district ? 
                      `${user.province} / ${user.district}` : 
                      'Belirtilmemiş'
                    }
                  </div>
                  {user.neighborhood && (
                    <div className="text-xs text-gray-500">{user.neighborhood}</div>
                  )}
                </div>

                {/* Rol */}
                <div className="col-span-1">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    user.role === 'admin' 
                      ? 'bg-purple-100 text-purple-800' 
                      : user.role === 'Aşçı'
                      ? 'bg-red-100 text-red-800'
                      : user.role === 'Garson'
                      ? 'bg-blue-100 text-blue-800'
                      : user.role === 'Mutfak Görevlisi'
                      ? 'bg-green-100 text-green-800'
                      : user.role === 'Restoran Müdürü'
                      ? 'bg-yellow-100 text-yellow-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}>
                    {user.role || 'Belirtilmemiş'}
                  </span>
                </div>

                {/* İşlem */}
                <div className="col-span-1">
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

        {/* İstatistikler */}
        {users.length > 0 && (
          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">İstatistikler</h3>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="text-center">
                <div className="text-2xl font-bold text-orange-600">{users.length}</div>
                <div className="text-sm text-gray-600">Toplam Kullanıcı</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-green-600">
                  {users.filter(u => u.emailVerified).length}
                </div>
                <div className="text-sm text-gray-600">Doğrulanmış E-posta</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-blue-600">
                  {users.filter(u => u.role === 'Aşçı').length}
                </div>
                <div className="text-sm text-gray-600">Aşçı</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-bold text-purple-600">
                  {users.filter(u => u.role === 'Garson').length}
                </div>
                <div className="text-sm text-gray-600">Garson</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default Admin;
