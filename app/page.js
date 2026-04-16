"use client";

import { useEffect, useState } from "react";
import { initializeApp } from "firebase/app";
import { getAuth, signInWithPopup, GoogleAuthProvider } from "firebase/auth";
import {
  getFirestore,
  collection,
  addDoc,
  onSnapshot,
  updateDoc,
  doc,
  query,
  where,
  getDocs,
  deleteDoc
} from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBCRkE04fMllnu6-y_8dW5O3Zb2ZP2g1UI",
  authDomain: "padel-chaponost.firebaseapp.com",
  projectId: "padel-chaponost",
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export default function Home() {
  const [user, setUser] = useState(null);
  const [view, setView] = useState("menu");
  const [players, setPlayers] = useState([]);
  const [games, setGames] = useState([]);
  const [selectedDate, setSelectedDate] = useState("");
  const [selectedTime, setSelectedTime] = useState("");

  const timeSlots = Array.from({ length: 48 }, (_, i) => {
    const h = Math.floor(i / 2).toString().padStart(2, "0");
    const m = i % 2 === 0 ? "00" : "30";
    return `${h}:${m}`;
  });

  useEffect(() => {
    const unsubPlayers = onSnapshot(collection(db, "players"), snap => {
      setPlayers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    const unsubGames = onSnapshot(collection(db, "games"), snap => {
      setGames(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    });
    return () => { unsubPlayers(); unsubGames(); };
  }, []);

  const login = async () => {
    const provider = new GoogleAuthProvider();
    const res = await signInWithPopup(auth, provider);
    setUser(res.user);

    const q = query(collection(db, "players"), where("uid", "==", res.user.uid));
    const snapshot = await getDocs(q);
    if (snapshot.empty) {
      await addDoc(collection(db, "players"), {
        name: res.user.displayName,
        presencas: 0,
        faltas: 0,
        uid: res.user.uid
      });
    }
  };

  const createGame = async () => {
    if (!selectedDate || !selectedTime) return alert("Choisissez date et heure");
    const date = `${selectedDate}T${selectedTime}`;
    await addDoc(collection(db, "games"), {
      date,
      participants: [],
      selected: [],
      status: "open",
      createdBy: user.uid
    });
    setView("menu");
  };

  const joinGame = async (game) => {
    if (game.participants.includes(user.uid)) return;
    await updateDoc(doc(db, "games", game.id), {
      participants: [...game.participants, user.uid]
    });
  };

  const leaveGame = async (game) => {
    await updateDoc(doc(db, "games", game.id), {
      participants: game.participants.filter(p => p !== user.uid)
    });
  };

  const deleteGame = async (id) => {
    await deleteDoc(doc(db, "games", id));
  };

  const score = (p) => (p.presencas * 1.5) - (p.faltas * 2);

  const generateMatch = async (game) => {
    let interessados = players.filter(p => game.participants.includes(p.uid));
    interessados.sort((a, b) => score(a) - score(b));

    const selecionados = interessados.slice(0, 4);
    const selectedIds = selecionados.map(p => p.uid);

    await updateDoc(doc(db, "games", game.id), {
      status: "closed",
      selected: selectedIds
    });
  };

  const confirmGame = async (game) => {
    for (let uid of game.selected) {
      const player = players.find(p => p.uid === uid);
      await updateDoc(doc(db, "players", player.id), {
        presencas: player.presencas + 1
      });
    }

    await updateDoc(doc(db, "games", game.id), {
      status: "played"
    });
  };

  const cancelGame = async (game) => {
    await updateDoc(doc(db, "games", game.id), {
      status: "cancelled"
    });
  };

  const getPlayerName = (uid) => players.find(p => p.uid === uid)?.name || "?";

  const getChance = (game, uid) => {
    const participantes = players.filter(p => game.participants.includes(p.uid));
    if (participantes.length === 0) return 0;

    const scores = participantes.map(score);
    const min = Math.min(...scores);
    const max = Math.max(...scores);
    const current = score(players.find(p => p.uid === uid));

    if (max === min) return 100 / participantes.length;

    const normalized = (max - current) / (max - min);
    return Math.round(normalized * 100);
  };

  const styles = {
    container: { maxWidth: 420, margin: "0 auto", backgroundColor: "#f3f4f6", minHeight: "100vh" },
    content: { padding: 16 },
    button: {
      padding: 14,
      margin: "8px 0",
      borderRadius: 14,
      border: "none",
      background: "linear-gradient(135deg,#22c55e,#0ea5e9)",
      color: "#fff",
      fontWeight: 600,
      width: "100%",
      cursor: "pointer"
    },
    dangerButton: {
      padding: 14,
      margin: "8px 0",
      borderRadius: 14,
      border: "none",
      background: "#ef4444",
      color: "#fff",
      fontWeight: 600,
      width: "100%",
      cursor: "pointer"
    },
    card: {
      background: "#ffffff",
      borderRadius: 16,
      padding: 16,
      marginBottom: 12,
      color: "#111"
    },
    input: {
      width: "100%",
      padding: 12,
      marginBottom: 10,
      borderRadius: 10,
      border: "1px solid #ddd",
      background: "#fff",
      color: "#111"
    }
  };

  const header = (
    <div style={{ marginBottom: 10 }}>
      <div style={{ width: "100%", height: 180, overflow: "hidden" }}>
        <img src="/logo.png" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </div>
    </div>
  );

  if (!user) {
    return (
      <div style={styles.container}>
        {header}
        <div style={styles.content}>
          <button style={styles.button} onClick={login}>Connexion avec Google</button>
        </div>
      </div>
    );
  }

  if (view === "menu") {
    return (
      <div style={styles.container}>
        {header}
        <div style={styles.content}>
          <button style={styles.button} onClick={() => setView("create")}>Créer un match</button>
          <button style={styles.button} onClick={() => setView("join")}>Participer</button>
          <button style={styles.button} onClick={() => setView("users")}>Classement</button>
          <button style={styles.button} onClick={() => setView("rules")}>📜 Règles</button>
        </div>
      </div>
    );
  }

  if (view === "create") {
    return (
      <div style={styles.container}>
        {header}
        <div style={styles.content}>
          <input type="date" style={styles.input} onChange={e => setSelectedDate(e.target.value)} />
          <select style={styles.input} onChange={e => setSelectedTime(e.target.value)}>
            <option value="">Heure</option>
            {timeSlots.map(t => <option key={t}>{t}</option>)}
          </select>
          <button style={styles.button} onClick={createGame}>Créer</button>
          <button style={styles.button} onClick={() => setView("menu")}>Retour</button>
        </div>
      </div>
    );
  }

  if (view === "join") {
    return (
      <div style={styles.container}>
        {header}
        <div style={styles.content}>
          {games.filter(g => g.status === "open" || g.status === "closed").map(game => {
            const isIn = game.participants.includes(user.uid);

            return (
              <div key={game.id} style={styles.card}>
                <b>{new Date(game.date).toLocaleString()}</b>

                <div style={{ marginTop: 10 }}>
                  {game.participants.map(uid => {
                    const chance = getChance(game, uid);
                    return (
                      <div key={uid} style={{ marginBottom: 6 }}>
                        {getPlayerName(uid)} ({chance}%)
                        <div style={{ height: 6, background: "#ddd", borderRadius: 6 }}>
                          <div style={{ width: `${chance}%`, background: "#22c55e", height: "100%", borderRadius: 6 }} />
                        </div>
                      </div>
                    );
                  })}
                </div>

                {game.selected?.length > 0 && (
                  <div style={{ marginTop: 10 }}>
                    <b>🎯 Sélectionnés:</b>
                    {game.selected.map(uid => (
                      <div key={uid}>{getPlayerName(uid)}</div>
                    ))}
                  </div>
                )}

                {!isIn ? (
                  <button style={styles.button} onClick={() => joinGame(game)}>Participer</button>
                ) : (
                  <button style={styles.dangerButton} onClick={() => leaveGame(game)}>Annuler participation</button>
                )}

                {game.participants.length >= 4 && game.status === "open" && (
                  <button style={styles.button} onClick={() => generateMatch(game)}>🎯 Générer match</button>
                )}

                {game.status === "closed" && (
                  <>
                    <button style={styles.button} onClick={() => confirmGame(game)}>✅ Match joué</button>
                    <button style={styles.dangerButton} onClick={() => cancelGame(game)}>❌ Annuler match</button>
                  </>
                )}

                <button style={styles.dangerButton} onClick={() => deleteGame(game.id)}>🗑 Supprimer</button>
              </div>
            );
          })}

          <button style={styles.button} onClick={() => setView("menu")}>Retour</button>
        </div>
      </div>
    );
  }

  if (view === "users") {
    const uniquePlayers = Object.values(players.reduce((acc, p) => { acc[p.uid] = p; return acc; }, {}));
    const sorted = [...uniquePlayers].sort((a, b) => score(b) - score(a));

    return (
      <div style={styles.container}>
        {header}
        <div style={styles.content}>
          {sorted.map((p, i) => (
            <div key={p.uid} style={styles.card}>
              {i + 1}. {p.name}
              <br />Matchs joués: {p.presencas}
              <br />Score: {score(p).toFixed(1)}
            </div>
          ))}
          <button style={styles.button} onClick={() => setView("menu")}>Retour</button>
        </div>
      </div>
    );
  }

  if (view === "rules") {
    return (
      <div style={styles.container}>
        {header}
        <div style={styles.content}>
          <div style={styles.card}>
            <h3>📜 Règles de priorité</h3>
            <p>Le système sélectionne automatiquement 4 joueurs si nécessaire.</p>
            <p>🎯 Objectif: équilibre entre assiduité et justice.</p>
            <ul>
              <li>✔ Les joueurs assidus sont favorisés</li>
              <li>✔ Les joueurs laissés de côté gagnent en priorité</li>
            </ul>
            <p>Score = (matchs joués × 1.5) − (absences × 2)</p>
            <p>👉 Les 4 joueurs avec le score le plus bas sont sélectionnés</p>
            <p>👉 Les matchs comptent uniquement s'ils sont marqués comme réalisés</p>
          </div>
          <button style={styles.button} onClick={() => setView("menu")}>Retour</button>
        </div>
      </div>
    );
  }

  return null;
}
