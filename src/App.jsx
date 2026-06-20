import { useState, useEffect, useCallback, useRef } from "react";
import { doc, onSnapshot, setDoc } from "firebase/firestore";
import {
  Plus,
  Trash2,
  Check,
  Clock,
  MapPin,
  Building2,
  RefreshCw,
  Phone,
  Users,
  X,
} from "lucide-react";
import { db } from "./firebase.js";

const DEFAULT_NURSES = ["Meryem", "Sanaa", "Dounia", "Fatim Zahra", "Wiam", "Yasmine"];

const LABS = [
  { id: "maarif", name: "Laboplus Maarif" },
  { id: "ghandi", name: "Laboplus Ghandi" },
];

function todayKey() {
  const d = new Date();
  return (
    d.getFullYear() +
    "-" +
    String(d.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(d.getDate()).padStart(2, "0")
  );
}

function formatDateLong(key) {
  const parts = key.split("-").map(Number);
  const date = new Date(parts[0], parts[1] - 1, parts[2]);
  const str = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function emptyRow() {
  return {
    id: "r_" + Date.now() + "_" + Math.random().toString(36).slice(2, 8),
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
  const [nurses, setNurses] = useState(null);
  const [saving, setSaving] = useState(false);
  const [connected, setConnected] = useState(true);
  const [teamPanelOpen, setTeamPanelOpen] = useState(false);
  const savingTimeout = useRef(null);

  useEffect(function () {
    const interval = setInterval(function () {
      const k = todayKey();
      setDateKey(function (prev) {
        return prev !== k ? k : prev;
      });
    }, 30000);
    return function () {
      clearInterval(interval);
    };
  }, []);

  useEffect(function () {
    setRows(null);
    const ref = doc(db, "prelevements", dateKey);
    const unsubscribe = onSnapshot(
      ref,
      function (snap) {
        setConnected(true);
        if (snap.exists()) {
          const data = snap.data();
          setRows(Array.isArray(data.rows) ? data.rows : []);
        } else {
          setRows([]);
        }
      },
      function (error) {
        console.error("Firestore error:", error);
        setConnected(false);
        setRows(function (prev) {
          return prev !== null && prev !== undefined ? prev : [];
        });
      }
    );
    return function () {
      unsubscribe();
    };
  }, [dateKey]);

  useEffect(function () {
    const ref = doc(db, "config", "team");
    const unsubscribe = onSnapshot(
      ref,
      async function (snap) {
        if (snap.exists()) {
          const data = snap.data();
          if (Array.isArray(data.nurses) && data.nurses.length > 0) {
            setNurses(data.nurses);
          } else {
            setNurses(DEFAULT_NURSES);
          }
        } else {
          setNurses(DEFAULT_NURSES);
          try {
            await setDoc(ref, { nurses: DEFAULT_NURSES });
          } catch (e) {
            console.error("Could not seed team list:", e);
          }
        }
      },
      function (error) {
        console.error("Firestore team error:", error);
        setNurses(DEFAULT_NURSES);
      }
    );
    return function () {
      unsubscribe();
    };
  }, []);

  const persistRows = useCallback(
    async function (nextRows) {
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
        savingTimeout.current = setTimeout(function () {
          setSaving(false);
        }, 400);
      }
    },
    [dateKey]
  );

  const persistNurses = useCallback(async function (nextNurses) {
    setSaving(true);
    try {
      const ref = doc(db, "config", "team");
      await setDoc(ref, { nurses: nextNurses });
      setConnected(true);
    } catch (e) {
      console.error("Erreur de sauvegarde équipe:", e);
      setConnected(false);
    } finally {
      clearTimeout(savingTimeout.current);
      savingTimeout.current = setTimeout(function () {
        setSaving(false);
      }, 400);
    }
  }, []);

  const updateRows = function (updater) {
    setRows(function (prev) {
      const base = prev || [];
      const next = typeof updater === "function" ? updater(base) : updater;
      persistRows(next);
      return next;
    });
  };

  const addRow = function () {
    updateRows(function (prev) {
      return prev.concat([emptyRow()]);
    });
  };

  const updateRow = function (id, field, value) {
    updateRows(function (prev) {
      return prev.map(function (r) {
        if (r.id === id) {
          const copy = Object.assign({}, r);
          copy[field] = value;
          return copy;
        }
        return r;
      });
    });
  };

  const deleteRow = function (id) {
    updateRows(function (prev) {
      return prev.filter(function (r) {
        return r.id !== id;
      });
    });
  };

  const addNurse = function (name) {
    const trimmed = name.trim();
    if (!trimmed) return;
    setNurses(function (prev) {
      const base = prev || [];
      if (
        base.some(function (n) {
          return n.toLowerCase() === trimmed.toLowerCase();
        })
      ) {
        return base;
      }
      const next = base.concat([trimmed]);
      persistNurses(next);
      return next;
    });
  };

  const removeNurse = function (name) {
    setNurses(function (prev) {
      const base = prev || [];
      const next = base.filter(function (n) {
        return n !== name;
      });
      persistNurses(next);
      return next;
    });
  };

  const sortedRows = rows
    ? rows.slice().sort(function (a, b) {
        if (!a.heure && !b.heure) return 0;
        if (!a.heure) return 1;
        if (!b.heure) return -1;
        return a.heure.localeCompare(b.heure);
      })
    : [];

  const totalCount = rows ? rows.length : 0;
  const doneCount = rows
    ? rows.filter(function (r) {
        return r.fait;
      }).length
    : 0;
  const unassignedCount = rows
    ? rows.filter(function (r) {
        return !r.infirmiere;
      }).length
    : 0;

  const nurseList = nurses || DEFAULT_NURSES;

  return (
    <div style={styles.page}>
      <style>{fontImport}</style>
      <div style={styles.wrap}>
        <div style={styles.header}>
          <div style={styles.headerLeft}>
            <div style={styles.mark}>LP</div>
            <div>
              <h1 style={styles.title}>Prélèvements à domicile</h1>
              <p style={styles.subtitle}>Laboplus · Maarif et Ghandi</p>
            </div>
          </div>
          <div style={styles.headerRight}>
            <div style={styles.dateLabel}>{formatDateLong(dateKey)}</div>
            <div style={styles.syncRow}>
              <RefreshCw
                size={11}
                style={{
                  animation: saving ? "spin 0.8s linear infinite" : "none",
                  opacity: saving ? 1 : 0.4,
                }}
              />
              <span>
                {!connected
                  ? "Hors ligne — réessai…"
                  : saving
                  ? "Synchronisation…"
                  : "À jour pour toutes"}
              </span>
            </div>
          </div>
        </div>

        <button
          style={styles.teamBtn}
          onClick={function () {
            setTeamPanelOpen(true);
          }}
        >
          <Users size={15} />
          Gérer l'équipe ({nurseList.length})
        </button>

        <div style={styles.statsStrip}>
          <div style={styles.statItem}>
            <span style={styles.statNum}>{totalCount}</span>
            <span style={styles.statLabel}>prélèvements</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statItem}>
            <span style={Object.assign({}, styles.statNum, { color: "#16433B" })}>
              {doneCount}
            </span>
            <span style={styles.statLabel}>faits</span>
          </div>
          <div style={styles.statDivider} />
          <div style={styles.statItem}>
            <span
              style={Object.assign({}, styles.statNum, {
                color: unassignedCount > 0 ? "#C9402A" : "#16433B",
              })}
            >
              {unassignedCount}
            </span>
            <span style={styles.statLabel}>sans infirmière</span>
          </div>
        </div>

        {rows === null && <div style={styles.loadingBox}>Chargement du tableau partagé…</div>}

        {rows !== null && rows.length === 0 && (
          <div style={styles.emptyBox}>
            <Clock size={28} color="#9A8F7C" />
            <p style={styles.emptyTitle}>Aucun prélèvement pour aujourd'hui</p>
            <p style={styles.emptyText}>Ajoutez la première ligne dès qu'une demande arrive.</p>
          </div>
        )}

        {rows !== null && sortedRows.length > 0 && (
          <div style={styles.list}>
            {sortedRows.map(function (row) {
              return (
                <RowCard
                  key={row.id}
                  row={row}
                  nurseList={nurseList}
                  onChange={function (field, value) {
                    updateRow(row.id, field, value);
                  }}
                  onDelete={function () {
                    deleteRow(row.id);
                  }}
                  onAddNurse={addNurse}
                />
              );
            })}
          </div>
        )}

        {rows !== null && (
          <button style={styles.addBtn} onClick={addRow}>
            <Plus size={18} strokeWidth={2.5} />
            Ajouter un prélèvement
          </button>
        )}

        <p style={styles.footnote}>
          Le tableau se vide automatiquement à minuit. Toute l'équipe voit les mêmes données en
          direct.
        </p>
      </div>

      {teamPanelOpen && (
        <TeamPanel
          nurseList={nurseList}
          onAdd={addNurse}
          onRemove={removeNurse}
          onClose={function () {
            setTeamPanelOpen(false);
          }}
        />
      )}
    </div>
  );
}

function TeamPanel(props) {
  const [newName, setNewName] = useState("");

  function handleAdd() {
    if (newName.trim()) {
      props.onAdd(newName);
      setNewName("");
    }
  }

  return (
    <div style={styles.overlay} onClick={props.onClose}>
      <div
        style={styles.panel}
        onClick={function (e) {
          e.stopPropagation();
        }}
      >
        <div style={styles.panelHeader}>
          <h2 style={styles.panelTitle}>Équipe</h2>
          <button style={styles.closeBtn} onClick={props.onClose} aria-label="Fermer">
            <X size={18} />
          </button>
        </div>

        <p style={styles.panelHint}>
          Ajoutez ou retirez une infirmière. Les changements sont visibles par toute l'équipe
          immédiatement.
        </p>

        <div style={styles.nurseRows}>
          {props.nurseList.map(function (name) {
            return (
              <div key={name} style={styles.nurseRow}>
                <span style={styles.nurseRowName}>{name}</span>
                <button
                  style={styles.nurseRemoveBtn}
                  onClick={function () {
                    props.onRemove(name);
                  }}
                  aria-label={"Retirer " + name}
                >
                  <Trash2 size={14} />
                </button>
              </div>
            );
          })}
          {props.nurseList.length === 0 && (
            <p style={styles.emptyText}>Aucune infirmière dans la liste.</p>
          )}
        </div>

        <div style={styles.addNurseRow}>
          <input
            type="text"
            value={newName}
            onChange={function (e) {
              setNewName(e.target.value);
            }}
            
