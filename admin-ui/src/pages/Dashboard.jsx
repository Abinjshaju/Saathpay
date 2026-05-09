import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import api from '../api/client';

export default function Dashboard() {
    const [summary, setSummary] = useState({
        total_orgs: 0,
        total_members: 0,
        total_messages: 0,
        estimated_cost: 0,
        whatsapp_count: 0,
        sms_count: 0
    });
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchSummary = async () => {
            try {
                // Fetch stats for the current month
                const res = await api.get('/analytics/summary?period=month');
                setSummary(res.data);
            } catch (err) {
                console.error("Failed to fetch dashboard summary", err);
            } finally {
                setLoading(false);
            }
        };
        fetchSummary();
    }, []);

    return (
        <>
            <Header title="Dashboard" />
            <div className="content-area" style={{ flex: 1, padding: '0 40px 40px 40px', overflowY: 'auto' }}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gridTemplateRows: 'repeat(2, auto)', gap: '24px' }}>
                    
                    <div className="ios-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)' }}>
                            Estimated Monthly Cost
                        </div>
                        <div style={{ fontSize: '40px', fontWeight: '600', color: 'var(--text-main)', letterSpacing: '-1px' }}>
                            ₹{loading ? '...' : summary.estimated_cost.toFixed(2)}
                        </div>
                    </div>

                    <div className="ios-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)' }}>
                            Active Users (Members)
                        </div>
                        <div style={{ fontSize: '40px', fontWeight: '600', color: 'var(--text-main)', letterSpacing: '-1px' }}>
                            {loading ? '...' : summary.total_members.toLocaleString()}
                        </div>
                    </div>

                    <div className="ios-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)' }}>
                            Messages Sent
                        </div>
                        <div style={{ fontSize: '40px', fontWeight: '600', color: 'var(--ios-blue)', letterSpacing: '-1px' }}>
                            {loading ? '...' : summary.total_messages.toLocaleString()}
                        </div>
                    </div>

                    <div className="ios-panel" style={{ gridColumn: 'span 2', padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)' }}>
                            Analytics Overview
                        </div>
                        <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', borderRadius: '12px', background: 'repeating-linear-gradient(45deg, #F9F9FB, #F9F9FB 10px, #F2F2F7 10px, #F2F2F7 20px)', marginTop: '12px', minHeight: '180px', border: '1px solid var(--border-color)' }}>
                            <div style={{ background: '#fff', padding: '12px 24px', borderRadius: '20px', boxShadow: '0 2px 10px rgba(0,0,0,0.05)', fontSize: '14px', fontWeight: '500', color: 'var(--text-muted)' }}>
                                See full charts on Analytics page
                            </div>
                        </div>
                    </div>

                    <div className="ios-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                        <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)' }}>
                            Platform KPIs
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', marginTop: '12px', flex: 1 }}>
                            <div style={{ padding: '16px', background: '#F9F9FB', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: '500', fontSize: '14px', color: 'var(--text-muted)' }}>WhatsApp Messages</span>
                                <span style={{ fontWeight: '600', fontSize: '16px', color: 'var(--text-main)' }}>{loading ? '...' : summary.whatsapp_count.toLocaleString()}</span>
                            </div>
                            <div style={{ padding: '16px', background: '#F9F9FB', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: '500', fontSize: '14px', color: 'var(--text-muted)' }}>SMS Messages</span>
                                <span style={{ fontWeight: '600', fontSize: '16px', color: 'var(--text-main)' }}>{loading ? '...' : summary.sms_count.toLocaleString()}</span>
                            </div>
                            <div style={{ padding: '16px', background: '#F9F9FB', borderRadius: '10px', border: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                <span style={{ fontWeight: '500', fontSize: '14px', color: 'var(--text-muted)' }}>Total Organisations</span>
                                <span style={{ fontWeight: '600', fontSize: '16px', color: 'var(--text-main)' }}>{loading ? '...' : summary.total_orgs}</span>
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
}
