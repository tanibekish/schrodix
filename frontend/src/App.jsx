import React, { useState, useEffect } from 'react';

const tg = window.Telegram.WebApp;
const BASE_URL = 'https://3e135c45baa7.ngrok-free.app'; // Твой адрес бэкенда

function App() {
  const [activeTab, setActiveTab] = useState('market');
  const [points, setPoints] = useState(0);
  const [events, setEvents] = useState([]);
  const [history, setHistory] = useState([]);
  const [leaderboard, setLeaderboard] = useState([]); // Состояние для таблицы лидеров
  const [loading, setLoading] = useState(false);

  // 1. Инициализация при входе
  useEffect(() => {
    tg.ready();
    tg.expand();
    fetchUserData();
    fetchEvents();
  }, []);

  // 2. Следим за переключением вкладок
  useEffect(() => {
    if (activeTab === 'profile') fetchHistory();
    if (activeTab === 'market') fetchEvents();
    if (activeTab === 'leaderboard') fetchLeaderboard();
  }, [activeTab]);

  // --- Функции запросов к бэкенду ---

  const fetchUserData = async () => {
    const userId = tg.initDataUnsafe?.user?.id || 0;
    const username = tg.initDataUnsafe?.user?.first_name || "Игрок"; // Берем имя из TG
    try {
      // Передаем имя в параметрах, чтобы бэкенд его сохранил/обновил
      const response = await fetch(`${BASE_URL}/user/${userId}?username=${username}`);
      if (response.ok) {
        const data = await response.json();
        setPoints(data.balance);
      }
    } catch (e) { console.error("Ошибка юзера:", e); }
  };

  const fetchEvents = async () => {
    try {
      const response = await fetch(`${BASE_URL}/events`);
      if (response.ok) {
        const data = await response.json();
        setEvents(data);
      }
    } catch (e) { console.error("Ошибка событий:", e); }
  };

  const fetchHistory = async () => {
    const userId = tg.initDataUnsafe?.user?.id || 0;
    try {
      const response = await fetch(`${BASE_URL}/user/${userId}/history`);
      if (response.ok) {
        const data = await response.json();
        setHistory(data);
      }
    } catch (e) { console.error("Ошибка истории:", e); }
  };

  const fetchLeaderboard = async () => {
    try {
      const response = await fetch(`${BASE_URL}/leaderboard`);
      if (response.ok) {
        const data = await response.json();
        setLeaderboard(data);
      }
    } catch (e) { console.error("Ошибка лидерборда:", e); }
  };

  const makePrediction = async (eventId, optionId, optionName) => {
    tg.HapticFeedback.impactOccurred('medium');
    if (points < 100) {
      tg.showAlert("Недостаточно $PRED! 🪙");
      return;
    }

    setLoading(true);
    try {
      const response = await fetch(`${BASE_URL}/predict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: tg.initDataUnsafe?.user?.id || 0,
          event_id: eventId,
          option_id: optionId
        })
      });

      if (response.ok) {
        const result = await response.json();
        setPoints(result.new_balance);
        tg.HapticFeedback.notificationOccurred('success');
        tg.showAlert(`Ставка на "${optionName}" принята!`);
      }
    } catch (e) {
      tg.HapticFeedback.notificationOccurred('error');
    } finally {
      setLoading(false);
    }
  };

  // --- Компоненты экранов ---

  const MarketScreen = () => (
    <div style={styles.screen}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Рынок событий ⚽️</h2>
      {events.length === 0 ? (
        <p style={{ textAlign: 'center', color: '#888' }}>Сейчас нет активных событий...</p>
      ) : (
        events.map((event) => (
          <div key={event.id} style={styles.card}>
            <h3 style={{ marginBottom: '15px' }}>{event.title}</h3>
            <div style={{ display: 'flex', gap: '10px' }}>
              {event.options.map((opt) => (
                <button 
                  key={opt.id}
                  onClick={() => makePrediction(event.id, opt.id, opt.name)}
                  disabled={loading}
                  style={opt.id === 1 ? styles.btnRed : styles.btnBlue}
                >
                  {opt.name}
                </button>
              ))}
            </div>
          </div>
        ))
      )}
    </div>
  );

  const LeaderboardScreen = () => (
    <div style={styles.screen}>
      <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Топ игроков 🏆</h2>
      <div style={styles.card}>
        {leaderboard.map((user, index) => (
          <div key={index} style={{ 
            display: 'flex', 
            justifyContent: 'space-between', 
            padding: '12px 0',
            borderBottom: index === leaderboard.length - 1 ? 'none' : '1px solid #333',
            alignItems: 'center'
          }}>
            <span style={{ color: index < 3 ? '#00d1ff' : '#fff', fontWeight: 'bold' }}>
              {index + 1}. {user.username}
            </span>
            <span style={{ fontWeight: 'bold', color: '#00d1ff' }}>{user.balance}</span>
          </div>
        ))}
      </div>
    </div>
  );

  const EarnScreen = () => (
    <div style={styles.screen}>
      <h2>Задания 💰</h2>
      <div style={styles.card}><p>Подписаться на канал (+100 $PRED)</p><button style={styles.btnSmall}>Выполнить</button></div>
      <div style={styles.card}><p>Пригласить 3 друзей (+500 $PRED)</p><button style={styles.btnSmall} disabled>0/3</button></div>
    </div>
  );

  const FriendsScreen = () => (
    <div style={styles.screen}>
      <h2>Друзья 🤝</h2>
      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <p>Приглашай друзей и получай бонусы!</p>
        <button onClick={() => tg.openTelegramLink(`https://t.me/share/url?url=https://t.me/твой_бот?start=${tg.initDataUnsafe?.user?.id}`)} style={styles.btnMain}>
          Пригласить друга
        </button>
      </div>
    </div>
  );

  const ProfileScreen = () => (
    <div style={styles.screen}>
      <h2>Профиль 👤</h2>
      <div style={styles.card}>
        <p style={{margin: '0 0 5px 0', color: '#888'}}>Ваш баланс:</p>
        <h1 style={{color: '#00d1ff', margin: 0}}>{points} $PRED</h1>
      </div>
      <h3 style={{ marginTop: '25px', marginBottom: '15px' }}>Ваши прогнозы</h3>
      {history.length === 0 ? <p style={{color: '#888'}}>Прогнозов пока нет</p> : history.map((item, index) => {
        const isWon = item.result === 'won';
        const isLost = item.result === 'lost';
        const statusColor = isWon ? '#4caf50' : isLost ? '#ff4b4b' : '#ffc107';
        return (
          <div key={index} style={{...styles.card, borderLeft: `4px solid ${statusColor}`}}>
            <div style={{fontSize: '14px', fontWeight: 'bold'}}>{item.event_title}</div>
            <div style={{display: 'flex', justifyContent: 'space-between', marginTop: '10px'}}>
              <span style={{fontSize: '12px', color: '#888'}}>Выбор: {item.chosen_option}</span>
              <span style={{fontSize: '12px', color: statusColor, fontWeight: 'bold'}}>
                {isWon ? 'Выигрыш +200' : isLost ? 'Проигрыш' : 'В игре'}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );

  return (
    <div style={styles.container}>
      <div style={{ paddingBottom: '80px' }}>
        {activeTab === 'market' && <MarketScreen />}
        {activeTab === 'leaderboard' && <LeaderboardScreen />}
        {activeTab === 'earn' && <EarnScreen />}
        {activeTab === 'friends' && <FriendsScreen />}
        {activeTab === 'profile' && <ProfileScreen />}
      </div>

      <nav style={styles.navBar}>
        <button onClick={() => setActiveTab('market')} style={{...styles.navItem, color: activeTab === 'market' ? '#00d1ff' : '#888'}}>
          🏠<br/>Market
        </button>
        <button onClick={() => setActiveTab('leaderboard')} style={{...styles.navItem, color: activeTab === 'leaderboard' ? '#00d1ff' : '#888'}}>
          🏆<br/>Top
        </button>
        <button onClick={() => setActiveTab('earn')} style={{...styles.navItem, color: activeTab === 'earn' ? '#00d1ff' : '#888'}}>
          💰<br/>Earn
        </button>
        <button onClick={() => setActiveTab('friends')} style={{...styles.navItem, color: activeTab === 'friends' ? '#00d1ff' : '#888'}}>
          👥<br/>Friends
        </button>
        <button onClick={() => setActiveTab('profile')} style={{...styles.navItem, color: activeTab === 'profile' ? '#00d1ff' : '#888'}}>
          👤<br/>Profile
        </button>
      </nav>
    </div>
  );
}

const styles = {
  container: { background: '#1a1a1a', minHeight: '100vh', color: 'white', fontFamily: 'sans-serif' },
  screen: { padding: '20px' },
  card: { background: '#252525', padding: '15px', borderRadius: '15px', marginBottom: '15px' },
  navBar: { position: 'fixed', bottom: 0, width: '100%', display: 'flex', justifyContent: 'space-around', background: '#111', padding: '10px 0', borderTop: '1px solid #333', zIndex: 100 },
  navItem: { background: 'none', border: 'none', fontSize: '10px', flex: 1, textAlign: 'center' },
  btnRed: { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: '#ff4b4b', color: 'white', fontWeight: 'bold' },
  btnBlue: { width: '100%', padding: '12px', borderRadius: '10px', border: 'none', background: '#4bafff', color: 'white', fontWeight: 'bold' },
  btnMain: { padding: '15px 30px', borderRadius: '12px', border: 'none', background: '#00d1ff', color: 'black', fontWeight: 'bold' },
  btnSmall: { padding: '8px 15px', borderRadius: '8px', border: 'none', background: '#444', color: '#00d1ff' }
};

export default App;