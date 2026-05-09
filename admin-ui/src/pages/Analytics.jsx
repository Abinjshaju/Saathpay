import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import api from '../api/client';
import {
    Chart as ChartJS,
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
} from 'chart.js';
import { Line, Doughnut } from 'react-chartjs-2';

ChartJS.register(
    CategoryScale,
    LinearScale,
    PointElement,
    LineElement,
    Title,
    Tooltip,
    Legend,
    ArcElement
);

ChartJS.defaults.font.family = '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif';
ChartJS.defaults.color = '#8E8E93';

export default function Analytics() {
    const [loading, setLoading] = useState(true);
    const [summary, setSummary] = useState({
        total_orgs: 0,
        total_users: 0, // In backend, it's total_members
        total_messages: 0,
        estimated_cost: 0,
        whatsapp_count: 0,
        sms_count: 0
    });
    const [costData, setCostData] = useState([]);
    const [messageData, setMessageData] = useState([]);

    useEffect(() => {
        const fetchAnalytics = async () => {
            try {
                const [summaryRes, costRes, msgRes] = await Promise.all([
                    api.get('/analytics/summary?period=month'),
                    api.get('/analytics/cost?period=month'),
                    api.get('/analytics/messages?period=month')
                ]);

                setSummary({
                    total_orgs: summaryRes.data.total_orgs,
                    total_users: summaryRes.data.total_members,
                    total_messages: summaryRes.data.total_messages,
                    estimated_cost: summaryRes.data.estimated_cost,
                    whatsapp_count: summaryRes.data.whatsapp_count,
                    sms_count: summaryRes.data.sms_count
                });

                setCostData(costRes.data.data || []);
                setMessageData(msgRes.data.data || []);
            } catch (err) {
                console.error("Failed to fetch analytics", err);
            } finally {
                setLoading(false);
            }
        };
        fetchAnalytics();
    }, []);

    const costChartData = {
        labels: costData.map(d => new Date(d.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })),
        datasets: [
            {
                label: 'WhatsApp Cost (₹)',
                data: costData.map(d => d.whatsapp_cost),
                borderColor: '#34C759',
                backgroundColor: 'rgba(52, 199, 89, 0.1)',
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 0,
                pointHoverRadius: 6,
            },
            {
                label: 'SMS Cost (₹)',
                data: costData.map(d => d.sms_cost),
                borderColor: '#007AFF',
                backgroundColor: 'rgba(0, 122, 255, 0.1)',
                tension: 0.4,
                borderWidth: 3,
                pointRadius: 0,
                pointHoverRadius: 6,
            }
        ]
    };

    const costOptions = {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
            legend: { position: 'top', align: 'end', labels: { usePointStyle: true, boxWidth: 8 } },
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                titleColor: '#000',
                bodyColor: '#000',
                borderColor: 'rgba(0,0,0,0.1)',
                borderWidth: 1,
                padding: 12,
                boxPadding: 6,
                usePointStyle: true,
                titleFont: { size: 14, weight: 'bold' }
            }
        },
        scales: {
            y: {
                beginAtZero: true,
                grid: { color: 'rgba(0,0,0,0.05)', drawBorder: false },
                ticks: { padding: 10, callback: (value) => '₹' + value.toFixed(2) }
            },
            x: {
                grid: { display: false, drawBorder: false },
                ticks: { padding: 10 }
            }
        },
        interaction: { intersect: false, mode: 'index' }
    };

    // Since delivery status isn't directly exposed in the summary yet, 
    // we use a simple split based on channel to show something meaningful
    const deliveryData = {
        labels: ['WhatsApp', 'SMS'],
        datasets: [{
            data: [summary.whatsapp_count, summary.sms_count],
            backgroundColor: ['#34C759', '#007AFF'],
            borderWidth: 0,
            hoverOffset: 4
        }]
    };

    const deliveryOptions = {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
            legend: { position: 'bottom', labels: { usePointStyle: true, padding: 20 } },
            tooltip: {
                backgroundColor: 'rgba(255, 255, 255, 0.9)',
                titleColor: '#000',
                bodyColor: '#000',
                borderColor: 'rgba(0,0,0,0.1)',
                borderWidth: 1,
                padding: 12,
                boxPadding: 6,
                usePointStyle: true
            }
        }
    };

    return (
        <>
            <Header title="Analytics" />
            <div className="content-area" style={{ flex: 1, padding: '0 40px 40px 40px', overflowY: 'auto' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                    
                    {/* KPIs */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '24px' }}>
                        <div className="ios-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)' }}>Total Organisations</div>
                            <div style={{ fontSize: '32px', fontWeight: '600', color: 'var(--text-main)', letterSpacing: '-1px' }}>{loading ? '...' : summary.total_orgs}</div>
                        </div>
                        <div className="ios-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)' }}>Total Users</div>
                            <div style={{ fontSize: '32px', fontWeight: '600', color: 'var(--text-main)', letterSpacing: '-1px' }}>{loading ? '...' : summary.total_users.toLocaleString()}</div>
                        </div>
                        <div className="ios-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)' }}>Messages Sent</div>
                            <div style={{ fontSize: '32px', fontWeight: '600', color: 'var(--text-main)', letterSpacing: '-1px' }}>{loading ? '...' : summary.total_messages.toLocaleString()}</div>
                        </div>
                        <div className="ios-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)' }}>Estimated Cost</div>
                            <div style={{ fontSize: '32px', fontWeight: '600', color: 'var(--text-main)', letterSpacing: '-1px' }}>₹{loading ? '...' : summary.estimated_cost.toFixed(2)}</div>
                        </div>
                    </div>

                    {/* Charts */}
                    <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: '24px' }}>
                        <div className="ios-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                                <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-main)' }}>Twilio Cost Analysis</div>
                            </div>
                            <div style={{ flex: 1, minHeight: '300px' }}>
                                {!loading && costData.length > 0 ? (
                                    <Line data={costChartData} options={costOptions} />
                                ) : (
                                    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>
                                        {loading ? 'Loading...' : 'No data available'}
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="ios-panel" style={{ padding: '24px', display: 'flex', flexDirection: 'column' }}>
                            <div style={{ fontSize: '16px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '24px' }}>Message Channels</div>
                            <div style={{ flex: 1, minHeight: '300px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                                {!loading && (summary.whatsapp_count > 0 || summary.sms_count > 0) ? (
                                    <Doughnut data={deliveryData} options={deliveryOptions} />
                                ) : (
                                    <div style={{ color: 'var(--text-muted)' }}>{loading ? 'Loading...' : 'No data available'}</div>
                                )}
                            </div>
                        </div>
                    </div>

                </div>
            </div>
        </>
    );
}
