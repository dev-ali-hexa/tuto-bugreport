import React, { useMemo, useState, useEffect } from 'react';
import { listenToFeedback, updateFeedbackStatus, updateFeedbackNotes, deleteFeedback, auth } from './firebase';
import { FeedbackItem, AdminInfo } from './types';

const featureCategories = ['AI', 'Learning', 'Chat', 'Video Call', 'Maps', 'Payments', 'Notifications', 'Community', 'Other'];
const bugScreens = ['Home', 'Search', 'Tutor Profile', 'Student Profile', 'Chat', 'Video Call', 'Groups', 'Notifications', 'Settings', 'Other'];

const issueOptions = [
  'App crashes', 'Slow loading', 'Lagging', 'Confusing UI', 'Login issues',
  'Notification issues', 'Location issues', 'Video Call issues', 'Chat issues', 'Other',
];

const StarRating = ({ value, readOnly = false }: { value: number; readOnly?: boolean }) => (
  <div className="stars">
    {[1, 2, 3, 4, 5].map((star) => (
      <button key={star} type="button" className={`star ${star <= value ? 'active' : ''}`} disabled={readOnly}>★</button>
    ))}
  </div>
);

interface AdminDashboardProps {
  onLogout: () => void;
}

type UserGroup = {
  email: string;
  name: string;
  reportCount: number;
  latestReport: number;
  reports: FeedbackItem[];
};

