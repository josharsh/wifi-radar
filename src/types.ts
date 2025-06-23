export interface WiFiNetwork {
  ssid: string;
  bssid: string;
  channel: number;
  frequency: number;
  signal: number;
  noise: number;
  security: string[];
  phyMode: string;
  networkType: string;
  countryCode: string;
  vendor?: string;
  encryption?: string;
  lastSeen: Date;
  isConnected: boolean;
}

export interface ConnectedDevice {
  mac: string;
  ip?: string;
  hostname?: string;
  vendor?: string;
  deviceType?: 'phone' | 'laptop' | 'tablet' | 'iot' | 'unknown';
  os?: string;
  lastSeen: Date;
  signal?: number;
  isActive: boolean;
}

export interface NetworkTopology {
  router: {
    mac: string;
    ip: string;
    vendor?: string;
    model?: string;
  };
  devices: ConnectedDevice[];
  networks: WiFiNetwork[];
  relationships: NetworkRelationship[];
}

export interface NetworkRelationship {
  from: string; // MAC address
  to: string;   // MAC address
  type: 'connected' | 'nearby' | 'roaming';
  strength: number;
}

export interface SignalAnalysis {
  network: WiFiNetwork;
  history: SignalReading[];
  prediction: SignalPrediction;
  recommendations: string[];
}

export interface SignalReading {
  timestamp: Date;
  signal: number;
  noise: number;
  snr: number;
  channel: number;
  interference: number;
}

export interface SignalPrediction {
  nextHour: number;
  confidence: number;
  factors: string[];
}

export interface SecurityAudit {
  network: WiFiNetwork;
  vulnerabilities: SecurityVulnerability[];
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  recommendations: string[];
}

export interface SecurityVulnerability {
  type: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  fix: string;
}

export interface AnomalyDetection {
  type: 'new_device' | 'unusual_traffic' | 'signal_anomaly' | 'security_event';
  severity: 'info' | 'warning' | 'critical';
  description: string;
  timestamp: Date;
  affected: string; // MAC or SSID
  data: any;
}

export interface RadarConfig {
  scanInterval: number;
  historySize: number;
  enablePrediction: boolean;
  enableAnomaly: boolean;
  debugMode: boolean;
  alertThreshold: number;
}