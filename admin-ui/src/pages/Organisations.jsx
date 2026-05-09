import React, { useState, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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

export default function Organisations() {
    const location = useLocation();
    const navigate = useNavigate();
    const [organisations, setOrganisations] = useState([]);
    const [selectedOrgId, setSelectedOrgId] = useState(null);
    const [orgDetail, setOrgDetail] = useState(null);
    const [orgMembers, setOrgMembers] = useState([]);
    const [loadingOrgs, setLoadingOrgs] = useState(true);
    const [loadingDetail, setLoadingDetail] = useState(false);
    const [search, setSearch] = useState('');
    
    const [isEditing, setIsEditing] = useState(false);
    const [editForm, setEditForm] = useState({
        name: '',
        type: '',
        custom_type: '',
        address: '',
        maps_url: '',
        upi_id: '',
        upi_number: '',
        whatsapp_enabled: true,
        sms_enabled: false
    });
    const [savingEdit, setSavingEdit] = useState(false);

    const [notice, setNotice] = useState('');
    const [bulkImportOpen, setBulkImportOpen] = useState(false);
    const [bulkImportStep, setBulkImportStep] = useState('upload');
    const [bulkFile, setBulkFile] = useState(null);
    const [bulkPreview, setBulkPreview] = useState(null);
    const [bulkLoading, setBulkLoading] = useState(false);
    const [bulkError, setBulkError] = useState('');
    const [templateDownloading, setTemplateDownloading] = useState(false);
    const [planNameCopiedRowId, setPlanNameCopiedRowId] = useState(null);
    const [bulkCsvWarnings, setBulkCsvWarnings] = useState([]);

    useEffect(() => {
        if (location.state?.notice) {
            setNotice(location.state.notice);
            navigate(`${location.pathname}${location.search}`, { replace: true, state: {} });
        }
    }, [location.pathname, location.search, location.state, navigate]);

    useEffect(() => {
        fetchOrganisations();
    }, [search]);

    useEffect(() => {
        if (selectedOrgId) {
            fetchOrgDetail(selectedOrgId);
        } else {
            setOrgDetail(null);
            setOrgMembers([]);
        }
    }, [selectedOrgId]);

    const fetchOrganisations = async () => {
        try {
            const res = await api.get('/organisations', { params: { search, limit: 100 } });
            setOrganisations(res.data.data || []);
            if (!selectedOrgId && res.data.data?.length > 0) {
                setSelectedOrgId(res.data.data[0].id);
            }
        } catch (err) {
            console.error('Failed to fetch orgs', err);
        } finally {
            setLoadingOrgs(false);
        }
    };

    const fetchOrgDetail = async (orgId) => {
        setLoadingDetail(true);
        try {
            const [detailRes, membersRes] = await Promise.all([
                api.get(`/organisations/${orgId}`),
                api.get(`/organisations/${orgId}/members`, { params: { limit: 100 } })
            ]);
            setOrgDetail(detailRes.data);
            setOrgMembers(membersRes.data.data || []);
        } catch (err) {
            console.error('Failed to fetch org detail', err);
        } finally {
            setLoadingDetail(false);
        }
    };

    const toggleStatus = async () => {
        if (!orgDetail) return;
        const newStatus = orgDetail.status === 'active' ? 'paused' : 'active';
        try {
            await api.patch(`/organisations/${orgDetail.id}/status`, { status: newStatus });
            setOrgDetail({ ...orgDetail, status: newStatus });
            setOrganisations(organisations.map(o => o.id === orgDetail.id ? { ...o, status: newStatus } : o));
        } catch (err) {
            console.error('Failed to toggle status', err);
        }
    };

    const handleEditClick = () => {
        setEditForm({
            name: orgDetail.name || '',
            type: orgDetail.type || '',
            custom_type: orgDetail.custom_type || '',
            address: orgDetail.address || '',
            maps_url: orgDetail.maps_url || '',
            upi_id: orgDetail.upi_id ?? '',
            upi_number: orgDetail.upi_number ?? '',
            whatsapp_enabled: orgDetail.whatsapp_enabled ?? true,
            sms_enabled: orgDetail.sms_enabled ?? false
        });
        setIsEditing(true);
    };

    const handleSaveEdit = async (e) => {
        e.preventDefault();
        const upiId = (editForm.upi_id || '').trim();
        const upiNumber = (editForm.upi_number || '').trim();
        if (!upiId || !upiNumber) {
            alert('UPI ID and UPI number are required.');
            return;
        }
        setSavingEdit(true);
        try {
            const payload = {
                name: editForm.name,
                type: editForm.type === 'Other' ? 'custom' : editForm.type,
                custom_type: editForm.type === 'Other' ? editForm.custom_type : null,
                address: editForm.address,
                maps_url: editForm.maps_url,
                upi_id: upiId,
                upi_number: upiNumber,
                whatsapp_enabled: !!editForm.whatsapp_enabled,
                sms_enabled: !!editForm.sms_enabled
            };

            const formData = new FormData();
            formData.append('payload', JSON.stringify(payload));

            await api.put(`/organisations/${orgDetail.id}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            // Refetch detail and list
            await fetchOrgDetail(orgDetail.id);
            fetchOrganisations();
            setIsEditing(false);
        } catch (err) {
            console.error('Failed to update organisation', err);
            alert('Failed to update organisation. Please check inputs.');
        } finally {
            setSavingEdit(false);
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

    const openBulkImportModal = () => {
        setBulkImportOpen(true);
        setBulkImportStep('upload');
        setBulkFile(null);
        setBulkPreview(null);
        setBulkError('');
        setBulkCsvWarnings([]);
        setBulkLoading(false);
    };

    const resetBulkImportModal = () => {
        setBulkImportOpen(false);
        setBulkImportStep('upload');
        setBulkPreview(null);
        setBulkFile(null);
        setBulkError('');
        setBulkCsvWarnings([]);
    };

    const closeBulkImportModal = () => {
        if (bulkLoading) return;
        resetBulkImportModal();
    };

    const handleBulkDownloadTemplate = async (e) => {
        e.preventDefault();
        setBulkError('');
        setTemplateDownloading(true);
        try {
            await downloadMembersCsvTemplate();
        } catch (err) {
            console.error('CSV template download failed', err);
            setBulkError(resolveApiErrorMessage(err) || 'Failed to download CSV template');
        } finally {
            setTemplateDownloading(false);
        }
    };

    const handleBulkValidate = async () => {
        if (!orgDetail?.id || !bulkFile) {
            setBulkError('Choose a CSV file first.');
            return;
        }
        setBulkLoading(true);
        setBulkError('');
        setBulkCsvWarnings([]);
        try {
            const csvText = await bulkFile.text();
            const { blockingError, warnings } = analyzeMemberCsvPlanColumn(csvText, orgDetail.plans || []);
            if (blockingError) {
                setBulkError(blockingError);
                return;
            }
            setBulkCsvWarnings(warnings);
            const fd = new FormData();
            fd.append('file', bulkFile);
            const res = await api.post(`/organisations/${orgDetail.id}/members/import`, fd, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            const preview = res.data;
            if (!preview?.import_id) {
                setBulkError('Unexpected response from import (missing import id).');
                return;
            }
            setBulkPreview(preview);
            setBulkImportStep('preview');
        } catch (err) {
            console.error('Bulk import staging failed', err);
            setBulkError(resolveApiErrorMessage(err));
        } finally {
            setBulkLoading(false);
        }
    };

    const handleBulkConfirm = async () => {
        if (!orgDetail?.id || !bulkPreview?.import_id) return;
        setBulkLoading(true);
        setBulkError('');
        try {
            await api.post(`/organisations/${orgDetail.id}/members/import/${bulkPreview.import_id}/confirm`);
            await fetchOrgDetail(orgDetail.id);
            resetBulkImportModal();
        } catch (err) {
            console.error('Confirm import failed', err);
            setBulkError(resolveApiErrorMessage(err));
        } finally {
            setBulkLoading(false);
        }
    };

    const handleBulkSkip = () => {
        closeBulkImportModal();
    };

    const copyCsvPlanLabel = async (planRowId, exactName) => {
        try {
            await navigator.clipboard.writeText(exactName);
            setPlanNameCopiedRowId(planRowId);
            window.setTimeout(
                () => setPlanNameCopiedRowId((prev) => (prev === planRowId ? null : prev)),
                1600
            );
        } catch {
            setNotice('Unable to copy to clipboard.');
        }
    };

    const inputStyle = { flex: 1, border: 'none', outline: 'none', fontSize: '15px', background: 'transparent', color: 'var(--text-main)' };
    const rowStyle = { display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-color-strong)' };
    const labelStyle = { width: '120px', fontSize: '15px', color: 'var(--text-main)' };

    return (
        <>
            <Header title="Organisations" />
            <div className="content-area" style={{ flex: 1, padding: '0 40px 40px 40px', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
                {notice ? (
                    <div
                        role="alert"
                        style={{
                            marginBottom: '16px',
                            padding: '14px 18px',
                            borderRadius: '12px',
                            background: 'rgba(0, 122, 255, 0.08)',
                            border: '1px solid rgba(0, 122, 255, 0.25)',
                            color: 'var(--text-main)',
                            fontSize: '14px',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'flex-start',
                            gap: '12px'
                        }}
                    >
                        <span>{notice}</span>
                        <button
                            type="button"
                            onClick={() => setNotice('')}
                            style={{ flexShrink: 0, border: 'none', background: 'transparent', cursor: 'pointer', color: 'var(--text-muted)', fontSize: '20px', lineHeight: 1, padding: 0 }}
                            aria-label="Dismiss"
                        >
                            &times;
                        </button>
                    </div>
                ) : null}
                <div style={{ display: 'flex', gap: '24px', flex: 1, minHeight: 0 }}>
                    
                    {/* Master List */}
                    <div className="ios-panel" style={{ width: '340px', display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                        <div style={{ padding: '16px', borderBottom: '1px solid var(--border-color)', background: '#fff' }}>
                            <div style={{ display: 'flex', alignItems: 'center', background: 'var(--ios-gray-light)', padding: '8px 16px', borderRadius: '10px', gap: '8px', color: 'var(--text-muted)' }}>
                                <ion-icon name="search-outline"></ion-icon>
                                <input 
                                    type="text" 
                                    placeholder="Search organisations..." 
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    style={{ border: 'none', background: 'transparent', outline: 'none', fontSize: '15px', width: '100%', color: 'var(--text-main)' }} 
                                />
                            </div>
                        </div>
                        <div style={{ flex: 1, overflowY: 'auto' }}>
                            {loadingOrgs ? (
                                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
                            ) : organisations.length === 0 ? (
                                <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text-muted)' }}>No organisations found.</div>
                            ) : (
                                organisations.map((org) => (
                                    <div 
                                        key={org.id}
                                        onClick={() => setSelectedOrgId(org.id)}
                                        style={{ 
                                            padding: '16px', 
                                            borderBottom: '1px solid var(--border-color)', 
                                            cursor: 'pointer', 
                                            background: selectedOrgId === org.id ? 'var(--active-bg)' : 'transparent', 
                                            borderLeft: selectedOrgId === org.id ? '4px solid var(--ios-blue)' : '4px solid transparent' 
                                        }}
                                    >
                                        <div style={{ fontWeight: '600', fontSize: '15px', color: 'var(--text-main)', marginBottom: '6px' }}>{org.name}</div>
                                        <div style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                                            {org.custom_type || org.type}
                                            <span className={org.status === 'paused' ? "status-badge status-paused" : "status-badge status-active"}>
                                                {org.status === 'paused' ? 'Paused' : 'Active'}
                                            </span>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                    {/* Detail View */}
                    <div className="ios-panel" style={{ flex: 1, display: 'flex', flexDirection: 'column', padding: 0, overflow: 'hidden' }}>
                        {loadingDetail ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)' }}>Loading Details...</div>
                        ) : !orgDetail ? (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', flex: 1, color: 'var(--text-muted)' }}>Select an organisation</div>
                        ) : (
                            <>
                                <div style={{ padding: '24px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                                    <div>
                                        <h2 style={{ fontSize: '24px', marginBottom: '8px', color: 'var(--text-main)' }}>{orgDetail.name}</h2>
                                        <div style={{ fontSize: '14px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                                            <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}><ion-icon name="folder-outline"></ion-icon> {orgDetail.custom_type || orgDetail.type}</span>
                                            <span className={orgDetail.status === 'paused' ? "status-badge status-paused" : "status-badge status-active"}>
                                                {orgDetail.status === 'paused' ? 'Paused' : 'Active'}
                                            </span>
                                        </div>
                                    </div>
                                    <div style={{ display: 'flex', gap: '12px' }}>
                                        <button 
                                            className={`btn ${orgDetail.status === 'paused' ? 'btn-active' : 'btn-pause'}`} 
                                            onClick={toggleStatus}
                                            style={orgDetail.status === 'paused' ? { background: 'rgba(52, 199, 89, 0.1)', color: 'var(--ios-green)' } : {}}
                                        >
                                            <ion-icon name={orgDetail.status === 'paused' ? "play-circle-outline" : "pause-circle-outline"}></ion-icon> 
                                            {orgDetail.status === 'paused' ? 'Resume Org' : 'Pause Org'}
                                        </button>
                                        <button className="btn btn-edit" onClick={handleEditClick}>
                                            <ion-icon name="create-outline"></ion-icon> Edit
                                        </button>
                                    </div>
                                </div>

                                <div style={{ padding: '24px', overflowY: 'auto', flex: 1 }}>
                                    
                                    <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '12px' }}>Overview</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '16px' }}>
                                        <div style={{ background: '#F9F9FB', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>Total Members</div>
                                            <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-main)' }}>{orgDetail.member_count || 0}</div>
                                        </div>
                                        <div style={{ background: '#F9F9FB', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>Messages (Month)</div>
                                            <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-main)' }}>{orgDetail.message_count_month || 0}</div>
                                        </div>
                                        <div style={{ background: '#F9F9FB', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                            <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>Created At</div>
                                            <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-main)' }}>{new Date(orgDetail.created_at).toLocaleDateString()}</div>
                                        </div>
                                    </div>

                                    <div style={{ marginTop: '20px' }}>
                                        <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '12px' }}>UPI payments</div>
                                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))', gap: '16px' }}>
                                            <div style={{ background: '#F9F9FB', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>UPI ID</div>
                                                <div style={{ fontSize: '15px', fontWeight: '600', color: orgDetail.upi_id ? 'var(--text-main)' : 'var(--text-muted)', wordBreak: 'break-all', fontStyle: orgDetail.upi_id ? 'normal' : 'italic' }}>
                                                    {orgDetail.upi_id || '—'}
                                                </div>
                                            </div>
                                            <div style={{ background: '#F9F9FB', padding: '16px', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
                                                <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '4px', textTransform: 'uppercase', fontWeight: '600' }}>UPI number</div>
                                                <div style={{ fontSize: '15px', fontWeight: '600', color: orgDetail.upi_number ? 'var(--text-main)' : 'var(--text-muted)', wordBreak: 'break-all', fontStyle: orgDetail.upi_number ? 'normal' : 'italic' }}>
                                                    {orgDetail.upi_number || '—'}
                                                </div>
                                            </div>
                                        </div>
                                    </div>

                                    <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '12px', marginTop: '32px' }}>Admin Users (App Logins)</div>
                                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                                        {orgDetail.users?.map((u, i) => (
                                            <div key={i} style={{ background: '#fff', border: '1px solid var(--border-color-strong)', borderRadius: '12px', padding: '16px', display: 'flex', gap: '16px', alignItems: 'center' }}>
                                                <div style={{ width: '48px', height: '48px', borderRadius: '50%', background: 'var(--active-bg)', color: 'var(--ios-blue)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '20px', fontWeight: '600' }}>
                                                    {u.full_name?.charAt(0) || u.username.charAt(0).toUpperCase()}
                                                </div>
                                                <div>
                                                    <h4 style={{ fontSize: '15px', marginBottom: '4px', color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                                                        {u.username}
                                                        {u.role && <span style={{ fontSize: '11px', padding: '2px 8px', background: 'var(--ios-gray-light)', borderRadius: '10px', color: 'var(--text-muted)' }}>{u.role}</span>}
                                                    </h4>
                                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}><ion-icon name="person-outline"></ion-icon> {u.full_name || 'N/A'}</p>
                                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px', marginBottom: '2px' }}><ion-icon name="mail-outline"></ion-icon> {u.email || 'N/A'}</p>
                                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '4px' }}><ion-icon name="call-outline"></ion-icon> {u.mobile || 'N/A'}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>

                                    <div style={{ marginBottom: '12px', marginTop: '32px' }}>
                                        <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)' }}>Membership Plans</div>
                                        <p style={{ fontSize: '13px', color: 'var(--text-muted)', margin: '8px 0 0 0', lineHeight: 1.45 }}>
                                            Member CSV uses a <strong>plan_name</strong> column—the server matches it to these names case-insensitively (trimmed). Duplicate plan names on the same org will fail import; rename plans so each label is unique for matching.
                                        </p>
                                    </div>
                                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: '16px' }}>
                                        {orgDetail.plans?.length > 0 ? orgDetail.plans.map((p, i) => (
                                            <div key={p.id || i} style={{ background: '#fff', border: '1px solid var(--border-color-strong)', borderRadius: '12px', padding: '16px' }}>
                                                <h4 style={{ fontSize: '15px', marginBottom: '8px', color: 'var(--text-main)' }}>{p.name}</h4>
                                                <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                                                    <span style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase' }}>CSV plan_name</span>
                                                    <code style={{ fontSize: '12px', color: 'var(--text-main)', background: '#F9F9FB', padding: '4px 8px', borderRadius: '6px', border: '1px solid var(--border-color)', wordBreak: 'break-word' }}>
                                                        {p.name}
                                                    </code>
                                                    <button
                                                        type="button"
                                                        onClick={() => copyCsvPlanLabel(p.id || `idx-${i}`, p.name)}
                                                        style={{ border: 'none', background: 'var(--ios-gray-light)', borderRadius: '8px', padding: '6px 10px', cursor: 'pointer', fontSize: '12px', color: 'var(--ios-blue)', fontWeight: '500', display: 'flex', alignItems: 'center', gap: '4px' }}
                                                    >
                                                        <ion-icon name="copy-outline" style={{ fontSize: '14px' }}></ion-icon>
                                                        {planNameCopiedRowId === (p.id || `idx-${i}`) ? 'Copied' : 'Copy name'}
                                                    </button>
                                                </div>
                                                <div style={{ fontSize: '18px', fontWeight: '600', color: 'var(--text-main)', marginBottom: '4px' }}>₹{p.amount.toFixed(2)} <span style={{ fontSize: '12px', color: 'var(--text-muted)', fontWeight: '400' }}>/{p.billing_cycle}</span></div>
                                                {p.description && <p style={{ fontSize: '13px', color: 'var(--text-muted)' }}>{p.description}</p>}
                                            </div>
                                        )) : (
                                            <div style={{ color: 'var(--text-muted)', fontSize: '14px', padding: '16px', background: '#F9F9FB', borderRadius: '12px' }}>No plans configured.</div>
                                        )}
                                    </div>

                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px', marginTop: '32px', flexWrap: 'wrap', gap: '12px' }}>
                                        <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)' }}>
                                            Added Members
                                        </div>
                                        <button type="button" className="btn btn-edit" onClick={openBulkImportModal}>
                                            <ion-icon name="cloud-upload-outline"></ion-icon> Bulk Import CSV
                                        </button>
                                    </div>
                                    <div style={{ border: '1px solid var(--border-color-strong)', borderRadius: '12px', overflow: 'hidden' }}>
                                        <table style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                                            <thead>
                                                <tr>
                                                    <th style={{ textAlign: 'left', padding: '14px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px', background: '#F9F9FB' }}>Name</th>
                                                    <th style={{ textAlign: 'left', padding: '14px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px', background: '#F9F9FB' }}>Mobile</th>
                                                    <th style={{ textAlign: 'left', padding: '14px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px', background: '#F9F9FB' }}>Plan</th>
                                                    <th style={{ textAlign: 'left', padding: '14px 16px', borderBottom: '1px solid var(--border-color)', fontWeight: '600', color: 'var(--text-muted)', textTransform: 'uppercase', fontSize: '12px', background: '#F9F9FB' }}>Join Date</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {orgMembers.length === 0 ? (
                                                    <tr>
                                                        <td colSpan="4" style={{ textAlign: 'center', padding: '24px', color: 'var(--text-muted)' }}>No members found.</td>
                                                    </tr>
                                                ) : orgMembers.map((m) => (
                                                    <tr key={m.id}>
                                                        <td style={{ textAlign: 'left', padding: '14px 16px', borderBottom: '1px solid var(--border-color)', fontSize: '14px', fontWeight: '500', color: 'var(--text-main)' }}>{m.full_name}</td>
                                                        <td style={{ textAlign: 'left', padding: '14px 16px', borderBottom: '1px solid var(--border-color)', fontSize: '14px' }}>{m.mobile}</td>
                                                        <td style={{ textAlign: 'left', padding: '14px 16px', borderBottom: '1px solid var(--border-color)', fontSize: '14px' }}>{m.plan_name || 'N/A'}</td>
                                                        <td style={{ textAlign: 'left', padding: '14px 16px', borderBottom: '1px solid var(--border-color)', fontSize: '14px' }}>{m.join_date ? new Date(m.join_date).toLocaleDateString() : 'N/A'}</td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>

                                </div>
                            </>
                        )}
                    </div>

                </div>
            </div>

            {/* Bulk CSV import */}
            {bulkImportOpen && orgDetail && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="ios-panel" style={{ width: 'min(560px, 92vw)', maxHeight: '90vh', padding: '0', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
                            <div>
                                <h3 style={{ margin: '0 0 4px 0', fontSize: '18px', color: 'var(--text-main)' }}>Bulk Import CSV</h3>
                                <div style={{ fontSize: '13px', color: 'var(--text-muted)' }}>
                                    {bulkImportStep === 'upload' ? 'Step 1: Upload CSV' : 'Step 2: Validate & Preview'}
                                </div>
                            </div>
                            <button
                                type="button"
                                onClick={closeBulkImportModal}
                                disabled={bulkLoading}
                                style={{ background: 'transparent', border: 'none', cursor: bulkLoading ? 'default' : 'pointer', fontSize: '24px', color: 'var(--text-muted)' }}
                            >
                                &times;
                            </button>
                        </div>
                        <div style={{ padding: '20px', overflowY: 'auto', flex: 1 }}>
                            {bulkError && (
                                <div style={{ marginBottom: '16px', padding: '12px 14px', background: 'rgba(255, 59, 48, 0.1)', color: 'var(--ios-red)', borderRadius: '10px', fontSize: '14px' }}>
                                    {typeof bulkError === 'string' ? bulkError : JSON.stringify(bulkError)}
                                </div>
                            )}
                            {bulkCsvWarnings.length > 0 && (
                                <div
                                    role="note"
                                    style={{
                                        marginBottom: '16px',
                                        padding: '12px 14px',
                                        background: 'rgba(255, 149, 0, 0.1)',
                                        color: 'var(--text-main)',
                                        borderRadius: '10px',
                                        fontSize: '13px',
                                        lineHeight: 1.5,
                                        border: '1px solid rgba(255, 149, 0, 0.35)'
                                    }}
                                >
                                    {bulkCsvWarnings.map((w, i) => (
                                        <div key={i} style={{ marginBottom: i === bulkCsvWarnings.length - 1 ? 0 : '10px' }}>
                                            {w}
                                        </div>
                                    ))}
                                </div>
                            )}
                            {bulkImportStep === 'upload' ? (
                                <>
                                    <p style={{ fontSize: '14px', color: 'var(--text-muted)', marginTop: 0, marginBottom: '12px', lineHeight: 1.5 }}>
                                        Upload a CSV to stage members for <strong>{orgDetail.name}</strong>. The file must include a <strong>plan_name</strong> column (see template from <strong>Download CSV template</strong>—headers match <code style={{ fontSize: '12px' }}>{MEMBER_CSV_HEADER_HINT}</code> or the API’s <code style={{ fontSize: '12px' }}>X-CSV-Headers</code>).
                                    </p>
                                    <p style={{ fontSize: '13px', color: 'var(--text-muted)', marginTop: 0, marginBottom: '16px', lineHeight: 1.5 }}>
                                        Use the <strong>exact plan_name</strong> strings shown under Membership Plans (matching is case-insensitive after trimming). Legacy sheets with <strong>plan_id</strong> (UUID) will be rejected—replace that column with plan names.
                                    </p>
                                    <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '12px' }}>
                                        <button
                                            type="button"
                                            onClick={handleBulkDownloadTemplate}
                                            disabled={templateDownloading}
                                            style={{ fontSize: '14px', color: 'var(--ios-blue)', background: 'transparent', border: 'none', cursor: templateDownloading ? 'default' : 'pointer', fontWeight: '500' }}
                                        >
                                            {templateDownloading ? 'Downloading…' : 'Download CSV template'}
                                        </button>
                                    </div>
                                    <input
                                        type="file"
                                        accept=".csv"
                                        onChange={(ev) => {
                                            setBulkFile(ev.target.files?.[0] || null);
                                            setBulkCsvWarnings([]);
                                            setBulkError('');
                                        }}
                                        style={{ fontSize: '14px', color: 'var(--text-muted)', marginBottom: '8px', width: '100%' }}
                                    />
                                    {bulkFile && <div style={{ fontSize: '13px', color: 'var(--text-muted)', marginBottom: '8px' }}>Selected: {bulkFile.name}</div>}
                                    <div style={{ display: 'flex', gap: '12px', marginTop: '20px', flexWrap: 'wrap' }}>
                                        <button
                                            type="button"
                                            className="btn-primary"
                                            disabled={bulkLoading || !bulkFile}
                                            onClick={handleBulkValidate}
                                            style={{ flex: '1 1 140px' }}
                                        >
                                            {bulkLoading ? 'Validating…' : 'Validate & preview'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleBulkSkip}
                                            disabled={bulkLoading}
                                            style={{
                                                flex: '1 1 120px',
                                                padding: '14px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-color)',
                                                background: 'transparent',
                                                fontWeight: '500',
                                                cursor: 'pointer',
                                                color: 'var(--text-main)'
                                            }}
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <div style={{ display: 'flex', gap: '16px', marginBottom: '20px', flexWrap: 'wrap' }}>
                                        <div style={{ background: 'rgba(52, 199, 89, 0.08)', padding: '14px 18px', borderRadius: '12px', border: '1px solid rgba(52, 199, 89, 0.25)', minWidth: '120px', flex: 1 }}>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Valid rows</div>
                                            <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--ios-green)' }}>{bulkPreview?.valid_rows}</div>
                                        </div>
                                        <div style={{ background: 'rgba(255, 59, 48, 0.06)', padding: '14px 18px', borderRadius: '12px', border: '1px solid rgba(255, 59, 48, 0.2)', minWidth: '120px', flex: 1 }}>
                                            <div style={{ fontSize: '11px', color: 'var(--text-muted)', fontWeight: '600', textTransform: 'uppercase', marginBottom: '4px' }}>Rows with errors</div>
                                            <div style={{ fontSize: '20px', fontWeight: '600', color: 'var(--ios-red)' }}>{bulkPreview?.error_rows}</div>
                                        </div>
                                    </div>
                                    {bulkPreview?.errors?.length > 0 && (
                                        <>
                                            <div style={{ fontSize: '13px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px' }}>Error detail</div>
                                            <div style={{ maxHeight: '200px', overflowY: 'auto', border: '1px solid var(--border-color-strong)', borderRadius: '10px', background: '#F9F9FB', marginBottom: '12px' }}>
                                                {bulkPreview.errors.map((entry, idx) => (
                                                    <div
                                                        key={idx}
                                                        style={{
                                                            padding: '10px 14px',
                                                            borderBottom: idx === bulkPreview.errors.length - 1 ? 'none' : '1px solid var(--border-color)',
                                                            fontSize: '13px'
                                                        }}
                                                    >
                                                        <span style={{ fontWeight: '600', color: 'var(--text-main)', marginRight: '8px' }}>Row {entry.row}</span>
                                                        <span style={{ color: 'var(--text-muted)' }}>{entry.reason}</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                    {bulkPreview?.expires_at && (
                                        <p style={{ fontSize: '12px', color: 'var(--text-muted)', marginBottom: '16px', marginTop: 0 }}>
                                            Staging expires {new Date(bulkPreview.expires_at).toLocaleString()}
                                        </p>
                                    )}
                                    <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                                        <button
                                            type="button"
                                            className="btn-primary"
                                            disabled={bulkLoading || (bulkPreview?.valid_rows ?? 0) < 1}
                                            onClick={handleBulkConfirm}
                                            style={{ flex: '1 1 160px', opacity: (bulkPreview?.valid_rows ?? 0) < 1 ? 0.6 : 1 }}
                                        >
                                            {bulkLoading ? 'Confirming…' : 'Confirm import'}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleBulkSkip}
                                            disabled={bulkLoading}
                                            style={{
                                                flex: '1 1 140px',
                                                padding: '14px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-color)',
                                                background: 'transparent',
                                                fontWeight: '500',
                                                cursor: 'pointer',
                                                color: 'var(--text-main)'
                                            }}
                                        >
                                            Skip (discard staging)
                                        </button>
                                        <button
                                            type="button"
                                            onClick={() => {
                                                setBulkImportStep('upload');
                                                setBulkPreview(null);
                                                setBulkError('');
                                            }}
                                            disabled={bulkLoading}
                                            style={{
                                                flex: '1 1 120px',
                                                padding: '14px',
                                                borderRadius: '12px',
                                                border: '1px solid var(--border-color)',
                                                background: '#F9F9FB',
                                                fontWeight: '500',
                                                cursor: 'pointer',
                                                color: 'var(--text-main)'
                                            }}
                                        >
                                            Different file
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </div>
                </div>
            )}

            {/* Edit Modal */}
            {isEditing && (
                <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
                    <div className="ios-panel" style={{ width: '500px', padding: '0', display: 'flex', flexDirection: 'column' }}>
                        <div style={{ padding: '20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <h3 style={{ margin: 0, fontSize: '18px', color: 'var(--text-main)' }}>Edit Organisation</h3>
                            <button onClick={() => setIsEditing(false)} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '24px', color: 'var(--text-muted)' }}>&times;</button>
                        </div>
                        <form onSubmit={handleSaveEdit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
                            <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                                <div style={rowStyle}>
                                    <div style={labelStyle}>Name</div>
                                    <input required type="text" value={editForm.name} onChange={e => setEditForm({...editForm, name: e.target.value})} style={inputStyle} />
                                </div>
                                <div style={{ ...rowStyle, borderBottom: editForm.type === 'Other' ? '1px solid var(--border-color-strong)' : 'none' }}>
                                    <div style={labelStyle}>Category</div>
                                    <select value={editForm.type} onChange={e => setEditForm({...editForm, type: e.target.value})} style={{ ...inputStyle, cursor: 'pointer' }}>
                                        <option value="Gym">Gym & Fitness</option>
                                        <option value="Yoga">Yoga Studio</option>
                                        <option value="Dance">Dance Academy</option>
                                        <option value="Tuition">Tuition Centre</option>
                                        <option value="Other">Other</option>
                                        {/* Preserve original custom types if they don't match the defaults */}
                                        {!['Gym', 'Yoga', 'Dance', 'Tuition', 'Other', 'custom'].includes(editForm.type) && editForm.type && (
                                            <option value={editForm.type}>{editForm.type}</option>
                                        )}
                                        {editForm.type === 'custom' && <option value="custom">Custom</option>}
                                    </select>
                                </div>
                                {(editForm.type === 'Other' || editForm.type === 'custom') && (
                                    <div style={{ ...rowStyle, borderBottom: 'none' }}>
                                        <div style={labelStyle}>Specify Other</div>
                                        <input required type="text" value={editForm.custom_type} onChange={e => setEditForm({...editForm, custom_type: e.target.value})} style={inputStyle} />
                                    </div>
                                )}
                                <div style={{ ...rowStyle, borderTop: '1px solid var(--border-color-strong)' }}>
                                    <div style={labelStyle}>Address</div>
                                    <input type="text" value={editForm.address} onChange={e => setEditForm({...editForm, address: e.target.value})} style={inputStyle} placeholder="Optional" />
                                </div>
                                <div style={rowStyle}>
                                    <div style={labelStyle}>Maps URL</div>
                                    <input type="url" value={editForm.maps_url} onChange={e => setEditForm({...editForm, maps_url: e.target.value})} style={inputStyle} placeholder="Optional" />
                                </div>
                                <div style={rowStyle}>
                                    <div style={labelStyle}>UPI ID</div>
                                    <input
                                        required
                                        type="text"
                                        value={editForm.upi_id}
                                        onChange={(e) => setEditForm({ ...editForm, upi_id: e.target.value })}
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
                                        value={editForm.upi_number}
                                        onChange={(e) => setEditForm({ ...editForm, upi_number: e.target.value })}
                                        style={inputStyle}
                                        placeholder="Registered mobile or VPA number"
                                        autoComplete="off"
                                    />
                                </div>
                            </div>
                            <div style={{ marginTop: '4px' }}>
                                <div style={{ fontSize: '13px', textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: '600', color: 'var(--text-muted)', marginBottom: '8px', marginLeft: '6px' }}>
                                    Messaging channels
                                </div>
                                <div style={{ border: '1px solid var(--border-color)', borderRadius: '12px', overflow: 'hidden' }}>
                                    <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', borderBottom: '1px solid var(--border-color-strong)', justifyContent: 'space-between' }}>
                                        <div style={{ fontSize: '15px', color: 'var(--text-main)' }}>WhatsApp enabled</div>
                                        <input
                                            type="checkbox"
                                            checked={!!editForm.whatsapp_enabled}
                                            onChange={(e) => setEditForm({ ...editForm, whatsapp_enabled: e.target.checked })}
                                        />
                                    </div>
                                    <div style={{ display: 'flex', alignItems: 'center', padding: '14px 16px', justifyContent: 'space-between' }}>
                                        <div style={{ fontSize: '15px', color: 'var(--text-main)' }}>SMS enabled</div>
                                        <input
                                            type="checkbox"
                                            checked={!!editForm.sms_enabled}
                                            onChange={(e) => setEditForm({ ...editForm, sms_enabled: e.target.checked })}
                                        />
                                    </div>
                                </div>
                            </div>
                            <div style={{ display: 'flex', gap: '12px', marginTop: '8px' }}>
                                <button type="button" onClick={() => setIsEditing(false)} style={{ flex: 1, padding: '14px', borderRadius: '12px', border: '1px solid var(--border-color)', background: 'transparent', fontWeight: '500', cursor: 'pointer', color: 'var(--text-main)' }}>Cancel</button>
                                <button type="submit" disabled={savingEdit} className="btn-primary" style={{ flex: 1 }}>{savingEdit ? 'Saving...' : 'Save Changes'}</button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </>
    );
}
