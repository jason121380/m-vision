export type CamType = 'video' | 'photo';

export type ServiceRow = { key: string; label: string; price: number };
export type CameraRow = { type: CamType; key: string; label: string; price: number; note: string };
export type CeremonyRow = { type: CamType; key: string; label: string; price: number };
export type AddonRow = { key: string; label: string; price: number };
export type PhotographerRow = { type: CamType; key: string; name: string; role: string; price: number };
export type SettingsMap = Record<string, string>;

export type AppConfig = {
  services: ServiceRow[];
  cameras: CameraRow[];
  ceremonies: CeremonyRow[];
  addons: AddonRow[];
  photographers: PhotographerRow[];
  settings: SettingsMap;
};

export type ServiceKey = '' | 'video' | 'photo' | 'both';
export type TimeKey = '' | 'lunch' | 'dinner';
export type AddrMode = 'none' | 'hotel' | 'rest' | 'addr';

export type FormState = {
  year: string;
  month: string;
  day: string;
  svc: ServiceKey;
  vmTime: TimeKey;
  pmTime: TimeKey;
  vcKey: string;
  pcKey: string;
  vcerKey: string;
  pcerKey: string;
  addonKey: string;
  vpKey: string;
  ppKey: string;
  groom: string;
  bride: string;
  phone: string;
  wt: TimeKey;
  restaurant: string;
  hotelMode: 'none' | 'addr';
  hotel: string;
  wzMode: AddrMode;
  wz: string;
  yqMode: AddrMode;
  yq: string;
  zhMode: AddrMode;
  zh: string;
  makeup: string;
  signature: string;
};

export const initialState: FormState = {
  year: '2026',
  month: '',
  day: '',
  svc: '',
  vmTime: '',
  pmTime: '',
  vcKey: '',
  pcKey: '',
  vcerKey: '',
  pcerKey: '',
  addonKey: 'none',
  vpKey: '',
  ppKey: '',
  groom: '',
  bride: '',
  phone: '',
  wt: '',
  restaurant: '',
  hotelMode: 'none',
  hotel: '',
  wzMode: 'none',
  wz: '',
  yqMode: 'none',
  yq: '',
  zhMode: 'none',
  zh: '',
  makeup: '',
  signature: '',
};
