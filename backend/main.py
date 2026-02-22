import sqlite3
import datetime
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from sqladmin import Admin, ModelView
from sqlalchemy import create_engine, Column, Integer, String
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# --- 1. Настройка БД и SQLAlchemy (для Админки) ---
DATABASE_URL = "sqlite:///./database.db"
engine = create_engine(DATABASE_URL, connect_args={"check_same_thread": False})
Base = declarative_base()

class Event(Base):
    __tablename__ = "events"
    id = Column(Integer, primary_key=True, index=True)
    title = Column(String)
    option_1 = Column(String)
    option_2 = Column(String)
    status = Column(String, default="active")      # "active" или "finished"
    winner_option = Column(Integer, nullable=True) # 1 или 2

Base.metadata.create_all(bind=engine)

# --- 2. Инициализация FastAPI и Админки ---
app = FastAPI()

admin = Admin(app, engine)

class EventAdmin(ModelView, model=Event):
    column_list = [Event.id, Event.title, Event.status, Event.winner_option]
    name = "Событие"
    name_plural = "События"
    icon = "fa-solid fa-trophy"

admin.add_view(EventAdmin)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- 3. Инициализация таблиц через SQLite (для логики) ---
def init_db():
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    # Таблица пользователей
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS users (
            user_id INTEGER PRIMARY KEY,
            username TEXT,
            balance INTEGER DEFAULT 500,
            referred_by INTEGER
        )
    ''')
    # Таблица прогнозов
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS predictions (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            user_id INTEGER,
            event_id INTEGER,
            option_id INTEGER,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

init_db()

# --- 4. Модели данных ---
class PredictionRequest(BaseModel):
    user_id: int
    event_id: int
    option_id: int

# --- 5. Эндпоинты (Маршруты) ---

@app.get("/")
def home():
    return {"status": "ok", "message": "Prediction Market API is running"}

# Получение активных событий для маркета
@app.get("/events")
def get_events():
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    cursor.execute('SELECT id, title, option_1, option_2 FROM events WHERE status="active"')
    rows = cursor.fetchall()
    conn.close()
    
    events = []
    for row in rows:
        events.append({
            "id": row[0],
            "title": row[1],
            "options": [{"id": 1, "name": row[2]}, {"id": 2, "name": row[3]}]
        })
    return events

# Юзер и рефералы
@app.get("/user/{user_id}")
def get_user(user_id: int, username: str = "User", ref_id: int = None):
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    cursor.execute('SELECT balance FROM users WHERE user_id = ?', (user_id,))
    user = cursor.fetchone()
    
    if not user:
        # При регистрации сохраняем и имя
        cursor.execute('INSERT INTO users (user_id, username, balance, referred_by) VALUES (?, ?, ?, ?)', 
                       (user_id, username, 500, ref_id))
        conn.commit()
        balance = 500
    else:
        # Если юзер уже есть, обновим его имя (вдруг сменил в TG)
        cursor.execute('UPDATE users SET username = ? WHERE user_id = ?', (username, user_id))
        conn.commit()
        balance = user[0]
    
    conn.close()
    return {"user_id": user_id, "balance": balance}

# Создание прогноза
@app.post("/predict")
def make_prediction(data: PredictionRequest):
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    try:
        cursor.execute('SELECT balance FROM users WHERE user_id = ?', (data.user_id,))
        row = cursor.fetchone()
        balance = row[0] if row else 500
        
        if balance < 100:
            return {"status": "error", "message": "Insufficient balance"}
        
        new_balance = balance - 100
        cursor.execute('UPDATE users SET balance = ? WHERE user_id = ?', (new_balance, data.user_id))
        cursor.execute('INSERT INTO predictions (user_id, event_id, option_id) VALUES (?, ?, ?)', 
                       (data.user_id, data.event_id, data.option_id))
        conn.commit()
        return {"status": "success", "new_balance": new_balance}
    except Exception as e:
        return {"status": "error", "message": str(e)}
    finally:
        conn.close()

# История с результатами (Won/Lost)
@app.get("/user/{user_id}/history")
def get_user_history(user_id: int):
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    query = '''
        SELECT e.title, p.option_id, e.option_1, e.option_2, e.winner_option, e.status
        FROM predictions p
        JOIN events e ON p.event_id = e.id
        WHERE p.user_id = ?
        ORDER BY p.timestamp DESC
    '''
    cursor.execute(query, (user_id,))
    rows = cursor.fetchall()
    conn.close()
    
    history = []
    for row in rows:
        title, p_opt, opt1, opt2, winner, status = row
        chosen_option = opt1 if p_opt == 1 else opt2
        
        result = "pending"
        if status == "finished":
            result = "won" if p_opt == winner else "lost"
            
        history.append({
            "event_title": title,
            "chosen_option": chosen_option,
            "result": result
        })
    return history

# Закрытие матча и выплата выигрышей
@app.post("/admin/settle/{event_id}/{winner_id}")
def settle_event(event_id: int, winner_id: int):
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    
    # 1. Завершаем событие
    cursor.execute('UPDATE events SET status="finished", winner_option=? WHERE id=?', (winner_id, event_id))
    
    # 2. Начисляем выигрыш (например, 200 поинтов за победу)
    cursor.execute('SELECT user_id FROM predictions WHERE event_id = ? AND option_id = ?', (event_id, winner_id))
    winners = cursor.fetchall()
    
    for (user_id,) in winners:
        cursor.execute('UPDATE users SET balance = balance + 200 WHERE user_id = ?', (user_id,))
    
    conn.commit()
    conn.close()
    return {"status": "success", "winners_paid": len(winners)}

# Лидерборд
@app.get("/leaderboard")
def get_leaderboard():
    conn = sqlite3.connect('database.db')
    cursor = conn.cursor()
    # Берем Топ-10 по балансу
    cursor.execute('SELECT username, balance FROM users ORDER BY balance DESC LIMIT 10')
    rows = cursor.fetchall()
    conn.close()
    
    return [{"username": r[0], "balance": r[1]} for r in rows]