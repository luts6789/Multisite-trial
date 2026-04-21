import React, { useState, useEffect } from 'react';
import { collection, onSnapshot, query, where, Timestamp } from 'firebase/firestore';
import { db } from '../firebase';
import { Shop, Drug, Sale, UserProfile } from '../types';
import { Printer, FileText, Search, Download, Calendar, Store, TrendingUp } from 'lucide-react';
import { formatCurrency } from '../utils';
import { format, startOfDay, endOfDay } from 'date-fns';

interface StockReportProps {
  userProfile: UserProfile;
}

export const StockReport: React.FC<StockReportProps> = ({ userProfile }) => {
  const [shops, setShops] = useState<Shop[]>([]);
  const [drugs, setDrugs] = useState<Drug[]>([]);
  const [sales, setSales] = useState<Sale[]>([]);
  const [search, setSearch] = useState('');
  const [selectedShopId, setSelectedShopId] = useState<string>('all');
  const [reportType, setReportType] = useState<'stock' | 'sales'>('stock');
  const [selectedDate, setSelectedDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const isAdmin = userProfile.role === 'admin';

  useEffect(() => {
    // If not admin, force selectedShopId to user's shopId
    if (!isAdmin && userProfile.shopId) {
      setSelectedShopId(userProfile.shopId);
    }
  }, [isAdmin, userProfile.shopId]);

  useEffect(() => {
    const unsubShops = onSnapshot(collection(db, 'shops'), (snapshot) => {
      setShops(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Shop)));
    });
    
    // For drugs and sales, if not admin, we could filter at the query level for better security/performance
    // but the current rules already restrict read access. 
    // However, for the UI to be clean, we'll filter the local state.
    
    const unsubDrugs = onSnapshot(collection(db, 'drugs'), (snapshot) => {
      setDrugs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Drug)));
    });
    const unsubSales = onSnapshot(collection(db, 'sales'), (snapshot) => {
      setSales(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Sale)));
    });
    return () => { unsubShops(); unsubDrugs(); unsubSales(); };
  }, []);

  const handlePrint = () => {
    window.print();
  };

  const downloadCSV = (data: any[], filename: string) => {
    const csvContent = "data:text/csv;charset=utf-8," 
      + data.map(row => Object.values(row).join(",")).join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleDownloadStock = () => {
    const data = filteredDrugs.map((d, i) => ({
      index: i + 1,
      name: d.name,
      shop: shops.find(s => s.id === d.shopId)?.name || 'Unknown',
      quantity: d.quantity,
      price: d.sellingPrice,
      totalValue: d.costPrice * d.quantity,
      status: d.quantity < 10 ? 'Low Stock' : 'In Stock'
    }));
    const headers = { index: '#', name: 'Drug Name', shop: 'Location', quantity: 'Current Stock', price: 'Unit Price', totalValue: 'Total Value', status: 'Status' };
    downloadCSV([headers, ...data], `Stock_Report_${format(new Date(), 'yyyy-MM-dd')}.csv`);
  };

  const handleDownloadSales = () => {
    const data = filteredSales.map((s, i) => ({
      index: i + 1,
      date: format(s.timestamp.toDate(), 'yyyy-MM-dd HH:mm'),
      shop: shops.find(sh => sh.id === s.shopId)?.name || 'Unknown',
      drug: s.drugName,
      quantity: s.quantity,
      total: s.totalPrice,
      profit: s.profit
    }));
    const headers = { index: '#', date: 'Date', shop: 'Shop', drug: 'Drug', quantity: 'Qty', total: 'Total', profit: 'Profit' };
    downloadCSV([headers, ...data], `Sales_Report_${selectedDate}.csv`);
  };

  const filteredDrugs = drugs
    .filter(d => {
      const matchesSearch = d.name.toLowerCase().includes(search.toLowerCase()) ||
        shops.find(s => s.id === d.shopId)?.name.toLowerCase().includes(search.toLowerCase());
      const matchesShop = selectedShopId === 'all' || d.shopId === selectedShopId;
      return matchesSearch && matchesShop;
    })
    .sort((a, b) => a.name.localeCompare(b.name));

  const filteredSales = sales
    .filter(s => {
      const saleDate = s.timestamp.toDate();
      const targetDate = new Date(selectedDate);
      const isSameDay = saleDate.getDate() === targetDate.getDate() &&
                       saleDate.getMonth() === targetDate.getMonth() &&
                       saleDate.getFullYear() === targetDate.getFullYear();
      const matchesShop = selectedShopId === 'all' || s.shopId === selectedShopId;
      return isSameDay && matchesShop;
    })
    .sort((a, b) => b.timestamp.toDate().getTime() - a.timestamp.toDate().getTime());

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 no-print">
        <div>
          <span className="text-[10px] font-bold text-zinc-400 uppercase tracking-widest mb-1 block">Reports</span>
          <h2 className="text-3xl font-black text-zinc-900 tracking-tight">System Reports</h2>
          <p className="text-zinc-500">Generate, print, and download detailed stock and sales reports for all locations.</p>
        </div>
        <div className="flex items-center gap-2 bg-zinc-100 p-1 rounded-xl border border-zinc-200">
          <button
            onClick={() => setReportType('stock')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${reportType === 'stock' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            Stock Inventory
          </button>
          <button
            onClick={() => setReportType('sales')}
            className={`px-4 py-2 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${reportType === 'sales' ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-700'}`}
          >
            Sales Report
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 no-print">
        {isAdmin && (
          <div className="md:col-span-1">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1 tracking-widest">Filter by Shop</label>
            <div className="relative">
              <Store className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <select
                value={selectedShopId}
                onChange={(e) => setSelectedShopId(e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none appearance-none text-sm font-medium"
              >
                <option value="all">All Shops</option>
                {shops.map(shop => (
                  <option key={shop.id} value={shop.id}>{shop.name}</option>
                ))}
              </select>
            </div>
          </div>
        )}

        {reportType === 'sales' && (
          <div className="md:col-span-1">
            <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1 tracking-widest">Select Date</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none text-sm font-medium"
              />
            </div>
          </div>
        )}

        <div className={reportType === 'sales' ? 'md:col-span-1' : 'md:col-span-2'}>
          <label className="block text-[10px] font-bold text-zinc-400 uppercase mb-1 tracking-widest">Search</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" size={16} />
            <input
              type="text"
              placeholder={reportType === 'stock' ? "Search drugs..." : "Filter results..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-white border border-zinc-200 rounded-xl focus:ring-2 focus:ring-zinc-900 outline-none text-sm font-medium"
            />
          </div>
        </div>

        <div className="md:col-span-1 flex items-end gap-2">
          <button
            onClick={handlePrint}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-100 text-zinc-900 rounded-xl font-bold hover:bg-zinc-200 transition-all text-sm"
          >
            <Printer size={16} /> Print
          </button>
          <button
            onClick={reportType === 'stock' ? handleDownloadStock : handleDownloadSales}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 bg-zinc-900 text-white rounded-xl font-bold hover:bg-zinc-800 transition-all text-sm shadow-lg shadow-zinc-200"
          >
            <Download size={16} /> Export
          </button>
        </div>
      </div>

      <div className="bg-white rounded-[2rem] border border-zinc-200 shadow-xl overflow-hidden print:border-0 print:shadow-none">
        <div className="p-8 border-b border-zinc-100 flex justify-between items-center bg-zinc-50/50">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-zinc-900 rounded-xl flex items-center justify-center">
              {reportType === 'stock' ? <FileText className="text-white" size={20} /> : <TrendingUp className="text-white" size={20} />}
            </div>
            <div>
              <h3 className="font-bold text-zinc-900">
                {reportType === 'stock' ? 'Official Stock Inventory' : `Sales Report - ${selectedDate}`}
              </h3>
              <p className="text-xs text-zinc-500 uppercase tracking-widest font-bold">
                {selectedShopId === 'all' ? 'All Locations' : shops.find(s => s.id === selectedShopId)?.name}
              </p>
            </div>
          </div>
          <div className="text-right hidden md:block print:block">
            <p className="text-sm font-bold text-zinc-900">PharmaTrack Multi-Site</p>
            <p className="text-xs text-zinc-500">Management System</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          {reportType === 'stock' ? (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest w-16">#</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Drug Name</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Location</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest text-center">Stock</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Price</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Total Value</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredDrugs.map((drug, index) => {
                  const shop = shops.find(s => s.id === drug.shopId);
                  const isLowStock = drug.quantity < 10;
                  const isExpired = new Date(drug.expiryDate) < new Date();

                  return (
                    <tr key={drug.id} className="hover:bg-zinc-50/50 transition-colors group">
                      <td className="px-6 py-4 text-sm font-mono text-zinc-400">{index + 1}</td>
                      <td className="px-6 py-4">
                        <p className="font-bold text-zinc-900">{drug.name}</p>
                        <p className="text-[10px] text-zinc-400 uppercase font-bold tracking-tighter">ID: {drug.id.slice(0, 8)}</p>
                      </td>
                      <td className="px-6 py-4">
                        <span className="text-sm font-medium text-zinc-600">{shop?.name || 'Unknown'}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`text-xl font-black ${isLowStock ? 'text-rose-600' : 'text-zinc-900'} font-mono`}>
                          {drug.quantity}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-zinc-900">
                        {formatCurrency(drug.sellingPrice)}
                      </td>
                      <td className="px-6 py-4 text-sm font-bold text-zinc-900">
                        {formatCurrency(drug.costPrice * drug.quantity)}
                      </td>
                      <td className="px-6 py-4">
                        {isExpired ? (
                          <span className="text-[10px] font-black uppercase text-rose-600 bg-rose-50 px-2 py-1 rounded">Expired</span>
                        ) : isLowStock ? (
                          <span className="text-[10px] font-black uppercase text-amber-600 bg-amber-50 px-2 py-1 rounded">Low Stock</span>
                        ) : (
                          <span className="text-[10px] font-black uppercase text-emerald-600 bg-emerald-50 px-2 py-1 rounded">In Stock</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-zinc-50 border-b border-zinc-200">
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest w-16">#</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Time</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Shop</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest">Drug</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest text-center">Qty</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest text-right">Total</th>
                  <th className="px-6 py-4 text-xs font-bold text-zinc-400 uppercase tracking-widest text-right">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {filteredSales.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-6 py-12 text-center text-zinc-400 italic">No sales recorded for this date and shop.</td>
                  </tr>
                ) : (
                  filteredSales.map((sale, index) => (
                    <tr key={sale.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4 text-sm font-mono text-zinc-400">{index + 1}</td>
                      <td className="px-6 py-4 text-sm text-zinc-600">{format(sale.timestamp.toDate(), 'HH:mm')}</td>
                      <td className="px-6 py-4 text-sm font-medium text-zinc-900">{shops.find(s => s.id === sale.shopId)?.name || 'Unknown'}</td>
                      <td className="px-6 py-4 text-sm font-bold text-zinc-900">{sale.drugName}</td>
                      <td className="px-6 py-4 text-center font-mono">{sale.quantity}</td>
                      <td className="px-6 py-4 text-right font-bold text-zinc-900">{formatCurrency(sale.totalPrice)}</td>
                      <td className="px-6 py-4 text-right font-bold text-emerald-600">{formatCurrency(sale.profit)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          )}
        </div>
        
        <div className="p-8 bg-zinc-50 border-t border-zinc-100 flex flex-col md:flex-row justify-between items-center gap-4 no-print">
          <p className="text-sm text-zinc-500">
            {reportType === 'stock' 
              ? `Showing ${filteredDrugs.length} items in inventory.` 
              : `Showing ${filteredSales.length} transactions.`}
          </p>
          <div className="flex flex-col items-end">
            <p className="text-sm font-bold text-zinc-900">
              {reportType === 'stock' 
                ? `Total Inventory Value: ${formatCurrency(filteredDrugs.reduce((acc, d) => acc + (d.costPrice * d.quantity), 0))}`
                : `Total Sales Revenue: ${formatCurrency(filteredSales.reduce((acc, s) => acc + s.totalPrice, 0))}`}
            </p>
            {reportType === 'sales' && (
              <p className="text-xs font-bold text-emerald-600 uppercase tracking-widest mt-1">
                Total Net Profit: {formatCurrency(filteredSales.reduce((acc, s) => acc + s.profit, 0))}
              </p>
            )}
          </div>
        </div>
      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media print {
          .no-print { display: none !important; }
          body { background: white !important; }
          .print\\:border-0 { border: 0 !important; }
          .print\\:shadow-none { box-shadow: none !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { border-bottom: 1px solid #e5e5e5 !important; }
          @page { margin: 2cm; }
        }
      `}} />
    </div>
  );
};

