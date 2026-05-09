import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../api/client';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(() => {
        const savedUser = localStorage.getItem('saathpay_admin_user');
        return savedUser ? JSON.parse(savedUser) : null;
    });
    const [token, setToken] = useState(() => localStorage.getItem('saathpay_admin_token'));
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        const handleUnauthorized = () => {
            setToken(null);
            setUser(null);
        };
        window.addEventListener('auth-unauthorized', handleUnauthorized);
        return () => window.removeEventListener('auth-unauthorized', handleUnauthorized);
    }, []);

    const login = async (username, password) => {
        setLoading(true);
        try {
            const response = await api.post('/auth/login', { username, password });
            const { access_token, user: userData } = response.data;
            
            localStorage.setItem('saathpay_admin_token', access_token);
            localStorage.setItem('saathpay_admin_user', JSON.stringify(userData));
            
            setToken(access_token);
            setUser(userData);
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error.response?.data?.detail || 'Invalid username or password' 
            };
        } finally {
            setLoading(false);
        }
    };

    const logout = async () => {
        try {
            await api.post('/auth/logout');
        } catch (e) {
            console.error('Logout API failed', e);
        } finally {
            localStorage.removeItem('saathpay_admin_token');
            localStorage.removeItem('saathpay_admin_user');
            setToken(null);
            setUser(null);
        }
    };

    return (
        <AuthContext.Provider value={{ user, token, isAuthenticated: !!token, login, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
