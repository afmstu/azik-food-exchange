import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { toast } from 'react-hot-toast';
import axios from 'axios';
import { Users, Trash2, Eye, Shield } from 'lucide-react';

function Admin() {
  const { user } = useAuth();
  const [users, setUsers] = useState([]);
  const [filteredUsers, setFilteredUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState('all');

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
      setFilteredUsers(response.data);
    } catch (error) {
      toast.error('Kullanıcılar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Arama ve filtreleme fonksiyonu
  const filterUsers = () => {
    let filtered = users;

    // Metin araması (isim, e-posta)
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      filtered = filtered.filter(user => 
        user.firstName?.toLowerCase().includes(term) ||
        user.lastName?.toLowerCase().includes(term) ||
        user.email?.toLowerCase().includes(term)
      );
    }

    // Rol filtresi
    if (roleFilter !== 'all') {
      filtered = filtered.filter(user => user.role === roleFilter);
    }

    setFilteredUsers(filtered);
  };

  // Arama terimi veya rol filtresi değiştiğinde filtreleme yap
  useEffect(() => {
    filterUsers();
  }, [searchTerm, roleFilter, users]);

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
          <h2 className="text-lg font-semibold mb-2">Kayıtlı Kullanıcılar ({filteredUsers.length}/{users.length})</h2>
        </div>

        {/* Arama ve Filtreleme */}
        <div className="mb-4 bg-gray-50 p-4 rounded-lg">
          <div className="flex flex-col md:flex-row gap-4">
            {/* Arama Kutusu */}
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Arama</label>
              <input
                type="text"
                placeholder="İsim, soyisim veya e-posta ara..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              />
            </div>
            
            {/* Rol Filtresi */}
            <div className="md:w-48">
              <label className="block text-sm font-medium text-gray-700 mb-1">Rol Filtresi</label>
              <select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-transparent"
              >
                <option value="all">Tüm Roller</option>
                <option value="Aşçı">Aşçı</option>
                <option value="Garson">Garson</option>
                <option value="Mutfak Görevlisi">Mutfak Görevlisi</option>
                <option value="Restoran Müdürü">Restoran Müdürü</option>
                <option value="admin">Admin</option>
              </select>
            </div>

            {/* Temizle Butonu */}
            <div className="md:w-auto">
              <label className="block text-sm font-medium text-gray-700 mb-1">&nbsp;</label>
              <button
                onClick={() => {
                  setSearchTerm('');
                  setRoleFilter('all');
                }}
                className="w-full md:w-auto px-4 py-2 bg-gray-500 text-white rounded-md hover:bg-gray-600 transition-colors"
              >
                Temizle
              </button>
            </div>
          </div>
        </div>

        {/* Kompakt Tablo */}
        <div className="bg-white rounded-lg shadow-sm border overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">#</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">Ad Soyad</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">E-posta</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">Telefon</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">Konum</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">Rol</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">Durum</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">Tarih</th>
                <th className="px-3 py-2 text-left font-semibold text-gray-700 border-b">İşlem</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.map((user, index) => (
                <tr key={user.id} className="hover:bg-gray-50 border-b">
                  <td className="px-3 py-2">
                    <span className="bg-orange-100 text-orange-800 px-1.5 py-0.5 rounded text-xs font-medium">
                      {index + 1}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <div className="flex items-center space-x-2">
                      <div className="w-6 h-6 bg-orange-100 rounded-full flex items-center justify-center">
                        <span className="text-orange-600 font-semibold text-xs">
                          {user.firstName.charAt(0)}{user.lastName.charAt(0)}
                        </span>
                      </div>
                      <span className="font-medium text-gray-800">
                        {user.firstName} {user.lastName}
                      </span>
                    </div>
                  </td>
                  <td className="px-3 py-2 text-gray-800">
                    {user.email}
                  </td>
                  <td className="px-3 py-2 text-gray-800">
                    {user.phone || '-'}
                  </td>
                  <td className="px-3 py-2 text-gray-800">
                    {user.province && user.district ? 
                      `${user.province}/${user.district}` : 
                      '-'
                    }
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
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
                      {user.role || '-'}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      user.emailVerified 
                        ? 'bg-green-100 text-green-800' 
                        : 'bg-red-100 text-red-800'
                    }`}>
                      {user.emailVerified ? '✅ Doğrulandı' : '❌ Doğrulanmadı'}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-gray-600 text-xs">
                    {user.createdAt ? new Date(user.createdAt).toLocaleDateString('tr-TR') : '-'}
                  </td>
                  <td className="px-3 py-2">
                    <button
                      onClick={() => deleteUser(user.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded transition-colors"
                      title="Kullanıcıyı Sil"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && users.length > 0 && (
          <div className="text-center py-8">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">Arama kriterlerinize uygun kullanıcı bulunamadı.</p>
          </div>
        )}

        {users.length === 0 && (
          <div className="text-center py-8">
            <Users className="w-12 h-12 mx-auto mb-4 text-gray-400" />
            <p className="text-gray-500">Henüz kayıtlı kullanıcı bulunmamaktadır.</p>
          </div>
        )}

        {/* İstatistikler */}
        {filteredUsers.length > 0 && (
          <div className="mt-6 bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-semibold mb-3">İstatistikler</h3>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl font-bold text-orange-600">{filteredUsers.length}</div>
                  <div className="text-sm text-gray-600">Filtrelenmiş Kullanıcı</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-green-600">
                    {filteredUsers.filter(u => u.emailVerified).length}
                  </div>
                  <div className="text-sm text-gray-600">Doğrulanmış E-posta</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-blue-600">
                    {filteredUsers.filter(u => u.role === 'Aşçı').length}
                  </div>
                  <div className="text-sm text-gray-600">Aşçı</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl font-bold text-purple-600">
                    {filteredUsers.filter(u => u.role === 'Garson').length}
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
