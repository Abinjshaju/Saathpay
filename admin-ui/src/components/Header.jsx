import React from 'react';

export default function Header({ title }) {
    return (
        <header className="header" style={{ height: '100px', padding: '0 40px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
            <div className="page-title" style={{ fontSize: '32px', fontWeight: '700', letterSpacing: '-0.5px' }}>
                {title}
            </div>
            <div className="header-actions" style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
                <div className="search-bar" style={{ display: 'flex', alignItems: 'center', background: 'var(--ios-gray-light)', padding: '8px 16px', borderRadius: '10px', width: '240px', gap: '8px', color: 'var(--text-muted)' }}>
                    <ion-icon name="search-outline"></ion-icon>
                    <input type="text" placeholder="Search..." style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '15px', width: '100%', color: 'var(--text-main)' }} />
                </div>
                <div className="user-profile" style={{ width: '40px', height: '40px', borderRadius: '50%', background: 'var(--ios-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: '600', fontSize: '16px', color: '#FFF', cursor: 'pointer', boxShadow: '0 2px 8px rgba(0, 122, 255, 0.3)' }}>
                    B
                </div>
            </div>
        </header>
    );
}
