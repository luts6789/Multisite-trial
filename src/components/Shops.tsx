import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Shop, UserProfile } from '../types';
import { Plus, Edit2, Trash2, X, Save, Store, CheckCircle, AlertCircle, MapPin, Settings } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError } from '../utils';

interface ShopsProps {
  userProfile: UserProfile;
}

export const Shops: React.FC<ShopsProps> = ({ userProfile }) => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [isAddingShop, setIsAddingShop] = useState(false);
  const [newShop, setNewShop] = useState({ name: '', location: '' });
  const [editingShopId, setEditingShopId] = useState<string | null>(null);
  const [editingShopLimit, setEditingShopLimit] = useState<number>(10);
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shopToDelete, setShopToDelete] = useState<Shop | null>(null);
  const isAdmin = userProfile.role === 'admin';

  useEffect(() => {
    if (notification) {
      const timer = setTimeout(() => setNotification(null), 3000);
      return () => clearTimeout(timer);
    }
  }, [notification]);

  useEffect(() => {
    const unsubShops = onSnapshot(collection(db, 'shops'), (snapshot) => {
      setShops(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop)));
    });
    return () => unsubShops();
  }, []);

  const handleAddShop = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'shops'), {
        ...newShop,
        lowStockLimit: 10,
        createdAt: Timestamp.now()
      });
      setNewShop({ name: '', location: '' });
      setIsAddingShop(false);
      setNotification({ message: 'Shop location added successfully!', type: 'success' });
    } catch (error) {
      setNotification({ message: 'Failed to add shop.', type: 'error' });
      handleFirestoreError(error, 'create', 'shops');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateShopLimit = async (id: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'shops', id), {
        lowStockLimit: editingShopLimit
      });
      setEditingShopId(null);
      setNotification({ message: 'Shop limit updated successfully!', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, 'update', 'shops');
    }
  };

  const handleDeleteShop = (shop: Shop) => {
    console.log('[Shops Debug] Attempting to delete shop:', shop.name, 'isAdmin:', isAdmin);
    if (!isAdmin) return;
    setShopToDelete(shop);
  };

  const confirmDeleteShop = async () => {
    if (!shopToDelete || !isAdmin) return;
    console.log('[Shops Debug] Confirming deletion of shop:', shopToDelete.id);
    setIsSubmitting(true);
    try {
      await deleteDoc(doc(db, 'shops', shopToDelete.id));
      console.log('[Shops Debug] Shop deleted successfully from Firestore');
      setNotification({ message: 'Shop deleted successfully!', type: 'success' });
      setShopToDelete(null);
    } catch (error) {
      console.error('[Shops Debug] Error deleting shop:', error);
      handleFirestoreError(error, 'delete', 'shops');
      setNotification({ message: 'Failed to delete shop.', type: 'error' });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-8 pb-20">
      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {shopToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-[60] p-4">
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md border border-zinc-100"
            >
              <div className="w-16 h-16 bg-rose-50 rounded-2xl flex items-center justify-center mb-6">
                <AlertCircle size={32} className="text-rose-500" />
              </div>
              <h3 className="text-2xl font-black text-zinc-900 mb-2">Delete Shop?</h3>
              <p className="text-zinc-500 mb-8 leading-relaxed">
                Are you sure you want to delete <span className="font-bold text-zinc-900">"{shopToDelete.name}"</span>? 
                This action cannot be undone. Associated drugs will remain but will be orphaned.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShopToDelete(null)}
                  className="flex-1 py-4 bg-zinc-100 text-zinc-900 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDeleteShop}
                  disabled={isSubmitting}
                  className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200 flex items-center justify-center gap-2"
                >
                  {isSubmitting ? (
                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Trash2 size={18} /> Delete
                    </>
                  )}
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

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

      <div className="flex items-center justify-between">
        <div>
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Management</span>
          <h3 className="text-2xl font-black text-zinc-900">Drug Shop Locations</h3>
          <p className="text-zinc-500 text-sm">Manage physical sites, locations, and inventory alert thresholds.</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setIsAddingShop(true)}
            className="flex items-center gap-2 px-6 py-3 bg-zinc-900 text-white rounded-2xl hover:bg-zinc-800 transition-all shadow-lg shadow-zinc-200"
          >
            <Plus size={20} /> Add New Shop
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {shops.map(shop => (
          <motion.div 
            layout
            key={shop.id} 
            className={`p-8 bg-white border border-zinc-200 rounded-[2.5rem] shadow-sm flex flex-col justify-between relative overflow-hidden group ${userProfile.shopId === shop.id ? 'ring-2 ring-zinc-900' : ''}`}
          >
            {userProfile.shopId === shop.id && (
              <div className="absolute top-0 right-0 bg-zinc-900 text-white text-[10px] font-black px-4 py-1 rounded-bl-2xl uppercase tracking-widest">
                Your Assigned Shop
              </div>
            )}
            
            <div>
              <div className="w-14 h-14 bg-zinc-50 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform">
                <Store size={28} className="text-zinc-400" />
              </div>
              <h4 className="text-xl font-black text-zinc-900 mb-2">{shop.name}</h4>
              <div className="flex items-center gap-2 text-zinc-500 mb-6">
                <MapPin size={16} />
                <span className="text-sm font-medium">{shop.location}</span>
              </div>
              
              <div className="pt-6 border-t border-zinc-100">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest">Low Stock Alert</p>
                    <p className="text-sm text-zinc-500">Threshold for warnings</p>
                  </div>
                  {isAdmin && editingShopId !== shop.id && (
                    <button 
                      onClick={() => {
                        setEditingShopId(shop.id);
                        setEditingShopLimit(shop.lowStockLimit || 10);
                      }}
                      className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 rounded-xl transition-all"
                    >
                      <Settings size={18} />
                    </button>
                  )}
                </div>

                {editingShopId === shop.id ? (
                  <div className="flex items-center gap-2 bg-zinc-50 p-2 rounded-2xl">
                    <input
                      type="number"
                      value={editingShopLimit}
                      onChange={(e) => setEditingShopLimit(parseInt(e.target.value) || 0)}
                      className="flex-1 px-3 py-2 bg-white border border-zinc-200 rounded-xl font-mono text-base focus:ring-2 focus:ring-zinc-900 outline-none"
                    />
                    <button onClick={() => handleUpdateShopLimit(shop.id)} className="p-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 shadow-sm">
                      <Save size={18} />
                    </button>
                    <button onClick={() => setEditingShopId(null)} className="p-2 bg-white border border-zinc-200 text-zinc-600 rounded-xl hover:bg-zinc-50">
                      <X size={18} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-3xl font-black text-zinc-900 font-mono">{shop.lowStockLimit || 10}</span>
                    <span className="text-zinc-400 font-bold text-sm uppercase">Units</span>
                  </div>
                )}
              </div>
            </div>

            {isAdmin && (
              <div className="mt-8 pt-6 border-t border-zinc-100 flex justify-end">
                <button 
                  onClick={() => handleDeleteShop(shop)}
                  className="p-3 text-rose-400 hover:text-rose-600 hover:bg-rose-50 rounded-2xl transition-all"
                  title="Delete Shop"
                >
                  <Trash2 size={20} />
                </button>
              </div>
            )}
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {isAddingShop && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <motion.div 
              initial={{ y: '100%', opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: '100%', opacity: 0 }} 
              className="bg-white p-10 rounded-t-[3rem] sm:rounded-[3rem] shadow-2xl w-full max-w-md"
            >
              <div className="flex justify-between items-center mb-8">
                <div>
                  <h3 className="text-2xl font-black text-zinc-900">Add New Shop</h3>
                  <p className="text-zinc-500 text-sm">Expand your drug shop network.</p>
                </div>
                <button onClick={() => setIsAddingShop(false)} className="p-3 hover:bg-zinc-100 rounded-full transition-colors"><X size={24} /></button>
              </div>
              <form onSubmit={handleAddShop} className="space-y-8">
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-3 tracking-widest">Shop Name</label>
                  <input 
                    required 
                    type="text" 
                    value={newShop.name} 
                    onChange={e => setNewShop({...newShop, name: e.target.value})} 
                    className="w-full p-5 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none text-lg font-medium" 
                    placeholder="e.g. Balale View Drug Shop" 
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-3 tracking-widest">Location</label>
                  <input 
                    required 
                    type="text" 
                    value={newShop.location} 
                    onChange={e => setNewShop({...newShop, location: e.target.value})} 
                    className="w-full p-5 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none text-lg font-medium" 
                    placeholder="e.g. Main Street, Block 4" 
                  />
                </div>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="w-full py-5 bg-zinc-900 text-white rounded-[1.5rem] font-bold hover:bg-zinc-800 transition-all flex items-center justify-center gap-3 text-lg shadow-xl shadow-zinc-200"
                >
                  {isSubmitting ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Save size={24} /> Create Shop Location
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
