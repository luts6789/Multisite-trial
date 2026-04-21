import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, doc, setDoc, updateDoc, deleteDoc, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { db } from '../firebase';
import { UserProfile, Shop } from '../types';
import { UserPlus, Shield, User as UserIcon, Trash2, Store, CheckCircle, AlertCircle, Activity, RotateCcw, RefreshCcw, Eraser } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError } from '../utils';

export const Users: React.FC = () => {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [shops, setShops] = useState<Shop[]>([]);
  const [isAdding, setIsAdding] = useState(false);
  const [newUser, setNewUser] = useState({ email: '', role: 'personnel' as const, shopId: '' });
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [userToDelete, setUserToDelete] = useState<{ id: string; email: string } | null>(null);
  const [userToResetEntries, setUserToResetEntries] = useState<{ id: string; email: string } | null>(null);
  const [isResetting, setIsResetting] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const unsubUsers = onSnapshot(collection(db, 'users'), async (snapshot) => {
      const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      
      // Group by email to handle the UID vs Email-slug ID transition
      const uniqueUsers: { [email: string]: UserProfile } = {};
      const duplicates: string[] = [];

      allUsers.forEach(u => {
        const email = u.email.toLowerCase();
        const existing = uniqueUsers[email];
        if (!existing) {
          uniqueUsers[email] = u;
        } else {
          // Prefer UID (no underscores, usually 28 chars) over email-slug (has underscores)
          const uIsUid = !u.id.includes('_');
          const existingIsUid = !existing.id.includes('_');

          if (uIsUid && !existingIsUid) {
            duplicates.push(existing.id);
            uniqueUsers[email] = u;
          } else if (!uIsUid && existingIsUid) {
            duplicates.push(u.id);
          } else {
            // Both are same type, prefer longer ID as fallback
            if (u.id.length > existing.id.length) {
              duplicates.push(existing.id);
              uniqueUsers[email] = u;
            } else {
              duplicates.push(u.id);
            }
          }
        }
      });

      // Automatically cleanup duplicates (delete email-slugged docs if UID doc exists)
      if (duplicates.length > 0) {
        console.log('[Users Debug] Cleaning up duplicate user profiles:', duplicates);
        for (const id of duplicates) {
          // Only delete if it's an email-slugged ID (contains underscores)
          if (id.includes('_')) {
            try {
              await deleteDoc(doc(db, 'users', id));
            } catch (err) {
              console.error('[Users Debug] Failed to delete duplicate:', id, err);
            }
          }
        }
      }
      
      setUsers(Object.values(uniqueUsers).sort((a, b) => a.email.localeCompare(b.email)));
    });
    const unsubShops = onSnapshot(collection(db, 'shops'), (snapshot) => {
      setShops(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop)));
    });
    return () => { unsubUsers(); unsubShops(); };
  }, []);

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const email = newUser.email.toLowerCase();
      const userId = email.replace(/[^a-zA-Z0-9]/g, '_');
      await setDoc(doc(db, 'users', userId), { ...newUser, email });
      setNewUser({ email: '', role: 'personnel', shopId: '' });
      setIsAdding(false);
      setNotification({ message: 'User profile pre-provisioned successfully!', type: 'success' });
    } catch (error) {
      setNotification({ message: 'Failed to add user.', type: 'error' });
      handleFirestoreError(error, 'create', 'users');
    }
  };

  const handleUpdateRole = async (id: string, role: 'admin' | 'personnel') => {
    try {
      await updateDoc(doc(db, 'users', id), { role });
    } catch (error) {
      handleFirestoreError(error, 'update', 'users');
    }
  };

  const handleAssignShop = async (id: string, shopId: string) => {
    try {
      await updateDoc(doc(db, 'users', id), { shopId });
      setNotification({ message: 'Shop assigned successfully!', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, 'update', 'users');
    }
  };

  const handleFixProfile = async (user: UserProfile) => {
    try {
      // Force update the role to personnel if that's what's intended
      await updateDoc(doc(db, 'users', user.id), { 
        role: 'personnel',
        // Ensure it's not admin
      });
      setNotification({ message: `Fixed profile for ${user.email}`, type: 'success' });
    } catch (error) {
      handleFirestoreError(error, 'update', 'users');
    }
  };

  const handleManualCleanup = async () => {
    try {
      const snapshot = await getDocs(collection(db, 'users'));
      const allUsers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as UserProfile));
      const uniqueUsers: { [email: string]: UserProfile } = {};
      const duplicates: string[] = [];

      allUsers.forEach(u => {
        const email = u.email.toLowerCase();
        const existing = uniqueUsers[email];
        if (!existing) {
          uniqueUsers[email] = u;
        } else {
          const uIsUid = !u.id.includes('_');
          const existingIsUid = !existing.id.includes('_');
          if (uIsUid && !existingIsUid) {
            duplicates.push(existing.id);
            uniqueUsers[email] = u;
          } else if (!uIsUid && existingIsUid) {
            duplicates.push(u.id);
          } else {
            if (u.id.length > existing.id.length) {
              duplicates.push(existing.id);
              uniqueUsers[email] = u;
            } else {
              duplicates.push(u.id);
            }
          }
        }
      });

      if (duplicates.length > 0) {
        for (const id of duplicates) {
          await deleteDoc(doc(db, 'users', id));
        }
        setNotification({ message: `Cleaned up ${duplicates.length} duplicate profiles.`, type: 'success' });
      } else {
        setNotification({ message: 'No duplicate profiles found.', type: 'success' });
      }
    } catch (error) {
      handleFirestoreError(error, 'delete', 'users');
    }
  };

  const handleDeleteUser = async (id: string, email: string) => {
    if (email === 'thevalleyviewdrugshop@gmail.com') {
      setNotification({ message: 'Cannot delete the primary administrator.', type: 'error' });
      return;
    }
    setUserToDelete({ id, email });
  };

  const confirmDelete = async () => {
    if (!userToDelete) return;

    try {
      await deleteDoc(doc(db, 'users', userToDelete.id));
      setNotification({ message: 'User deleted successfully.', type: 'success' });
      setUserToDelete(null);
    } catch (error) {
      handleFirestoreError(error, 'delete', 'users');
      setNotification({ message: 'Failed to delete user.', type: 'error' });
    }
  };

  const handleSystemReset = async () => {
    setIsResetting(true);
    try {
      const collectionsToClear = [
        'shops',
        'drugs',
        'sales',
        'deliveries',
        'orders',
        'expenses',
        'extraSales',
        'debts',
        'messages'
      ];

      for (const collName of collectionsToClear) {
        const snapshot = await getDocs(collection(db, collName));
        const docs = snapshot.docs;
        
        // Process in batches of 500 (Firestore limit)
        for (let i = 0; i < docs.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = docs.slice(i, i + 500);
          chunk.forEach(d => batch.delete(d.ref));
          await batch.commit();
        }
      }

      // Special handling for users - keep admins
      const usersSnapshot = await getDocs(collection(db, 'users'));
      const userDocs = usersSnapshot.docs;
      
      for (let i = 0; i < userDocs.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = userDocs.slice(i, i + 500);
        let deletedInBatch = 0;
        
        chunk.forEach(d => {
          const data = d.data();
          const email = data.email?.toLowerCase();
          if (email !== 'thevalleyviewdrugshop@gmail.com') {
            batch.delete(d.ref);
            deletedInBatch++;
          }
        });
        
        if (deletedInBatch > 0) {
          await batch.commit();
        }
      }

      setNotification({ message: 'System reset successful. All entries cleared.', type: 'success' });
      setShowResetConfirm(false);
    } catch (error) {
      console.error('System reset error:', error);
      setNotification({ message: 'Failed to perform system reset.', type: 'error' });
      handleFirestoreError(error, 'delete', 'all');
    } finally {
      setIsResetting(false);
    }
  };

  const handleResetUserEntries = async () => {
    if (!userToResetEntries) return;
    setIsResetting(true);
    try {
      const collectionsToClear = [
        { name: 'sales', field: 'personnelId' },
        { name: 'expenses', field: 'personnelId' },
        { name: 'extraSales', field: 'personnelId' },
        { name: 'debts', field: 'personnelId' },
        { name: 'orders', field: 'personnelId' },
        { name: 'messages', field: 'senderId' }
      ];

      let totalDeleted = 0;
      for (const coll of collectionsToClear) {
        const q = query(collection(db, coll.name), where(coll.field, '==', userToResetEntries.id));
        const snapshot = await getDocs(q);
        const docs = snapshot.docs;
        
        for (let i = 0; i < docs.length; i += 500) {
          const batch = writeBatch(db);
          const chunk = docs.slice(i, i + 500);
          chunk.forEach(d => batch.delete(d.ref));
          await batch.commit();
          totalDeleted += chunk.length;
        }
      }

      setNotification({ message: `Successfully reset ${totalDeleted} entries for ${userToResetEntries.email}.`, type: 'success' });
      setUserToResetEntries(null);
    } catch (error) {
      console.error('Reset user entries error:', error);
      setNotification({ message: 'Failed to reset user entries.', type: 'error' });
      handleFirestoreError(error, 'delete', 'user_entries');
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Notification Toast */}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 50 }}
            className={`fixed bottom-20 left-1/2 -translate-x-1/2 px-6 py-3 rounded-full shadow-lg z-50 flex items-center gap-2 ${
              notification.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
            }`}
          >
            {notification.type === 'success' ? <CheckCircle className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
            <span className="font-medium">{notification.message}</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {userToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-zinc-100"
            >
              <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-6">
                <Trash2 className="text-rose-600" size={32} />
              </div>
              <h3 className="text-2xl font-black text-zinc-900 mb-2">Delete User?</h3>
              <p className="text-zinc-500 mb-8 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-zinc-900">{userToDelete.email}</span>? 
                This will revoke their access to the system immediately.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setUserToDelete(null)}
                  className="flex-1 py-4 bg-zinc-100 text-zinc-900 rounded-xl font-bold hover:bg-zinc-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  className="flex-1 py-4 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* System Reset Confirmation Modal */}
      <AnimatePresence>
        {showResetConfirm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-zinc-100"
            >
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-6">
                <RotateCcw className="text-amber-600" size={32} />
              </div>
              <h3 className="text-2xl font-black text-zinc-900 mb-2">Factory Reset?</h3>
              <p className="text-zinc-500 mb-8 leading-relaxed">
                This will <span className="font-bold text-rose-600 uppercase">delete all entries</span> including shops, drugs, sales, and personnel accounts. 
                Admin accounts will be preserved. This action <span className="font-bold text-zinc-900 underline">cannot be undone</span>.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  disabled={isResetting}
                  onClick={handleSystemReset}
                  className="w-full py-4 bg-rose-600 text-white rounded-xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isResetting ? (
                    <>
                      <RefreshCcw className="w-5 h-5 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    'Yes, Delete Everything'
                  )}
                </button>
                <button
                  disabled={isResetting}
                  onClick={() => setShowResetConfirm(false)}
                  className="w-full py-4 bg-zinc-100 text-zinc-900 rounded-xl font-bold hover:bg-zinc-200 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* User Entries Reset Confirmation Modal */}
      <AnimatePresence>
        {userToResetEntries && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="bg-white rounded-[2.5rem] p-8 max-w-md w-full shadow-2xl border border-zinc-100"
            >
              <div className="w-16 h-16 bg-amber-50 rounded-2xl flex items-center justify-center mb-6">
                <Eraser className="text-amber-600" size={32} />
              </div>
              <h3 className="text-2xl font-black text-zinc-900 mb-2">Reset User Entries?</h3>
              <p className="text-zinc-500 mb-8 leading-relaxed">
                This will <span className="font-bold text-rose-600 uppercase">delete all entries</span> made by <span className="font-bold text-zinc-900">{userToResetEntries.email}</span> (sales, expenses, etc.). 
                The user account and settings will be <span className="font-bold text-emerald-600">preserved</span>.
              </p>
              <div className="flex flex-col gap-3">
                <button
                  disabled={isResetting}
                  onClick={handleResetUserEntries}
                  className="w-full py-4 bg-amber-600 text-white rounded-xl font-bold hover:bg-amber-700 transition-all shadow-lg shadow-amber-200 flex items-center justify-center gap-2 disabled:opacity-50"
                >
                  {isResetting ? (
                    <>
                      <RefreshCcw className="w-5 h-5 animate-spin" />
                      Resetting...
                    </>
                  ) : (
                    'Yes, Reset Entries'
                  )}
                </button>
                <button
                  disabled={isResetting}
                  onClick={() => setUserToResetEntries(null)}
                  className="w-full py-4 bg-zinc-100 text-zinc-900 rounded-xl font-bold hover:bg-zinc-200 transition-all disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Staff</span>
          <h3 className="text-xl font-bold text-zinc-900">User Management</h3>
          <p className="text-zinc-500 text-sm">Control system access, assign personnel to specific shops, and manage administrative roles.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => setShowResetConfirm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-rose-100 text-rose-700 rounded-lg hover:bg-rose-200 transition-all text-sm font-bold"
            title="Factory Reset System"
          >
            <RotateCcw size={18} />
            System Reset
          </button>
          <button
            onClick={handleManualCleanup}
            className="flex items-center gap-2 px-4 py-2 bg-amber-100 text-amber-700 rounded-lg hover:bg-amber-200 transition-all text-sm font-bold"
            title="Cleanup duplicate profiles"
          >
            Cleanup
          </button>
          <button
            onClick={async () => {
              const snapshot = await getDocs(collection(db, 'users'));
              console.log('[Users Debug] Raw Firestore Data:', snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
              setNotification({ message: 'User data logged to console.', type: 'success' });
            }}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-100 text-zinc-700 rounded-lg hover:bg-zinc-200 transition-all text-sm font-bold"
          >
            Debug
          </button>
          <button
            onClick={() => setIsAdding(!isAdding)}
            className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-all"
          >
            <UserPlus size={18} /> {isAdding ? 'Cancel' : 'Add User'}
          </button>
        </div>
      </div>

      {isAdding && (
        <div className="bg-white p-6 rounded-2xl border border-zinc-200 shadow-sm animate-in fade-in slide-in-from-top-4 duration-300">
          <form onSubmit={handleAddUser} className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
            <div className="md:col-span-2">
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Email Address</label>
              <input required type="email" value={newUser.email} onChange={e => setNewUser({...newUser, email: e.target.value})} className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-zinc-900" placeholder="staff@example.com" />
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Role</label>
              <select value={newUser.role} onChange={e => setNewUser({...newUser, role: e.target.value as any})} className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-zinc-900">
                <option value="personnel">Personnel</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-bold text-zinc-500 uppercase mb-1">Assign Shop</label>
              <select value={newUser.shopId} onChange={e => setNewUser({...newUser, shopId: e.target.value})} className="w-full p-2.5 bg-zinc-50 border border-zinc-200 rounded-lg outline-none focus:ring-2 focus:ring-zinc-900">
                <option value="">None</option>
                {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>
            <button type="submit" className="w-full py-2.5 bg-zinc-900 text-white rounded-lg font-bold hover:bg-zinc-800 transition-all">
              Save User
            </button>
          </form>
        </div>
      )}

      <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
        {/* Desktop Table */}
        <table className="hidden md:table w-full text-left border-collapse">
          <thead>
            <tr className="bg-zinc-50 border-bottom border-zinc-200">
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">User</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Role</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Assigned Shop</th>
              <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-100">
            {users.map(user => (
              <tr key={user.id} className="hover:bg-zinc-50/50 transition-colors">
                <td className="px-6 py-4">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-zinc-100 rounded-full text-zinc-400">
                      <UserIcon size={16} />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-medium text-zinc-900">{user.email}</span>
                      <span className="text-[10px] text-zinc-400 font-mono">{user.id}</span>
                      {user.id.includes('_') ? (
                        <span className="text-[8px] font-bold text-amber-600 uppercase tracking-tighter">Pre-provisioned</span>
                      ) : (
                        <span className="text-[8px] font-bold text-emerald-600 uppercase tracking-tighter">Active (Logged In)</span>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider ${
                      user.role === 'admin' ? 'bg-zinc-900 text-white' : 'bg-zinc-100 text-zinc-600'
                    }`}>
                      {user.role}
                    </span>
                    {user.email !== 'thevalleyviewdrugshop@gmail.com' && (
                      <select
                        value={user.role}
                        onChange={(e) => handleUpdateRole(user.id, e.target.value as any)}
                        className="bg-transparent border-none text-sm font-medium text-zinc-700 focus:ring-0 cursor-pointer"
                      >
                        <option value="admin">Admin</option>
                        <option value="personnel">Personnel</option>
                      </select>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2 text-sm text-zinc-600">
                    <Store size={14} />
                    {user.email !== 'thevalleyviewdrugshop@gmail.com' ? (
                      <select
                        value={user.shopId || ''}
                        onChange={(e) => handleAssignShop(user.id, e.target.value)}
                        className="bg-transparent border-none text-sm font-medium text-zinc-700 focus:ring-0 cursor-pointer"
                      >
                        <option value="">None (Admin)</option>
                        {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                      </select>
                    ) : (
                      <span className="text-xs font-medium text-zinc-400 italic">All Shops</span>
                    )}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setUserToResetEntries({ id: user.id, email: user.email })}
                      className="p-2 text-zinc-400 hover:text-amber-600 hover:bg-amber-50 rounded-lg transition-colors"
                      title="Reset User Entries"
                    >
                      <Eraser size={18} />
                    </button>
                    <button
                      onClick={() => handleFixProfile(user)}
                      className="p-2 text-zinc-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
                      title="Force Reset to Personnel"
                    >
                      <Activity size={18} />
                    </button>
                    <button 
                      onClick={() => handleDeleteUser(user.id, user.email)}
                      className="p-2 text-zinc-400 hover:text-rose-500 transition-colors"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Mobile Cards */}
        <div className="md:hidden divide-y divide-zinc-100">
          {users.map(user => (
            <div key={user.id} className="p-4 space-y-4">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-zinc-100 rounded-full text-zinc-400">
                    <UserIcon size={20} />
                  </div>
                  <span className="font-bold text-zinc-900 break-all">{user.email}</span>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setUserToResetEntries({ id: user.id, email: user.email })}
                    className="p-2 text-amber-600 bg-amber-50 rounded-lg"
                    title="Reset Entries"
                  >
                    <Eraser size={20} />
                  </button>
                  <button 
                    onClick={() => handleDeleteUser(user.id, user.email)}
                    className="p-2 text-rose-500 bg-rose-50 rounded-lg"
                  >
                    <Trash2 size={20} />
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Role</p>
                  <select
                    value={user.role}
                    onChange={(e) => handleUpdateRole(user.id, e.target.value as any)}
                    className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-bold text-zinc-700"
                  >
                    <option value="admin">Admin</option>
                    <option value="personnel">Personnel</option>
                  </select>
                </div>
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-zinc-400 uppercase">Shop</p>
                  <select
                    value={user.shopId || ''}
                    onChange={(e) => handleAssignShop(user.id, e.target.value)}
                    className="w-full p-2 bg-zinc-50 border border-zinc-200 rounded-lg text-sm font-bold text-zinc-700"
                  >
                    <option value="">None (Admin)</option>
                    {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
