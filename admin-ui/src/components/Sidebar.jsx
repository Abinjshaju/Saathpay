import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function Sidebar() {
    const { logout } = useAuth();
    
    return (
        <aside className="sidebar">
            <div className="sidebar-logo">
                <img src="/logo/logo3.svg" alt="SaathPay Logo" style={{ height: '32px', width: 'auto' }} />
            </div>
            <ul className="nav-menu" style={{ listStyle: 'none', display: 'flex', flexDirection: 'column', gap: '6px', flex: 1 }}>
                <li>
                    <NavLink to="/" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <ion-icon name="grid-outline"></ion-icon> Dashboard
                    </NavLink>
                </li>
                <li>
                    <NavLink to="/organisations" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <ion-icon name="business-outline"></ion-icon> Organisations
                    </NavLink>
                </li>
                <li>
                    <NavLink to="/onboard" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <ion-icon name="person-add-outline"></ion-icon> Onboard
                    </NavLink>
                </li>
                <li>
                    <NavLink to="/analytics" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <ion-icon name="stats-chart-outline"></ion-icon> Analytics
                    </NavLink>
                </li>
                <li>
                    <NavLink to="/settings" className={({ isActive }) => `nav-item ${isActive ? 'active' : ''}`}>
                        <ion-icon name="settings-outline"></ion-icon> Settings
                    </NavLink>
                </li>
            </ul>
            <div style={{ padding: '0 16px' }}>
                <button 
                    onClick={logout}
                    style={{ width: '100%', padding: '12px', background: 'transparent', border: '1px solid var(--border-color)', borderRadius: '12px', color: 'var(--ios-red)', fontSize: '15px', fontWeight: '500', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', cursor: 'pointer' }}
                >
                    <ion-icon name="log-out-outline"></ion-icon> Logout
                </button>
            </div>
        </aside>
    );
}
