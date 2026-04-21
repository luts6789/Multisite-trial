import { Timestamp } from 'firebase/firestore';

export type UserRole = 'admin' | 'personnel';

export interface Shop {
  id: string;
  name: string;
  location: string;
  lowStockLimit?: number;
}

export interface UserProfile {
  id: string;
  email: string;
  role: UserRole;
  shopId?: string;
}

export interface Drug {
  id: string;
  name: string;
  shopId: string;
  costPrice: number;
  sellingPrice: number;
  quantity: number;
  expiryDate: string;
}

export interface Sale {
  id: string;
  shopId: string;
  drugId: string;
  drugName: string;
  quantity: number;
  totalPrice: number;
  profit: number;
  timestamp: Timestamp;
  personnelId: string;
}

export interface Delivery {
  id: string;
  shopId: string;
  drugName: string;
  quantity: number;
  costPrice: number;
  sellingPrice: number;
  expiryDate: string;
  status: 'pending' | 'confirmed' | 'declined';
  rejectionReason?: string;
  createdAt: Timestamp;
}

export interface Order {
  id: string;
  shopId: string;
  drugName: string;
  quantity: number;
  status: 'pending' | 'approved' | 'declined';
  rejectionReason?: string;
  createdAt: Timestamp;
  personnelId: string;
}

export interface Expense {
  id: string;
  shopId: string;
  description: string;
  amount: number;
  timestamp: Timestamp;
  personnelId: string;
}

export interface ExtraSale {
  id: string;
  shopId: string;
  description: string;
  amount: number;
  timestamp: Timestamp;
  personnelId: string;
}

export interface Debt {
  id: string;
  shopId: string;
  patientName: string;
  patientPhone: string;
  drugId: string;
  drugName: string;
  quantity: number;
  amount: number;
  profit: number;
  anticipatedPaymentDate: string;
  status: 'unpaid' | 'paid';
  timestamp: Timestamp;
  personnelId: string;
}

export interface Message {
  id: string;
  shopId: string;
  senderId: string;
  senderName: string;
  receiverId?: string;
  content: string;
  timestamp: Timestamp;
  read: boolean;
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: 'create' | 'update' | 'delete' | 'list' | 'get' | 'write';
  path: string | null;
  authInfo: any;
}
