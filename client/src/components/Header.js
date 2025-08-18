import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { 
  Home, 
  Plus, 
  List, 
  MessageSquare, 
  Inbox, 
  User, 
  LogOut,
  Utensils,
  MapPin,
  ChevronDown
} from 'lucide-react';

function Header() {
  const { user, logout } = useAuth();
  const location = useLocation();
  const [showUserMenu, setShowUserMenu] = useState(false);
  const userMenuRef = useRef(null);

  const isActive = (path) => {
    return location.pathname === path;
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target)) {
        setShowUserMenu(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, []);

  const toggleUserMenu = () => {
    setShowUserMenu(!showUserMenu);
  };

  return (
    <header className="header">
      <div className="header-content">
        <Link to="/" className="logo">
          <div className="logo-icon">
            <Utensils size={24} />
          </div>
          <span>Azık</span>
        </Link>

        {user ? (
          <nav className="nav-menu">
            <Link 
              to="/" 
              className={`nav-link ${isActive('/') ? 'active' : ''}`}
            >
              <Home size={16} />
              Ana Sayfa
            </Link>
            
            <Link 
              to="/create-listing" 
              className={`nav-link ${isActive('/create-listing') ? 'active' : ''}`}
            >
              <Plus size={16} />
              Takas Et
            </Link>
            
            <Link 
              to="/my-listings" 
              className={`nav-link ${isActive('/my-listings') ? 'active' : ''}`}
            >
              <List size={16} />
              İlanlarım
            </Link>
            
            <Link 
              to="/my-offers" 
              className={`nav-link ${isActive('/my-offers') ? 'active' : ''}`}
            >
              <MessageSquare size={16} />
              Tekliflerim
            </Link>
            
            <Link 
              to="/listing-offers" 
              className={`nav-link ${isActive('/listing-offers') ? 'active' : ''}`}
            >
              <Inbox size={16} />
              Gelen Teklifler
            </Link>

            <div className="flex items-center gap-2">
              {/* User Menu Dropdown */}
              <div className="relative" ref={userMenuRef}>
                <button 
                  onClick={toggleUserMenu}
                  className="flex items-center gap-2 px-3 py-2 bg-white hover:bg-gray-50 border border-gray-200 hover:border-orange-300 rounded-lg transition-all duration-200 shadow-sm"
                >
                  <User size={16} className="text-gray-600" />
                  <span className="text-sm font-medium text-gray-700">
                    {user.firstName}
                  </span>
                  <ChevronDown 
                    size={14} 
                    className={`text-gray-500 transition-transform duration-200 ${showUserMenu ? 'rotate-180' : ''}`} 
                  />
                </button>

                {/* Dropdown Menu */}
                {showUserMenu && (
                  <div className="absolute right-0 mt-2 w-48 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-50">
                    {/* User Info */}
                    <div className="px-4 py-2 border-b border-gray-100">
                      <div className="text-sm font-medium text-gray-900">
                        {user.firstName} {user.lastName}
                      </div>
                      <div className="text-xs text-gray-500">
                        {user.role}
                      </div>
                    </div>
                    
                    {/* Menu Items */}
                    <Link 
                      to="/update-address" 
                      onClick={() => setShowUserMenu(false)}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-orange-50 hover:text-orange-600 transition-colors duration-200"
                    >
                      <MapPin size={16} />
                      Adres Güncelle
                    </Link>
                    
                    <button 
                      onClick={() => {
                        setShowUserMenu(false);
                        logout();
                      }}
                      className="flex items-center gap-3 px-4 py-2 text-sm text-gray-700 hover:bg-red-50 hover:text-red-600 transition-colors duration-200 w-full text-left"
                    >
                      <LogOut size={16} />
                      Çıkış Yap
                    </button>
                  </div>
                )}
              </div>
            </div>
          </nav>
        ) : (
          <nav className="nav-menu">
            <Link to="/login" className="btn btn-secondary">
              <User size={16} />
              Giriş Yap
            </Link>
            <Link to="/register" className="btn btn-primary">
              <User size={16} />
              Kayıt Ol
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}

export default Header;
