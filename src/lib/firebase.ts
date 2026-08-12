import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey || "AIzaSyD-wKkFfKFTQN1lQtjSZ25Clpuia7TZqJo",
  authDomain: firebaseConfigJson.authDomain || "medi-queue-4be67.firebaseapp.com",
  projectId: firebaseConfigJson.projectId || "medi-queue-4be67",
  storageBucket: firebaseConfigJson.storageBucket || "medi-queue-4be67.firebasestorage.app",
  messagingSenderId: firebaseConfigJson.messagingSenderId || "487405101252",
  appId: firebaseConfigJson.appId || "1:487405101252:web:c20e2dcd936f40b9dd2991",
};

const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const db = firebaseConfigJson.firestoreDatabaseId && firebaseConfigJson.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfigJson.firestoreDatabaseId)
  : getFirestore(app);

export const auth = getAuth(app);

