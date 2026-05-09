import React from 'react';
import Sidebar from './Sidebar';

export default function Layout({ children }) {
    return (
        <>
            <Sidebar />
            <main className="main-content" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, gap: 0, height: '100vh' }}>
                {children}
            </main>
        </>
    );
}
