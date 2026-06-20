import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyDkj4dgOkAo7Z2_NKW3mMC7jk41k3Cj-ak",
  authDomain: "domiciles-laboplus.firebaseapp.com",
  projectId: "domiciles-laboplus",
  storageBucket: "domiciles-laboplus.firebasestorage.app",
  messagingSenderId: "21859088066",
  appId: "1:21859088066:web:ef036c3775c828fdf6ad5b",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
