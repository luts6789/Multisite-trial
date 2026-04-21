import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, addDoc, doc, updateDoc, deleteDoc, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Shop, Drug } from '../types';
import { Plus, Edit2, Trash2, X, Save, Store, CheckCircle, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { handleFirestoreError } from '../utils';

export const Inventory: React.FC = () => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [isAddingDrug, setIsAddingDrug] = useState(false);
  const [isAddingDelivery, setIsAddingDelivery] = useState(false);
  const [search, setSearch] = useState('');
  const [newShop, setNewShop] = useState({ name: '', location: '' });
  const [newDelivery, setNewDelivery] = useState({
    drugName: '',
    shopId: '',
    costPrice: 0,
    sellingPrice: 0,
    quantity: 0,
    expiryDate: ''
  });

  const [editingDrugId, setEditingDrugId] = useState<string | null>(null);
  const [editingDrugData, setEditingDrugData] = useState<Partial<Drug>>({});
  const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleUpdateDrug = async (id: string) => {
    try {
      await updateDoc(doc(db, 'drugs', id), {
        ...editingDrugData,
        updatedAt: Timestamp.now()
      });
      setEditingDrugId(null);
      setNotification({ message: 'Drug updated successfully!', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, 'update', 'drugs');
    }
  };

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
    const unsubDrugs = onSnapshot(collection(db, 'drugs'), (snapshot) => {
      setDrugs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Drug)));
    });
    return () => { unsubShops(); unsubDrugs(); };
  }, []);

  const handleAddDelivery = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await addDoc(collection(db, 'deliveries'), {
        ...newDelivery,
        status: 'pending',
        createdAt: Timestamp.now()
      });
      setNewDelivery({ drugName: '', shopId: '', costPrice: 0, sellingPrice: 0, quantity: 0, expiryDate: '' });
      setIsAddingDelivery(false);
      setNotification({ message: 'Delivery sent to shop for confirmation!', type: 'success' });
    } catch (error) {
      setNotification({ message: 'Failed to send delivery.', type: 'error' });
      handleFirestoreError(error, 'create', 'deliveries');
    } finally {
      setIsSubmitting(false);
    }
  };

  const [drugToDelete, setDrugToDelete] = useState<string | null>(null);

  const handleDeleteDrug = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'drugs', id));
      setDrugToDelete(null);
      setNotification({ message: 'Drug deleted successfully!', type: 'success' });
    } catch (error) {
      handleFirestoreError(error, 'delete', 'drugs');
      setNotification({ message: 'Failed to delete drug.', type: 'error' });
    }
  };

  const filteredDrugs = drugs.filter(drug => {
    const shopName = shops.find(s => s.id === drug.shopId)?.name || '';
    return drug.name.toLowerCase().includes(search.toLowerCase()) || 
           shopName.toLowerCase().includes(search.toLowerCase());
  });

  return (
    <div className="space-y-12 pb-20">
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

      {/* Drugs Section */}
      <section className="space-y-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Inventory</span>
            <h3 className="text-xl font-bold text-zinc-900">Master Inventory</h3>
            <p className="text-zinc-500 text-sm">Central control for all drugs across all sites. Update prices, quantities, and send new deliveries.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <input
                type="text"
                placeholder="Search name or shop..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-4 pr-4 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none w-64 shadow-sm"
              />
            </div>
            <button
              onClick={() => setIsAddingDelivery(true)}
              className="flex items-center gap-2 px-4 py-2 bg-zinc-900 text-white rounded-lg hover:bg-zinc-800 transition-all shadow-md"
            >
              <Plus size={18} /> Send Delivery
            </button>
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-zinc-200 overflow-hidden shadow-sm">
          {/* Desktop Table */}
          <table className="hidden md:table w-full text-left border-collapse">
            <thead>
              <tr className="bg-zinc-50 border-bottom border-zinc-200">
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Name</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Shop</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Cost</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Selling</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Qty</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Expiry</th>
                <th className="px-6 py-4 text-xs font-bold text-zinc-500 uppercase tracking-wider">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
              {filteredDrugs.map(drug => (
                <tr key={drug.id} className="hover:bg-zinc-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-zinc-900">{drug.name}</td>
                  <td className="px-6 py-4 text-zinc-500 text-sm">
                    {shops.find(s => s.id === drug.shopId)?.name || 'Unknown'}
                  </td>
                  <td className="px-6 py-4">
                    {editingDrugId === drug.id ? (
                      <input
                        type="number"
                        value={editingDrugData.costPrice}
                        onChange={(e) => setEditingDrugData({...editingDrugData, costPrice: parseFloat(e.target.value) || 0})}
                        className="w-24 px-2 py-1 border border-zinc-200 rounded font-mono text-sm"
                      />
                    ) : (
                      <span className="text-zinc-600 font-mono text-sm">{drug.costPrice}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingDrugId === drug.id ? (
                      <input
                        type="number"
                        value={editingDrugData.sellingPrice}
                        onChange={(e) => setEditingDrugData({...editingDrugData, sellingPrice: parseFloat(e.target.value) || 0})}
                        className="w-24 px-2 py-1 border border-zinc-200 rounded font-mono text-sm"
                      />
                    ) : (
                      <span className="text-zinc-600 font-mono text-sm">{drug.sellingPrice}</span>
                    )}
                  </td>
                  <td className="px-6 py-4">
                    {editingDrugId === drug.id ? (
                      <input
                        type="number"
                        value={editingDrugData.quantity}
                        onChange={(e) => setEditingDrugData({...editingDrugData, quantity: parseInt(e.target.value) || 0})}
                        className="w-20 px-2 py-1 border border-zinc-200 rounded font-mono text-sm"
                      />
                    ) : (
                      <span className="text-zinc-600 font-mono text-sm">{drug.quantity}</span>
                    )}
                  </td>
                  <td className="px-6 py-4 text-zinc-600 text-sm">{drug.expiryDate}</td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-1">
                      {editingDrugId === drug.id ? (
                        <>
                          <button onClick={() => handleUpdateDrug(drug.id)} className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors">
                            <Save size={18} />
                          </button>
                          <button onClick={() => setEditingDrugId(null)} className="p-2 text-zinc-400 hover:bg-zinc-50 rounded-lg transition-colors">
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <>
                          <button 
                            onClick={() => {
                              setNewDelivery({
                                drugName: drug.name,
                                shopId: '',
                                costPrice: drug.costPrice,
                                sellingPrice: drug.sellingPrice,
                                quantity: 0,
                                expiryDate: drug.expiryDate
                              });
                              setIsAddingDelivery(true);
                            }}
                            className="p-2 text-zinc-400 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors"
                            title="Send to Shop"
                          >
                            <Store size={18} />
                          </button>
                          <button 
                            onClick={() => {
                              setEditingDrugId(drug.id);
                              setEditingDrugData({
                                costPrice: drug.costPrice,
                                sellingPrice: drug.sellingPrice,
                                quantity: drug.quantity
                              });
                            }} 
                            className="p-2 text-zinc-400 hover:text-zinc-900 hover:bg-zinc-50 rounded-lg transition-colors"
                          >
                            <Edit2 size={18} />
                          </button>
                          <button onClick={() => setDrugToDelete(drug.id)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-colors">
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Mobile Cards */}
          <div className="md:hidden divide-y divide-zinc-100">
            {filteredDrugs.map(drug => (
              <div key={drug.id} className="p-4 space-y-3">
                  <div className="flex justify-between items-start">
                    <div>
                      <h4 className="font-bold text-zinc-900 text-lg">{drug.name}</h4>
                      <p className="text-xs text-zinc-500 font-bold uppercase tracking-wider">
                        {shops.find(s => s.id === drug.shopId)?.name || 'Unknown'}
                      </p>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          setNewDelivery({
                            drugName: drug.name,
                            shopId: '',
                            costPrice: drug.costPrice,
                            sellingPrice: drug.sellingPrice,
                            quantity: 0,
                            expiryDate: drug.expiryDate
                          });
                          setIsAddingDelivery(true);
                        }}
                        className="p-2 text-emerald-600 bg-emerald-50 rounded-lg"
                      >
                        <Store size={20} />
                      </button>
                      <button onClick={() => setDrugToDelete(drug.id)} className="p-2 text-rose-500 bg-rose-50 rounded-lg">
                        <Trash2 size={20} />
                      </button>
                    </div>
                  </div>
                <div className="grid grid-cols-2 gap-4 bg-zinc-50 p-3 rounded-xl">
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Quantity</p>
                    <p className="text-xl font-black text-zinc-900">{drug.quantity}</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Selling Price</p>
                    <p className="text-sm font-bold text-zinc-900">{drug.sellingPrice} UGX</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Cost Price</p>
                    <p className="text-sm text-zinc-500">{drug.costPrice} UGX</p>
                  </div>
                  <div>
                    <p className="text-[10px] font-bold text-zinc-400 uppercase">Expiry</p>
                    <p className="text-sm text-zinc-500">{drug.expiryDate}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Modals */}
      <AnimatePresence>
        {isAddingDelivery && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-end sm:items-center justify-center z-50 p-0 sm:p-4">
            <motion.div 
              initial={{ y: '100%', opacity: 0 }} 
              animate={{ y: 0, opacity: 1 }} 
              exit={{ y: '100%', opacity: 0 }} 
              className="bg-white p-8 rounded-t-[2.5rem] sm:rounded-[2.5rem] shadow-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto"
            >
              <div className="flex justify-between items-center mb-6">
                <h3 className="text-2xl font-bold">Send New Delivery</h3>
                <button onClick={() => setIsAddingDelivery(false)} className="p-2 hover:bg-zinc-100 rounded-full"><X size={24} /></button>
              </div>
              <form onSubmit={handleAddDelivery} className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">Drug Name</label>
                  <input required type="text" value={newDelivery.drugName} onChange={e => setNewDelivery({...newDelivery, drugName: e.target.value})} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none text-lg" />
                </div>
                <div className="relative">
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">Assign to Shop</label>
                  <select 
                    required 
                    value={newDelivery.shopId} 
                    onChange={e => setNewDelivery({...newDelivery, shopId: e.target.value})} 
                    className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none text-lg appearance-none cursor-pointer"
                  >
                    <option value="">Select Shop</option>
                    {shops.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <div className="absolute right-4 bottom-5 pointer-events-none text-zinc-400">
                    <Store size={20} />
                  </div>
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">Expiry Date</label>
                  <input required type="date" value={newDelivery.expiryDate} onChange={e => setNewDelivery({...newDelivery, expiryDate: e.target.value})} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none text-lg" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">Cost Price (UGX)</label>
                  <input required type="number" min="0" value={newDelivery.costPrice} onChange={e => setNewDelivery({...newDelivery, costPrice: Number(e.target.value)})} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none text-lg" />
                </div>
                <div>
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">Selling Price (UGX)</label>
                  <input required type="number" min="0" value={newDelivery.sellingPrice} onChange={e => setNewDelivery({...newDelivery, sellingPrice: Number(e.target.value)})} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none text-lg" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-zinc-400 uppercase mb-2 tracking-widest">Quantity to Send</label>
                  <input required type="number" min="1" value={newDelivery.quantity} onChange={e => setNewDelivery({...newDelivery, quantity: Number(e.target.value)})} className="w-full p-4 bg-zinc-50 border border-zinc-200 rounded-2xl focus:ring-2 focus:ring-zinc-900 outline-none text-lg" />
                </div>
                <button 
                  type="submit" 
                  disabled={isSubmitting}
                  className="sm:col-span-2 py-5 bg-zinc-900 text-white rounded-2xl font-bold hover:bg-zinc-800 disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center gap-2 text-lg shadow-lg"
                >
                  {isSubmitting ? (
                    <div className="w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                  ) : (
                    <>
                      <Save size={24} /> Send to Shop
                    </>
                  )}
                </button>
              </form>
            </motion.div>
          </div>
        )}

        {drugToDelete && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }} 
              animate={{ scale: 1, opacity: 1 }} 
              exit={{ scale: 0.9, opacity: 0 }} 
              className="bg-white p-8 rounded-[2.5rem] shadow-2xl w-full max-w-md text-center"
            >
              <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto mb-6">
                <Trash2 className="text-rose-600" size={40} />
              </div>
              <h3 className="text-2xl font-black text-zinc-900 mb-2">Delete Drug?</h3>
              <p className="text-zinc-500 mb-8">This action cannot be undone. Are you sure you want to remove this item from the inventory?</p>
              <div className="flex gap-4">
                <button 
                  onClick={() => setDrugToDelete(null)}
                  className="flex-1 py-4 bg-zinc-100 text-zinc-600 rounded-2xl font-bold hover:bg-zinc-200 transition-all"
                >
                  Cancel
                </button>
                <button 
                  onClick={() => handleDeleteDrug(drugToDelete)}
                  className="flex-1 py-4 bg-rose-600 text-white rounded-2xl font-bold hover:bg-rose-700 transition-all shadow-lg shadow-rose-200"
                >
                  Delete
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
