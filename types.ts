
export interface ParsedClient {
  id: string; // Unique ID for React keys (generated)
  name: string;
  dueDate: Date;
  rawNotes: string;
  customNotes?: string;
  customMessage?: string; // Nova funcionalidade: Mensagem personalizada
  tags?: string[]; // Array of Tag IDs
  linked?: ParsedClient[]; // New: Linked/Dependent clients
  type: 'iptv' | 'p2p';
}

export interface ProcessingStats {
  totalParsed: number;
  invalidLines: number;
  filteredCount: number;
  type: 'iptv' | 'p2p' | 'mixed';
}

export interface MessageTemplate {
  id: string;
  label: string;
  content: string;
}

export interface ClientTag {
  id: string;
  label: string;
  color: string; // Hex code
}

export interface PricingPlan {
  id: string;
  label: string;
  price: number;
}

export interface PlanGroup {
  id: string;
  label: string; // e.g., "Padrão (1 Tela)", "2 Telas", "Revenda"
  title?: string; // Custom title for this group specific table
  plans: PricingPlan[];
}

export interface QuickLink {
  id: string;
  label: string;
  url: string;
}

export interface AppConfig {
  pixKey: string;
  defaultTime: string; // New: Configurable time (e.g., "20:00")
  antiBanMode: boolean; // New: WhatsApp Security Mode
  plansTitle?: string; // New: Customizable title for the pricing table
  plans: PricingPlan[]; // Legacy support (Main default plans)
  planGroups: PlanGroup[]; // New: Multiple Pricing Tables
  priceLineFormat?: string; // New: Format for the price line (e.g. "{nome} - R$ {valor}")
  quickLinks: QuickLink[]; // New: Bank of quick links
  templates: {
    normal: string;
    expired: string;
    receipt: string; // New: Receipt Template
    additional: MessageTemplate[]; // Multiple templates support
  };
  tags: ClientTag[]; // New: Available tags
}

export type ViewMode = 'input' | 'results';
export type ResultViewMode = 'grid' | 'list' | 'focus'; // Added 'focus'

export interface DateRange {
  start: string;
  end: string;
}

export interface ToastMessage {
  id: number;
  text: string;
  type: 'success' | 'error' | 'info' | 'warning';
}

export interface DashboardStats {
  total: number;
  expired: number;
  today: number;
  potentialRevenue: number;
}

export interface ActionLog {
  clientId: string;
  clientName: string;
  timestamp: number;
  action: 'whatsapp' | 'copy' | 'mark' | 'receipt';
}
