// User related types
export enum UserRole {
  ADMIN = "admin",
  SUPERVISOR = "supervisor",
  VIEWER = "viewer"
}

export interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  createdAt: Date;
}

// Site related types
export interface Site {
  id: string;
  name: string;
  jobName: string;
  posNo: string;
  location: string; // Added location field to match database requirements
  startDate: Date;
  completionDate?: Date;
  supervisorId: string;
  supervisor: string; // This field is required based on error messages
  createdAt: Date;
  isCompleted: boolean;
  funds?: number;
  totalFunds?: number;
}

// Financial data types
export enum PaymentMethod {
  NEFT = "NEFT",
  RTGS = "RTGS",
  IMPS = "IMPS",
  UPI = "UPI",
  CASH = "Cash"
}

export interface HeadOfficeTransaction {
  id: string;
  date: Date;
  supervisorId: string;
  supervisorName: string;
  amount: number;
  description?: string;
  createdAt: Date;
}

export enum ExpenseCategory {
  TRAVEL = "travel",
  MATERIAL = "material",
  LABOR = "labor",
  OFFICE = "office",
  MISC = "misc",
  TRANSPORT = "transport",
  FOOD = "food",
  ACCOMMODATION = "accommodation",
  EQUIPMENT = "equipment",
  MAINTENANCE = "maintenance",
  STAFF_TRAVELLING_CHARGES = "STAFF TRAVELLING CHARGES",
  STATIONARY_PRINTING = "STATIONARY & PRINTING",
  DIESEL_FUEL_CHARGES = "DIESEL & FUEL CHARGES",
  LABOUR_TRAVELLING_EXP = "LABOUR TRAVELLING EXP.",
  LOADGING_BOARDING_STAFF = "LOADGING & BOARDING FOR STAFF",
  FOOD_CHARGES_LABOUR = "FOOD CHARGES FOR LABOUR",
  SITE_EXPENSES = "SITE EXPENSES",
  ROOM_RENT_LABOUR = "ROOM RENT FOR LABOUR"
}

export enum AdvancePurpose {
  ADVANCE = "advance",
  SAFETY_SHOES = "safety_shoes",
  TOOLS = "tools",
  OTHER = "other"
}

export enum ApprovalStatus {
  PENDING = "pending",
  APPROVED = "approved",
  REJECTED = "rejected"
}

export enum PaymentStatus {
  PENDING = "pending",
  PAID = "paid"
}

export enum RecipientType {
  WORKER = "worker",
  SUBCONTRACTOR = "subcontractor",
  SUPERVISOR = "supervisor"
}

export interface Expense {
  id: string;
  date: Date;
  description: string;
  category: ExpenseCategory | string;
  amount: number;
  status: ApprovalStatus;
  createdBy: string;
  createdAt: Date;
  siteId?: string; // Reference to the site
  supervisorId: string;
}

export interface Advance {
  id: string;
  date: Date;
  recipientId?: string;
  recipientName: string;
  recipientType: RecipientType;
  purpose: AdvancePurpose;
  amount: number;
  remarks?: string;
  status: ApprovalStatus;
  createdBy: string;
  createdAt: Date;
  siteId?: string;
}

export interface FundsReceived {
  id: string;
  date: Date;
  amount: number;
  siteId: string;
  createdAt: Date;
  reference?: string;
  method?: string; // Changed from PaymentMethod to string to be more flexible
}

export interface BankDetails {
  accountNumber: string;
  bankName: string;
  ifscCode: string;
  email?: string;
  mobile?: string;
}

export interface MaterialItem {
  id?: string;
  material: string;
  quantity: number | null;
  rate: number | null;
  gstPercentage: number | null;
  amount: number | null;
}

export interface Invoice {
  id: string;
  date: Date;
  partyId: string;
  partyName: string;
  material: string;
  quantity: number;
  rate: number;
  gstPercentage: number;
  grossAmount: number;
  netAmount: number;
  materialItems?: MaterialItem[];
  bankDetails: BankDetails;
  billUrl?: string;
  invoiceImageUrl?: string;
  paymentStatus: PaymentStatus;
  createdBy: string;
  createdAt: Date;
  approverType?: "ho" | "supervisor";
  siteId?: string; // Reference to the site
  vendorName?: string;  // Added for compatibility
  invoiceNumber?: string; // Added for compatibility
  amount?: number;       // Added for compatibility
  status: PaymentStatus;
}

// Balance Summary interface
export interface BalanceSummary {
  fundsReceived: number;
  fundsReceivedFromSupervisor?: number;
  totalExpenditure: number;
  totalAdvances: number;
  debitsToWorker: number;
  invoicesPaid: number;
  pendingInvoices: number;
  advancePaidToSupervisor?: number;
  totalBalance: number;
}

export interface ChartDataPoint {
  name: string;
  value: number;
}

export interface CategorySummary {
  category: ExpenseCategory;
  total: number;
  percentage: number;
}

export interface DailyExpenseSummary {
  date: Date;
  total: number;
  categories: CategorySummary[];
}

// For recent activity feed
export enum ActivityType {
  EXPENSE = "expense",
  ADVANCE = "advance",
  INVOICE = "invoice",
  FUNDS = "funds",
  PAYMENT = "payment"
}

export interface Activity {
  id: string;
  type: ActivityType;
  description: string;
  amount: number;
  date: Date;
  user: string;
}

// Supervisor transaction types
export enum SupervisorTransactionType {
  FUNDS_RECEIVED = 'funds_received',
  ADVANCE_PAID = 'advance_paid'
}

export interface SupervisorTransaction {
  id: string;
  date: Date;
  payerSupervisorId: string;
  payerSupervisorName: string;
  receiverSupervisorId: string;
  receiverSupervisorName: string;
  payerSiteId: string;
  payerSiteName: string;
  receiverSiteId: string;
  receiverSiteName: string;
  amount: number;
  transactionType: SupervisorTransactionType;
  createdAt: Date;
}

// Authentication and user-related types
export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  created_at: Date;
}
