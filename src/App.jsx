import { useState, useEffect, useCallback, useRef } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import { Plus, Trash2, Check, Clock, MapPin, Building2, RefreshCw, Phone } from "lucide-react";
import { db } from "./firebase.js";

const NURSES = ["Meryem", "Sanaa", "Dounia", "Fatim Zahra", "Wiam", "Yasmine"];
const LABS = [
  { id: "maarif", name: "Laboplus Maarif" },
  { id: "ghandi", name: "Laboplus Ghandi" },
];

function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function formatDateLong(key) {
  const [y, m, d] = key.split("-").map(Number);
  const date = new Date(y, m - 1, d);
  const str = date.toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long" });
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function emptyRow() {
  return {
    id: `r_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    heure: "",
    patient: "",
    tel: "",
    labo: "",
    infirmiere: "",
    fait: false,
  };
}

export default function App() {
  const [dateKey, setDateKey] = useState(todayKey());
  const [rows, setRows] = useState(null);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(true);
  const savingTimeout = useRef(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const k = todayKey();
      setDateKey((prev) => (prev !== k ? k : prev));
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    setRows(null);
    const ref = doc(db, "prelevements", dateKey);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        setConnected(true);
        if (snap.exists()) {
          const data = snap.data();
          setRows(Array.isArray(data.rows) ? data.rows : []);
        } else {
          setRows([]);
        }
      },
      (error) => {
        console.error("Firestore error:", error);
        setConnected(false);
        setRows((prev) => prev ?? []);
      }
    );
    return () => unsubscribe();
  }, [dateKey]);

  const persist = useCallback(
    async (nextRows) => {
      setSaving(true);
      try {
        const ref = doc(db, "prelevements", dateKey);
        await setDoc(ref, { rows: nextRows, updatedAt: Date.now() });
        setConnected(true);
      } catch (e) {
        console.error("Erreur de sauvegarde:", e);
        setConnected(false);
      } finally {
        clearTimeout(savingTimeout.current);
        savingTimeout.current = setTimeout(() => setSaving(false), 400);
      }
    },
    [dateKey]
  );

  const updateRows = (updater) => {
    setRows((prev) => {
      const base = prev || [];
      const next = typeof updater === "function" ? updater(base) : updater;
      persist(next);
      return next;
    });
  };

  const addRow = () => updateRows((prev) => [...prev, emptyRow()]);
  const updateRow = (id, field, value) =>
    updateRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)));
  const deleteRow = (id) => updateRows((prev) => prev.filter((r) => r.id !== id));

  const sortedRows = rows
    ? [...rows].sort((a, b) => {
        if (!a.heure && !b.heure) return 0;
        if (!a.heure) return 1;
        if (!b.heure) return -1;
        return a.heure.localeCompare(b.heure);
      })
    : [];

  const totalCount = r
