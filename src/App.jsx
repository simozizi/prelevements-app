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
  ChevronLeft,
  ChevronRight,
  CalendarDays,
} from "lucide-react";
import { db } from "./firebase.js";

const DEFAULT_NURSES = ["Meryem", "Sanaa", "Dounia", "Fatim Zahra", "Wiam", "Yasmine"];

const LABS = [
  { id: "maarif", name: "Laboplus Maarif" },
  { id: "ghandi", name: "Laboplus Ghandi" },
];

function dateToKey(date) {
  return (
    date.getFullYear() +
    "-" +
    String(date.getMonth() + 1).padStart(2, "0") +
    "-" +
    String(date.getDate()).padStart(2, "0")
  );
}

function keyToDate(key) {
  const parts = key.split("-").map(Number);
  return new Date(parts[0], parts[1] - 1, parts[2]);
}

function todayKey() {
  return dateToKey(new Date());
}

function addDays(key, n) {
  const d = keyToDate(key);
  d.setDate(d.getDate() + n);
  return dateToKey(d);
}

function formatDateLong(key) {
  const date = keyToDate(key);
  const str = date.toLocaleDateString("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
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
  const dateInputRef = useRef(null);

  const isToday = dateKey === todayKey();

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

  const goToPrevDay = function () {
    setDateKey(function (prev) {
      return addDays(prev, -1);
    });
  };

  const goToNextDay = function () {
    setDateKey(function (prev) {
      return addDays(prev, 1);
    });
  };

  const goToToday = function () {
    setDateKey(todayKey());
  };

  const openDatePicker = function () {
    if (dateInputRef.current) {
      if (dateInputRef.current.showPicker) {
        dateInputRef.current.showPicker();
      } else {
        dateInputRef.current.focus();
        dateInputRef.current.click();
      }
    }
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

        <div style={styles.dateNav}>
          <button style={styles.dateNavArrow} onClick={goToPrevDay} aria-label="Jour précédent">
            <ChevronLeft size={18} />
          </button>

          <button style={styles.dateNavCenter} onClick={openDatePicker}>
            <CalendarDays size={14} color="#9A8F7C" />
            <span style={styles.dateNavLabel}>{formatDateLong(dateKey)}</span>
          </button>

          <button style={styles.dateNavArrow} onClick={goToNextDay} aria-label="Jour suivant">
            <ChevronRight size={18} />
          </button>

          <input
            ref={dateInputRef}
            type="date"
            value={dateKey}
            onChange={function (e) {
              if (e.target.value) setDateKey(e.target.value);
            }}
            style={styles.hiddenDateInput}
          />
        </div>

        {!isToday && (
          <button style={styles.todayBtn} onClick={goToToday}>
            ↳ Revenir à aujourd'hui
          </button>
        )}

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
            <p style={styles.emptyTitle}>Aucun prélèvement {isToday ? "pour aujourd'hui" : "ce jour-là"}</p>
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
          Naviguez entre les jours avec les flèches ou la date. Rien n'est supprimé
          automatiquement — vous pouvez programmer à l'avance ou consulter l'historique.
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
            onKeyDown={function (e) {
              if (e.key === "Enter") handleAdd();
            }}
            placeholder="Nom de la nouvelle infirmière"
            style={styles.addNurseInput}
          />
          <button style={styles.addNurseBtn} onClick={handleAdd}>
            <Plus size={16} strokeWidth={2.5} />
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

function RowCard(props) {
  const row = props.row;
  const onChange = props.onChange;
  const onDelete = props.onDelete;
  const nurseList = props.nurseList;
  const onAddNurse = props.onAddNurse;

  const [addingNurse, setAddingNurse] = useState(false);
  const [newNurseName, setNewNurseName] = useState("");

  const labInfo = LABS.find(function (l) {
    return l.id === row.labo;
  });
  const isUnassigned = !row.infirmiere;

  function handleSelectChange(e) {
    const value = e.target.value;
    if (value === "__add_new__") {
      setAddingNurse(true);
      setNewNurseName("");
    } else {
      onChange("infirmiere", value);
    }
  }

  function confirmNewNurse() {
    const trimmed = newNurseName.trim();
    if (trimmed) {
      onAddNurse(trimmed);
      onChange("infirmiere", trimmed);
    }
    setAddingNurse(false);
    setNewNurseName("");
  }

  return (
    <div style={Object.assign({}, styles.card, row.fait ? styles.cardDone : {})}>
      <div style={styles.cardTopRow}>
        <div style={styles.heureWrap}>
          <Clock size={14} color="#9A8F7C" />
          <input
            type="time"
            value={row.heure}
            onChange={function (e) {
              onChange("heure", e.target.value);
            }}
            style={styles.timeInput}
          />
        </div>

        <button
          onClick={function () {
            onChange("fait", !row.fait);
          }}
          style={Object.assign({}, styles.doneToggle, row.fait ? styles.doneToggleActive : {})}
          aria-label={row.fait ? "Marquer non fait" : "Marquer fait"}
        >
          <Check size={15} strokeWidth={3} />
          {row.fait ? "Fait" : "À faire"}
        </button>
      </div>

      <div style={styles.fieldGroup}>
        <MapPin size={14} color="#9A8F7C" style={styles.fieldIcon} />
        <input
          type="text"
          placeholder="Patient / adresse"
          value={row.patient}
          onChange={function (e) {
            onChange("patient", e.target.value);
          }}
          style={styles.textInput}
        />
      </div>

      <div style={styles.fieldGroup}>
        <Phone size={14} color="#9A8F7C" style={styles.fieldIcon} />
        <input
          type="tel"
          placeholder="Téléphone"
          value={row.tel}
          onChange={function (e) {
            onChange("tel", e.target.value);
          }}
          style={styles.textInput}
        />
      </div>

      <div style={styles.bottomRow}>
        <div style={styles.selectWrap}>
          <Building2 size={13} color="#9A8F7C" />
          <select
            value={row.labo}
            onChange={function (e) {
              onChange("labo", e.target.value);
            }}
            style={Object.assign({}, styles.select, {
              color: labInfo ? (labInfo.id === "maarif" ? "#16433B" : "#C9402A") : "#B7AE9B",
            })}
          >
            <option value="">Labo…</option>
            {LABS.map(function (l) {
              return (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              );
            })}
          </select>
        </div>

        {!addingNurse && (
          <div
            style={Object.assign(
              {},
              styles.selectWrap,
              { flex: 1.4 },
              isUnassigned ? styles.selectWrapWarn : {}
            )}
          >
            <select
              value={row.infirmiere}
              onChange={handleSelectChange}
              style={Object.assign({}, styles.select, {
                fontWeight: 700,
                color: isUnassigned ? "#C9402A" : "#16433B",
              })}
            >
              <option value="">Assigner à…</option>
              {nurseList.map(function (n) {
                return (
                  <option key={n} value={n}>
                    {n}
                  </option>
                );
              })}
              <option value="__add_new__">+ Autre…</option>
            </select>
          </div>
        )}

        {addingNurse && (
          <div style={Object.assign({}, styles.selectWrap, { flex: 1.4, background: "#FFFFFF" })}>
            <input
              autoFocus
              type="text"
              value={newNurseName}
              onChange={function (e) {
                setNewNurseName(e.target.value);
              }}
              onKeyDown={function (e) {
                if (e.key === "Enter") confirmNewNurse();
                if (e.key === "Escape") setAddingNurse(false);
              }}
              onBlur={confirmNewNurse}
              placeholder="Nom…"
              style={Object.assign({}, styles.select, { fontWeight: 700 })}
            />
          </div>
        )}

        <button onClick={onDelete} style={styles.deleteBtn} aria-label="Supprimer">
          <Trash2 size={15} />
        </button>
      </div>
    </div>
  );
}

const fontImport =
  "@import url('https://fonts.googleapis.com/css2?family=Archivo:wght@500;700;800&family=DM+Mono:wght@400;500&display=swap');" +
  "@keyframes spin { from { transform: rotate(0deg); } to { transform: rotate(360deg); } }" +
  "* { box-sizing: border-box; }" +
  "body { margin: 0; }" +
  "input[type='time']::-webkit-calendar-picker-indicator { filter: invert(0.5); }";

const styles = {
  page: { minHeight: "100vh", background: "#F6F4EF", fontFamily: "'Archivo', sans-serif", padding: "20px 14px 60px" },
  wrap: { maxWidth: 520, margin: "0 auto" },
  header: { display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "3px solid #16433B", paddingBottom: 14, marginBottom: 14, gap: 12 },
  headerLeft: { display: "flex", alignItems: "center", gap: 12 },
  mark: { width: 42, height: 42, background: "#16433B", borderRadius: 9, display: "flex", alignItems: "center", justifyContent: "center", color: "#F6F4EF", fontWeight: 800, fontSize: 16, flexShrink: 0 },
  title: { fontSize: 19, fontWeight: 800, color: "#16433B", letterSpacing: "-0.2px", lineHeight: 1.15, margin: 0 },
  subtitle: { fontFamily: "'DM Mono', monospace", fontSize: 11, color: "#8A8170", marginTop: 2, textTransform: "uppercase", letterSpacing: "0.5px" },
  syncRow: { display: "flex", alignItems: "center", gap: 5, flexShrink: 0, fontFamily: "'DM Mono', monospace", fontSize: 10, color: "#9A8F7C" },
  dateNav: { display: "flex", alignItems: "center", gap: 8, marginBottom: 8, position: "relative" },
  dateNavArrow: { width: 36, height: 36, flexShrink: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "#FFFFFF", border: "1.5px solid #E5DFD0", borderRadius: 9, color: "#16433B", cursor: "pointer" },
  dateNavCenter: { flex: 1, display: "flex", alignItems: "center", justifyContent: "center", gap: 7, background: "#FFFFFF", border: "1.5px solid #E5DFD0", borderRadius: 10, padding: "9px 10px", cursor: "pointer" },
  dateNavLabel: { fontSize: 13.5, fontWeight: 700, color: "#16433B", fontFamily: "'Archivo', sans-serif" },
  hiddenDateInput: { position: "absolute", opacity: 0, width: 1, height: 1, pointerEvents: "none" },
  todayBtn: { width: "100%", textAlign: "center", background: "transparent", border: "none", color: "#C9402A", fontSize: 12.5, fontWeight: 700, padding: "2px 0 12px", cursor: "pointer", fontFamily: "'Archivo', sans-serif" },
  teamBtn: { display: "flex", alignItems: "center", justifyContent: "center", gap: 7, width: "100%", background: "#FFFFFF", border: "1.5px solid #E5DFD0", borderRadius: 10, padding: "10px", marginBottom: 14, fontSize: 13, fontWeight: 700, color: "#16433B", cursor: "pointer", fontFamily: "'Archivo', sans-serif" },
  statsStrip: { display: "flex", alignItems: "center", background: "#FFFFFF", border: "1.5px solid #E5DFD0", borderRadius: 12, padding: "12px 4px", marginBottom: 18 },
  statItem: { flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 2 },
  statNum: { fontSize: 20, fontWeight: 800, color: "#16433B", fontFamily: "'DM Mono', monospace" },
  statLabel: { fontSize: 10, color: "#9A8F7C", textTransform: "uppercase", letterSpacing: "0.4px" },
  statDivider: { width: 1.5, height: 28, background: "#E5DFD0" },
  loadingBox: { textAlign: "center", padding: "50px 20px", color: "#9A8F7C", fontFamily: "'DM Mono', monospace", fontSize: 13 },
  emptyBox: { textAlign: "center", padding: "40px 24px", background: "#FFFFFF", border: "1.5px dashed #D8D0BC", borderRadius: 14, marginBottom: 16 },
  emptyTitle: { fontSize: 14.5, fontWeight: 700, color: "#16433B", marginTop: 10 },
  emptyText: { fontSize: 12.5, color: "#9A8F7C", marginTop: 4 },
  list: { display: "flex", flexDirection: "column", gap: 12, marginBottom: 16 },
  card: { background: "#FFFFFF", border: "1.5px solid #E5DFD0", borderRadius: 14, padding: 14, transition: "background 0.2s, border-color 0.2s" },
  cardDone: { background: "#F0F4F0", borderColor: "#C7DBC9" },
  cardTopRow: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 },
  heureWrap: { display: "flex", alignItems: "center", gap: 6, background: "#F6F4EF", border: "1.5px solid #E5DFD0", borderRadius: 8, padding: "6px 10px" },
  timeInput: { border: "none", background: "transparent", fontFamily: "'DM Mono', monospace", fontSize: 14, fontWeight: 700, color: "#16433B", outline: "none", width: 76 },
  doneToggle: { display: "flex", alignItems: "center", gap: 5, border: "1.5px solid #D8D0BC", background: "#FFFFFF", color: "#9A8F7C", borderRadius: 20, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "'Archivo', sans-serif" },
  doneToggleActive: { background: "#16433B", borderColor: "#16433B", color: "#F6F4EF" },
  fieldGroup: { display: "flex", alignItems: "center", gap: 8, borderBottom: "1.5px solid #EDE8DA", padding: "8px 2px" },
  fieldIcon: { flexShrink: 0 },
  textInput: { flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "'DM Mono', monospace", fontSize: 14, color: "#2B2820" },
  bottomRow: { display: "flex", alignItems: "center", gap: 8, marginTop: 10 },
  selectWrap: { display: "flex", alignItems: "center", gap: 6, flex: 1, background: "#F6F4EF", border: "1.5px solid #E5DFD0", borderRadius: 8, padding: "7px 8px" },
  selectWrapWarn: { background: "#FBEDEA", borderColor: "#F0C5BA" },
  select: { flex: 1, border: "none", outline: "none", background: "transparent", fontFamily: "'Archivo', sans-serif", fontSize: 12.5, width: "100%" },
  deleteBtn: { flexShrink: 0, width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #E5DFD0", background: "#FFFFFF", color: "#B7AE9B", borderRadius: 8, cursor: "pointer" },
  addBtn: { width: "100%", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, background: "#16433B", color: "#F6F4EF", border: "none", borderRadius: 12, padding: "14px", fontSize: 14.5, fontWeight: 700, cursor: "pointer", fontFamily: "'Archivo', sans-serif" },
  footnote: { textAlign: "center", fontSize: 11.5, color: "#9A8F7C", marginTop: 16, lineHeight: 1.5, fontFamily: "'DM Mono', monospace" },
  overlay: { position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(22, 67, 59, 0.45)", display: "flex", alignItems: "flex-end", justifyContent: "center", zIndex: 50 },
  panel: { width: "100%", maxWidth: 520, background: "#F6F4EF", borderRadius: "20px 20px 0 0", padding: "22px 18px 28px", maxHeight: "80vh", overflowY: "auto" },
  panelHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  panelTitle: { fontSize: 18, fontWeight: 800, color: "#16433B", fontFamily: "'Archivo', sans-serif", margin: 0 },
  closeBtn: { width: 32, height: 32, display: "flex", alignItems: "center", justifyContent: "center", border: "none", background: "#E5DFD0", borderRadius: 8, color: "#16433B", cursor: "pointer" },
  panelHint: { fontSize: 12.5, color: "#8A8170", fontFamily: "'DM Mono', monospace", marginBottom: 16, lineHeight: 1.5 },
  nurseRows: { display: "flex", flexDirection: "column", gap: 8, marginBottom: 18 },
  nurseRow: { display: "flex", alignItems: "center", justifyContent: "space-between", background: "#FFFFFF", border: "1.5px solid #E5DFD0", borderRadius: 10, padding: "10px 12px" },
  nurseRowName: { fontSize: 14.5, fontWeight: 700, color: "#16433B", fontFamily: "'Archivo', sans-serif" },
  nurseRemoveBtn: { width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", border: "1.5px solid #F0C5BA", background: "#FBEDEA", borderRadius: 8, color: "#C9402A", cursor: "pointer" },
  addNurseRow: { display: "flex", gap: 8 },
  addNurseInput: { flex: 1, border: "1.5px solid #E5DFD0", background: "#FFFFFF", borderRadius: 10, padding: "10px 12px", fontSize: 14, fontFamily: "'DM Mono', monospace", color: "#2B2820", outline: "none" },
  addNurseBtn: { display: "flex", alignItems: "center", gap: 5, background: "#16433B", color: "#F6F4EF", border: "none", borderRadius: 10, padding: "10px 14px", fontSize: 13, fontWeight: 700, cursor: "pointer", fontFamily: "'Archivo', sans-serif", flexShrink: 0 },
};
