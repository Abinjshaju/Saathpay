import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Login() {
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const { login, loading } = useAuth();
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        
        const result = await login(username, password);
        if (result.success) {
            navigate('/');
        } else {
            setError(result.error || 'Failed to login');
        }
    };

    return (
        <div style={{ height: '100vh', width: '100vw', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--background)' }}>
            <div className="ios-panel" style={{ width: '400px', padding: '40px', display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <div style={{ textAlign: 'center' }}>
                    <img src="/logo/logo3.svg" alt="SaathPay Logo" style={{ height: '48px', marginBottom: '16px' }} />
                    <h1 style={{ fontSize: '24px', fontWeight: '600', color: 'var(--text-main)', letterSpacing: '-0.5px' }}>Admin Login</h1>
                    <p style={{ color: 'var(--text-muted)', fontSize: '15px', marginTop: '8px' }}>Sign in to access the SaathPay platform</p>
                </div>

                <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    {error && (
                        <div style={{ padding: '12px', background: 'rgba(255, 59, 48, 0.1)', color: 'var(--ios-red)', borderRadius: '10px', fontSize: '14px', textAlign: 'center' }}>
                            {error}
                        </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)', marginLeft: '8px' }}>Username</label>
                        <input 
                            type="text" 
                            required
                            value={username}
                            onChange={(e) => setUsername(e.target.value)}
                            style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', background: '#F9F9FB', fontSize: '16px', color: 'var(--text-main)', outline: 'none' }}
                            placeholder="Enter username"
                        />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        <label style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)', marginLeft: '8px' }}>Password</label>
                        <input 
                            type="password" 
                            required
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            style={{ padding: '14px 16px', borderRadius: '12px', border: '1px solid var(--border-color)', background: '#F9F9FB', fontSize: '16px', color: 'var(--text-main)', outline: 'none' }}
                            placeholder="Enter password"
                        />
                    </div>

                    <button 
                        type="submit" 
                        className="btn-primary" 
                        disabled={loading}
                        style={{ marginTop: '8px', opacity: loading ? 0.7 : 1 }}
                    >
                        {loading ? 'Signing In...' : 'Sign In'}
                    </button>
                </form>
            </div>
        </div>
    );
}