export const AdminDashboard: React.FC<AdminDashboardProps> = ({ onLogout }) => {
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  const [categoryFilter, setCategoryFilter] = useState('All');
  const [deviceFilter, setDeviceFilter] = useState('All');
  const [selectedFeedback, setSelectedFeedback] = useState<FeedbackItem | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedUserEmail, setSelectedUserEmail] = useState<string | null>(null);
  const [internalNotes, setInternalNotes] = useState('');
  const [viewingImage, setViewingImage] = useState<string | null>(null);

  useEffect(() => {
    const feedbackRefPath = 'feedback'; // The node you are reading from
    console.log('Setting up Firebase listener for path:', feedbackRefPath);
    console.log('Current authenticated user:', auth.currentUser?.email);

    const unsubscribe = listenToFeedback((value) => {
      console.log('Firebase snapshot received. Exists:', !!value);
      console.log('Snapshot value:', value);
      if (value) {
        const migratedItems = Object.keys(value).map(key => {
          const oldItem = value[key];
          // Basic migration: if it doesn't have the new structure, create it.
          if (!oldItem.contact && oldItem.email) {
            const migrated: Partial<FeedbackItem> = {
              ...oldItem,
              contact: { name: oldItem.name, email: oldItem.email, phone: oldItem.phone },
              admin: { status: oldItem.status || 'Open', internalNotes: oldItem.internalNotes },
              deviceInfo: { ...oldItem.meta },
              attachments: oldItem.imageBase64s?.map((b64:string) => ({base64: b64, name: 'image.jpg', type: 'image/jpeg'})) || [],
            };
            if (oldItem.type === 'bug') migrated.bugReport = { title: oldItem.title, description: oldItem.description, screen: oldItem.device, device: oldItem.meta?.device, expectedResult: oldItem.meta?.expected, actualResult: oldItem.meta?.actual, stepsToReproduce: oldItem.meta?.steps };
            if (oldItem.type === 'feature') migrated.featureSuggestion = { title: oldItem.title, description: oldItem.description, priority: oldItem.priority, category: oldItem.category, whyNeeded: oldItem.meta?.featureReason, benefit: oldItem.meta?.featureHelp };
            if (oldItem.type === 'improvement') migrated.uiImprovement = { screen: oldItem.category, suggestion: oldItem.description };
            if (oldItem.type === 'performance') migrated.performance = { ...oldItem.meta?.ratings, overallExperience: oldItem.meta?.ratings?.overall, selectedIssues: oldItem.meta?.issues };
            if (oldItem.type === 'general') migrated.generalFeedback = oldItem.description;
            return { id: Number(key), ...migrated };
          }
          return { id: Number(key), ...oldItem };
        });

        const sortedItems = (migratedItems as FeedbackItem[]).sort((a, b) => b.id - a.id);
        console.log(`Total reports loaded: ${sortedItems.length}`);
        setFeedbacks(sortedItems);
        setIsLoading(false);
      } else {
        setFeedbacks([]);
        console.log('No reports found in the database.');
        setIsLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  const visibleFeedback = useMemo(() => {
    let filtered = feedbacks;

    console.log("All Reports:", feedbacks);

    if (selectedUserEmail) {
      console.log("Selected Email:", selectedUserEmail);
      // BUG FIX: Filter by the correct nested property `contact.email`
      filtered = filtered.filter(item => (item.contact?.email || item.email) === selectedUserEmail);
      console.log("Filtered Reports:", filtered);
    }

    return filtered.filter(item => {
      // Handle both old and new schemas for searching
      const title = item.bugReport?.title || item.featureSuggestion?.title || item.title || '';
      const description = item.bugReport?.description || item.featureSuggestion?.description || item.uiImprovement?.suggestion || item.generalFeedback || item.description || '';
      const priority = item.featureSuggestion?.priority || item.priority || 'Medium';
      const category = item.featureSuggestion?.category || item.uiImprovement?.screen || item.category || '';
      const device = item.bugReport?.screen || item.device || '';

      const matchesSearch = `${title} ${description} ${item.contact?.name || item.name || ''} ${item.contact?.email || item.email || ''} ${category} ${device}`.toLowerCase().includes(search.toLowerCase());
      const matchesStatus = statusFilter === 'All' || (item.admin?.status || item.status) === statusFilter;
      const matchesPriority = priorityFilter === 'All' || priority === priorityFilter;
      const matchesCategory = categoryFilter === 'All' || category === categoryFilter;
      const matchesDevice = deviceFilter === 'All' || device === deviceFilter;
      return matchesSearch && matchesStatus && matchesPriority && matchesCategory && matchesDevice;
    });
  }, [feedbacks, search, statusFilter, priorityFilter, categoryFilter, deviceFilter, selectedUserEmail]);

  const userGroups = useMemo<UserGroup[]>(() => {
    const groups: Record<string, UserGroup> = {};
    feedbacks.forEach(report => {
      const email = report.contact?.email || report.email;
      if (!email) return;
      if (!groups[email]) {
        groups[email] = {
          email: email,
          name: report.contact?.name || report.name || 'Unknown User',
          reportCount: 0,
          latestReport: 0,
          reports: [],
        };
      }
      groups[email].reportCount++;
      groups[email].reports.push(report);
      if (report.id > groups[email].latestReport) {
        groups[email].latestReport = report.id;
      }
    });
    return Object.values(groups).sort((a, b) => b.latestReport - a.latestReport);
  }, [feedbacks]);

  const stats = useMemo(() => {
    const priorities = feedbacks.map(f => f.featureSuggestion?.priority).filter(Boolean);
    return {
      total: feedbacks.length,
      open: feedbacks.filter(f => (f.admin?.status || f.status) === 'Open').length,
      inProgress: feedbacks.filter(f => (f.admin?.status || f.status) === 'In Progress').length,
      fixed: feedbacks.filter(f => (f.admin?.status || f.status) === 'Fixed').length,
      closed: feedbacks.filter(f => (f.admin?.status || f.status) === 'Closed').length,
      critical: priorities.filter(p => p === 'High').length,
      users: userGroups.length,
    };
  }, [feedbacks, userGroups]);

  const exportCsv = () => {
    const headers = ['Title', 'Type', 'Status', 'Priority', 'Category', 'Device', 'Created At', 'Description'];
    const rows = feedbacks.map((item) => [item.title, item.type, item.status, item.priority, item.category ?? '', item.device ?? '', item.createdAt, item.description]);
    const csv = [headers.join(','), ...rows.map((row) => row.map((value) => `"${String(value).split('"').join('""')}"`).join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'tutomap-feedback.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  useEffect(() => {
    if (selectedFeedback) {
      setInternalNotes(selectedFeedback.admin?.internalNotes || '');
    }
  }, [selectedFeedback]);

  const handleSaveNotes = () => {
    if (selectedFeedback) {
      updateFeedbackNotes(selectedFeedback.id, internalNotes);
    }
  };

  const handleDeleteReport = () => {
    if (selectedFeedback && window.confirm(`Are you sure you want to delete this report?`)) {
      deleteFeedback(selectedFeedback.id);
      setSelectedFeedback(null);
    }
  };

  const selectedUser = useMemo(() => {
    if (!selectedUserEmail) return null;
    return userGroups.find(u => u.email === selectedUserEmail);
  }, [selectedUserEmail, userGroups]);

  useEffect(() => {
    const handleEsc = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setViewingImage(null);
      }
    };
    window.addEventListener('keydown', handleEsc);

    return () => window.removeEventListener('keydown', handleEsc);
  }, []);

  return (
    <>
      <div className="admin-layout" onClick={(e) => { if (e.target === e.currentTarget) setSelectedFeedback(null); }}>
        <aside className="admin-sidebar">
          <div className="admin-sidebar-header">
          <div>
            <h3>Admin Dashboard</h3>
            <p>Review all bug reports, feature requests, and improvement suggestions.</p>
          </div>
          <button type="button" className="secondary-btn" onClick={onLogout}>
            Logout
          </button>
          </div>
          <div className="user-list">
            <div className={`user-item ${!selectedUserEmail ? 'active' : ''}`} onClick={() => setSelectedUserEmail(null)}>
              <strong>All Reports</strong>
              <span>{feedbacks.length} total</span>
            </div>
            {userGroups.map(user => (
              <div key={user.email} className={`user-item ${selectedUserEmail === user.email ? 'active' : ''}`} onClick={() => setSelectedUserEmail(user.email)}>
                <strong>{user.name}</strong>
                <span>{user.email}</span>
                <span>{user.reportCount} report{user.reportCount > 1 ? 's' : ''}</span>
              </div>
            ))}
          </div>
        </aside>
        <main className="admin-main">
          <div className="stat-cards">
            <div className="stat-card"><h4>Total Reports</h4><span>{stats.total}</span></div>
            <div className="stat-card"><h4>Open</h4><span>{stats.open}</span></div>
            <div className="stat-card"><h4>In Progress</h4><span>{stats.inProgress}</span></div>
            <div className="stat-card"><h4>Critical</h4><span>{stats.critical}</span></div>
            <div className="stat-card"><h4>Total Users</h4><span>{stats.users}</span></div>
          </div>

        <div className="filters">
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search keyword" />
          <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value="All">All Status</option>
            {statuses.map((status) => <option key={status} value={status}>{status}</option>)}
          </select>
          <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
            <option value="All">All Priority</option>
            <option value="High">High</option>
            <option value="Medium">Medium</option>
            <option value="Low">Low</option>
          </select>
          <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)}>
            <option value="All">All Category</option>
            {featureCategories.map((category) => <option key={category} value={category}>{category}</option>)}
          </select>
          <select value={deviceFilter} onChange={(event) => setDeviceFilter(event.target.value)}>
            <option value="All">All Device</option>
            {bugScreens.map((device) => <option key={device} value={device}>{device}</option>)}
          </select>
          <button type="button" className="secondary-btn" onClick={exportCsv}>Export CSV</button>
        </div>

          {isLoading ? <p>Loading reports...</p> : visibleFeedback.length === 0 ? <div className="empty-state"><p>No reports submitted yet.</p></div> : (
            <div className="admin-list">
          {visibleFeedback.map((item) => (
            <article key={item.id} className="admin-item" onClick={() => setSelectedFeedback(item)}>
              <div className="admin-item-head">
                <div>
                  <h4>{item.bugReport?.title || item.featureSuggestion?.title || item.title || 'Feedback Report'}</h4>
                  <p>{item.bugReport?.description || item.featureSuggestion?.description || item.uiImprovement?.suggestion || item.generalFeedback || item.description}</p>
                </div>
                <div className="pills-row">
                  <span className={`pill ${(item.featureSuggestion?.priority || item.priority)?.toLowerCase() || 'medium'}`}>{item.featureSuggestion?.priority || item.priority || 'N/A'}</span>
                  <span className={`pill ${(item.admin?.status || item.status)?.toLowerCase().replace(' ', '-')}`}>{item.admin?.status || item.status}</span>
                </div>
              </div>
              <div className="meta-row">
                <span>{item.featureSuggestion?.category || item.uiImprovement?.screen || item.category || 'General'}</span>
                <span>{item.bugReport?.screen || item.device || 'N/A'}</span>
                <span>{item.createdAt}</span>
              </div>
              <div className="admin-item-foot">
                {(item.attachments?.[0]?.base64 || item.imageBase64s?.[0]) &&
                  <img src={item.attachments?.[0]?.base64 || item.imageBase64s?.[0]} alt="Thumbnail" className="admin-thumbnail" onClick={(e) => { e.stopPropagation(); setViewingImage(item.attachments![0].base64 || item.imageBase64s![0]); }} />
                }
                <span className="pill green">{item.type}</span>
              </div>
            </article>
          ))}
            </div>
          )}
        </main>
      </div>

      {selectedFeedback && (
        <div className="login-overlay" onClick={() => setSelectedFeedback(null)}>
          <div className="detail-modal" onClick={(e) => e.stopPropagation()}>
            <button className="close-modal" onClick={() => setSelectedFeedback(null)}>×</button>
            <h3>Feedback Details</h3>
            <div className="feedback-form feedback-form-readonly">
              {/* Section 1: Bug Report - Always show */}
              <section className="section-card">
                <div className="section-title">
                  <h2>1. Report a Bug</h2>
                  <p>Tell us what broke and how it happened.</p>
                </div>
                <div className="grid two">
                  <label>Bug Title<input value={selectedFeedback.bugReport?.title || 'Not Provided'} readOnly /></label>
                  <label>Which screen/page?<input value={selectedFeedback.bugReport?.screen || 'Not Provided'} readOnly /></label>
                </div>
                <label>Bug Description<textarea value={selectedFeedback.bugReport?.description || 'Not Provided'} readOnly rows={4} /></label>
                <div className="grid two">
                  <label>Device<input value={selectedFeedback.bugReport?.device || 'Not Provided'} readOnly /></label>
                </div>
                <div className="grid two">
                  <label>Expected Result<textarea value={selectedFeedback.bugReport?.expectedResult || 'Not Provided'} readOnly rows={3} /></label>
                  <label>Actual Result<textarea value={selectedFeedback.bugReport?.actualResult || 'Not Provided'} readOnly rows={3} /></label>
                </div>
                {selectedFeedback.attachments && selectedFeedback.attachments.length > 0 && (
                  <label className="upload-box">Attachment
                    <div className="image-previews-readonly">
                      {selectedFeedback.attachments.map((att, index) => <img key={index} src={att.base64} alt={att.name} className="detail-image" onClick={() => setViewingImage(att.base64)} />)}
                    </div>
                  </label>
                )}
                <div className="grid three">
                  <label>Android Version<input value={selectedFeedback.bugReport?.androidVersion || 'Not Provided'} readOnly /></label>
                  <label>App Version<input value={selectedFeedback.bugReport?.appVersion || 'Not Provided'} readOnly /></label>
                </div>
              </section>

              {/* Section 2: Feature Suggestion - Always show */}
              <section className="section-card">
                <div className="section-title"><h2>2. Suggest a New Feature</h2><p>Tell us what idea you want to share with TutoMap.</p></div>
                <div className="feature-panel">
                  <label>Feature Title<input value={selectedFeedback.featureSuggestion?.title || 'Not Provided'} readOnly /></label>
                  <label>Describe your feature idea<textarea value={selectedFeedback.featureSuggestion?.description || 'Not Provided'} readOnly rows={4} /></label>
                  <label>Why should this feature be added?<textarea value={selectedFeedback.featureSuggestion?.whyNeeded || 'Not Provided'} readOnly rows={3} /></label>
                  <label>How will it help students or tutors?<textarea value={selectedFeedback.featureSuggestion?.benefit || 'Not Provided'} readOnly rows={3} /></label>
                  <div className="grid two">
                    <label>Priority<input value={selectedFeedback.featureSuggestion?.priority || 'Not Provided'} readOnly /></label>
                    <label>Category<input value={selectedFeedback.featureSuggestion?.category || 'Not Provided'} readOnly /></label>
                  </div>
                </div>
              </section>

              {/* Section 3: Improvement Suggestion - Always show */}
              <section className="section-card">
                <div className="section-title"><h2>3. UI/UX Improvement Suggestions</h2><p>Let us know what should feel better.</p></div>
                <label>Which part of the app should be improved?<input value={selectedFeedback.uiImprovement?.screen || 'Not Provided'} readOnly /></label>
                <label>Suggestion<textarea value={selectedFeedback.uiImprovement?.suggestion || 'Not Provided'} readOnly rows={4} /></label>
              </section>

              {/* Section 4: Performance Feedback - Always show */}
              <section className="section-card">
                <div className="section-title"><h2>4. Performance Feedback</h2><p>Rate your experience and flag issues.</p></div>
                <div className="rating-grid">
                  <label>App Speed<StarRating value={selectedFeedback.performance?.appSpeed ?? 0} readOnly /></label>
                  <label>Ease of Use<StarRating value={selectedFeedback.performance?.easeOfUse ?? 0} readOnly /></label>
                  <label>Design<StarRating value={selectedFeedback.performance?.design ?? 0} readOnly /></label>
                  <label>Features<StarRating value={selectedFeedback.performance?.features ?? 0} readOnly /></label>
                  <label>Overall Experience<StarRating value={selectedFeedback.performance?.overallExperience ?? 0} readOnly /></label>
                </div>
                <div className="chip-grid">
                  {issueOptions.map((option) => (
                    <label key={option} className="chip">
                      <input type="checkbox" value={option} checked={selectedFeedback.performance?.selectedIssues?.includes(option) ?? false} disabled />
                      <span>{option}</span>
                    </label>
                  ))}
                </div>
              </section>

              {/* Section 5: General Feedback - Always show */}
              <section className="section-card">
                <div className="section-title"><h2>5. General Feedback</h2><p>Anything else you want us to know?</p></div>
                <label><textarea value={selectedFeedback.generalFeedback || 'Not Provided'} readOnly rows={5} /></label>
              </section>

              {/* Section 6: Contact Information - Always show */}
              <section className="section-card">
                <div className="section-title"><h2>6. Contact Information</h2><p>Optional, only if you want a follow-up.</p></div>
                <div className="grid three">
                  <label>Name<input value={selectedFeedback.contact.name} readOnly /></label>
                  <label>Email<input value={selectedFeedback.contact.email} readOnly /></label>
                  <label>Phone (Optional)<input value={selectedFeedback.contact.phone || ''} readOnly /></label>
                </div>
              </section>

              {/* Admin Actions Section - The only new part */}
              <section className="section-card">
                <div className="section-title"><h2>Admin Actions</h2></div>
                <div className="grid two">
                  <label>
                    Status
                    <select
                      value={selectedFeedback.admin.status}
                      onChange={(e) => {
                        const newStatus = e.target.value as AdminInfo['status'];
                        updateFeedbackStatus(selectedFeedback.id, newStatus);
                        setSelectedFeedback({ ...selectedFeedback, admin: { ...selectedFeedback.admin, status: newStatus } });
                      }}
                    >
                      {statuses.map(s => <option key={s} value={s}>{s}</option>)}
                    </select>
                  </label>
                  <label>
                    Assign Developer
                    <input placeholder="e.g. developer@email.com" />
                  </label>
                </div>
                <label>
                  Internal Notes
                  <textarea
                    value={internalNotes}
                    onChange={(e) => setInternalNotes(e.target.value)}
                    rows={4}
                    placeholder="Add notes for the team..."
                  />
                </label>
                <div className="login-actions">
                  <button type="button" className="submit-btn" onClick={handleSaveNotes}>Save Changes</button>
                  <button type="button" className="delete-btn" onClick={handleDeleteReport}>Delete Report</button>
                </div>
              </section>
            </div>
          </div>
        </div>
      )}

      {viewingImage && (
        <div className="login-overlay image-viewer" onClick={() => setViewingImage(null)}>
          <button className="close-modal" onClick={() => setViewingImage(null)}>×</button>
          <div className="image-viewer-content" onClick={(e) => e.stopPropagation()}>
            <img src={viewingImage} alt="Full screen preview" />
          </div>
        </div>
      )}
    </>
  );
};