import { useEffect, useState } from 'react';
import api from '../api';

export default function StudentDashboard({ user }) {
  const [group, setGroup] = useState(null);
  const [assignments, setAssignments] = useState([]);
  const [groupName, setGroupName] = useState('');
  const [memberInput, setMemberInput] = useState('');
  const [confirmModal, setConfirmModal] = useState({ open: false, step: 1, assignment: null });

  const loadData = async () => {
    const [grpRes, assignRes] = await Promise.all([
      api.get('/groups/my'),
      api.get('/assignments'),
    ]);
    setGroup(grpRes.data);
    setAssignments(assignRes.data);
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreateGroup = async (e) => {
    e.preventDefault();
    try {
      await api.post('/groups', { name: groupName });
      setGroupName('');
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Could not create group');
    }
  };

  const handleAddMember = async (e) => {
    e.preventDefault();
    try {
      await api.post(`/groups/${group.id}/members`, { identifier: memberInput });
      setMemberInput('');
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Could not add member');
    }
  };

  const handleFinalConfirm = async () => {
    try {
      await api.post(`/assignments/${confirmModal.assignment.id}/confirm`);
      setConfirmModal({ open: false, step: 1, assignment: null });
      loadData();
    } catch (err) {
      alert(err.response?.data?.error || 'Confirmation failed');
    }
  };

  const submittedCount = assignments.filter((a) => a.submission_status === 'SUBMITTED').length;
  const progress = assignments.length ? Math.round((submittedCount / assignments.length) * 100) : 0;

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      {/* Group & Progress Grid */}
      <div className="grid md:grid-cols-2 gap-6">
        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
          <h2 className="text-lg font-semibold text-white mb-3">Your Group</h2>
          {!group ? (
            <form onSubmit={handleCreateGroup} className="flex gap-2">
              <input
                type="text"
                placeholder="Enter new group name..."
                required
                className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
              <button className="bg-indigo-600 hover:bg-indigo-500 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer">
                Create Group
              </button>
            </form>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-indigo-400 font-semibold text-base">{group.name}</span>
                <span className="text-xs bg-slate-800 px-2.5 py-1 rounded-full text-slate-300">
                  Group ID: #{group.id} • Your Student ID: #{user.id}
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {group.members?.map((m) => (
                  <span key={m.id} className="text-xs bg-slate-800/80 border border-slate-700 px-3 py-1 rounded-full">
                    {m.name} ({m.email})
                  </span>
                ))}
              </div>
              <form onSubmit={handleAddMember} className="flex gap-2 pt-2 border-t border-slate-800">
                <input
                  type="text"
                  placeholder="Add member by student email or ID..."
                  required
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-lg px-3 py-2 text-sm"
                  value={memberInput}
                  onChange={(e) => setMemberInput(e.target.value)}
                />
                <button className="bg-slate-800 hover:bg-slate-700 px-3 py-2 rounded-lg text-sm cursor-pointer">
                  + Invite
                </button>
              </form>
            </div>
          )}
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col justify-between">
          <div>
            <h2 className="text-lg font-semibold text-white mb-1">Group Completion Progress</h2>
            <p className="text-sm text-slate-400">
              {submittedCount} of {assignments.length} assignments confirmed
            </p>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm font-medium mb-1">
              <span className="text-slate-300">Overall Status</span>
              <span className="text-emerald-400">{progress}%</span>
            </div>
            <div className="w-full h-3 bg-slate-800 rounded-full overflow-hidden">
              <div
                className="h-full bg-emerald-500 transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Assignments List */}
      <div className="space-y-3">
        <h2 className="text-lg font-semibold text-white">Assigned Work</h2>
        {assignments.length === 0 && (
          <p className="text-slate-400 text-sm">No assignments posted yet.</p>
        )}
        {assignments.map((a) => {
          const isSubmitted = a.submission_status === 'SUBMITTED';
          return (
            <div
              key={a.id}
              className="bg-slate-900 border border-slate-800 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              <div>
                <div className="flex items-center gap-3">
                  <h3 className="font-semibold text-white text-base">{a.title}</h3>
                  <span
                    className={`text-xs px-2.5 py-0.5 rounded-full font-medium ${
                      isSubmitted
                        ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                        : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                    }`}
                  >
                    {isSubmitted ? 'Submitted ✓' : 'Pending'}
                  </span>
                </div>
                <p className="text-sm text-slate-400 mt-1">{a.description}</p>
                <p className="text-xs text-slate-500 mt-2">
                  Due: {new Date(a.due_date).toLocaleString()}
                </p>
              </div>

              <div className="flex items-center gap-3 shrink-0">
                <a
                  href={a.onedrive_link}
                  target="_blank"
                  rel="noreferrer"
                  className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-sm text-indigo-300 font-medium"
                >
                  Open OneDrive ↗
                </a>

                {!isSubmitted && (
                  <button
                    disabled={!group}
                    onClick={() => setConfirmModal({ open: true, step: 1, assignment: a })}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 text-sm font-medium cursor-pointer"
                  >
                    Confirm Submission
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Two-Step Confirmation Modal */}
      {confirmModal.open && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center p-4 z-50">
          <div className="bg-slate-900 border border-slate-700 rounded-xl max-w-md w-full p-6 space-y-4">
            <span className="text-xs uppercase tracking-wider text-indigo-400 font-semibold">
              Step {confirmModal.step} of 2
            </span>
            {confirmModal.step === 1 ? (
              <>
                <h3 className="text-lg font-bold text-white">Have you uploaded your files to OneDrive?</h3>
                <p className="text-sm text-slate-400">
                  Make sure your group ({group?.name}) has uploaded all deliverables to the OneDrive link for{' '}
                  <strong className="text-slate-200">{confirmModal.assignment?.title}</strong>.
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setConfirmModal({ open: false, step: 1, assignment: null })}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-sm cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={() => setConfirmModal({ ...confirmModal, step: 2 })}
                    className="px-4 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-sm font-medium cursor-pointer"
                  >
                    Yes, I have submitted
                  </button>
                </div>
              </>
            ) : (
              <>
                <h3 className="text-lg font-bold text-white">Final Verification</h3>
                <p className="text-sm text-slate-400">
                  This will officially mark <strong className="text-slate-200">{confirmModal.assignment?.title}</strong> as
                  submitted for <strong className="text-indigo-400">{group?.name}</strong>. Proceed?
                </p>
                <div className="flex justify-end gap-2 pt-2">
                  <button
                    onClick={() => setConfirmModal({ ...confirmModal, step: 1 })}
                    className="px-4 py-2 rounded-lg bg-slate-800 text-sm cursor-pointer"
                  >
                    Back
                  </button>
                  <button
                    onClick={handleFinalConfirm}
                    className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-sm font-medium cursor-pointer"
                  >
                    Confirm & Lock Submission
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}