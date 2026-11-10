'use strict';

/* Shared item catalog — used by the invoice maker and the admin price manager */
window.AE_INSTALL = {
  item: 'Installation & Service Charge',
  desc: 'Installation, wiring and service charge'
};

window.AE_GROUPS = ['All', 'My Items', 'CCTV', 'Solar', 'Wiring', 'Power & Control', 'Labour', 'Charges'];

window.AE_CATALOG = [
  // CCTV
  { group: 'CCTV', item: 'CCTV Camera 2MP', desc: 'HD bullet / dome camera, night vision', price: 7500 },
  { group: 'CCTV', item: 'CCTV Camera 5MP', desc: '5MP HD bullet / dome camera, night vision', price: 12500 },
  { group: 'CCTV', item: 'DVR 4 Channel', desc: '4 channel DVR with mobile view', price: 15000 },
  { group: 'CCTV', item: 'DVR 8 Channel', desc: '8 channel DVR with mobile view', price: 24000 },
  { group: 'CCTV', item: 'CCTV Hard Disk 1TB', desc: 'Surveillance hard disk 1TB', price: 13500 },
  { group: 'CCTV', item: 'CCTV Power Supply 12V 10A', desc: 'Central power supply unit', price: 4500 },
  { group: 'CCTV', item: 'CCTV Cable (per meter)', desc: 'Coaxial + power cable', price: 120 },
  { group: 'CCTV', item: 'BNC Connector', desc: 'Video connector (per piece)', price: 250 },
  { group: 'CCTV', item: 'CCTV Camera Installation', desc: 'Installation & wiring per camera point', price: 2500 },

  // Solar
  { group: 'Solar', item: 'Solar Panel 550W', desc: 'Monocrystalline solar panel', price: 42000 },
  { group: 'Solar', item: 'Solar Panel 450W', desc: 'Monocrystalline solar panel', price: 35000 },
  { group: 'Solar', item: 'Solar Inverter 3kW Hybrid', desc: 'Hybrid inverter with grid support', price: 185000 },
  { group: 'Solar', item: 'Solar Battery 100Ah', desc: 'Deep cycle battery', price: 48000 },
  { group: 'Solar', item: 'Solar Charge Controller 60A', desc: 'MPPT charge controller', price: 22000 },
  { group: 'Solar', item: 'Solar Mounting Structure', desc: 'Galvanized roof mounting frame', price: 15000 },
  { group: 'Solar', item: 'Solar DC Cable (per meter)', desc: 'UV resistant DC cable', price: 350 },
  { group: 'Solar', item: 'Solar Installation & Commissioning', desc: 'Full system installation and testing', price: 25000 },

  // Wiring
  { group: 'Wiring', item: 'House Wiring (per point)', desc: 'Concealed wiring with accessories', price: 1500 },
  { group: 'Wiring', item: 'Industrial Wiring (per point)', desc: 'Industrial grade wiring per point', price: 2500 },
  { group: 'Wiring', item: 'Switch Socket 13A', desc: 'Wall switch socket outlet', price: 950 },
  { group: 'Wiring', item: 'MCB 16A', desc: 'Miniature circuit breaker', price: 1250 },
  { group: 'Wiring', item: 'Distribution Board 8 Way', desc: '8 way DB with cover', price: 6500 },
  { group: 'Wiring', item: 'LED Panel Light', desc: 'Ceiling LED panel light', price: 2200 },
  { group: 'Wiring', item: 'Ceiling Fan', desc: 'Ceiling fan with regulator', price: 9500 },
  { group: 'Wiring', item: 'Electrical Cable (per meter)', desc: 'Copper cable 1.5 / 2.5 / 4 mm', price: 280 },

  // Power & Control
  { group: 'Power & Control', item: 'Power Control Panel', desc: 'Custom power control panel', price: 35000 },
  { group: 'Power & Control', item: 'Motor Control Panel', desc: 'Motor starter / control panel', price: 45000 },
  { group: 'Power & Control', item: 'Automatic Gate Motor', desc: 'Gate motor with remote control', price: 85000 },
  { group: 'Power & Control', item: 'Security Alarm System', desc: 'Alarm panel with sensors', price: 28000 },

  // Labour
  { group: 'Labour', item: 'Electrician Labour (per day)', desc: 'Skilled technician per day', price: 5000 },
  { group: 'Labour', item: 'Site Visit & Inspection', desc: 'Site inspection and estimate', price: 2000 },

  // Charges
  { group: 'Charges', item: 'Installation & Service Charge', desc: 'Installation, wiring and service charge', price: 2500 },
  { group: 'Charges', item: 'Insulation Charge', desc: 'Cable and pipe insulation work', price: 1500 },
  { group: 'Charges', item: 'Delivery & Transport', desc: 'Transport of goods to site', price: 1500 }
];
