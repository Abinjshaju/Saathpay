import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Header from '../components/Header';
import api from '../api/client';
import { analyzeMemberCsvPlanColumn, MEMBER_CSV_HEADER_HINT } from '../utils/memberCsv';

async function downloadMembersCsvTemplate() {
    const res = await api.get('/members/csv-template', { responseType: 'blob' });
    const blob = res.data;
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'members-template.csv';
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    a.remove();
    window.URL.revokeObjectURL(url);
}

export default function Onboard() {
    const navigate = useNavigate();
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [csvFile, setCsvFile] = useState(null);
    const [importPreview, setImportPreview] = useState(null);
    const [stagingOrgId, setStagingOrgId] = useState(null);
    const [templateDownloading, setTemplateDownloading] = useState(false);
    const [csvLocalNotice, setCsvLocalNotice] = useState('');
    
    const [orgData, setOrgData] = useState({
        name: '',
        type: '',
        custom_type: '',
        address: '',
        google_maps_url: '',
        upi_id: '',
        upi_number: ''
    });

    const [users, setUsers] = useState([
        { full_name: '', username: '', password: '', mobile: '', email: '', role: 'admin' },
        { full_name: '', username: '', password: '', mobile: '', email: '', role: 'admin' }
    ]);

    const [plans, setPlans] = useState([
        { name: '', amount: '', billing_cycle: 'monthly', description: '' }
    ]);

    const handleOrgChange = (field, value) => {
        setOrgData(prev => ({ ...prev, [field]: value }));
    };

    const handleUserChange = (index, field, value) => {
        const newUsers = [...users];
        newUsers[index][field] = value;
        setUsers(newUsers);
    };

    const handlePlanChange = (index, field, value) => {
        const newPlans = [...plans];
        newPlans[index][field] = value;
        setPlans(newPlans);
    };

    const addPlan = () => {
        if (plans.length < 5) {
            setPlans([...plans, { name: '', amount: '', billing_cycle: 'monthly', description: '' }]);
        }
    };

    const removePlan = (index) => {
        if (plans.length > 1) {
            const newPlans = [...plans];
            newPlans.splice(index, 1);
            setPlans(newPlans);
        }
    };

    const resolveApiErrorMessage = (err) => {
        const data = err.response?.data;
        if (data?.errors?.length && (data.message || data.code)) {
            const msgs = data.errors.map((e) => e.msg || e.message || '').filter(Boolean).join(' ');
            return [data.message, msgs].filter(Boolean).join(': ') || 'Request failed';
        }
        return data?.detail?.[0]?.msg || data?.detail || err.message || 'Request failed';
    };

    const handleDownloadTemplateClick = async (e) => {
        e.preventDefault();
        setError('');
        setTemplateDownloading(true);
        try {
            await downloadMembersCsvTemplate();
        } catch (err) {
            console.error('Failed to download CSV template', err);
            setError(resolveApiErrorMessage(err) || 'Failed to download CSV template');
        } finally {
            setTemplateDownloading(false);
        }
    };

    const handleConfirmStagingImport = async () => {
        if (!stagingOrgId || !importPreview?.import_id) return;
        setLoading(true);
        setError('');
        try {
            await api.post(`/organisations/${stagingOrgId}/members/import/${importPreview.import_id}/confirm`);
            navigate('/organisations');
        } catch (err) {
            console.error('Failed to confirm member import', err);
            setError(resolveApiErrorMessage(err));
        } finally {
            setLoading(false);
        }
    };

    const handleSkipStagingImport = () => {
        navigate('/organisations');
    };

    const handleOnboard = async (e) => {
        e.preventDefault();
        if (importPreview) return;
        setLoading(true);
        setError('');
        setCsvLocalNotice('');

        try {
            // API requires exactly two organisation app users (min_length: 2 on users).
            const appUsersPair = users.slice(0, 2).map((u) => ({
                full_name: u.full_name,
                username: u.username,
                password: u.password,
                mobile: u.mobile,
                email: u.email,
                role: u.role
            }));
            const missingSecond = appUsersPair.some((u) => !(u.username || '').trim() || !u.password);
            if (missingSecond) {
                setError(
                    'This organisation needs two admin app accounts. Fill username and password for both Primary and Secondary user.'
                );
                setLoading(false);
                return;
            }

            const upiId = (orgData.upi_id || '').trim();
            const upiNumber = (orgData.upi_number || '').trim();
            if (!upiId || !upiNumber) {
                setError('UPI ID and UPI number are required.');
                setLoading(false);
                return;
            }

            const payload = {
                name: orgData.name,
                type: orgData.type === 'Other' ? 'custom' : orgData.type,
                custom_type: orgData.type === 'Other' ? orgData.custom_type : null,
                address: orgData.address,
                google_maps_url: orgData.google_maps_url,
                upi_id: upiId,
                upi_number: upiNumber,
                users: appUsersPair,
                plans: plans.filter(p => p.name && p.amount).map(p => ({
                    ...p,
                    amount: parseFloat(p.amount)
                }))
            };

            if (csvFile) {
                const csvText = await csvFile.text();
                const plansForCsv = payload.plans.map(({ name }) => ({ name }));
                const { blockingError, warnings } = analyzeMemberCsvPlanColumn(csvText, plansForCsv);
                if (blockingError) {
                    setError(blockingError);
                    setLoading(false);
                    return;
                }
                if (warnings.length > 0) {
                    setCsvLocalNotice(warnings.join('\n\n'));
                }
            }

            const formData = new FormData();
            formData.append('payload', JSON.stringify(payload));

            const createRes = await api.post('/organisations', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            const orgId = createRes.data?.id;
            if (!orgId) {
                throw new Error('No organisation id in response');
            }

            if (csvFile) {
                const importFd = new FormData();
                importFd.append('file', csvFile);
                try {
                    const importRes = await api.post(`/organisations/${orgId}/members/import`, importFd, {
                        headers: { 'Content-Type': 'multipart/form-data' }
                    });
                    const preview = importRes.data;
                    if (preview?.import_id) {
                        setStagingOrgId(orgId);
                        setImportPreview(preview);
                        return;
                    }
                } catch (importErr) {
                    console.error('Member CSV import staging failed after org creation', importErr);
                    const msg = `Organisation was created, but staging the member CSV failed: ${resolveApiErrorMessage(importErr)}. Open this organisation and use Bulk Import CSV to try again.`;
                    navigate('/organisations', { state: { notice: msg } });
                    return;
                }
            }

            navigate('/organisations');

        } catch (err) {
            console.error('Failed to onboard org', err);
            setError(resolveApiErrorMessage(err) || 'Failed to create organisation');
        } finally {
            setLoading(false);
        }
    };

    const inputStyle = { flex: 1, border: 'none', outline: 'none', fontSize: '15px', background: 'transparent', color: 'var(--text-main)' };
    const rowStyle = { display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-color-strong)' };
    const labelStyle = { width: '140px', fontSize: '15px', color: 'var(--text-main)' };

    return (
        <>
            <Header title="Add Organisation" />
            <div className="content-area" style={{ flex: 1, padding: '0 40px 60px 40px', overflowY: 'auto' }}>
                <form onSubmit={handleOnboard} style={{ maxWidth: '700px', margin: '0 auto' }}>
                    
                    {error && (
                        <div style={{ marginBottom: '24px', padding: '16px', background: 'rgba(255, 59, 48, 0.1)', color: 'var(--ios-red)', borderRadius: '12px' }}>
                            {typeof error === 'string' ? error : JSON.stringify(error)}
                        </div>
                    )}

                    {importPreview ? (
                        <div className="ios-panel" style={{ overflow: 'hidden', padding: '24px', marginBottom: '24px' }}>
                            <div style={{ fontSize: '17px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '8px' }}>Import validation preview</div>
                            <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '20px' }}>
                                Review counts before confirming. Confirmed rows are written to member records for this organisation.
                            </p>
                            <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
                                <div style={{ background: 'rgba(52, 199, 89, 0.08)', padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(52, 199, 89, 0.25)', minWidth: '140px' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Valid rows</div>
                                    <div style={{ fontSize: '22px', fontWeight: '600', color: 'var(--ios-green)' }}>{importPreview.valid_rows}</div>
                                </div>
                                <div style={{ background: 'rgba(255, 59, 48, 0.06)', padding: '16px 20px', borderRadius: '12px', border: '1px solid rgba(255, 59, 48, 0.2)', minWidth: '140px' }}>
                                    <div style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Rows with errors</div>
                                    <div style={{ fontSize: '22px', fontWeight: '600', color: 'var(--ios-red)' }}>{importPreview.error_rows}</div>
                                </div>
                            </div>
                            {importPreview.errors?.length > 0 && (
                                <>
                                    <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>Error detail</div>
                                    <div style={{ maxHeight: '220px', overflowY: 'auto', border: '1px solid var(--border-color-strong)', borderRadius: '10px', background: '#F9F9FB' }}>
                                        {importPreview.errors.map((entry, idx) => (
                                            <div key={idx} style={{ padding: '10px 14px', borderBottom: idx === importPreview.errors.length - 1 ? 'none' : '1px solid var(--border-color)', fontSize: '13px' }}>
                                                <span style={{ fontWeight: '600', color: 'var(--text-main)', marginRight: '8px' }}>Row {entry.row}</span>
                                                <span style={{ color: 'var(--text-muted)' }}>{entry.reason}</span>
                                            </div>
                                        ))}
                                    </div>
                                </>
                            )}
                            {importPreview.expires_at && (
                                <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '14px', marginBottom: 0 }}>
                                    Staging expires {new Date(importPreview.expires_at).toLocaleString()}
                                </p>
                            )}
                            <div style={{ display: 'flex', gap: '12px', marginTop: '24px', flexWrap: 'wrap' }}>
                                <button
                                    type="button"
                                    className="btn-primary"
                                    disabled={loading || importPreview.valid_rows < 1}
                                    onClick={handleConfirmStagingImport}
                                    style={{ opacity: loading || importPreview.valid_rows < 1 ? 0.6 : 1 }}
                                >
                                    {loading ? 'Confirming…' : 'Confirm import'}
                                </button>
                                <button
                                    type="button"
                                    onClick={handleSkipStagingImport}
                                    disabled={loading}
                                    style={{ padding: '14px 20px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'transparent', fontWeight: '500', cursor: 'pointer', color: 'var(--text-main)' }}
                                >
                                    Skip (do not import)
                                </button>
                            </div>
                        </div>
                    ) : (
                        <>
                    <div style={{ marginBottom: '32px' }}>
                        <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', marginLeft: '16px' }}>
                            Organisation Details
                        </div>
                        <div className="ios-panel" style={{ overflow: 'hidden', padding: 0 }}>
                            <div style={rowStyle}>
                                <div style={labelStyle}>Name</div>
                                <input 
                                    required type="text" 
                                    value={orgData.name}
                                    onChange={e => handleOrgChange('name', e.target.value)}
                                    style={inputStyle} 
                                    placeholder="Acme Corp" 
                                />
                            </div>
                            <div style={{ ...rowStyle, borderBottom: orgData.type === 'Other' ? '1px solid var(--border-color-strong)' : 'none' }}>
                                <div style={labelStyle}>Category</div>
                                <div style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative' }}>
                                    <select 
                                        value={orgData.type} 
                                        onChange={(e) => handleOrgChange('type', e.target.value)}
                                        required
                                        style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px', background: 'transparent', color: 'var(--ios-blue)', appearance: 'none', cursor: 'pointer' }}
                                    >
                                        <option value="" disabled>Select Category</option>
                                        <option value="Gym">Gym & Fitness</option>
                                        <option value="Yoga">Yoga Studio</option>
                                        <option value="Dance">Dance Academy</option>
                                        <option value="Tuition">Tuition Centre</option>
                                        <option value="Other">Other</option>
                                    </select>
                                    <ion-icon name="chevron-down-outline" style={{ position: 'absolute', right: 0, color: 'var(--text-muted)', pointerEvents: 'none' }}></ion-icon>
                                </div>
                            </div>
                            {orgData.type === 'Other' && (
                                <div style={{ ...rowStyle, borderBottom: 'none' }}>
                                    <div style={labelStyle}>Specify Other</div>
                                    <input 
                                        required type="text" 
                                        value={orgData.custom_type}
                                        onChange={e => handleOrgChange('custom_type', e.target.value)}
                                        style={inputStyle} 
                                        placeholder="Custom Category" 
                                    />
                                </div>
                            )}
                            <div style={{ borderTop: '1px solid var(--border-color-strong)', ...rowStyle }}>
                                <div style={labelStyle}>Address (Optional)</div>
                                <input 
                                    type="text" 
                                    value={orgData.address}
                                    onChange={e => handleOrgChange('address', e.target.value)}
                                    style={inputStyle} 
                                    placeholder="123 Main St, Mumbai" 
                                />
                            </div>
                            <div style={rowStyle}>
                                <div style={labelStyle}>Maps URL (Optional)</div>
                                <input 
                                    type="url" 
                                    value={orgData.google_maps_url}
                                    onChange={e => handleOrgChange('google_maps_url', e.target.value)}
                                    style={inputStyle} 
                                    placeholder="https://maps.google.com/..." 
                                />
                            </div>
                            <div style={rowStyle}>
                                <div style={labelStyle}>UPI ID</div>
                                <input
                                    required
                                    type="text"
                                    value={orgData.upi_id}
                                    onChange={(e) => handleOrgChange('upi_id', e.target.value)}
                                    style={inputStyle}
                                    placeholder="merchant@paytm"
                                    autoComplete="off"
                                />
                            </div>
                            <div style={{ ...rowStyle, borderBottom: 'none' }}>
                                <div style={labelStyle}>UPI number</div>
                                <input
                                    required
                                    type="text"
                                    inputMode="numeric"
                                    value={orgData.upi_number}
                                    onChange={(e) => handleOrgChange('upi_number', e.target.value)}
                                    style={inputStyle}
                                    placeholder="Registered mobile or VPA number"
                                    autoComplete="off"
                                />
                            </div>
                        </div>
                    </div>

                    {[0, 1].map(index => (
                        <div key={index} style={{ marginBottom: '32px' }}>
                            <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', marginLeft: '16px' }}>
                                {index === 0 ? 'Primary User (User 1)' : 'Secondary User (User 2) — required'}
                            </div>
                            <div className="ios-panel" style={{ overflow: 'hidden', padding: 0 }}>
                                <div style={rowStyle}>
                                    <div style={labelStyle}>Full Name</div>
                                    <input 
                                        required type="text" 
                                        value={users[index].full_name}
                                        onChange={e => handleUserChange(index, 'full_name', e.target.value)}
                                        style={inputStyle} 
                                        placeholder={`Rahul Sharma`} 
                                    />
                                </div>
                                <div style={rowStyle}>
                                    <div style={labelStyle}>Username</div>
                                    <input 
                                        required type="text" 
                                        value={users[index].username}
                                        onChange={e => handleUserChange(index, 'username', e.target.value)}
                                        style={inputStyle} 
                                        placeholder={`user${index + 1}`} 
                                    />
                                </div>
                                <div style={rowStyle}>
                                    <div style={labelStyle}>Password</div>
                                    <input 
                                        required type="password" 
                                        value={users[index].password}
                                        onChange={e => handleUserChange(index, 'password', e.target.value)}
                                        style={inputStyle} 
                                        placeholder="Required" 
                                    />
                                </div>
                                <div style={rowStyle}>
                                    <div style={labelStyle}>Phone</div>
                                    <input 
                                        type="tel" 
                                        value={users[index].mobile}
                                        onChange={e => handleUserChange(index, 'mobile', e.target.value)}
                                        style={inputStyle} 
                                        placeholder="+91 98765 43210" 
                                    />
                                </div>
                                <div style={rowStyle}>
                                    <div style={labelStyle}>Email</div>
                                    <input 
                                        type="email" 
                                        value={users[index].email}
                                        onChange={e => handleUserChange(index, 'email', e.target.value)}
                                        style={inputStyle} 
                                        placeholder={`user${index + 1}@example.com`} 
                                    />
                                </div>
                                <div style={{ ...rowStyle, borderBottom: 'none' }}>
                                    <div style={labelStyle}>Role</div>
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative' }}>
                                        <select 
                                            value={users[index].role} 
                                            onChange={(e) => handleUserChange(index, 'role', e.target.value)}
                                            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px', background: 'transparent', color: 'var(--ios-blue)', appearance: 'none', cursor: 'pointer' }}
                                        >
                                            <option value="admin">Admin</option>
                                            <option value="staff">Staff</option>
                                        </select>
                                        <ion-icon name="chevron-down-outline" style={{ position: 'absolute', right: 0, color: 'var(--text-muted)', pointerEvents: 'none' }}></ion-icon>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}

                    <div style={{ marginBottom: '32px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px', marginLeft: '16px', marginRight: '16px' }}>
                            <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)' }}>
                                Membership Plans
                            </div>
                            {plans.length < 5 && (
                                <button type="button" onClick={addPlan} style={{ fontSize: '13px', color: 'var(--ios-blue)', background: 'transparent', border: 'none', cursor: 'pointer', fontWeight: '500' }}>
                                    + Add Plan
                                </button>
                            )}
                        </div>
                        
                        {plans.map((plan, index) => (
                            <div key={index} className="ios-panel" style={{ overflow: 'hidden', padding: 0, marginBottom: '16px', position: 'relative' }}>
                                {plans.length > 1 && (
                                    <button 
                                        type="button" 
                                        onClick={() => removePlan(index)}
                                        style={{ position: 'absolute', right: '16px', top: '14px', color: 'var(--ios-red)', background: 'transparent', border: 'none', cursor: 'pointer', zIndex: 10 }}
                                    >
                                        <ion-icon name="trash-outline" style={{ fontSize: '18px' }}></ion-icon>
                                    </button>
                                )}
                                <div style={rowStyle}>
                                    <div style={labelStyle}>Plan Name</div>
                                    <input 
                                        required type="text" 
                                        value={plan.name}
                                        onChange={e => handlePlanChange(index, 'name', e.target.value)}
                                        style={{ ...inputStyle, paddingRight: '30px' }} 
                                        placeholder="Standard Monthly" 
                                    />
                                </div>
                                <div style={rowStyle}>
                                    <div style={labelStyle}>Amount (₹)</div>
                                    <input 
                                        required type="number" step="0.01"
                                        value={plan.amount}
                                        onChange={e => handlePlanChange(index, 'amount', e.target.value)}
                                        style={inputStyle} 
                                        placeholder="1500" 
                                    />
                                </div>
                                <div style={rowStyle}>
                                    <div style={labelStyle}>Billing Cycle</div>
                                    <div style={{ flex: 1, display: 'flex', alignItems: 'center', position: 'relative' }}>
                                        <select 
                                            value={plan.billing_cycle} 
                                            onChange={(e) => handlePlanChange(index, 'billing_cycle', e.target.value)}
                                            style={{ flex: 1, border: 'none', outline: 'none', fontSize: '15px', background: 'transparent', color: 'var(--ios-blue)', appearance: 'none', cursor: 'pointer' }}
                                        >
                                            <option value="monthly">Monthly</option>
                                            <option value="quarterly">Quarterly</option>
                                            <option value="annual">Annual</option>
                                        </select>
                                        <ion-icon name="chevron-down-outline" style={{ position: 'absolute', right: 0, color: 'var(--text-muted)', pointerEvents: 'none' }}></ion-icon>
                                    </div>
                                </div>
                                <div style={{ ...rowStyle, borderBottom: 'none' }}>
                                    <div style={labelStyle}>Description (Opt)</div>
                                    <input 
                                        type="text" 
                                        value={plan.description}
                                        onChange={e => handlePlanChange(index, 'description', e.target.value)}
                                        style={inputStyle} 
                                        placeholder="Includes all equipment" 
                                    />
                                </div>
                            </div>
                        ))}
                    </div>

                    <div style={{ marginBottom: '32px' }}>
                        <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', marginLeft: '16px' }}>
                            1.4 Member import (optional)
                        </div>
                        <div className="ios-panel" style={{ overflow: 'hidden', padding: 0 }}>
                            <div style={{ ...rowStyle, flexDirection: 'column', alignItems: 'stretch', gap: '12px', borderBottom: '1px solid var(--border-color-strong)' }}>
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
                                    <div style={{ fontSize: '15px', color: 'var(--text-main)', fontWeight: '500' }}>CSV file</div>
                                    <button
                                        type="button"
                                        onClick={handleDownloadTemplateClick}
                                        disabled={templateDownloading}
                                        style={{ fontSize: '14px', color: 'var(--ios-blue)', background: 'transparent', border: 'none', cursor: templateDownloading ? 'default' : 'pointer', fontWeight: '500', padding: 0 }}
                                    >
                                        {templateDownloading ? 'Downloading…' : 'Download CSV template'}
                                    </button>
                                </div>
                                <input
                                    type="file"
                                    accept=".csv"
                                    onChange={(ev) => {
                                        const file = ev.target.files?.[0] || null;
                                        setCsvFile(file);
                                        setCsvLocalNotice('');
                                        setError('');
                                    }}
                                    style={{ fontSize: '14px', color: 'var(--text-muted)' }}
                                />
                                {csvFile && (
                                    <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>Selected: {csvFile.name}</div>
                                )}
                            </div>
                            {csvLocalNotice && (
                                <div
                                    role="note"
                                    style={{
                                        margin: '0 16px 12px',
                                        padding: '12px 14px',
                                        borderRadius: '10px',
                                        background: 'rgba(255, 149, 0, 0.1)',
                                        border: '1px solid rgba(255, 149, 0, 0.35)',
                                        fontSize: '13px',
                                        color: 'var(--text-main)',
                                        lineHeight: 1.5,
                                        whiteSpace: 'pre-wrap'
                                    }}
                                >
                                    {csvLocalNotice}
                                </div>
                            )}
                            <div style={{ padding: '14px 16px', fontSize: '13px', color: 'var(--text-muted)', lineHeight: 1.5 }}>
                                Template columns from the API use <strong>plan_name</strong> (not plan UUID)—for example:{' '}
                                <code style={{ fontSize: '12px', color: 'var(--text-main)' }}>{MEMBER_CSV_HEADER_HINT}</code>. After you submit, plans are created from the section above—use those <strong>exact plan names</strong> in the CSV (matching is case-insensitive after trimming). Duplicate plan names in that list will cause import failures. Legacy files with only <strong>plan_id</strong> must be updated. You’ll preview staged rows before confirming import.
                            </div>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        className="btn-primary" 
                        disabled={loading}
                        style={{ opacity: loading ? 0.7 : 1, marginTop: '16px' }}
                    >
                        {loading ? 'Creating...' : 'Onboard Organisation'}
                    </button>
                        </>
                    )}

                </form>
            </div>
        </>
    );
}
