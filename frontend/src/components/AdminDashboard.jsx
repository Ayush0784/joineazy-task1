import { useEffect, useState } from 'react';
import api from '../api';

export default function AdminDashboard() {
  const [analytics, setAnalytics] = useState({ assignments: [], groups: [], submissions: [] });
  const [allAssignments, setAllAssignments] = useState([]);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState({
    title: '',
    description: '',
    due_date: '',
    onedrive_link: '',
    target_type: 'ALL',
    group_ids: [],
  });

  const loadData = async () => {
    const [anaRes, assignRes] = await Promise.all([
      api.get('/analytics'),
      api.get('/assignments'),
    ]);
    setAnalytics(anaRes.data);
    setAllAssignments(assignRes.data);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/assignments/${editingId}`, form);
        setEditingId(null);
      } else {
        await api.post('/assignments', form);
      }
      setForm({ title: '', description: '', due_date: '', onedrive_link: '', target_type: 'ALL', group_ids: [] });
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to save assignment');
    }
  };

  const startEdit = (a) => {
    setEditingId(a.id);
    setForm({
      title: a.title,
      description: a.description || '',
      due_date: a.due_date ? a.due_date.slice(0, 16) : '',
      onedrive_link: a.onedrive_link,
      target_type: a.target_type,
      group_ids: [],
    });
  };

  const toggleGroupSelection = (gid) => {
    setForm((prev) => ({
      ...prev,
      group_ids: prev.group_ids.includes(gid)
        ? prev.group_ids.filter((id) => id !== gid)
        : [...prev.group_ids, gid],
    }));
  };

  const totalPossible = analytics.assignments.length * analytics.groups.length;
  const completionRate = totalPossible ? Math.round((analytics.submissions.length / totalPossible) * 100) : 0;

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Analytics Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-xs uppercase text-slate-400">Total Assignments</p>
          <p className="text-3xl font-bold text-white mt-1">{analytics.assignments.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-xs uppercase text-slate-400">Active Student Groups</p>
          <p className="text-3xl font-bold text-indigo-400 mt-1">{analytics.groups.length}</p>
        </div>
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <p className="text-xs uppercase text-slate-400">Overall Submission Rate</p>
          <p className="text-3xl font-bold text-emerald-400 mt-1">{completionRate}%</p>
        </div>
      </div>

      {/* Create / Edit Assignment Form */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          {editingId ? 'Edit Assignment' : 'Post New Assignment'}
        </h2>
        <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
          <input
            type="text"
            placeholder="Assignment Title"
            required
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
          />
          <input
            type="url"
            placeholder="OneDrive Submission Folder URL (https://...)"
            required
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            value={form.onedrive_link}
            onChange={(e) => setForm({ ...form, onedrive_link: e.target.value })}
          />
          <input
            type="datetime-local"
            required
            className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm scheme-dark"
            value={form.due_date}
            onChange={(e) => setForm({ ...form, due_date: e.target.value })}
          />
          {!editingId && (
            <select
              className="bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
              value={form.target_type}
              onChange={(e) => setForm({ ...form, target_type: e.target.value })}
            >
              <option value="ALL">Assign to All Students</option>
              <option value="SPECIFIC">Assign to Specific Groups</option>
            </select>
          )}
          <textarea
            placeholder="Assignment description & instructions..."
            rows={2}
            className="md:col-span-2 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          {!editingId && form.target_type === 'SPECIFIC' && (
            <div className="md:col-span-2 flex flex-wrap gap-2">
              {analytics.groups.map((g) => (
                <label key={g.id} className="flex items-center gap-2 bg-slate-950 border border-slate-800 px-3 py-1.5 rounded-lg text-sm cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.group_ids.includes(g.id)}
                    onChange={() => toggleGroupSelection(g.id)}
                  />
                  {g.name}
                </label>
              ))}
            </div>
          )}

          <div className="md:col-span-2 flex gap-2">
            <button type="submit" className="bg-indigo-600 hover:bg-indigo-500 px-5 py-2 rounded-lg text-sm font-medium cursor-pointer">
              {editingId ? 'Update Assignment' : 'Publish Assignment'}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setForm({ title: '', description: '', due_date: '', onedrive_link: '', target_type: 'ALL', group_ids: [] });
                }}
                className="bg-slate-800 px-4 py-2 rounded-lg text-sm cursor-pointer"
              >
                Cancel Edit
              </button>
            )}
          </div>
        </form>
      </div>

      {/* Group-Wise Submission Tracking Matrix */}
      <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 overflow-x-auto">
        <h2 className="text-lg font-semibold text-white mb-4">Group-Wise Submission Tracking</h2>
        <table className="w-full text-left text-sm">
          <thead className="border-b border-slate-800 text-slate-400">
            <tr>
              <th className="py-2.5">Assignment</th>
              <th className="py-2.5">Group</th>
              <th className="py-2.5">Status</th>
              <th className="py-2.5">Confirmed By</th>
              <th className="py-2.5 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/60">
            {allAssignments.map((a) =>
              analytics.groups.length === 0 ? (
                <tr key={a.id}>
                  <td className="py-3 font-medium text-white">{a.title}</td>
                  <td colSpan={3} className="py-3 text-slate-500">No student groups created yet</td>
                  <td className="py-3 text-right">
                    <button onClick={() => startEdit(a)} className="text-indigo-400 hover:underline cursor-pointer">Edit</button>
                  </td>
                </tr>
              ) : (
                analytics.groups.map((g, idx) => {
                  const sub = analytics.submissions.find(
                    (s) => s.assignment_id === a.id && s.group_id === g.id
                  );
                  return (
                    <tr key={`${a.id}-${g.id}`}>
                      <td className="py-3 font-medium text-white">{a.title}</td>
                      <td className="py-3 text-slate-300">{g.name}</td>
                      <td className="py-3">
                        <span
                          className={`text-xs px-2.5 py-0.5 rounded-full ${
                            sub
                              ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                              : 'bg-slate-800 text-slate-400'
                          }`}
                        >
                          {sub ? 'Submitted' : 'Pending'}
                        </span>
                      </td>
                      <td className="py-3 text-slate-400">
                        {sub ? `${sub.confirmed_by_name} (${new Date(sub.confirmed_at).toLocaleDateString()})` : '—'}
                      </td>
                      <td className="py-3 text-right">
                        {idx === 0 && (
                          <button onClick={() => startEdit(a)} className="text-indigo-400 hover:underline cursor-pointer">
                            Edit Assignment
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}