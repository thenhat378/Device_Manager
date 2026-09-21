// inspect_devices.js
import { initializeApp } from 'firebase/app';
import { getFirestore, collection, getDocs } from 'firebase/firestore';
import fs from 'fs';

const firebaseConfig = JSON.parse(fs.readFileSync('./firebase-applet-config.json', 'utf8'));
const app = initializeApp(firebaseConfig);
const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

async function main() {
  console.log("Fetching devices and transfers from Firestore...");
  const devicesSnap = await getDocs(collection(db, 'devices'));
  const transfersSnap = await getDocs(collection(db, 'transfers'));

  const devices = [];
  devicesSnap.forEach(doc => {
    devices.push({ id: doc.id, ...doc.data() });
  });

  const transfers = [];
  transfersSnap.forEach(doc => {
    transfers.push({ id: doc.id, ...doc.data() });
  });

  console.log(`Total devices: ${devices.length}`);
  console.log(`Total transfers: ${transfers.length}`);

  // Find Samsung/A9 tablets
  const filteredDevices = devices.filter(d => 
    d.name.toLowerCase().includes('samsung') || 
    d.name.toLowerCase().includes('a9') || 
    d.name.toLowerCase().includes('máy tính bảng')
  );

  console.log("\nFiltered Samsung/A9/Tablet Devices:");
  filteredDevices.forEach(d => {
    console.log(`- ID: ${d.id}, SN: ${d.serialNumber}, Name: ${d.name}, Location: ${JSON.stringify(d.location)}`);
    const devTransfers = transfers.filter(t => t.deviceId === d.id || t.deviceSn === d.serialNumber);
    console.log(`  Transfers (${devTransfers.length}):`);
    devTransfers.forEach(t => {
      console.log(`    * ID: ${t.id}, Date: ${t.transferDate}, From: ${JSON.stringify(t.fromLocation)}, To: ${JSON.stringify(t.toLocation)}, Reason: ${t.reason}`);
    });
  });
}

main().catch(console.error);
