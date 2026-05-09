import React, { useState, useEffect } from 'react';
import Header from '../components/Header';
import api from '../api/client';

export default function Settings() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    const [settings, setSettings] = useState({
        messaging_enabled: true,
        sms_fallback_enabled: true,
        twilio_whatsapp_cost: 0.0135,
        twilio_sms_cost: 0.0079,
        whatsapp_sender: '',
        sms_sender: '',
        twilio_account_sid: '',
        twilio_auth_token: ''
    });

    useEffect(() => {
        const fetchSettings = async () => {
            try {
                const res = await api.get('/settings');
                if (res.data) {
                    setSettings({
                        ...settings,
                        ...res.data,
                        twilio_auth_token: '' // Don't populate the masked token in the input field
                    });
                }
            } catch (err) {
                console.error("Failed to load settings", err);
                setError('Failed to load settings');
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();
    }, []);

    const handleSave = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            // Build the update payload. Only include auth_token if it was typed
            const payload = { ...settings };
            if (!payload.twilio_auth_token) {
                delete payload.twilio_auth_token;
            }

            const res = await api.put('/settings', payload);
            setSettings({
                ...settings,
                ...res.data,
                twilio_auth_token: ''
            });
            setSuccess('Settings saved successfully!');
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            console.error("Failed to save settings", err);
            setError(err.response?.data?.detail?.[0]?.msg || 'Failed to save settings');
        } finally {
            setSaving(false);
        }
    };

    if (loading) {
        return (
            <>
                <Header title="Platform Settings" />
                <div style={{ padding: '40px', color: 'var(--text-muted)' }}>Loading settings...</div>
            </>
        );
    }

    return (
        <>
            <Header title="Platform Settings" />
            <div className="content-area" style={{ flex: 1, padding: '0 40px 60px 40px', overflowY: 'auto' }}>
                <form onSubmit={handleSave} style={{ maxWidth: '600px', margin: '0 auto' }}>
                    
                    {error && (
                        <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(255, 59, 48, 0.1)', color: 'var(--ios-red)', borderRadius: '12px' }}>
                            {error}
                        </div>
                    )}

                    {success && (
                        <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(52, 199, 89, 0.1)', color: 'var(--ios-green)', borderRadius: '12px' }}>
                            {success}
                        </div>
                    )}

                    <div style={{ marginBottom: '32px' }}>
                        <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', marginLeft: '16px' }}>
                            Messaging Controls
                        </div>
                        <div className="ios-panel" style={{ overflow: 'hidden', padding: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-color-strong)', justifyContent: 'space-between' }}>
                                <div style={{ fontSize: '16px', color: 'var(--text-main)' }}>Enable Global Messaging</div>
                                <input 
                                    type="checkbox" 
                                    checked={settings.messaging_enabled}
                                    onChange={(e) => setSettings({...settings, messaging_enabled: e.target.checked})}
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', justifyContent: 'space-between' }}>
                                <div style={{ fontSize: '16px', color: 'var(--text-main)' }}>Enable SMS Fallback</div>
                                <input 
                                    type="checkbox" 
                                    checked={settings.sms_fallback_enabled}
                                    onChange={(e) => setSettings({...settings, sms_fallback_enabled: e.target.checked})}
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '32px' }}>
                        <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', marginLeft: '16px' }}>
                            Twilio Configuration
                        </div>
                        <div className="ios-panel" style={{ overflow: 'hidden', padding: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-color-strong)' }}>
                                <div style={{ width: '180px', fontSize: '16px', color: 'var(--text-main)' }}>Account SID</div>
                                <input 
                                    type="text"
                                    value={settings.twilio_account_sid || ''}
                                    onChange={(e) => setSettings({...settings, twilio_account_sid: e.target.value})}
                                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: '16px', background: 'transparent', color: 'var(--text-main)' }} 
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-color-strong)' }}>
                                <div style={{ width: '180px', fontSize: '16px', color: 'var(--text-main)' }}>Auth Token</div>
                                <input 
                                    type="password"
                                    value={settings.twilio_auth_token}
                                    onChange={(e) => setSettings({...settings, twilio_auth_token: e.target.value})}
                                    placeholder={settings.id ? "Leave blank to keep unchanged" : ""}
                                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: '16px', background: 'transparent', color: 'var(--text-main)' }} 
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-color-strong)' }}>
                                <div style={{ width: '180px', fontSize: '16px', color: 'var(--text-main)' }}>WhatsApp Sender ID</div>
                                <input 
                                    type="text"
                                    value={settings.whatsapp_sender || ''}
                                    onChange={(e) => setSettings({...settings, whatsapp_sender: e.target.value})}
                                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: '16px', background: 'transparent', color: 'var(--text-main)' }} 
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px' }}>
                                <div style={{ width: '180px', fontSize: '16px', color: 'var(--text-main)' }}>SMS Sender ID</div>
                                <input 
                                    type="text"
                                    value={settings.sms_sender || ''}
                                    onChange={(e) => setSettings({...settings, sms_sender: e.target.value})}
                                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: '16px', background: 'transparent', color: 'var(--text-main)' }} 
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '32px' }}>
                        <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', marginLeft: '16px' }}>
                            Costs Estimation Configuration
                        </div>
                        <div className="ios-panel" style={{ overflow: 'hidden', padding: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-color-strong)' }}>
                                <div style={{ width: '180px', fontSize: '16px', color: 'var(--text-main)' }}>WhatsApp Cost (₹)</div>
                                <input 
                                    type="number" step="0.0001"
                                    value={settings.twilio_whatsapp_cost || 0}
                                    onChange={(e) => setSettings({...settings, twilio_whatsapp_cost: parseFloat(e.target.value)})}
                                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: '16px', background: 'transparent', color: 'var(--text-main)' }} 
                                />
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px' }}>
                                <div style={{ width: '180px', fontSize: '16px', color: 'var(--text-main)' }}>SMS Cost (₹)</div>
                                <input 
                                    type="number" step="0.0001"
                                    value={settings.twilio_sms_cost || 0}
                                    onChange={(e) => setSettings({...settings, twilio_sms_cost: parseFloat(e.target.value)})}
                                    style={{ flex: 1, border: 'none', outline: 'none', fontSize: '16px', background: 'transparent', color: 'var(--text-main)' }} 
                                />
                            </div>
                        </div>
                    </div>

                    <div style={{ marginBottom: '32px' }}>
                        <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', marginLeft: '16px' }}>
                            Data Management
                        </div>
                        <div className="ios-panel" style={{ overflow: 'hidden', padding: 0 }}>
                            <div 
                                style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', cursor: 'pointer', color: 'var(--ios-blue)', fontWeight: '500' }}
                                onClick={async () => {
                                    try {
                                        await api.post('/backup');
                                        alert('Backup created successfully!');
                                    } catch (e) {
                                        alert('Failed to create backup');
                                    }
                                }}
                            >
                                <ion-icon name="cloud-download-outline" style={{ marginRight: '8px' }}></ion-icon>
                                Request System Backup
                            </div>
                            <div 
                                style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderTop: '1px solid var(--border-color-strong)', cursor: 'pointer', color: 'var(--ios-blue)', fontWeight: '500' }}
                                onClick={async () => {
                                    try {
                                        await api.get('/logs/export');
                                        alert('Export requested successfully!');
                                    } catch (e) {
                                        alert('Failed to request export');
                                    }
                                }}
                            >
                                <ion-icon name="document-text-outline" style={{ marginRight: '8px' }}></ion-icon>
                                Request Logs Export
                            </div>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        className="btn-primary"
                        disabled={saving}
                        style={{ opacity: saving ? 0.7 : 1 }}
                    >
                        {saving ? 'Saving...' : 'Save Settings'}
                    </button>

                </form>
            </div>
        </>
    );
}
